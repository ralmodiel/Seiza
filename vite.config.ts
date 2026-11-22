import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Keeps local-only test models out of every build.
 *
 * `public/__poselab/` holds VRM files for the local pose lab, some of which
 * may not be redistributed. The folder is gitignored, but Vite copies all of
 * `public/` into `dist/`, so a deploy from this machine would have served
 * them publicly. The dev server still serves the folder, so the pose lab
 * keeps working.
 */
function excludeLocalOnlyAssets(): Plugin {
  return {
    name: "seiza-exclude-local-only-assets",
    apply: "build",
    closeBundle() {
      rmSync(resolve(__dirname, "dist/__poselab"), { recursive: true, force: true });
    },
  };
}

/**
 * Serves a separate world's files in development, as its build.mjs does in
 * a build: /worlds/<id>/... from worlds/<id>/world/... (its world.json, and
 * any pictures it ships). So `VITE_SEIZA_WORLD_ID=seisugbo npm run dev`
 * runs that world with hot reload. Files in public/worlds/ win, as before.
 */
function serveWorldFolders(): Plugin {
  const types: Record<string, string> = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
  return {
    name: "seiza-serve-world-folders",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.split("?")[0].match(/^\/worlds\/([a-z0-9-]+)\/(.+)$/);
        if (!match || match[2].includes("..")) return next();
        const file = resolve(__dirname, "worlds", match[1], "world", match[2]);
        if (!existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
        res.end(readFileSync(file));
      });
    },
  };
}

/**
 * The Askou world (worlds/askou) asks a running Askou for its bots and their answers. In development the three calls
 * the village makes go to ASKOU_URL; nothing is forwarded when it is not set (no address of another project lives in
 * this file). Anything else under /askou/api/ is a 404 here: the rest of Askou (reactions, erasing a conversation,
 * its admin API) is not reachable through this server.
 * A village visitor is anonymous to Askou: cookies and credentials are not passed on, Askou's cookies are not passed
 * back, and X-Chat-Log (the header that asks Askou to record a conversation) is dropped whoever sends it.
 * ASKOU_TEST=1 marks every forwarded request as a test, which Askou records nowhere: set it for QA and automation.
 */
const ASKOU_CALLS: Record<string, string> = { "/askou/api/bot": "GET", "/askou/api/bot/characters": "GET", "/askou/api/chat": "POST" };
function askouProxy(): Record<string, import("vite").ProxyOptions> {
  const target = process.env.ASKOU_URL;
  if (!target) return {};
  const test = process.env.ASKOU_TEST === "1";
  return {
    "^/askou/api(/|$)": {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/askou/, ""),
      // the path as sent, not normalised: "/askou/api/chat/../x" is not one of the three calls
      bypass: (request) => (ASKOU_CALLS[(request.url ?? "").split("?")[0]] === request.method ? undefined : false),
      configure: (proxy) => {
        proxy.on("proxyReq", (request) => {
          for (const header of ["cookie", "authorization", "x-chat-log"]) request.removeHeader(header);
          if (test) request.setHeader("X-Askou-Test", "1");
        });
        proxy.on("proxyRes", (response) => void delete response.headers["set-cookie"]);
      },
    },
  };
}

// Static frontend dev server only. The Worker (worker/index.ts, which
// also hosts the room server as a bound Durable Object — worker/room.ts)
// runs separately via `npm run worker:dev` — see DOCS.md's "Local
// development" section.
export default defineConfig({
  plugins: [react(), excludeLocalOnlyAssets(), serveWorldFolders()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/rooms": { target: "ws://127.0.0.1:8787", ws: true, changeOrigin: true },
      ...askouProxy(),
    },
  },
});
