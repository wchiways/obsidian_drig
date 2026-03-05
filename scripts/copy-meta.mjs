import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const files = ["manifest.json", "versions.json"];

await mkdir(distDir, { recursive: true });

for (const file of files) {
  await copyFile(path.join(rootDir, file), path.join(distDir, file));
}
