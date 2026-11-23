import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The privacy promise, enforced by the browser: the built page may only load its own files and is
// blocked from sending data to ANY server (connect-src 'none'), from being framed, and from posting forms.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // charts set inline style attributes
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function csp(): Plugin {
  return {
    name: "inject-csp",
    apply: "build", // dev server needs inline scripts for hot reload
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// Relative base so the built site works from any folder or host (GitHub Pages, Cloudflare Pages…).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), csp()],
  build: { sourcemap: false, chunkSizeWarningLimit: 1200 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
