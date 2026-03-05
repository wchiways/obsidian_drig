import { createRoot, type Root } from "react-dom/client";
import { App, Editor, Notice, Plugin, PluginSettingTab } from "obsidian";
import { normalizeLocale, t as translate, type MessageKey } from "./i18n";
import { SettingsPanel } from "./settings/SettingsPanel";
import {
  getImageFilesFromClipboard,
  hasRequiredConfig,
  testR2Connection,
  uploadImageToR2
} from "./r2";
import { DEFAULT_SETTINGS, type DrigSettings } from "./types";

export default class DrigPlugin extends Plugin {
  settings: DrigSettings = DEFAULT_SETTINGS;
  private settingsTab: DrigSettingTab | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.settingsTab = new DrigSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt: ClipboardEvent, editor: Editor) => {
        void this.handlePaste(evt, editor);
      })
    );
  }

  onunload(): void {
    this.settingsTab?.dispose();
    this.settingsTab = null;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.language = normalizeLocale(this.settings.language);
    if (this.settings.signatureKey === undefined) {
      this.settings.signatureKey = "";
    }
    if (this.settings.enableSignature === undefined) {
      this.settings.enableSignature = false;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async handlePaste(evt: ClipboardEvent, editor: Editor): Promise<void> {
    const files = getImageFilesFromClipboard(evt);
    if (files.length === 0) {
      return;
    }

    if (!hasRequiredConfig(this.settings)) {
      new Notice(this.tr("notice.configMissing"));
      return;
    }

    const clipboardData = evt.clipboardData;
    evt.preventDefault();
    const inserted: string[] = [];
    let hasFailure = false;

    for (const file of files) {
      try {
        const imageUrl = await uploadImageToR2(file, this.settings);
        const altText = this.settings.defaultAltText.trim() || "图片";
        inserted.push(`![${altText}](${imageUrl})`);
      } catch (error) {
        hasFailure = true;
        const message = error instanceof Error ? error.message : String(error);
        new Notice(this.tr("notice.uploadFailed", { message }));
      }
    }

    if (inserted.length > 0) {
      editor.replaceSelection(inserted.join("\n"));
      new Notice(this.tr("notice.uploadSuccess", { count: inserted.length }));
    } else if (hasFailure && clipboardData) {
      const text = clipboardData.getData("text/plain");
      const html = clipboardData.getData("text/html");
      if (text || html) {
        editor.replaceSelection(text || html);
      } else {
        new Notice(this.tr("notice.uploadFailedRetry"));
      }
    }
  }

  private tr(key: MessageKey, params?: Record<string, string | number>): string {
    return translate(this.settings.language, key, params);
  }

  async testConnection(): Promise<void> {
    if (!hasRequiredConfig(this.settings)) {
      new Notice(this.tr("notice.configMissing"));
      return;
    }

    new Notice(this.tr("notice.connectionTesting"));
    try {
      await testR2Connection(this.settings);
      new Notice(this.tr("notice.connectionSuccess"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(this.tr("notice.connectionFailed", { message }));
    }
  }
}

class DrigSettingTab extends PluginSettingTab {
  private plugin: DrigPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DrigPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const mount = containerEl.createDiv();

    this.root?.unmount();
    this.root = createRoot(mount);
    this.root.render(
      <SettingsPanel
        settings={this.plugin.settings}
        onChange={(patch) => {
          const normalizedPatch = normalizePatch(patch);
          this.plugin.settings = { ...this.plugin.settings, ...normalizedPatch };
          void this.plugin.saveSettings();
        }}
        onTestConnection={async () => {
          await this.plugin.testConnection();
        }}
      />
    );
  }

  hide(): void {
    this.root?.unmount();
    this.root = null;
  }

  dispose(): void {
    this.root?.unmount();
    this.root = null;
  }
}

function normalizePatch(patch: Partial<DrigSettings>): Partial<DrigSettings> {
  const normalized: Partial<DrigSettings> = { ...patch };

  if (normalized.language !== undefined) {
    normalized.language = normalizeLocale(normalized.language);
  }

  return normalized;
}
