import { describe, it, expect } from "vitest";
import { queryImages, extractFilename, extractExtension, getUniqueExtensions } from "../src/imageManager/imageQuery";
import type { R2Object } from "../src/r2";

describe("imageQuery", () => {
  const mockImages: R2Object[] = [
    {
      key: "drig-images/2024-01-01-abc123.png",
      size: 1024 * 1024,
      lastModified: new Date("2024-01-01T00:00:00Z"),
      url: "https://example.com/image1.png"
    },
    {
      key: "drig-images/2024-01-02-def456.jpg",
      size: 2 * 1024 * 1024,
      lastModified: new Date("2024-01-02T00:00:00Z"),
      url: "https://example.com/image2.jpg"
    },
    {
      key: "drig-images/screenshot-test.png",
      size: 512 * 1024,
      lastModified: new Date("2024-01-03T00:00:00Z"),
      url: "https://example.com/image3.png"
    }
  ];

  describe("queryImages", () => {
    it("should return all images when no filters applied", () => {
      const result = queryImages(mockImages, {});
      expect(result).toHaveLength(3);
    });

    it("should filter by keyword", () => {
      const result = queryImages(mockImages, { keyword: "screenshot" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toContain("screenshot");
    });

    it("should filter by keyword case-insensitively", () => {
      const result = queryImages(mockImages, { keyword: "SCREENSHOT" });
      expect(result).toHaveLength(1);
    });

    it("should filter by extension", () => {
      const result = queryImages(mockImages, { extension: "png" });
      expect(result).toHaveLength(2);
    });

    it("should filter by extension case-insensitively", () => {
      const result = queryImages(mockImages, { extension: "PNG" });
      expect(result).toHaveLength(2);
    });

    it("should sort by lastModified descending", () => {
      const result = queryImages(mockImages, {
        sortField: "lastModified",
        sortDirection: "desc"
      });

      expect(result[0].key).toContain("screenshot");
      expect(result[2].key).toContain("abc123");
    });

    it("should sort by lastModified ascending", () => {
      const result = queryImages(mockImages, {
        sortField: "lastModified",
        sortDirection: "asc"
      });

      expect(result[0].key).toContain("abc123");
      expect(result[2].key).toContain("screenshot");
    });

    it("should sort by size descending", () => {
      const result = queryImages(mockImages, {
        sortField: "size",
        sortDirection: "desc"
      });

      expect(result[0].size).toBe(2 * 1024 * 1024);
      expect(result[2].size).toBe(512 * 1024);
    });

    it("should sort by size ascending", () => {
      const result = queryImages(mockImages, {
        sortField: "size",
        sortDirection: "asc"
      });

      expect(result[0].size).toBe(512 * 1024);
      expect(result[2].size).toBe(2 * 1024 * 1024);
    });

    it("should sort by name", () => {
      const result = queryImages(mockImages, {
        sortField: "name",
        sortDirection: "asc"
      });

      const filenames = result.map(img => extractFilename(img.key));
      expect(filenames[0]).toBe("2024-01-01-abc123.png");
      expect(filenames[1]).toBe("2024-01-02-def456.jpg");
      expect(filenames[2]).toBe("screenshot-test.png");
    });

    it("should combine keyword filter and sorting", () => {
      const result = queryImages(mockImages, {
        keyword: "2024",
        sortField: "size",
        sortDirection: "desc"
      });

      expect(result).toHaveLength(2);
      expect(result[0].size).toBe(2 * 1024 * 1024);
    });

    it("should not mutate original array", () => {
      const original = [...mockImages];
      queryImages(mockImages, { sortField: "size", sortDirection: "desc" });
      expect(mockImages).toEqual(original);
    });
  });

  describe("extractFilename", () => {
    it("should extract filename from key", () => {
      expect(extractFilename("drig-images/test.png")).toBe("test.png");
      expect(extractFilename("folder/subfolder/image.jpg")).toBe("image.jpg");
    });

    it("should return key if no slash", () => {
      expect(extractFilename("test.png")).toBe("test.png");
    });
  });

  describe("extractExtension", () => {
    it("should extract extension from key", () => {
      expect(extractExtension("drig-images/test.png")).toBe("png");
      expect(extractExtension("image.jpg")).toBe("jpg");
    });

    it("should return empty string if no extension", () => {
      expect(extractExtension("noextension")).toBe("");
    });

    it("should handle multiple dots", () => {
      expect(extractExtension("file.name.with.dots.png")).toBe("png");
    });
  });

  describe("getUniqueExtensions", () => {
    it("should return unique extensions sorted", () => {
      const extensions = getUniqueExtensions(mockImages);
      expect(extensions).toEqual(["jpg", "png"]);
    });

    it("should return empty array for empty input", () => {
      const extensions = getUniqueExtensions([]);
      expect(extensions).toEqual([]);
    });

    it("should handle case-insensitively", () => {
      const images: R2Object[] = [
        { ...mockImages[0], key: "test.PNG" },
        { ...mockImages[1], key: "test.png" }
      ];
      const extensions = getUniqueExtensions(images);
      expect(extensions).toEqual(["png"]);
    });
  });
});
