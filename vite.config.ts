import { builtinModules } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const externalModules = [
  "obsidian",
  "electron",
  "@codemirror/autocomplete",
  "@codemirror/collab",
  "@codemirror/commands",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/lr",
  ...builtinModules
];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: mode !== "production",
    minify: mode === "production",
    emptyOutDir: true,
    outDir: path.resolve(__dirname, "dist"),
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      formats: ["cjs"],
      fileName: () => "main.js"
    },
    rollupOptions: {
      external: externalModules
    }
  }
}));
