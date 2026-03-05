import { vi } from "vitest";

// Mock crypto API
Object.defineProperty(global, "crypto", {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: vi.fn(async () => new ArrayBuffer(32)),
      importKey: vi.fn(async () => ({} as CryptoKey)),
      sign: vi.fn(async () => new ArrayBuffer(32))
    }
  },
  writable: true,
  configurable: true
});

// Mock navigator
Object.defineProperty(global, "navigator", {
  value: {
    onLine: true,
    clipboard: {
      writeText: vi.fn(async () => Promise.resolve())
    }
  },
  writable: true,
  configurable: true
});
