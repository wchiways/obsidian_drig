import type { DrigSettings } from "../types";
import type { CopyFormat, CopyContext } from "../upload/types";

export function renderCopyTemplate(
  format: CopyFormat,
  context: CopyContext,
  settings: DrigSettings
): string {
  let template: string;

  switch (format) {
    case "markdown":
      template = settings.copyMarkdownTemplate;
      break;
    case "url":
      template = settings.copyUrlTemplate;
      break;
    case "html":
      template = settings.copyHtmlTemplate;
      break;
    default:
      template = settings.copyMarkdownTemplate;
  }

  return replaceVariables(template, context, settings);
}

function replaceVariables(
  template: string,
  context: CopyContext,
  settings: DrigSettings
): string {
  const variables: Record<string, string> = {
    url: context.url,
    key: context.key,
    filename: context.filename,
    alt: context.alt || settings.defaultAltText,
    title: context.title || context.filename,
    size: formatFileSize(context.size),
    date: formatDate(context.lastModified)
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(escapeRegExp(placeholder), "g"), value);
  }

  return result;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
