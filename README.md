# drig (Obsidian Plugin)

Author: **chiway**  
Website: **https://ssvex.com**

`drig` detects pasted images in Obsidian editor, uploads them to Cloudflare R2, and inserts markdown image tags automatically.

## Tech Stack

- React 18
- Vite
- TypeScript
- pnpm

## Features

- Listen to `editor-paste` and detect clipboard images.
- Upload pasted images to Cloudflare R2 (S3-compatible API + SigV4).
- Insert markdown image syntax `![alt](url)` at cursor.
- React-based plugin settings panel.
- Built-in i18n with default language set to Chinese (`zh-CN`).
- Includes a "Test Connection" action in settings to verify R2 credentials.

## R2 Preparation

1. Create a bucket in Cloudflare R2.
2. Create API token with object write permission.
3. Prepare:
   - `Account ID`
   - `Bucket Name`
   - `Access Key ID`
   - `Secret Access Key`
4. Optional: bind custom domain and use it as `Public Base URL`.

## Development (pnpm)

```bash
pnpm install
pnpm dev
```

Production build:

```bash
pnpm build
```

Build output directory is `dist/`, including:
- `dist/main.js`
- `dist/manifest.json`
- `dist/versions.json`

## Install to Obsidian

1. Build project to generate files in `dist/`.
2. Copy files below from `dist/` to vault plugin directory:
   - `manifest.json`
   - `versions.json`
   - `main.js`
3. Target folder:
   - `<Vault>/.obsidian/plugins/drig/`
4. Reload Obsidian and enable plugin `drig`.

## Settings

- `Account ID`
- `Bucket Name`
- `Access Key ID`
- `Secret Access Key`
- `Region` (use `auto`)
- `Public Base URL` (optional)
- `Key Prefix`
- `Default Alt Text`
