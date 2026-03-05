import { describe, it, expect } from "vitest";
import { renderCopyTemplate } from "../src/clipboard/formatTemplate";
import type { CopyContext } from "../src/upload/types";
import { DEFAULT_SETTINGS } from "../src/types";

describe("formatTemplate", () => {
  const mockContext: CopyContext = {
    url: "https://example.com/image.png",
    key: "drig-images/2024-01-01-abc123.png",
    filename: "2024-01-01-abc123.png",
    size: 1024 * 1024, // 1MB
    lastModified: new Date("2024-01-01T00:00:00Z"),
    alt: "Test Image",
    title: "Test Title"
  };

  describe("renderCopyTemplate", () => {
    it("should render markdown template", () => {
      const result = renderCopyTemplate("markdown", mockContext, DEFAULT_SETTINGS);
      expect(result).toBe("![Test Image](https://example.com/image.png)");
    });

    it("should render url template", () => {
      const result = renderCopyTemplate("url", mockContext, DEFAULT_SETTINGS);
      expect(result).toBe("https://example.com/image.png");
    });

    it("should render html template", () => {
      const result = renderCopyTemplate("html", mockContext, DEFAULT_SETTINGS);
      expect(result).toBe('<img src="https://example.com/image.png" alt="Test Image" title="Test Title" />');
    });

    it("should use default alt text when not provided", () => {
      const contextWithoutAlt = { ...mockContext, alt: undefined };
      const result = renderCopyTemplate("markdown", contextWithoutAlt, DEFAULT_SETTINGS);
      expect(result).toBe("![图片](https://example.com/image.png)");
    });

    it("should replace all variables correctly", () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        copyMarkdownTemplate: "{filename} - {size} - {date} - {url}"
      };

      const result = renderCopyTemplate("markdown", mockContext, settings);
      expect(result).toContain("2024-01-01-abc123.png");
      expect(result).toContain("1.0 MB");
      expect(result).toContain("https://example.com/image.png");
    });

    it("should handle custom templates", () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        copyMarkdownTemplate: "[![{alt}]({url})]({url})"
      };

      const result = renderCopyTemplate("markdown", mockContext, settings);
      expect(result).toBe("[![Test Image](https://example.com/image.png)](https://example.com/image.png)");
    });

    it("should format file size correctly", () => {
      const contexts = [
        { ...mockContext, size: 500 }, // 500 B
        { ...mockContext, size: 1024 }, // 1.0 KB
        { ...mockContext, size: 1024 * 1024 }, // 1.0 MB
        { ...mockContext, size: 1536 * 1024 } // 1.5 MB
      ];

      const settings = {
        ...DEFAULT_SETTINGS,
        copyMarkdownTemplate: "{size}"
      };

      expect(renderCopyTemplate("markdown", contexts[0], settings)).toBe("500 B");
      expect(renderCopyTemplate("markdown", contexts[1], settings)).toBe("1.0 KB");
      expect(renderCopyTemplate("markdown", contexts[2], settings)).toBe("1.0 MB");
      expect(renderCopyTemplate("markdown", contexts[3], settings)).toBe("1.5 MB");
    });

    it("should use filename as title fallback", () => {
      const contextWithoutTitle = { ...mockContext, title: undefined };
      const settings = {
        ...DEFAULT_SETTINGS,
        copyHtmlTemplate: '<img src="{url}" title="{title}" />'
      };

      const result = renderCopyTemplate("html", contextWithoutTitle, settings);
      expect(result).toBe('<img src="https://example.com/image.png" title="2024-01-01-abc123.png" />');
    });
  });
});
