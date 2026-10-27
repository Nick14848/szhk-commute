import { defineConfig } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Local video artifact sink. configureServer is not part of the static build.
function localCapture() {
  return {
    name: "local-capture-artifact",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/__local_capture", async (req, res) => {
        const host = req.headers.host ?? "";
        const origin = req.headers.origin ?? "";
        if (req.method !== "POST" || !/^(127\.0\.0\.1|localhost):\d+$/.test(host) || origin !== `http://${host}`) {
          res.statusCode = 403; res.end("Local same-origin recording only"); return;
        }
        if (req.headers["content-type"] !== "video/mp4") {
          res.statusCode = 415; res.end("MP4 required"); return;
        }
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 80 * 1024 * 1024) throw new Error("Recording exceeds 80 MB");
            chunks.push(Buffer.from(chunk));
          }
          const dir = fileURLToPath(new URL("./review-2026-10-27/video/", import.meta.url));
          await mkdir(dir, { recursive: true });
          const path = `${dir}szhk-commute-vertical-${Date.now()}.mp4`;
          await writeFile(path, Buffer.concat(chunks), { flag: "wx" });
          res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ path, bytes: size }));
        } catch (error) {
          res.statusCode = 500; res.end(String(error));
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [localCapture()],
});
