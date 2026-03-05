import { useEffect, useState } from "react";
import { Notice } from "obsidian";
import { t as translate, type MessageKey } from "../i18n";
import type { DrigSettings } from "../types";
import { listR2Objects, deleteR2Object, type R2Object } from "../r2";
import { queryImages, getUniqueExtensions, extractFilename, type SortField, type SortDirection } from "./imageQuery";
import { copyWithNotification } from "../clipboard/copyService";
import type { CopyFormat, CopyContext } from "../upload/types";

interface ImageManagerProps {
  settings: DrigSettings;
}

export function ImageManager(props: ImageManagerProps): JSX.Element {
  const [allImages, setAllImages] = useState<R2Object[]>([]);
  const [filteredImages, setFilteredImages] = useState<R2Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  // Search and sort state
  const [keyword, setKeyword] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastModified");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const tr = (key: MessageKey, params?: Record<string, string | number>): string =>
    translate(props.settings.language, key, params);

  const loadImages = async () => {
    setLoading(true);
    try {
      const objects = await listR2Objects(props.settings);
      setAllImages(objects);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${tr("imageManager.loadFailed")}: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadImages();
  }, []);

  // Apply filters and sorting whenever inputs change
  useEffect(() => {
    const filtered = queryImages(allImages, {
      keyword,
      sortField,
      sortDirection
    });
    setFilteredImages(filtered);
  }, [allImages, keyword, sortField, sortDirection]);

  const handleDelete = async () => {
    if (selectedImages.size === 0) {
      new Notice(tr("imageManager.noSelection"));
      return;
    }

    const confirmed = confirm(
      tr("imageManager.deleteConfirm", { count: selectedImages.size })
    );
    if (!confirmed) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const key of selectedImages) {
      try {
        await deleteR2Object(key, props.settings);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to delete ${key}:`, error);
      }
    }

    setSelectedImages(new Set());
    await loadImages();

    if (failCount === 0) {
      new Notice(tr("imageManager.deleteSuccess", { count: successCount }));
    } else {
      new Notice(
        tr("imageManager.deletePartial", { success: successCount, fail: failCount })
      );
    }
  };

  const toggleSelection = (key: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedImages(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredImages.map((img) => img.key)));
    }
  };

  const handleCopy = async (image: R2Object, format: CopyFormat) => {
    const context: CopyContext = {
      url: image.url,
      key: image.key,
      filename: extractFilename(image.key),
      size: image.size,
      lastModified: image.lastModified
    };

    const formatLabels = {
      markdown: "Markdown",
      url: "URL",
      html: "HTML"
    };

    await copyWithNotification(format, context, props.settings, formatLabels[format]);
  };

  const openPreview = (url: string) => {
    const index = filteredImages.findIndex((img) => img.url === url);
    setPreviewImage(url);
    setPreviewIndex(index);
  };

  const closePreview = () => {
    setPreviewImage(null);
    setPreviewIndex(-1);
  };

  const navigatePreview = (direction: "prev" | "next") => {
    if (previewIndex < 0 || filteredImages.length === 0) return;

    let newIndex = previewIndex;
    if (direction === "prev") {
      newIndex = previewIndex > 0 ? previewIndex - 1 : filteredImages.length - 1;
    } else {
      newIndex = previewIndex < filteredImages.length - 1 ? previewIndex + 1 : 0;
    }

    setPreviewIndex(newIndex);
    setPreviewImage(filteredImages[newIndex].url);
  };

  return (
    <div className="drig-image-manager">
      <div className="drig-manager-header">
        <h2>{tr("imageManager.title")}</h2>
        <div className="drig-manager-actions">
          <button onClick={loadImages} disabled={loading}>
            {loading ? tr("imageManager.loading") : tr("imageManager.refresh")}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || selectedImages.size === 0}
            className="drig-delete-btn"
          >
            {tr("imageManager.delete")} ({selectedImages.size})
          </button>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="drig-manager-controls">
        <input
          type="text"
          placeholder="搜索图片..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="drig-search-input"
        />
        <div className="drig-sort-controls">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="drig-sort-select"
          >
            <option value="lastModified">修改时间</option>
            <option value="size">文件大小</option>
            <option value="name">文件名</option>
          </select>
          <button
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            className="drig-sort-direction"
            title={sortDirection === "asc" ? "升序" : "降序"}
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {filteredImages.length > 0 && (
        <div className="drig-select-all">
          <label>
            <input
              type="checkbox"
              checked={selectedImages.size === filteredImages.length}
              onChange={toggleSelectAll}
            />
            <span>{tr("imageManager.selectAll")} ({filteredImages.length})</span>
          </label>
        </div>
      )}

      <div className="drig-image-grid">
        {filteredImages.map((image) => (
          <div
            key={image.key}
            className={`drig-image-item ${
              selectedImages.has(image.key) ? "selected" : ""
            }`}
          >
            <div className="drig-image-checkbox">
              <input
                type="checkbox"
                checked={selectedImages.has(image.key)}
                onChange={() => toggleSelection(image.key)}
              />
            </div>
            <div
              className="drig-image-preview"
              onClick={() => openPreview(image.url)}
            >
              <img src={image.url} alt={image.key} loading="lazy" />
            </div>
            <div className="drig-image-info">
              <div className="drig-image-name" title={image.key}>
                {image.key.split("/").pop()}
              </div>
              <div className="drig-image-meta">
                <span>{formatFileSize(image.size)}</span>
                <span>{formatDate(image.lastModified)}</span>
              </div>
              <div className="drig-image-actions">
                <button
                  onClick={() => handleCopy(image, "markdown")}
                  title="复制 Markdown"
                  className="drig-copy-btn"
                >
                  MD
                </button>
                <button
                  onClick={() => handleCopy(image, "url")}
                  title="复制 URL"
                  className="drig-copy-btn"
                >
                  URL
                </button>
                <button
                  onClick={() => handleCopy(image, "html")}
                  title="复制 HTML"
                  className="drig-copy-btn"
                >
                  HTML
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredImages.length === 0 && !loading && (
        <div className="drig-empty-state">
          <p>{allImages.length === 0 ? tr("imageManager.empty") : "没有匹配的图片"}</p>
        </div>
      )}

      {previewImage && (
        <div className="drig-preview-modal" onClick={closePreview}>
          <div className="drig-preview-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="drig-preview-close"
              onClick={closePreview}
            >
              ×
            </button>
            {filteredImages.length > 1 && (
              <>
                <button
                  className="drig-preview-nav drig-preview-prev"
                  onClick={() => navigatePreview("prev")}
                  title="上一张"
                >
                  ‹
                </button>
                <button
                  className="drig-preview-nav drig-preview-next"
                  onClick={() => navigatePreview("next")}
                  title="下一张"
                >
                  ›
                </button>
              </>
            )}
            <img src={previewImage} alt="Preview" />
            {previewIndex >= 0 && (
              <div className="drig-preview-counter">
                {previewIndex + 1} / {filteredImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
