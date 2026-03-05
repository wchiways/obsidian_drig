import type { DrigSettings } from "../types";
import type { PrecheckResult, UploadError } from "./types";

const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml"
]);

export function precheckUpload(file: File, settings: DrigSettings): PrecheckResult {
  // Check 1: Configuration completeness
  if (!settings.accountId || !settings.bucketName || !settings.accessKeyId || !settings.secretAccessKey) {
    return {
      ok: false,
      error: {
        code: "CONFIG_MISSING",
        message: "R2 配置不完整",
        retryable: false,
        details: "请在设置中配置 Account ID、Bucket Name、Access Key ID 和 Secret Access Key"
      }
    };
  }

  // Check 2: Online status
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      error: {
        code: "OFFLINE",
        message: "网络离线",
        retryable: true,
        details: "请检查网络连接后重试"
      }
    };
  }

  // Check 3: MIME type whitelist
  if (!SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_MIME",
        message: "不支持的文件格式",
        retryable: false,
        details: `当前格式: ${file.type || "未知"}，支持的格式: png, jpg, webp, gif, bmp, svg`
      }
    };
  }

  // Check 4: File size limit
  const maxSizeBytes = settings.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      ok: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: "文件大小超过限制",
        retryable: false,
        details: `当前大小: ${(file.size / 1024 / 1024).toFixed(2)}MB，限制: ${settings.maxFileSizeMb}MB`
      }
    };
  }

  // Check 5: Signature key validity (if enabled)
  if (settings.enableSignature) {
    if (!settings.signatureKey || settings.signatureKey.length < 16) {
      return {
        ok: false,
        error: {
          code: "SIGNATURE_KEY_INVALID",
          message: "签名密钥无效",
          retryable: false,
          details: "签名密钥长度必须至少 16 个字符"
        }
      };
    }
  }

  return { ok: true };
}

export function createUploadError(
  code: UploadError["code"],
  message: string,
  retryable: boolean,
  details?: string,
  httpStatus?: number
): UploadError {
  return {
    code,
    message,
    retryable,
    details,
    httpStatus
  };
}
