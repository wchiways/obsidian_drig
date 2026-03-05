export type Locale = "zh-CN" | "en-US";

const MESSAGES = {
  "zh-CN": {
    "setting.title": "drig - Cloudflare R2 图床",
    "setting.description":
      "在编辑器中粘贴图片后，插件会自动上传到 R2 并插入 Markdown 图片标签。",
    "setting.language.name": "界面语言",
    "setting.language.description": "插件设置页与提示语的显示语言。",
    "language.zh-CN": "中文",
    "language.en-US": "English",
    "field.accountId.label": "Account ID",
    "field.accountId.description": "Cloudflare 账号 ID，用于拼接 R2 S3 Endpoint。",
    "field.bucketName.label": "Bucket Name",
    "field.bucketName.description": "用于存储图片的 R2 Bucket 名称。",
    "field.accessKeyId.label": "Access Key ID",
    "field.accessKeyId.description": "R2 API 的访问密钥 ID。",
    "field.secretAccessKey.label": "Secret Access Key",
    "field.secretAccessKey.description": "R2 API 的访问密钥 Secret。",
    "field.region.label": "Region",
    "field.region.description": "Cloudflare R2 建议使用 auto。",
    "field.publicBaseUrl.label": "Public Base URL",
    "field.publicBaseUrl.description":
      "可选。用于最终图片地址前缀，例如 https://img.example.com",
    "field.keyPrefix.label": "Key Prefix",
    "field.keyPrefix.description": "图片对象在 Bucket 内的路径前缀。",
    "field.defaultAltText.label": "Default Alt Text",
    "field.defaultAltText.description": "插入 Markdown 图片语法时使用的默认 alt 文本。",
    "field.enableSignature.label": "启用文件签名",
    "field.enableSignature.description": "为上传的文件生成签名并附加到文件名中，增强安全性。",
    "field.signatureKey.label": "签名密钥",
    "field.signatureKey.description": "用于生成文件签名的密钥，建议使用随机字符串。",
    "connection.test": "测试连接",
    "connection.testing": "连接测试中...",
    "notice.configMissing": "drig：请先在设置里完成 Cloudflare R2 配置。",
    "notice.connectionTesting": "drig：正在测试 R2 连接...",
    "notice.connectionSuccess": "drig：R2 连接测试成功。",
    "notice.connectionFailed": "drig：R2 连接测试失败：{message}",
    "notice.uploadFailed": "drig 上传失败：{message}",
    "notice.uploadFailedRetry": "drig：所有图片上传失败，请重新粘贴。",
    "notice.uploadSuccess": "drig：成功上传 {count} 张图片到 R2。",
    "error.requestTimeout": "请求超时",
    "error.signatureKeyTooShort": "签名密钥长度必须至少为 16 个字符",
    "imageManager.title": "R2 图片管理",
    "imageManager.refresh": "刷新",
    "imageManager.loading": "加载中...",
    "imageManager.delete": "删除",
    "imageManager.selectAll": "全选",
    "imageManager.noSelection": "请先选择要删除的图片",
    "imageManager.deleteConfirm": "确定要删除 {count} 张图片吗？此操作不可恢复。",
    "imageManager.deleteSuccess": "成功删除 {count} 张图片",
    "imageManager.deletePartial": "删除完成：成功 {success} 张，失败 {fail} 张",
    "imageManager.loadFailed": "加载图片列表失败",
    "imageManager.empty": "暂无图片"
  },
  "en-US": {
    "setting.title": "drig - Cloudflare R2 Image Uploader",
    "setting.description":
      "Paste an image in the editor, then drig uploads it to R2 and inserts a Markdown image tag.",
    "setting.language.name": "Language",
    "setting.language.description":
      "Display language for plugin settings and notices.",
    "language.zh-CN": "中文",
    "language.en-US": "English",
    "field.accountId.label": "Account ID",
    "field.accountId.description":
      "Cloudflare account ID used for the R2 S3 endpoint.",
    "field.bucketName.label": "Bucket Name",
    "field.bucketName.description": "Target R2 bucket for pasted images.",
    "field.accessKeyId.label": "Access Key ID",
    "field.accessKeyId.description": "R2 API access key ID.",
    "field.secretAccessKey.label": "Secret Access Key",
    "field.secretAccessKey.description": "R2 API secret access key.",
    "field.region.label": "Region",
    "field.region.description": "Use auto for Cloudflare R2.",
    "field.publicBaseUrl.label": "Public Base URL",
    "field.publicBaseUrl.description":
      "Optional public URL prefix, e.g. https://img.example.com",
    "field.keyPrefix.label": "Key Prefix",
    "field.keyPrefix.description": "Object key prefix inside the bucket.",
    "field.defaultAltText.label": "Default Alt Text",
    "field.defaultAltText.description":
      "Default alt text for inserted markdown image syntax.",
    "field.enableSignature.label": "Enable File Signature",
    "field.enableSignature.description":
      "Generate and append signature to filename for enhanced security.",
    "field.signatureKey.label": "Signature Key",
    "field.signatureKey.description":
      "Secret key for generating file signatures. Use a random string.",
    "connection.test": "Test Connection",
    "connection.testing": "Testing Connection...",
    "notice.configMissing":
      "drig: please complete Cloudflare R2 settings first.",
    "notice.connectionTesting": "drig: testing R2 connection...",
    "notice.connectionSuccess": "drig: R2 connection test passed.",
    "notice.connectionFailed": "drig: R2 connection test failed: {message}",
    "notice.uploadFailed": "drig upload failed: {message}",
    "notice.uploadFailedRetry": "drig: All images failed to upload, please paste again.",
    "notice.uploadSuccess": "drig: uploaded {count} image(s) to R2.",
    "error.requestTimeout": "Request timeout",
    "error.signatureKeyTooShort": "Signature key must be at least 16 characters long",
    "imageManager.title": "R2 Image Manager",
    "imageManager.refresh": "Refresh",
    "imageManager.loading": "Loading...",
    "imageManager.delete": "Delete",
    "imageManager.selectAll": "Select All",
    "imageManager.noSelection": "Please select images to delete",
    "imageManager.deleteConfirm": "Are you sure you want to delete {count} image(s)? This action cannot be undone.",
    "imageManager.deleteSuccess": "Successfully deleted {count} image(s)",
    "imageManager.deletePartial": "Deletion completed: {success} succeeded, {fail} failed",
    "imageManager.loadFailed": "Failed to load image list",
    "imageManager.empty": "No images found"
  }
} as const;

export type MessageKey = keyof (typeof MESSAGES)["zh-CN"];
type MessageParams = Record<string, string | number>;

export function normalizeLocale(locale?: string): Locale {
  if (locale === "zh-CN" || locale === "en-US") {
    return locale;
  }

  const value = locale?.toLowerCase().trim();
  if (value?.startsWith("en")) {
    return "en-US";
  }
  return "zh-CN";
}

export function t(
  locale: string | undefined,
  key: MessageKey,
  params?: MessageParams
): string {
  const normalizedLocale = normalizeLocale(locale);
  const template = MESSAGES[normalizedLocale][key] ?? MESSAGES["zh-CN"][key];
  return applyParams(template, params);
}

function applyParams(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }

  let message = template;
  for (const [name, value] of Object.entries(params)) {
    message = message.split(`{${name}}`).join(String(value));
  }
  return message;
}
