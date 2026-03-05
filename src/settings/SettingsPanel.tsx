import { useEffect, useMemo, useRef, useState } from "react";
import { t as translate, type MessageKey } from "../i18n";
import type { DrigSettings } from "../types";

interface SettingsPanelProps {
  settings: DrigSettings;
  onChange: (patch: Partial<DrigSettings>) => void;
  onTestConnection: () => Promise<void>;
}

interface TextField {
  key: Exclude<keyof DrigSettings, "language" | "enableSignature">;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  placeholder: string;
  type?: "text" | "password";
}

const FIELDS: TextField[] = [
  {
    key: "accountId",
    labelKey: "field.accountId.label",
    descriptionKey: "field.accountId.description",
    placeholder: "0123456789abcdef"
  },
  {
    key: "bucketName",
    labelKey: "field.bucketName.label",
    descriptionKey: "field.bucketName.description",
    placeholder: "my-image-bucket"
  },
  {
    key: "accessKeyId",
    labelKey: "field.accessKeyId.label",
    descriptionKey: "field.accessKeyId.description",
    placeholder: "xxxxxxxxxxxxxxxxxxxx"
  },
  {
    key: "secretAccessKey",
    labelKey: "field.secretAccessKey.label",
    descriptionKey: "field.secretAccessKey.description",
    placeholder: "************************",
    type: "password"
  },
  {
    key: "region",
    labelKey: "field.region.label",
    descriptionKey: "field.region.description",
    placeholder: "auto"
  },
  {
    key: "publicBaseUrl",
    labelKey: "field.publicBaseUrl.label",
    descriptionKey: "field.publicBaseUrl.description",
    placeholder: "https://img.example.com"
  },
  {
    key: "keyPrefix",
    labelKey: "field.keyPrefix.label",
    descriptionKey: "field.keyPrefix.description",
    placeholder: "drig-images"
  },
  {
    key: "defaultAltText",
    labelKey: "field.defaultAltText.label",
    descriptionKey: "field.defaultAltText.description",
    placeholder: "图片"
  },
  {
    key: "signatureKey",
    labelKey: "field.signatureKey.label",
    descriptionKey: "field.signatureKey.description",
    placeholder: "your-secret-signature-key",
    type: "password"
  }
];

export function SettingsPanel(props: SettingsPanelProps): JSX.Element {
  const rows = useMemo(() => FIELDS, []);
  const [draft, setDraft] = useState<DrigSettings>(props.settings);
  const [isTesting, setIsTesting] = useState(false);
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

  return (
    <div className="drig-settings-panel">
      <h2>{tr("setting.title")}</h2>
      <p>{tr("setting.description")}</p>

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

      {rows.map((field) => (
        <label
          key={field.key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            margin: "12px 0"
          }}
        >
          <span style={{ fontWeight: 600 }}>{tr(field.labelKey)}</span>
          <span style={{ fontSize: "12px", opacity: 0.8 }}>{tr(field.descriptionKey)}</span>
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
    </div>
  );
}
