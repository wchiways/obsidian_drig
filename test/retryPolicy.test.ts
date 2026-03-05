import { describe, it, expect } from "vitest";
import { shouldRetry, computeRetryDelay, classifyError } from "../src/upload/retryPolicy";
import type { UploadError } from "../src/upload/types";

describe("retryPolicy", () => {
  describe("shouldRetry", () => {
    it("should not retry if max attempts exceeded", () => {
      const error: UploadError = {
        code: "NETWORK_ERROR",
        message: "Network failed",
        retryable: true
      };

      expect(shouldRetry(error, 3, 2)).toBe(false);
    });

    it("should not retry if error is not retryable", () => {
      const error: UploadError = {
        code: "CONFIG_MISSING",
        message: "Config missing",
        retryable: false
      };

      expect(shouldRetry(error, 1, 3)).toBe(false);
    });

    it("should retry if attempts within limit and error is retryable", () => {
      const error: UploadError = {
        code: "NETWORK_ERROR",
        message: "Network failed",
        retryable: true
      };

      expect(shouldRetry(error, 1, 3)).toBe(true);
      expect(shouldRetry(error, 2, 3)).toBe(true);
    });
  });

  describe("computeRetryDelay", () => {
    it("should compute exponential backoff", () => {
      const baseMs = 1000;
      const maxMs = 10000;

      const delay1 = computeRetryDelay(1, baseMs, maxMs);
      const delay2 = computeRetryDelay(2, baseMs, maxMs);
      const delay3 = computeRetryDelay(3, baseMs, maxMs);

      // First attempt: ~1000ms (with jitter 0.7-1.3)
      expect(delay1).toBeGreaterThanOrEqual(700);
      expect(delay1).toBeLessThanOrEqual(1300);

      // Second attempt: ~2000ms (with jitter)
      expect(delay2).toBeGreaterThanOrEqual(1400);
      expect(delay2).toBeLessThanOrEqual(2600);

      // Third attempt: ~4000ms (with jitter)
      expect(delay3).toBeGreaterThanOrEqual(2800);
      expect(delay3).toBeLessThanOrEqual(5200);
    });

    it("should cap delay at maxMs", () => {
      const baseMs = 1000;
      const maxMs = 5000;

      const delay = computeRetryDelay(10, baseMs, maxMs);

      // Should be capped at maxMs with jitter
      expect(delay).toBeLessThanOrEqual(maxMs * 1.3);
    });

    it("should add jitter to prevent thundering herd", () => {
      const baseMs = 1000;
      const maxMs = 10000;
      const delays: number[] = [];

      // Generate multiple delays for same attempt
      for (let i = 0; i < 10; i++) {
        delays.push(computeRetryDelay(1, baseMs, maxMs));
      }

      // Check that delays are different (jitter working)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe("classifyError", () => {
    it("should classify network errors as retryable", () => {
      const error = new Error("Network request failed");
      const classified = classifyError(error);

      expect(classified.code).toBe("NETWORK_ERROR");
      expect(classified.retryable).toBe(true);
    });

    it("should classify timeout errors as retryable", () => {
      const error = new Error("Request timeout");
      const classified = classifyError(error);

      expect(classified.code).toBe("TIMEOUT");
      expect(classified.retryable).toBe(true);
    });

    it("should classify HTTP 429 as retryable", () => {
      const error = new Error("Too many requests");
      const classified = classifyError(error, 429);

      expect(classified.code).toBe("HTTP_ERROR");
      expect(classified.retryable).toBe(true);
      expect(classified.httpStatus).toBe(429);
    });

    it("should classify HTTP 5xx as retryable", () => {
      const error = new Error("Server error");
      const classified = classifyError(error, 500);

      expect(classified.code).toBe("HTTP_ERROR");
      expect(classified.retryable).toBe(true);
      expect(classified.httpStatus).toBe(500);
    });

    it("should classify HTTP 4xx (except 429) as not retryable", () => {
      const error = new Error("Bad request");
      const classified = classifyError(error, 400);

      expect(classified.code).toBe("HTTP_ERROR");
      expect(classified.retryable).toBe(false);
      expect(classified.httpStatus).toBe(400);
    });

    it("should classify unknown errors as not retryable", () => {
      const error = new Error("Unknown error");
      const classified = classifyError(error);

      expect(classified.code).toBe("UNKNOWN_ERROR");
      expect(classified.retryable).toBe(false);
    });
  });
});
