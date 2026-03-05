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
  enableSignature: false
};
