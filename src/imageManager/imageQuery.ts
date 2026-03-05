import type { R2Object } from "../r2";

export type SortField = "lastModified" | "size" | "name";
export type SortDirection = "asc" | "desc";

export interface ImageQueryOptions {
  keyword?: string;
  extension?: string;
  sortField?: SortField;
  sortDirection?: SortDirection;
}

export function queryImages(
  images: R2Object[],
  options: ImageQueryOptions = {}
): R2Object[] {
  let result = [...images];

  // Filter by keyword
  if (options.keyword && options.keyword.trim()) {
    const keyword = options.keyword.trim().toLowerCase();
    result = result.filter((img) => {
      const key = img.key.toLowerCase();
      const filename = extractFilename(img.key).toLowerCase();
      return key.includes(keyword) || filename.includes(keyword);
    });
  }

  // Filter by extension
  if (options.extension && options.extension.trim()) {
    const ext = options.extension.trim().toLowerCase();
    result = result.filter((img) => {
      const imgExt = extractExtension(img.key).toLowerCase();
      return imgExt === ext;
    });
  }

  // Sort
  if (options.sortField) {
    result = sortImages(result, options.sortField, options.sortDirection || "desc");
  }

  return result;
}

function sortImages(
  images: R2Object[],
  field: SortField,
  direction: SortDirection
): R2Object[] {
  const sorted = [...images];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case "lastModified":
        comparison = a.lastModified.getTime() - b.lastModified.getTime();
        break;
      case "size":
        comparison = a.size - b.size;
        break;
      case "name":
        comparison = extractFilename(a.key).localeCompare(extractFilename(b.key));
        break;
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

export function extractFilename(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}

export function extractExtension(key: string): string {
  const filename = extractFilename(key);
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function getUniqueExtensions(images: R2Object[]): string[] {
  const extensions = new Set<string>();
  images.forEach((img) => {
    const ext = extractExtension(img.key);
    if (ext) {
      extensions.add(ext.toLowerCase());
    }
  });
  return Array.from(extensions).sort();
}
