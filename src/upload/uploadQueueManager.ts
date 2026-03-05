import type { DrigSettings } from "../types";
import type {
  UploadTask,
  UploadQueueState,
  QueueSummary,
  UploadResult,
  UploadError
} from "./types";
import { precheckUpload } from "./precheck";
import { shouldRetry, computeRetryDelay, classifyError } from "./retryPolicy";
import { AdaptiveConcurrencyController } from "./concurrencyController";
import { uploadImageToR2 } from "../r2";

type StateListener = (state: UploadQueueState) => void;

export class UploadQueueManager {
  private settings: DrigSettings;
  private state: UploadQueueState;
  private listeners: StateListener[] = [];
  private concurrencyController: AdaptiveConcurrencyController;
  private isRunning: boolean = false;
  private taskIdCounter: number = 0;

  constructor(settings: DrigSettings) {
    this.settings = settings;
    this.state = {
      tasks: new Map(),
      pendingIds: [],
      runningIds: [],
      completedIds: [],
      failedIds: []
    };
    this.concurrencyController = new AdaptiveConcurrencyController(
      settings.uploadConcurrency,
      4, // maxConcurrency
      settings.degradeFailureThreshold,
      settings.degradeCooldownMs
    );
  }

  enqueue(files: File[]): string[] {
    const taskIds: string[] = [];

    files.forEach((file, index) => {
      const taskId = this.generateTaskId();
      const task: UploadTask = {
        id: taskId,
        order: index,
        file,
        status: "queued",
        attempt: 0,
        createdAt: Date.now()
      };

      this.state.tasks.set(taskId, task);
      this.state.pendingIds.push(taskId);
      taskIds.push(taskId);
    });

    this.notifyListeners();
    return taskIds;
  }

  async start(): Promise<QueueSummary> {
    if (this.isRunning) {
      throw new Error("Queue is already running");
    }

    this.isRunning = true;

    try {
      // Process all pending tasks
      const promises = this.state.pendingIds.map((taskId) =>
        this.processTask(taskId)
      );

      await Promise.all(promises);

      return this.generateSummary();
    } finally {
      this.isRunning = false;
    }
  }

  async retryTask(taskId: string): Promise<void> {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== "failed") {
      throw new Error(`Task ${taskId} is not in failed state`);
    }

    // Reset task state
    task.status = "queued";
    task.attempt = 0;
    task.error = undefined;
    task.startedAt = undefined;
    task.finishedAt = undefined;

    // Move from failed to pending
    this.state.failedIds = this.state.failedIds.filter((id) => id !== taskId);
    this.state.pendingIds.push(taskId);

    this.notifyListeners();

    // Process the task
    await this.processTask(taskId);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  cancelAll(): void {
    // Mark all pending and running tasks as cancelled
    [...this.state.pendingIds, ...this.state.runningIds].forEach((taskId) => {
      const task = this.state.tasks.get(taskId);
      if (task) {
        task.status = "cancelled";
        task.finishedAt = Date.now();
      }
    });

    this.state.pendingIds = [];
    this.state.runningIds = [];
    this.isRunning = false;

    this.notifyListeners();
  }

  private async processTask(taskId: string): Promise<void> {
    const task = this.state.tasks.get(taskId);
    if (!task) return;

    // Acquire concurrency slot
    await this.concurrencyController.acquire();

    try {
      // Move to running
      this.moveTaskToRunning(taskId);

      // Precheck
      task.status = "prechecking";
      this.notifyListeners();

      const precheckResult = precheckUpload(task.file, this.settings);
      if (!precheckResult.ok) {
        task.error = precheckResult.error;
        this.moveTaskToFailed(taskId);
        this.concurrencyController.reportFailure(precheckResult.error!);
        return;
      }

      // Upload with retry
      await this.uploadWithRetry(task);
    } finally {
      this.concurrencyController.release();
    }
  }

  private async uploadWithRetry(task: UploadTask): Promise<void> {
    while (true) {
      task.attempt++;
      task.status = "uploading";
      task.startedAt = Date.now();
      this.notifyListeners();

      try {
        const startTime = Date.now();
        const url = await uploadImageToR2(task.file, this.settings);
        const durationMs = Date.now() - startTime;

        // Success
        task.result = {
          url,
          key: this.extractKeyFromUrl(url),
          contentType: task.file.type,
          size: task.file.size,
          durationMs
        };
        task.status = "success";
        task.finishedAt = Date.now();

        this.moveTaskToCompleted(task.id);
        this.concurrencyController.reportSuccess();
        return;
      } catch (error) {
        // Classify error
        const httpStatus = this.extractHttpStatus(error);
        const uploadError = classifyError(error, httpStatus);
        task.error = uploadError;

        // Check if should retry
        if (shouldRetry(uploadError, task.attempt, this.settings.maxRetryAttempts)) {
          // Wait before retry
          task.status = "retry_waiting";
          this.notifyListeners();

          const delay = computeRetryDelay(
            task.attempt,
            this.settings.retryBaseDelayMs,
            this.settings.retryMaxDelayMs
          );
          await this.sleep(delay);

          this.concurrencyController.reportFailure(uploadError);
          // Continue to next retry
        } else {
          // Final failure
          task.status = "failed";
          task.finishedAt = Date.now();
          this.moveTaskToFailed(task.id);
          this.concurrencyController.reportFailure(uploadError);
          return;
        }
      }
    }
  }

  private moveTaskToRunning(taskId: string): void {
    this.state.pendingIds = this.state.pendingIds.filter((id) => id !== taskId);
    this.state.runningIds.push(taskId);
    this.notifyListeners();
  }

  private moveTaskToCompleted(taskId: string): void {
    this.state.runningIds = this.state.runningIds.filter((id) => id !== taskId);
    this.state.completedIds.push(taskId);
    this.notifyListeners();
  }

  private moveTaskToFailed(taskId: string): void {
    this.state.runningIds = this.state.runningIds.filter((id) => id !== taskId);
    this.state.failedIds.push(taskId);
    this.notifyListeners();
  }

  private generateSummary(): QueueSummary {
    const results: UploadResult[] = [];
    const errors: UploadError[] = [];
    let cancelled = 0;

    this.state.tasks.forEach((task) => {
      if (task.status === "success" && task.result) {
        results.push(task.result);
      } else if (task.status === "failed" && task.error) {
        errors.push(task.error);
      } else if (task.status === "cancelled") {
        cancelled++;
      }
    });

    return {
      total: this.state.tasks.size,
      success: this.state.completedIds.length,
      failed: this.state.failedIds.length,
      cancelled,
      results,
      errors
    };
  }

  private notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach((listener) => listener(stateCopy));
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${this.taskIdCounter++}`;
  }

  private extractKeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split("/");
      return parts[parts.length - 1] || "";
    } catch {
      return "";
    }
  }

  private extractHttpStatus(error: unknown): number | undefined {
    if (error instanceof Error) {
      const match = error.message.match(/HTTP (\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
