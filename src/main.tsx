import { createRoot, type Root } from "react-dom/client";
import { App, Editor, ItemView, Notice, Plugin, PluginSettingTab, WorkspaceLeaf } from "obsidian";
import { normalizeLocale, t as translate, type MessageKey } from "./i18n";
import { SettingsPanel } from "./settings/SettingsPanel";
import { ImageManager } from "./imageManager/ImageManager";
import {
  getImageFilesFromClipboard,
  hasRequiredConfig,
  testR2Connection,
  uploadImageToR2
} from "./r2";
import { DEFAULT_SETTINGS, type DrigSettings } from "./types";
import { UploadQueueManager } from "./upload/uploadQueueManager";
import type { UploadTask } from "./upload/types";

const IMAGE_MANAGER_VIEW_TYPE = "drig-image-manager";

export default class DrigPlugin extends Plugin {
  settings: DrigSettings = DEFAULT_SETTINGS;
  private settingsTab: DrigSettingTab | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.settingsTab = new DrigSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.registerView(
      IMAGE_MANAGER_VIEW_TYPE,
      (leaf) => new ImageManagerView(leaf, this)
    );

    this.addRibbonIcon("image", "R2 图片管理", () => {
      this.activateImageManagerView();
    });

    this.addCommand({
      id: "open-image-manager",
      name: "打开图片管理器",
      callback: () => {
        this.activateImageManagerView();
      }
    });

    this.registerEvent(
      this.app.workspace.on("editor-paste", (evt: ClipboardEvent, editor: Editor) => {
        void this.handlePaste(evt, editor);
      })
    );
  }

  async activateImageManagerView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(IMAGE_MANAGER_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: IMAGE_MANAGER_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
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

    // Use upload queue for concurrent uploads
    const queueManager = new UploadQueueManager(this.settings);
    queueManager.enqueue(files);

    try {
      const summary = await queueManager.start();

      // Sort successful results by order and insert
      const successTasks: UploadTask[] = [];
      queueManager["state"].tasks.forEach((task) => {
        if (task.status === "success" && task.result) {
          successTasks.push(task);
        }
      });

      successTasks.sort((a, b) => a.order - b.order);

      const inserted: string[] = successTasks.map((task) => {
        const altText = this.settings.defaultAltText.trim() || "图片";
        return `![${altText}](${task.result!.url})`;
      });

      if (inserted.length > 0) {
        editor.replaceSelection(inserted.join("\n"));
      }

      // Show summary notification
      if (summary.failed === 0 && summary.success > 0) {
        new Notice(this.tr("notice.uploadSuccess", { count: summary.success }));
      } else if (summary.success > 0 && summary.failed > 0) {
        new Notice(
          `上传完成：成功 ${summary.success} 张，失败 ${summary.failed} 张`
        );
      } else if (summary.failed > 0) {
        // All failed - show first error
        const firstError = summary.errors[0];
        if (firstError) {
          new Notice(
            this.tr("notice.uploadFailed", { message: firstError.message })
          );
        }

        // Fallback to clipboard text if available
        if (clipboardData) {
          const text = clipboardData.getData("text/plain");
          const html = clipboardData.getData("text/html");
          if (text || html) {
            editor.replaceSelection(text || html);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(this.tr("notice.uploadFailed", { message }));

      // Fallback to clipboard text
      if (clipboardData) {
        const text = clipboardData.getData("text/plain");
        const html = clipboardData.getData("text/html");
        if (text || html) {
          editor.replaceSelection(text || html);
        }
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

class ImageManagerView extends ItemView {
  private plugin: DrigPlugin;
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DrigPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return IMAGE_MANAGER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "R2 图片管理";
  }

  getIcon(): string {
    return "image";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    const mount = container.createDiv();

    this.root = createRoot(mount);
    this.root.render(<ImageManager settings={this.plugin.settings} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
