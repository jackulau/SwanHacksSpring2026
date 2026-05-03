import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import type { Plugin } from "vite";

function canvasProxy(): Plugin {
  return {
    name: "canvas-proxy",
    configureServer(server) {
      server.middlewares.use("/api/canvas-proxy", async (req: any, res: any) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const canvasBase = req.headers["x-canvas-url"] as string;
        const canvasToken = req.headers["x-canvas-token"] as string;
        const path = url.pathname + url.search;

        if (!canvasBase || !canvasToken) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing x-canvas-url or x-canvas-token headers" }));
          return;
        }

        try {
          const target = canvasBase.replace(/\/+$/, "") + "/api/v1" + path;
          const response = await fetch(target, {
            headers: { Authorization: `Bearer ${canvasToken}` },
          });
          const body = await response.text();
          res.writeHead(response.status, {
            "Content-Type": response.headers.get("content-type") || "application/json",
          });
          res.end(body);
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({ routesDirectory: "./src/routes" }),
    react(),
    tailwindcss(),
    canvasProxy(),
  ],
  server: {
    port: 3000,
    // COOP/COEP enable cross-origin isolation, which transformers.js
    // (`@huggingface/transformers`) needs for SharedArrayBuffer + threaded
    // WASM. Without these the Whisper model load can fail with a vague
    // "fetch failed" or "RuntimeError: WASM" error.
    // `credentialless` lets cross-origin fetches (HuggingFace CDN) work
    // without the model's host needing CORP headers.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
