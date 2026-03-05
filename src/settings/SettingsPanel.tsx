import { useEffect, useMemo, useRef, useState } from "react";
import { t as translate, type MessageKey } from "../i18n";
import type { DrigSettings } from "../types";

interface SettingsPanelProps {
  settings: DrigSettings;
  onChange: (patch: Partial<DrigSettings>) => void;
  onTestConnection: () => Promise<void>;
}

interface TextField {
  key: Exclude<keyof DrigSettings, "language" | "enableSignature" | "uploadConcurrency" | "maxRetryAttempts" | "retryBaseDelayMs" | "retryMaxDelayMs" | "degradeFailureThreshold" | "degradeCooldownMs" | "maxFileSizeMb" | "defaultCopyFormat">;
  labelKey?: MessageKey;
  descriptionKey?: MessageKey;
  label?: string;
  description?: string;
  placeholder: string;
  type?: "text" | "password";
  group: "basic" | "advanced" | "copy";
}

interface NumberField {
  key: "uploadConcurrency" | "maxRetryAttempts" | "retryBaseDelayMs" | "retryMaxDelayMs" | "degradeFailureThreshold" | "degradeCooldownMs" | "maxFileSizeMb";
  label: string;
  description: string;
  min: number;
  max: number;
  step?: number;
  group: "performance";
}

const FIELDS: TextField[] = [
  {
    key: "accountId",
    labelKey: "field.accountId.label",
    descriptionKey: "field.accountId.description",
    placeholder: "0123456789abcdef",
    group: "basic"
  },
  {
    key: "bucketName",
    labelKey: "field.bucketName.label",
    descriptionKey: "field.bucketName.description",
    placeholder: "my-image-bucket",
    group: "basic"
  },
  {
    key: "accessKeyId",
    labelKey: "field.accessKeyId.label",
    descriptionKey: "field.accessKeyId.description",
    placeholder: "xxxxxxxxxxxxxxxxxxxx",
    group: "basic"
  },
  {
    key: "secretAccessKey",
    labelKey: "field.secretAccessKey.label",
    descriptionKey: "field.secretAccessKey.description",
    placeholder: "************************",
    type: "password",
    group: "basic"
  },
  {
    key: "region",
    labelKey: "field.region.label",
    descriptionKey: "field.region.description",
    placeholder: "auto",
    group: "advanced"
  },
  {
    key: "publicBaseUrl",
    labelKey: "field.publicBaseUrl.label",
    descriptionKey: "field.publicBaseUrl.description",
    placeholder: "https://img.example.com",
    group: "advanced"
  },
  {
    key: "keyPrefix",
    labelKey: "field.keyPrefix.label",
    descriptionKey: "field.keyPrefix.description",
    placeholder: "drig-images",
    group: "advanced"
  },
  {
    key: "defaultAltText",
    labelKey: "field.defaultAltText.label",
    descriptionKey: "field.defaultAltText.description",
    placeholder: "图片",
    group: "advanced"
  },
  {
    key: "signatureKey",
    labelKey: "field.signatureKey.label",
    descriptionKey: "field.signatureKey.description",
    placeholder: "your-secret-signature-key",
    type: "password",
    group: "advanced"
  },
  {
    key: "copyMarkdownTemplate",
    label: "Markdown 模板",
    description: "复制 Markdown 格式时使用的模板",
    placeholder: "![{alt}]({url})",
    group: "copy"
  },
  {
    key: "copyUrlTemplate",
    label: "URL 模板",
    description: "复制 URL 格式时使用的模板",
    placeholder: "{url}",
    group: "copy"
  },
  {
    key: "copyHtmlTemplate",
    label: "HTML 模板",
    description: "复制 HTML 格式时使用的模板",
    placeholder: '<img src="{url}" alt="{alt}" title="{title}" />',
    group: "copy"
  }
];

const NUMBER_FIELDS: NumberField[] = [
  {
    key: "uploadConcurrency",
    label: "上传并发数",
    description: "同时上传的图片数量（1-4）",
    min: 1,
    max: 4,
    group: "performance"
  },
  {
    key: "maxRetryAttempts",
    label: "最大重试次数",
    description: "上传失败后的重试次数（0-5）",
    min: 0,
    max: 5,
    group: "performance"
  },
  {
    key: "maxFileSizeMb",
    label: "最大文件大小 (MB)",
    description: "允许上传的最大文件大小",
    min: 1,
    max: 50,
    group: "performance"
  },
  {
    key: "retryBaseDelayMs",
    label: "重试基础延迟 (ms)",
    description: "首次重试的延迟时间",
    min: 100,
    max: 5000,
    step: 100,
    group: "performance"
  },
  {
    key: "retryMaxDelayMs",
    label: "重试最大延迟 (ms)",
    description: "重试延迟的上限",
    min: 1000,
    max: 30000,
    step: 1000,
    group: "performance"
  },
  {
    key: "degradeFailureThreshold",
    label: "降级失败阈值",
    description: "连续失败多少次后切换为串行上传",
    min: 1,
    max: 10,
    group: "performance"
  },
  {
    key: "degradeCooldownMs",
    label: "降级冷却时间 (ms)",
    description: "降级后恢复并发的等待时间",
    min: 5000,
    max: 120000,
    step: 5000,
    group: "performance"
  }
];

export function SettingsPanel(props: SettingsPanelProps): JSX.Element {
  const [draft, setDraft] = useState<DrigSettings>(props.settings);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["basic"]));
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDraft(props.settings);
  }, [props.settings]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        const changes: Partial<DrigSettings> = {};
        for (const key in draft) {
          if (draft[key as keyof DrigSettings] !== props.settings[key as keyof DrigSettings]) {
            (changes as any)[key] = draft[key as keyof DrigSettings];
          }
        }
        if (Object.keys(changes).length > 0) {
          props.onChange(changes);
        }
      }
    };
  }, [draft, props.settings]);

  const tr = (key: MessageKey, params?: Record<string, string | number>): string =>
    translate(draft.language, key, params);

  const updateDraft = <K extends keyof DrigSettings>(key: K, value: DrigSettings[K]): void => {
    setDraft((prev) => ({ ...prev, [key]: value }));

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      props.onChange({ [key]: value } as Partial<DrigSettings>);
    }, 500);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderSection = (title: string, sectionKey: string, children: React.ReactNode) => (
    <div style={{ marginBottom: "20px", border: "1px solid var(--background-modifier-border)", borderRadius: "4px" }}>
      <div
        onClick={() => toggleSection(sectionKey)}
        style={{
          padding: "12px",
          cursor: "pointer",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--background-secondary)"
        }}
      >
        <span>{title}</span>
        <span>{expandedSections.has(sectionKey) ? "▼" : "▶"}</span>
      </div>
      {expandedSections.has(sectionKey) && (
        <div style={{ padding: "12px" }}>{children}</div>
      )}
    </div>
  );

  return (
    <div className="drig-settings-panel">
      <h2>{tr("setting.title")}</h2>
      <p>{tr("setting.description")}</p>

      {/* Language Setting */}
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          margin: "12px 0"
        }}
      >
        <span style={{ fontWeight: 600 }}>{tr("setting.language.name")}</span>
        <span style={{ fontSize: "12px", opacity: 0.8 }}>
          {tr("setting.language.description")}
        </span>
        <select
          value={draft.language}
          onChange={(event) => {
            updateDraft("language", event.target.value as DrigSettings["language"]);
          }}
        >
          <option value="zh-CN">{tr("language.zh-CN")}</option>
          <option value="en-US">{tr("language.en-US")}</option>
        </select>
      </label>

      {/* Test Connection */}
      <div style={{ margin: "12px 0 20px" }}>
        <button
          type="button"
          disabled={isTesting}
          onClick={async () => {
            if (isTesting) {
              return;
            }
            setIsTesting(true);
            try {
              await props.onTestConnection();
            } finally {
              setIsTesting(false);
            }
          }}
        >
          {isTesting ? tr("connection.testing") : tr("connection.test")}
        </button>
      </div>

      {/* Basic Configuration */}
      {renderSection("基础配置", "basic", (
        <>
          {FIELDS.filter(f => f.group === "basic").map((field) => (
            <label
              key={field.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                margin: "12px 0"
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {field.labelKey ? tr(field.labelKey) : field.label}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>
                {field.descriptionKey ? tr(field.descriptionKey) : field.description}
              </span>
              <input
                type={field.type ?? "text"}
                value={draft[field.key]}
                placeholder={field.placeholder}
                onChange={(event) => {
                  updateDraft(field.key, event.target.value);
                }}
              />
            </label>
          ))}
        </>
      ))}

      {/* Advanced Configuration */}
      {renderSection("高级配置", "advanced", (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              margin: "12px 0"
            }}
          >
            <input
              type="checkbox"
              checked={draft.enableSignature}
              onChange={(event) => {
                updateDraft("enableSignature", event.target.checked);
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontWeight: 600 }}>{tr("field.enableSignature.label")}</span>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>
                {tr("field.enableSignature.description")}
              </span>
            </div>
          </label>

          {FIELDS.filter(f => f.group === "advanced").map((field) => (
            <label
              key={field.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                margin: "12px 0"
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {field.labelKey ? tr(field.labelKey) : field.label}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>
                {field.descriptionKey ? tr(field.descriptionKey) : field.description}
              </span>
              <input
                type={field.type ?? "text"}
                value={draft[field.key]}
                placeholder={field.placeholder}
                onChange={(event) => {
                  updateDraft(field.key, event.target.value);
                }}
              />
            </label>
          ))}
        </>
      ))}

      {/* Performance Configuration */}
      {renderSection("性能配置", "performance", (
        <>
          {NUMBER_FIELDS.map((field) => (
            <label
              key={field.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                margin: "12px 0"
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {field.label}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>
                {field.description}
              </span>
              <input
                type="number"
                value={draft[field.key]}
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                onChange={(event) => {
                  const value = parseInt(event.target.value, 10);
                  if (!isNaN(value)) {
                    updateDraft(field.key, value);
                  }
                }}
              />
            </label>
          ))}
        </>
      ))}

      {/* Copy Template Configuration */}
      {renderSection("复制模板配置", "copy", (
        <>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              margin: "12px 0"
            }}
          >
            <span style={{ fontWeight: 600 }}>默认复制格式</span>
            <span style={{ fontSize: "12px", opacity: 0.8 }}>
              点击复制按钮时使用的默认格式
            </span>
            <select
              value={draft.defaultCopyFormat}
              onChange={(event) => {
                updateDraft("defaultCopyFormat", event.target.value as DrigSettings["defaultCopyFormat"]);
              }}
            >
              <option value="markdown">Markdown</option>
              <option value="url">URL</option>
              <option value="html">HTML</option>
            </select>
          </label>

          {FIELDS.filter(f => f.group === "copy").map((field) => (
            <label
              key={field.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                margin: "12px 0"
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {field.label || (field.labelKey ? tr(field.labelKey) : "")}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.8 }}>
                {field.description || (field.descriptionKey ? tr(field.descriptionKey) : "")}
              </span>
              <input
                type="text"
                value={draft[field.key]}
                placeholder={field.placeholder}
                onChange={(event) => {
                  updateDraft(field.key, event.target.value);
                }}
              />
              <span style={{ fontSize: "11px", opacity: 0.6 }}>
                可用变量: {"{url}"}, {"{alt}"}, {"{title}"}, {"{filename}"}, {"{size}"}, {"{date}"}
              </span>
            </label>
          ))}
        </>
      ))}
    </div>
  );
}
