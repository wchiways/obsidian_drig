import { useEffect, useState } from "react";
import { Notice } from "obsidian";
import { t as translate, type MessageKey } from "../i18n";
import type { DrigSettings } from "../types";
import { listR2Objects, deleteR2Object, type R2Object } from "../r2";

interface ImageManagerProps {
  settings: DrigSettings;
}

export function ImageManager(props: ImageManagerProps): JSX.Element {
  const [images, setImages] = useState<R2Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const tr = (key: MessageKey, params?: Record<string, string | number>): string =>
    translate(props.settings.language, key, params);

  const loadImages = async () => {
    setLoading(true);
    try {
      const objects = await listR2Objects(props.settings);
      setImages(objects);
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
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map((img) => img.key)));
    }
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

      {images.length > 0 && (
        <div className="drig-select-all">
          <label>
            <input
              type="checkbox"
              checked={selectedImages.size === images.length}
              onChange={toggleSelectAll}
            />
            <span>{tr("imageManager.selectAll")}</span>
          </label>
        </div>
      )}

      <div className="drig-image-grid">
        {images.map((image) => (
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
              onClick={() => setPreviewImage(image.url)}
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
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && !loading && (
        <div className="drig-empty-state">
          <p>{tr("imageManager.empty")}</p>
        </div>
      )}

      {previewImage && (
        <div className="drig-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="drig-preview-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="drig-preview-close"
              onClick={() => setPreviewImage(null)}
            >
              ×
            </button>
            <img src={previewImage} alt="Preview" />
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
