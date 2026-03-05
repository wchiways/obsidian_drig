import type { Locale } from "./i18n";

export interface DrigSettings {
  language: Locale;
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  publicBaseUrl: string;
  keyPrefix: string;
  defaultAltText: string;
  signatureKey: string;
  enableSignature: boolean;
  // Upload queue settings
  uploadConcurrency: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  degradeFailureThreshold: number;
  degradeCooldownMs: number;
  maxFileSizeMb: number;
  // Copy template settings
  copyMarkdownTemplate: string;
  copyHtmlTemplate: string;
  copyUrlTemplate: string;
  defaultCopyFormat: "markdown" | "url" | "html";
}

export const DEFAULT_SETTINGS: DrigSettings = {
  language: "zh-CN",
  accountId: "",
  bucketName: "",
  accessKeyId: "",
  secretAccessKey: "",
  region: "auto",
  publicBaseUrl: "",
  keyPrefix: "drig-images",
  defaultAltText: "图片",
  signatureKey: "",
  enableSignature: false,
  // Upload queue defaults
  uploadConcurrency: 2,
  maxRetryAttempts: 2,
  retryBaseDelayMs: 800,
  retryMaxDelayMs: 8000,
  degradeFailureThreshold: 2,
  degradeCooldownMs: 30000,
  maxFileSizeMb: 10,
  // Copy template defaults
  copyMarkdownTemplate: "![{alt}]({url})",
  copyHtmlTemplate: '<img src="{url}" alt="{alt}" title="{title}" />',
  copyUrlTemplate: "{url}",
  defaultCopyFormat: "markdown"
};
