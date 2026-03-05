# R2 Image Paste Uploader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Obsidian plugin that intercepts pasted images, uploads them to Cloudflare R2, and inserts a Markdown image link.

**Architecture:** Use Obsidian's `editor-paste` event to detect image clipboard items and prevent default local attachment behavior. Upload each image to R2 through the S3-compatible API signed with AWS Signature V4, then write `![]()` at the cursor with the public URL.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, AWS SigV4 (implemented in plugin utility code).

---

### Task 1: Scaffold plugin project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `versions.json`

**Step 1: Define package scripts and dependencies**
- Add build and dev scripts for Obsidian plugin bundling.

**Step 2: Add TypeScript compiler configuration**
- Enable strict TS options and target modern Electron runtime.

**Step 3: Add Obsidian manifest metadata**
- Set plugin id, name, version, and description for R2 paste upload behavior.

**Step 4: Add compatibility map**
- Add `versions.json` for release compatibility.

**Step 5: Commit**
- Commit scaffold files.

### Task 2: Implement plugin runtime

**Files:**
- Create: `main.ts`

**Step 1: Add settings model and defaults**
- Define R2 credentials, bucket config, URL base, and object key prefix.

**Step 2: Register paste interception**
- Listen to `editor-paste`, detect image clipboard items, and stop default paste flow.

**Step 3: Implement R2 uploader**
- Convert clipboard file to bytes, sign request with SigV4, `PUT` to R2 endpoint.

**Step 4: Insert Markdown image links**
- Build final URL from configured public base URL and insert `![alt](url)` into editor.

**Step 5: Add notices and error handling**
- Show upload progress/failures and skip interception when settings are incomplete.

### Task 3: Implement plugin settings UI and docs

**Files:**
- Modify: `main.ts`
- Create: `README.md`

**Step 1: Add settings tab**
- Expose inputs for account id, bucket, access key, secret key, region, key prefix, and public URL.

**Step 2: Add safe defaults and validation helper**
- Validate required fields before upload attempts.

**Step 3: Document setup and usage**
- Write README with R2 prerequisites and plugin behavior.

**Step 4: Build to validate TS**
- Run `npm run build` and fix any compile issues.

**Step 5: Commit**
- Commit runtime + docs.
