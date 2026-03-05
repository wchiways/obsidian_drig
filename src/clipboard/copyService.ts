import { Notice } from "obsidian";
import type { CopyFormat, CopyContext } from "../upload/types";
import type { DrigSettings } from "../types";
import { renderCopyTemplate } from "./formatTemplate";

export async function copyToClipboard(
  format: CopyFormat,
  context: CopyContext,
  settings: DrigSettings
): Promise<boolean> {
  const text = renderCopyTemplate(format, context, settings);

  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback to execCommand
    return copyToClipboardFallback(text);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

function copyToClipboardFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    document.body.removeChild(textarea);
    return false;
  }
}

export function showCopyFallbackModal(text: string): void {
  const modal = document.createElement("div");
  modal.className = "drig-copy-fallback-modal";
  modal.innerHTML = `
    <div class="drig-copy-fallback-content">
      <h3>复制失败</h3>
      <p>请手动复制以下内容：</p>
      <textarea readonly>${text}</textarea>
      <button class="drig-copy-fallback-close">关闭</button>
    </div>
  `;

  document.body.appendChild(modal);

  const textarea = modal.querySelector("textarea") as HTMLTextAreaElement;
  const closeBtn = modal.querySelector(".drig-copy-fallback-close") as HTMLButtonElement;

  textarea.select();

  const close = () => {
    document.body.removeChild(modal);
  };

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      close();
    }
  });
}

export async function copyWithNotification(
  format: CopyFormat,
  context: CopyContext,
  settings: DrigSettings,
  formatLabel: string
): Promise<void> {
  const success = await copyToClipboard(format, context, settings);

  if (success) {
    new Notice(`已复制${formatLabel}格式`);
  } else {
    const text = renderCopyTemplate(format, context, settings);
    showCopyFallbackModal(text);
  }
}
