# 文件签名机制说明

## 概述

drig 插件提供了可选的文件签名功能，用于增强上传文件的完整性验证。

## 工作原理

1. **签名生成**：
   - 计算文件内容的 SHA-256 哈希值
   - 使用 HMAC-SHA256 和用户提供的密钥对哈希值进行签名
   - 取签名的前 16 个字符附加到文件名中

2. **文件命名格式**：
   ```
   原始: 2026-03-05T12-30-45-abc123.png
   签名: 2026-03-05T12-30-45-abc123-1a2b3c4d5e6f7890.png
                                    ^^^^^^^^^^^^^^^^
                                    16字符签名
   ```

## 使用方法

### 1. 启用签名功能

在插件设置中：
1. 勾选 "启用文件签名"
2. 设置 "签名密钥"（至少 16 个字符，建议使用随机字符串）

### 2. 签名验证

插件提供了验证函数供外部使用：

```typescript
import { verifyFileSignature, extractSignatureFromKey } from './r2';

// 从文件名提取签名
const signature = extractSignatureFromKey('image-1a2b3c4d5e6f7890.png');

// 验证文件完整性
const isValid = await verifyFileSignature(
  fileBytes,
  'your-signature-key',
  signature
);
```

### 3. CDN/Worker 层验证（推荐）

在 Cloudflare Worker 中实现验证：

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // 提取签名
  const match = path.match(/-([a-f0-9]{16})\.[^.]+$/)
  if (!match) {
    return new Response('Invalid signature', { status: 403 })
  }

  const signature = match[1]

  // 获取文件
  const response = await fetch(request)
  const fileBytes = await response.arrayBuffer()

  // 验证签名（需要实现 HMAC-SHA256）
  const isValid = await verifySignature(fileBytes, signature)

  if (!isValid) {
    return new Response('Signature verification failed', { status: 403 })
  }

  return response
}
```

## 安全建议

1. **密钥管理**：
   - 使用强随机密钥（建议 32+ 字符）
   - 定期更换密钥
   - 不要在公开场合分享密钥

2. **验证层**：
   - 在 CDN/Worker 层实现验证可防止未授权访问
   - 客户端验证可检测文件篡改

3. **限制**：
   - 签名不能防止文件被复制
   - 签名不能防止密钥泄露后的伪造
   - 建议配合其他安全措施使用（如访问控制、HTTPS）

## 性能影响

- 签名生成：约 1-5ms（取决于文件大小）
- 文件名增加：16 个字符
- 存储开销：可忽略不计

## 常见问题

**Q: 签名是否必需？**
A: 不是。签名功能是可选的，默认关闭。

**Q: 如何选择密钥？**
A: 使用密码生成器生成 32+ 字符的随机字符串。

**Q: 更换密钥后旧文件怎么办？**
A: 旧文件的签名仍然有效，但无法用新密钥验证。建议保留旧密钥或重新上传。

**Q: 签名能防止什么？**
A: 主要用于检测文件完整性和防止文件名冲突，配合验证层可防止未授权访问。
