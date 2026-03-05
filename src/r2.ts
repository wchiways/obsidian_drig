import { requestUrl } from "obsidian";
import type { DrigSettings } from "./types";

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg"
};

const CONNECTION_TEST_FILE_NAME = "__drig_connection_test__.txt";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB file size limit
const REQUEST_TIMEOUT = 30000; // 30 seconds request timeout

export function hasRequiredConfig(settings: DrigSettings): boolean {
  const runtimeSettings = normalizeRuntimeSettings(settings);
  return Boolean(
    runtimeSettings.accountId &&
      runtimeSettings.bucketName &&
      runtimeSettings.accessKeyId &&
      runtimeSettings.secretAccessKey
  );
}

export function getImageFilesFromClipboard(evt: ClipboardEvent): File[] {
  const clipboardData = evt.clipboardData;
  if (!clipboardData) {
    return [];
  }

  const files: File[] = [];
  for (let i = 0; i < clipboardData.items.length; i += 1) {
    const item = clipboardData.items[i];
    if (item.kind !== "file" || !item.type.startsWith("image/")) {
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }
  return files;
}

export async function uploadImageToR2(
  file: File,
  settings: DrigSettings
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`文件大小超过限制 (${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB)`);
  }

  const runtimeSettings = normalizeRuntimeSettings(settings);
  const objectKey = generateObjectKey(file.type, runtimeSettings.keyPrefix);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  let finalObjectKey = objectKey;
  if (runtimeSettings.enableSignature && runtimeSettings.signatureKey) {
    if (runtimeSettings.signatureKey.length < 16) {
      throw new Error("Signature key must be at least 16 characters long");
    }
    const signature = await generateFileSignature(bytes, runtimeSettings.signatureKey);
    finalObjectKey = appendSignatureToKey(objectKey, signature);
  }

  await putObjectToR2Bytes(bytes, contentType, finalObjectKey, runtimeSettings);
  return toPublicUrl(finalObjectKey, runtimeSettings);
}

export async function testR2Connection(settings: DrigSettings): Promise<void> {
  const runtimeSettings = normalizeRuntimeSettings(settings);
  const prefix = trimSlash(runtimeSettings.keyPrefix);
  const objectKey = prefix
    ? `${prefix}/${CONNECTION_TEST_FILE_NAME}`
    : CONNECTION_TEST_FILE_NAME;
  const bytes = textToBytes("drig-connection-test");

  await putObjectToR2Bytes(
    bytes,
    "text/plain; charset=utf-8",
    objectKey,
    runtimeSettings
  );
}

function generateObjectKey(mimeType: string, keyPrefix: string): string {
  const extension = MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? "png";
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  const random = randomHex(6);
  const prefix = trimSlash(keyPrefix);
  const filename = `${timestamp}-${random}.${extension}`;
  return prefix ? `${prefix}/${filename}` : filename;
}

function randomHex(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function trimSlash(value: string): string {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toPublicUrl(objectKey: string, settings: DrigSettings): string {
  const encodedKey = encodeObjectKey(objectKey);
  const publicBaseUrl = settings.publicBaseUrl.trim().replace(/\/+$/, "");

  if (publicBaseUrl) {
    return `${publicBaseUrl}/${encodedKey}`;
  }

  const encodedBucket = encodeURIComponent(settings.bucketName);
  return `https://${settings.accountId}.r2.cloudflarestorage.com/${encodedBucket}/${encodedKey}`;
}

function normalizeRuntimeSettings(settings: DrigSettings): DrigSettings {
  return {
    ...settings,
    accountId: settings.accountId.trim(),
    bucketName: settings.bucketName.trim(),
    accessKeyId: settings.accessKeyId.trim(),
    secretAccessKey: settings.secretAccessKey.trim(),
    region: settings.region.trim() || "auto",
    publicBaseUrl: settings.publicBaseUrl.trim(),
    keyPrefix: settings.keyPrefix.trim(),
    defaultAltText: settings.defaultAltText.trim() || "图片",
    signatureKey: settings.signatureKey?.trim() || "",
    enableSignature: settings.enableSignature ?? false
  };
}

async function putObjectToR2Bytes(
  bytes: Uint8Array,
  contentType: string,
  objectKey: string,
  settings: DrigSettings
): Promise<void> {
  const host = `${settings.accountId}.r2.cloudflarestorage.com`;
  const encodedBucket = encodeURIComponent(settings.bucketName);
  const encodedObjectKey = encodeObjectKey(objectKey);
  const canonicalUri = `/${encodedBucket}/${encodedObjectKey}`;
  const url = `https://${host}${canonicalUri}`;
  const payloadHash = await sha256Hex(bytes);
  const amzDate = createAmzDate();
  const dateStamp = amzDate.slice(0, 8);
  const region = settings.region || "auto";
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = await getSignatureKey(
    settings.secretAccessKey,
    dateStamp,
    region,
    "s3"
  );
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${settings.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");

  let response;
  try {
    response = await Promise.race([
      requestUrl({
        url,
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
          Authorization: authorization
        },
        body: toArrayBuffer(bytes),
        throw: false
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT)
      )
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request failed: ${message}`);
  }

  if (response.status < 200 || response.status >= 300) {
    const detail = response.text?.trim();
    const sanitizedDetail = sanitizeErrorMessage(detail || "");
    throw new Error(
      `HTTP ${response.status}${sanitizedDetail ? `: ${sanitizedDetail}` : ""}`
    );
  }
}

function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  sanitized = sanitized.replace(/[A-Z0-9]{20,}/gi, "***");
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/gi, "***");
  sanitized = sanitized.replace(/[a-f0-9]{32,}/gi, "***");
  sanitized = sanitized.replace(/\b\d{16}\b/g, "***");

  return sanitized;
}

async function generateFileSignature(bytes: Uint8Array, signatureKey: string): Promise<string> {
  const fileHash = await sha256Hex(bytes);
  const signature = await hmacHex(signatureKey, fileHash);
  return signature.slice(0, 16);
}

export async function verifyFileSignature(
  bytes: Uint8Array,
  signatureKey: string,
  expectedSignature: string
): Promise<boolean> {
  const actualSignature = await generateFileSignature(bytes, signatureKey);
  return actualSignature === expectedSignature;
}

function appendSignatureToKey(objectKey: string, signature: string): string {
  const parts = objectKey.split(".");
  if (parts.length > 1) {
    const extension = parts.pop();
    const baseName = parts.join(".");
    return `${baseName}-${signature}.${extension}`;
  }
  return `${objectKey}-${signature}`;
}

export function extractSignatureFromKey(objectKey: string): string | null {
  const parts = objectKey.split(".");
  if (parts.length > 1) {
    const baseName = parts[0];
    const match = baseName.match(/-([a-f0-9]{16})$/);
    return match ? match[1] : null;
  }
  const match = objectKey.match(/-([a-f0-9]{16})$/);
  return match ? match[1] : null;
}

function createAmzDate(date: Date = new Date()): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function getSubtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable in this environment.");
  }
  return globalThis.crypto.subtle;
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function toHex(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? textToBytes(data) : data;
  const hash = await getSubtleCrypto().digest("SHA-256", toArrayBuffer(bytes));
  return toHex(hash);
}

async function hmacRaw(
  key: Uint8Array | string,
  message: string
): Promise<ArrayBuffer> {
  const keyBytes = typeof key === "string" ? textToBytes(key) : key;
  const cryptoKey = await getSubtleCrypto().importKey(
    "raw",
    toArrayBuffer(keyBytes),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  return getSubtleCrypto().sign("HMAC", cryptoKey, toArrayBuffer(textToBytes(message)));
}

async function hmacHex(key: Uint8Array | string, message: string): Promise<string> {
  const buffer = await hmacRaw(key, message);
  return toHex(buffer);
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<Uint8Array> {
  const kDate = new Uint8Array(await hmacRaw(`AWS4${secretKey}`, dateStamp));
  const kRegion = new Uint8Array(await hmacRaw(kDate, region));
  const kService = new Uint8Array(await hmacRaw(kRegion, service));
  return new Uint8Array(await hmacRaw(kService, "aws4_request"));
}

export async function listR2Objects(settings: DrigSettings): Promise<R2Object[]> {
  const runtimeSettings = normalizeRuntimeSettings(settings);
  const host = `${runtimeSettings.accountId}.r2.cloudflarestorage.com`;
  const encodedBucket = encodeURIComponent(runtimeSettings.bucketName);
  const prefix = trimSlash(runtimeSettings.keyPrefix);

  // Build query parameters
  const queryParams: Record<string, string> = {
    "list-type": "2"
  };
  if (prefix) {
    queryParams.prefix = prefix + "/";
  }

  // Build URL with encoded query string
  const urlQueryString = Object.entries(queryParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  const url = `https://${host}/${encodedBucket}?${urlQueryString}`;

  const amzDate = createAmzDate();
  const dateStamp = amzDate.slice(0, 8);
  const region = runtimeSettings.region || "auto";
  const canonicalUri = `/${encodedBucket}`;

  // Build canonical query string (sorted by key, with proper encoding)
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const payloadHash = await sha256Hex("");

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join("\n");

  const signingKey = await getSignatureKey(
    runtimeSettings.secretAccessKey,
    dateStamp,
    region,
    "s3"
  );
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${runtimeSettings.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");

  let response;
  try {
    response = await Promise.race([
      requestUrl({
        url,
        method: "GET",
        headers: {
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
          Authorization: authorization
        },
        throw: false
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT)
      )
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request failed: ${message}`);
  }

  if (response.status < 200 || response.status >= 300) {
    const detail = response.text?.trim();
    const sanitizedDetail = sanitizeErrorMessage(detail || "");
    throw new Error(
      `HTTP ${response.status}${sanitizedDetail ? `: ${sanitizedDetail}` : ""}`
    );
  }

  return parseListObjectsResponse(response.text, runtimeSettings);
}

export async function deleteR2Object(
  objectKey: string,
  settings: DrigSettings
): Promise<void> {
  const runtimeSettings = normalizeRuntimeSettings(settings);
  const host = `${runtimeSettings.accountId}.r2.cloudflarestorage.com`;
  const encodedBucket = encodeURIComponent(runtimeSettings.bucketName);
  const encodedObjectKey = encodeObjectKey(objectKey);
  const canonicalUri = `/${encodedBucket}/${encodedObjectKey}`;
  const url = `https://${host}${canonicalUri}`;

  const amzDate = createAmzDate();
  const dateStamp = amzDate.slice(0, 8);
  const region = runtimeSettings.region || "auto";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const payloadHash = await sha256Hex("");

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n");

  const canonicalRequest = [
    "DELETE",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join("\n");

  const signingKey = await getSignatureKey(
    runtimeSettings.secretAccessKey,
    dateStamp,
    region,
    "s3"
  );
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${runtimeSettings.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(", ");

  let response;
  try {
    response = await Promise.race([
      requestUrl({
        url,
        method: "DELETE",
        headers: {
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
          Authorization: authorization
        },
        throw: false
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), REQUEST_TIMEOUT)
      )
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request failed: ${message}`);
  }

  if (response.status < 200 || response.status >= 300) {
    const detail = response.text?.trim();
    const sanitizedDetail = sanitizeErrorMessage(detail || "");
    throw new Error(
      `HTTP ${response.status}${sanitizedDetail ? `: ${sanitizedDetail}` : ""}`
    );
  }
}

function parseListObjectsResponse(xml: string, settings: DrigSettings): R2Object[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const contents = doc.querySelectorAll("Contents");
  const objects: R2Object[] = [];

  contents.forEach((content) => {
    const key = content.querySelector("Key")?.textContent;
    const size = content.querySelector("Size")?.textContent;
    const lastModified = content.querySelector("LastModified")?.textContent;

    if (key && size && lastModified) {
      objects.push({
        key,
        size: parseInt(size, 10),
        lastModified: new Date(lastModified),
        url: toPublicUrl(key, settings)
      });
    }
  });

  return objects;
}

