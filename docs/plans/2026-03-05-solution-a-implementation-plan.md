# Obsidian R2 图片管理插件：方案 A（创作效率优先）详细实施计划

## 1. Analysis（任务分析）

### 1.1 目标与范围
- 目标：将当前"串行上传 + 基础管理"升级为"高成功率、高反馈、低等待"的创作链路。
- 范围：仅覆盖方案 A 的 5 类能力，不引入 Worker/后端改造，不改变 R2 基础鉴权模型。
- 边界：保持现有 `AWS SigV4 + requestUrl + Web Crypto` 主干，做增量架构扩展。

### 1.2 当前架构现状（对接点）
- `src/main.tsx`：粘贴事件入口，当前串行上传并直接插入 Markdown。
- `src/r2.ts`：上传/列表/删除 API，内置 10MB 限制与 30s 超时。
- `src/imageManager/ImageManager.tsx`：列表展示、预览、批量删除。
- `src/types.ts`：配置定义，当前无并发、重试、模板、搜索排序相关配置。

### 1.3 痛点
- 多图粘贴时串行上传耗时长，失败后反馈粗粒度。
- 无任务状态面板，用户无法感知"是否卡住、是否可重试"。
- 预检能力弱，很多错误在上传后才暴露。
- 图片管理器缺少搜索排序，查找效率低。
- 缺少复制模板能力，二次编辑成本高。

## 2. Architecture Decision（架构决策）

### 2.1 新增模块/文件结构
```text
src/
  upload/
    types.ts                  # 队列任务、状态、事件、错误类型
    precheck.ts               # 上传前预检规则
    retryPolicy.ts            # 重试策略（指数退避+jitter）
    concurrencyController.ts  # 并发控制与串行降级逻辑
    uploadQueueManager.ts     # 队列调度器（核心）
  clipboard/
    formatTemplate.ts         # Markdown/URL/HTML 模板引擎
    copyService.ts            # 一键复制封装（clipboard API + fallback）
  imageManager/
    imageQuery.ts             # 搜索/过滤/排序纯函数
  r2.ts                       # 保持 API 主体，增补可观测上下文返回
  main.tsx                    # 接入队列管理器替代串行上传
  types.ts                    # 扩展配置
```

### 2.2 状态管理方案（上传队列）
- 使用"事件驱动 + 内存状态树"：
  - `UploadQueueState`：`tasks`, `pendingIds`, `runningIds`, `completedIds`, `failedIds`。
  - `UploadTask`：`id`, `file`, `order`, `status`, `attempt`, `error`, `result`, `timestamps`。
- 状态源在 `UploadQueueManager` 内，UI（通知或面板）通过订阅器 `subscribe(listener)` 获取快照更新。
- 任务状态（对外可见）：
  - `queued`（排队）
  - `uploading`（上传中）
  - `success`（成功）
  - `failed`（失败）
- 任务状态（内部扩展）：
  - `prechecking`
  - `retry_waiting`
  - `cancelled`

### 2.3 并发控制器设计
- 核心模型：`Semaphore + Adaptive Degrade Strategy`
- 初始并发 `N`（默认 2），上限 4。
- 降级触发条件（任一满足）：
  - 连续出现 `retryable` 错误达到阈值（默认 2）；
  - 出现明显网络异常（timeout/network down）。
- 降级行为：将并发强制设为 1（串行）并进入冷却窗口（默认 30s）。
- 恢复策略：冷却结束且连续成功达到阈值（默认 3）后恢复默认并发。

### 2.4 与现有代码集成点
- `main.tsx`：
  - `handlePaste` 改为：提取文件 -> 入队 -> 订阅状态 -> 全部完成后按原顺序插入文本。
- `r2.ts`：
  - 保留现有 `uploadImageToR2` 兼容；新增带上下文返回的新上传接口。
- `ImageManager.tsx`：
  - `images` 渲染前经过 `imageQuery.ts` 的 filter/sort pipeline。
  - 在图片卡片新增复制菜单与快速预览切换按钮（上一个/下一个）。

## 3. Implementation（核心功能设计与 API 变更）

### 3.1 上传队列状态机（状态转换与事件流）

#### 状态转换
| 当前状态 | 事件 | 下一状态 | 说明 |
|---|---|---|---|
| queued | START_PRECHECK | prechecking | 进入预检 |
| prechecking | PRECHECK_OK | uploading | 获取并发许可后上传 |
| prechecking | PRECHECK_FAIL | failed | 不发起网络请求 |
| uploading | UPLOAD_OK | success | 记录 URL 与耗时 |
| uploading | UPLOAD_FAIL_RETRYABLE | retry_waiting | 按退避等待 |
| retry_waiting | RETRY_TIMER_DONE | uploading | attempt+1 后重试 |
| uploading | UPLOAD_FAIL_FINAL | failed | 达到最大重试或不可重试 |
| queued/uploading | CANCEL | cancelled | 用户取消或卸载清理 |

#### 事件流（批量粘贴）
1. `editor-paste` 提取文件，按剪贴板顺序生成任务（含 `order`）。
2. 调度器按并发阈值拉起任务。
3. 每个任务执行：预检 -> 上传 -> 成功/失败 ->（必要时）重试。
4. 批次完成后，将成功任务按 `order` 排序插入编辑器，保证内容顺序稳定。
5. 输出聚合通知：成功数、失败数、失败主因摘要。

### 3.2 并发限流算法（限流策略与降级逻辑）
- 采用可调信号量：
  - `acquire()`：无令牌时排队。
  - `release()`：唤醒等待队列。
- 动态并发参数：
  - `defaultConcurrency`（默认 2）
  - `maxConcurrency`（默认 4，防止过载）
  - `degradedConcurrency`（固定 1）
- 降级策略：
  - 错误分类为 `retryable` 时计入失败窗口；
  - 到达阈值切换到串行，记录 `degradedUntil`；
  - 冷却期内保持串行，避免"抖动恢复"。

### 3.3 重试机制（指数退避）
- 默认最大重试：`2`（总尝试 3 次）。
- 退避公式：
  - `delayMs = min(maxDelayMs, baseDelayMs * 2^(attempt-1)) * jitter(0.7~1.3)`
- 默认参数：
  - `baseDelayMs = 800`
  - `maxDelayMs = 8000`
- 可重试错误：
  - 网络失败（`Network request failed`）
  - 超时（`Request timeout`）
  - HTTP `429`, `5xx`
- 不可重试错误：
  - 配置缺失、签名密钥过短、格式不支持、超大小等前置错误
  - HTTP `4xx`（除 429）

### 3.4 预检逻辑（检查项与错误分类）
- 检查项（执行顺序）：
  1. 配置完整性（账号、桶、AK/SK）
  2. 在线状态（`navigator.onLine`，若可用）
  3. MIME 白名单（当前插件支持集合）
  4. 大小限制（默认 10MB，可配置）
  5. 签名配置合法性（启用签名时 key >= 16）
- 错误分类：
  - `CONFIG_MISSING`
  - `OFFLINE`
  - `UNSUPPORTED_MIME`
  - `FILE_TOO_LARGE`
  - `SIGNATURE_KEY_INVALID`
  - `UNKNOWN_PRECHECK`
- 错误提示策略：
  - 给出"可操作建议"与"当前值 vs 限制值"。

### 3.5 复制功能（模板引擎与格式支持）
- 支持格式：
  - `markdown`
  - `url`
  - `html`
- 变量：
  - `{url}`, `{alt}`, `{title}`, `{filename}`, `{key}`, `{size}`, `{date}`
- 默认模板：
  - Markdown：`![{alt}]({url})`
  - URL：`{url}`
  - HTML：`<img src="{url}" alt="{alt}" title="{title}" />`
- 交互：
  - 图片卡片增加"复制"下拉（复制 Markdown/URL/HTML）。
  - 复制成功/失败 Notice 提示，失败时回退到"弹窗可手动复制文本"。

### 3.6 搜索排序（过滤条件与排序字段）
- 过滤条件：
  - 关键字（匹配 `key` 与文件名，忽略大小写）
  - 扩展名（可选）
  - 大小区间（可选，后续可扩展）
- 排序字段：
  - `lastModified`
  - `size`
  - `name`
- 排序方向：
  - `asc` / `desc`
- 快速预览切换：
  - 在预览弹窗支持 `prev/next`（按过滤后列表顺序）。

### 3.7 API 变更清单

#### 新增类型（`src/upload/types.ts`）
```ts
export type UploadTaskStatus =
  | "queued"
  | "prechecking"
  | "uploading"
  | "retry_waiting"
  | "success"
  | "failed"
  | "cancelled";

export interface UploadTask {
  id: string;
  order: number;
  file: File;
  status: UploadTaskStatus;
  attempt: number;
  error?: UploadError;
  result?: UploadResult;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}
```

#### 新增函数签名
```ts
// src/upload/precheck.ts
export function precheckUpload(file: File, settings: DrigSettings): PrecheckResult;

// src/upload/retryPolicy.ts
export function shouldRetry(error: UploadError, attempt: number, maxRetry: number): boolean;
export function computeRetryDelay(attempt: number, baseMs: number, maxMs: number): number;

// src/upload/concurrencyController.ts
export class AdaptiveConcurrencyController {
  acquire(): Promise<void>;
  release(): void;
  reportSuccess(): void;
  reportFailure(error: UploadError): void;
  getCurrentConcurrency(): number;
}

// src/upload/uploadQueueManager.ts
export class UploadQueueManager {
  enqueue(files: File[]): string[];
  start(): Promise<QueueSummary>;
  retryTask(taskId: string): Promise<void>;
  subscribe(listener: (state: UploadQueueState) => void): () => void;
  cancelAll(): void;
}

// src/clipboard/formatTemplate.ts
export function renderCopyTemplate(format: CopyFormat, context: CopyContext, settings: DrigSettings): string;
```

#### 修改现有函数
```ts
// src/r2.ts
export async function uploadImageToR2(
  file: File,
  settings: DrigSettings,
  options?: { requestId?: string }
): Promise<{ url: string; key: string; contentType: string; size: number; durationMs: number }>;
```
- 兼容策略：保留原调用方式（旧代码只使用 `url` 时可无痛迁移）。

#### 配置项扩展（`src/types.ts`）
```ts
uploadConcurrency: number;              // default 2
maxRetryAttempts: number;               // default 2
retryBaseDelayMs: number;               // default 800
retryMaxDelayMs: number;                // default 8000
degradeFailureThreshold: number;        // default 2
degradeCooldownMs: number;              // default 30000
maxFileSizeMb: number;                  // default 10
copyMarkdownTemplate: string;           // default "![{alt}]({url})"
copyHtmlTemplate: string;               // default "<img src=\"{url}\" alt=\"{alt}\" title=\"{title}\" />"
copyUrlTemplate: string;                // default "{url}"
defaultCopyFormat: "markdown" | "url" | "html";
```

## 4. Considerations（实施步骤、测试策略、风险缓解）

### 4.1 按优先级排序的任务列表（含输入/输出/依赖/工时）
| 优先级 | 任务 | 输入 | 输出 | 依赖 | 预估 |
|---|---|---|---|---|---|
| P0 | 扩展类型与配置项 | 现有 `DrigSettings` | 新配置与默认值 | 无 | 0.5 天 |
| P0 | 预检模块落地 | MIME/大小/签名规则 | `precheckUpload` | 类型扩展 | 0.5 天 |
| P0 | 重试策略模块 | 错误分类规则 | `shouldRetry/computeRetryDelay` | 预检模块 | 0.5 天 |
| P0 | 并发控制器 | 阈值参数 | 自适应并发控制类 | 重试策略 | 1 天 |
| P0 | 队列调度器 | 文件列表 + 设置 | 任务状态机与订阅 | 并发控制器 | 1.5 天 |
| P0 | `main.tsx` 接入队列 | 粘贴事件 | 并发上传+顺序插入 | 队列调度器 | 1 天 |
| P1 | 复制模板功能 | 图片对象信息 | Markdown/URL/HTML 一键复制 | 类型扩展 | 1 天 |
| P1 | 搜索排序与预览切换 | 列表数据 | 可搜索可排序可切换预览 | imageQuery 模块 | 1 天 |
| P1 | 文案与设置页完善 | i18n 与 settings UI | 用户可配置并发/重试/模板 | 所有上游任务 | 1 天 |
| P1 | 自动化测试与回归 | 功能清单 | 单测+集成测试 | 全部 | 1.5 天 |
| P2 | 性能与观测埋点 | 上传/队列事件 | 指标输出与调优建议 | 主流程稳定后 | 0.5 天 |

> 总工时：约 8–9 人天（单人连续开发）。

### 4.2 测试策略

#### 单元测试覆盖点
- `precheckUpload`：格式、大小、签名 key、离线检测分支。
- `retryPolicy`：不同错误分类下的重试判定与退避时长边界。
- `AdaptiveConcurrencyController`：降级触发、冷却恢复、并发令牌正确释放。
- `renderCopyTemplate`：变量替换、转义、缺省值回退。
- `imageQuery`：关键词过滤、排序稳定性（同值排序保持原序）。

#### 集成测试场景
- 多图粘贴（3/5/10 张）并发上传成功路径。
- 部分失败（网络抖动）触发重试并最终部分成功。
- 并发模式触发降级串行，冷却后恢复并发。
- 上传全部失败时，不插入空内容且提示可操作原因。
- 管理器搜索排序 + 预览上下切换一致性。
- 复制 Markdown/URL/HTML 三种格式及 fallback 行为。

#### 边界条件测试
- 0 字节文件、超大文件、未知 MIME、SVG/GIF 特殊文件。
- 大批量粘贴时内存峰值（确保按任务启动时才读取 arrayBuffer）。
- 任务取消（插件 unload）时队列清理与 UI 状态收敛。
- 重复重试上限后的最终错误一致性。

### 4.3 技术风险与缓解

#### 风险点与应对方案
- 风险：并发上传导致插入顺序错乱
  - 缓解：任务持有 `order`，最终按 `order` 聚合插入。
- 风险：降级逻辑抖动（并发/串行频繁切换）
  - 缓解：设置冷却窗口 + 成功阈值恢复，禁止即时来回切换。
- 风险：重试放大请求成本
  - 缓解：仅对可重试错误重试，默认上限 2，提供配置可调。
- 风险：复制 API 权限限制导致失败
  - 缓解：`navigator.clipboard` 失败时 fallback 到手动复制弹窗文本。
- 风险：预检与上传规则不一致
  - 缓解：将限制常量统一收敛到 `precheck.ts` 与 `r2.ts` 共享来源。

#### 回滚策略
- 引入功能开关：`enableUploadQueueV2`（默认可灰度）。
- 保留旧串行路径（`main.tsx` 原 `for..of` 上传逻辑）作为 fallback。
- 如果出现线上稳定性问题：
  1. 关闭开关立即回退旧逻辑；
  2. 保留日志用于定位；
  3. 修复后再小流量开启。

#### 性能监控指标（插件内轻量埋点）
- `upload_success_rate`
- `upload_avg_duration_ms`
- `upload_p95_duration_ms`
- `retry_rate`
- `degrade_trigger_count`
- `queue_peak_depth`
- `batch_partial_failure_rate`
- `image_manager_filter_latency_ms`

---

## 结论
- 方案 A 可在不引入后端的前提下完成核心体验升级。
- 推荐执行顺序：`队列/并发/重试`（P0）-> `复制/搜索排序`（P1）-> `观测优化`（P2）。
- 通过灰度开关与可回退路径，可在可控风险下上线。
