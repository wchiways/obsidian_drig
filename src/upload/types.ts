export type UploadTaskStatus =
  | "queued"
  | "prechecking"
  | "uploading"
  | "retry_waiting"
  | "success"
  | "failed"
  | "cancelled";

export type PrecheckErrorCode =
  | "CONFIG_MISSING"
  | "OFFLINE"
  | "UNSUPPORTED_MIME"
  | "FILE_TOO_LARGE"
  | "SIGNATURE_KEY_INVALID"
  | "UNKNOWN_PRECHECK";

export type UploadErrorCode =
  | PrecheckErrorCode
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "UNKNOWN_ERROR";

export interface UploadError {
  code: UploadErrorCode;
  message: string;
  retryable: boolean;
  httpStatus?: number;
  details?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
  durationMs: number;
}

export interface UploadTask {
  id: string;
  order: number;
  file: File;
  status: UploadTaskStatus;
  attempt: number;
  error?: UploadError;
  result?: UploadResult;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface UploadQueueState {
  tasks: Map<string, UploadTask>;
  pendingIds: string[];
  runningIds: string[];
  completedIds: string[];
  failedIds: string[];
}

export interface QueueSummary {
  total: number;
  success: number;
  failed: number;
  cancelled: number;
  results: UploadResult[];
  errors: UploadError[];
}

export interface PrecheckResult {
  ok: boolean;
  error?: UploadError;
}

export type CopyFormat = "markdown" | "url" | "html";

export interface CopyContext {
  url: string;
  key: string;
  filename: string;
  size: number;
  lastModified: Date;
  alt?: string;
  title?: string;
}
