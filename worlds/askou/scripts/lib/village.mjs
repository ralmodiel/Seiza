// Drives the village in a headless browser, for the probes in this folder (QA and improvement rounds). Run them from the repo's root.
// Needs the dev server:  ASKOU_URL=<running Askou> ASKOU_TEST=1 VITE_SEIZA_WORLD_ID=askou npx vite --port 5199 --strictPort --host 127.0.0.1
// (ASKOU_TEST=1 marks every request as a test, which Askou records nowhere.)
//   import { launch, enter, state, shot, Checks } from "./lib/village.mjs"
// Env: VILLAGE_URL (default http://localhost:5199), GPU=0 (SwiftShader instead of hardware WebGL), UNCAPPED=1 (no 60 fps cap, for speed probes), PW (playwright path).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || `${process.env.HOME}/harness/video/node_modules/playwright`);

export const BASE = process.env.VILLAGE_URL || "http://localhost:5199";
export const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..", ".scratch", "out"); // pictures and reports: gitignored
mkdirSync(OUT, { recursive: true });

export async function launch() {
  const gpu = process.env.GPU !== "0"; // hardware WebGL (60 fps here); GPU=0 = SwiftShader, a few frames a second
  return chromium.launch({
    headless: true,
    args: gpu
      ? ["--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=vulkan", "--enable-features=Vulkan", "--enable-webgl", ...(process.env.UNCAPPED === "1" ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : [])]
      : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
  });
}

/** Opens the village and enters it. `query` e.g. "skyHour=12&at=66,0.2,0,-1.57". Returns { page, ctx, errors }. `init`: a function run in the page before its scripts; `alone`: stay out of the room. */
export async function enter(browser, { query = "", width = 1280, height = 800, touch = false, settle = 6000, name = "QA Bot", reducedMotion = false, init = null, alone = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  // alone: no room (other probes' browsers stand in the same room, and their avatars would be counted and drawn)
  if (alone) await ctx.routeWebSocket(/\/rooms\//, (ws) => ws.close());
  if (init) await ctx.addInitScript(init); // runs before the page's own scripts (e.g. to take the browser's WebXR away)
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    const text = m.text();
    // a call the GPU refused is a warning on the console (a texture that changed size, say): what it should have drawn is not on the screen
    if (m.type() === "warning" && /GL_INVALID|GL_OUT_OF_MEMORY|WebGL: (INVALID|CONTEXT_LOST)/.test(text)) return void errors.push(`gpu: ${text.slice(0, 200)}`);
    if (m.type() !== "error") return;
    // no room server runs in these probes (the Worker): its refused connections are not the village's errors
    if (/WebSocket|\/rooms|\/api\/(avatars|assets|config)|ERR_CONNECTION_REFUSED|Failed to load resource/.test(text)) return;
    errors.push(`console: ${text.slice(0, 300)}`);
  });
  await page.goto(`${BASE}/?${query}`, { waitUntil: "domcontentloaded" });
  const nameBox = page.locator('input[autocomplete="nickname"]');
  await nameBox.waitFor({ timeout: 30000 });
  await nameBox.fill(name);
  const remember = page.locator('input[type="checkbox"]').first();
  if (await remember.isChecked().catch(() => false)) await remember.uncheck();
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => !!window.__askou, null, { timeout: 60000 });
  // Seiza's controls guide opens on a first visit, over the middle of the view
  const guide = page.locator('[aria-labelledby="seiza-guide-title"] button[aria-label]').first();
  if (await guide.isVisible().catch(() => false)) await guide.click();
  await page.waitForTimeout(settle);
  return { page, ctx, errors };
}

/** The village's own state and the renderer's counters (the dev-only window.__askou hook in Village.tsx). */
export const state = (page) =>
  page.evaluate(() => {
    const a = window.__askou, s = a.village(), info = a.gl.info;
    return {
      bots: s.bots.length, posts: s.posts.length, live: s.live, open: s.open, busy: s.busy, near: s.near, trail: s.trail, directory: s.directory,
      threads: Object.fromEntries(Object.entries(s.threads).map(([k, v]) => [k, v.length])),
      shown: [...a.live.shown.entries()].filter(([, v]) => v > 0.5).map(([k]) => k),
      ground: a.ground(), self: a.self(),
      calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
      renderer: (() => { const g = a.gl.getContext(), e = g.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.VERSION); })(),
    };
  });

export async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  return path;
}

/** Frames a second, measured over `ms` in the page. */
export const fps = (page, ms = 3000) =>
  page.evaluate(
    (ms) =>
      new Promise((done) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 >= ms) done(+((n * 1000) / (performance.now() - t0)).toFixed(1));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    ms
  );

/** ok/FAIL lines and the verdict: `N checks, M FAIL`; exits non-zero on a failure. */
export class Checks {
  n = 0;
  bad = 0;
  check(ok, what, detail = "") {
    this.n++;
    if (!ok) this.bad++;
    if (!ok || process.env.ALL) console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? ` — ${detail}` : ""}`);
    return ok;
  }
  done(label = "") {
    console.log(`${label ? `${label}: ` : ""}${this.n} checks, ${this.bad} FAIL`);
    process.exitCode = this.bad ? 1 : 0;
  }
}
