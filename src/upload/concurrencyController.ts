import type { UploadError } from "./types";

interface WaitingTask {
  resolve: () => void;
}

export class AdaptiveConcurrencyController {
  private defaultConcurrency: number;
  private maxConcurrency: number;
  private degradedConcurrency: number;
  private degradeFailureThreshold: number;
  private degradeCooldownMs: number;

  private currentConcurrency: number;
  private availableSlots: number;
  private waitingQueue: WaitingTask[] = [];

  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private degradedUntil: number = 0;
  private isDegraded: boolean = false;

  constructor(
    defaultConcurrency: number = 2,
    maxConcurrency: number = 4,
    degradeFailureThreshold: number = 2,
    degradeCooldownMs: number = 30000
  ) {
    this.defaultConcurrency = Math.max(1, defaultConcurrency);
    this.maxConcurrency = Math.max(this.defaultConcurrency, maxConcurrency);
    this.degradedConcurrency = 1;
    this.degradeFailureThreshold = Math.max(1, degradeFailureThreshold);
    this.degradeCooldownMs = degradeCooldownMs;

    this.currentConcurrency = this.defaultConcurrency;
    this.availableSlots = this.currentConcurrency;
  }

  async acquire(): Promise<void> {
    // Check if we should exit degraded mode
    this.checkDegradedMode();

    if (this.availableSlots > 0) {
      this.availableSlots--;
      return Promise.resolve();
    }

    // Wait in queue
    return new Promise<void>((resolve) => {
      this.waitingQueue.push({ resolve });
    });
  }

  release(): void {
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        waiting.resolve();
      }
    } else {
      this.availableSlots++;
    }
  }

  reportSuccess(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;

    // If in degraded mode and have enough consecutive successes, consider recovery
    if (this.isDegraded && this.consecutiveSuccesses >= 3) {
      const now = Date.now();
      if (now >= this.degradedUntil) {
        this.recoverFromDegradedMode();
      }
    }
  }

  reportFailure(error: UploadError): void {
    this.consecutiveSuccesses = 0;

    // Only count retryable errors for degradation
    if (error.retryable) {
      this.consecutiveFailures++;

      // Check if we should degrade
      if (!this.isDegraded && this.consecutiveFailures >= this.degradeFailureThreshold) {
        this.enterDegradedMode();
      }
    }
  }

  getCurrentConcurrency(): number {
    return this.currentConcurrency;
  }

  private enterDegradedMode(): void {
    this.isDegraded = true;
    this.degradedUntil = Date.now() + this.degradeCooldownMs;
    this.currentConcurrency = this.degradedConcurrency;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;

    // Adjust available slots (but don't go negative)
    const slotsInUse = this.defaultConcurrency - this.availableSlots;
    this.availableSlots = Math.max(0, this.degradedConcurrency - slotsInUse);
  }

  private recoverFromDegradedMode(): void {
    this.isDegraded = false;
    this.currentConcurrency = this.defaultConcurrency;
    this.consecutiveSuccesses = 0;

    // Restore available slots
    const slotsInUse = this.degradedConcurrency - this.availableSlots;
    this.availableSlots = Math.max(0, this.defaultConcurrency - slotsInUse);
  }

  private checkDegradedMode(): void {
    if (this.isDegraded) {
      const now = Date.now();
      if (now >= this.degradedUntil && this.consecutiveSuccesses >= 3) {
        this.recoverFromDegradedMode();
      }
    }
  }
}
