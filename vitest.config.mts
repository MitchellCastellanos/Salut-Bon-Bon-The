import { defineConfig } from "vitest/config";

// Next.js keeps `jsx: preserve` in tsconfig; Vitest needs the automatic runtime to render server components in tests.
export default defineConfig({ oxc: { jsx: { runtime: "automatic" } } } as never);
