import type { UploadError } from "./types";

export function shouldRetry(error: UploadError, attempt: number, maxRetry: number): boolean {
  // Exceeded max retry attempts
  if (attempt >= maxRetry) {
    return false;
  }

  // Only retry if error is marked as retryable
  return error.retryable;
}

export function computeRetryDelay(attempt: number, baseMs: number, maxMs: number): number {
  // Exponential backoff: baseMs * 2^(attempt-1)
  const exponentialDelay = baseMs * Math.pow(2, attempt - 1);

  // Cap at maxMs
  const cappedDelay = Math.min(exponentialDelay, maxMs);

  // Add jitter (0.7 ~ 1.3)
  const jitter = 0.7 + Math.random() * 0.6;

  return Math.floor(cappedDelay * jitter);
}

export function classifyError(error: Error | unknown, httpStatus?: number): UploadError {
  const message = error instanceof Error ? error.message : String(error);

  // Network errors
  if (message.includes("Network request failed") || message.includes("Failed to fetch")) {
    return {
      code: "NETWORK_ERROR",
      message: "网络请求失败",
      retryable: true,
      details: message
    };
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("Timeout")) {
    return {
      code: "TIMEOUT",
      message: "请求超时",
      retryable: true,
      details: message
    };
  }

  // HTTP errors
  if (httpStatus !== undefined) {
    // 429 Too Many Requests - retryable
    if (httpStatus === 429) {
      return {
        code: "HTTP_ERROR",
        message: "请求过于频繁",
        retryable: true,
        httpStatus,
        details: "服务器限流，请稍后重试"
      };
    }

    // 5xx Server errors - retryable
    if (httpStatus >= 500) {
      return {
        code: "HTTP_ERROR",
        message: "服务器错误",
        retryable: true,
        httpStatus,
        details: `HTTP ${httpStatus}`
      };
    }

    // 4xx Client errors (except 429) - not retryable
    if (httpStatus >= 400) {
      return {
        code: "HTTP_ERROR",
        message: "请求错误",
        retryable: false,
        httpStatus,
        details: `HTTP ${httpStatus}`
      };
    }
  }

  // Unknown errors - not retryable by default
  return {
    code: "UNKNOWN_ERROR",
    message: "未知错误",
    retryable: false,
    details: message
  };
}
