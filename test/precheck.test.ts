import { describe, it, expect, beforeEach } from "vitest";
import { precheckUpload } from "../src/upload/precheck";
import type { DrigSettings } from "../src/types";
import { DEFAULT_SETTINGS } from "../src/types";

describe("precheck", () => {
  let settings: DrigSettings;

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    settings.accountId = "test-account";
    settings.bucketName = "test-bucket";
    settings.accessKeyId = "test-access-key";
    settings.secretAccessKey = "test-secret-key";
  });

  describe("precheckUpload", () => {
    it("should pass with valid configuration and file", () => {
      const file = new File(["test"], "test.png", { type: "image/png" });
      const result = precheckUpload(file, settings);

      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should fail with missing configuration", () => {
      settings.accountId = "";
      const file = new File(["test"], "test.png", { type: "image/png" });
      const result = precheckUpload(file, settings);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("CONFIG_MISSING");
      expect(result.error?.retryable).toBe(false);
    });

    it("should fail with unsupported MIME type", () => {
      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      const result = precheckUpload(file, settings);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("UNSUPPORTED_MIME");
      expect(result.error?.retryable).toBe(false);
    });

    it("should fail with file too large", () => {
      const largeData = new Uint8Array(11 * 1024 * 1024); // 11MB
      const file = new File([largeData], "large.png", { type: "image/png" });
      const result = precheckUpload(file, settings);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("FILE_TOO_LARGE");
      expect(result.error?.retryable).toBe(false);
    });

    it("should fail with invalid signature key when signature enabled", () => {
      settings.enableSignature = true;
      settings.signatureKey = "short"; // Less than 16 characters
      const file = new File(["test"], "test.png", { type: "image/png" });
      const result = precheckUpload(file, settings);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("SIGNATURE_KEY_INVALID");
      expect(result.error?.retryable).toBe(false);
    });

    it("should pass with valid signature key", () => {
      settings.enableSignature = true;
      settings.signatureKey = "valid-signature-key-16chars";
      const file = new File(["test"], "test.png", { type: "image/png" });
      const result = precheckUpload(file, settings);

      expect(result.ok).toBe(true);
    });

    it("should support all image MIME types", () => {
      const mimeTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/svg+xml"
      ];

      mimeTypes.forEach((mimeType) => {
        const file = new File(["test"], `test.${mimeType.split("/")[1]}`, { type: mimeType });
        const result = precheckUpload(file, settings);
        expect(result.ok).toBe(true);
      });
    });
  });
});
