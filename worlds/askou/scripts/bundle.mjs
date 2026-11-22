// Does the village build for production, and is the bundle clean? Runs the local bundling step only (vite build into
// node_modules/.cache/askou-bundle: not the world's build.mjs, which also looks up a Cloudflare namespace and writes dist/), then reads the
// files: the Askou address given at build time is baked in, no development address, no test or recording header, no
// dev-only probe hook; and it prints the sizes. Nothing is sent anywhere.
// Usage: node worlds/askou/scripts/bundle.mjs      env: SKIP_BUILD=1 reads the last build.   Verdict: `bundle: N checks, M FAIL`.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Checks } from "./lib/village.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../.."), OUT = join(ROOT, "node_modules", ".cache", "askou-bundle") /* not watched by the dev server: an index.html written under .scratch reloads every open page */, API = "https://askou.example.org";
const c = new Checks();
let built = true, log = "";
if (process.env.SKIP_BUILD !== "1") {
  try { log = execSync(`npx vite build --outDir ${JSON.stringify(OUT)} --emptyOutDir --logLevel warn`, { cwd: ROOT, env: { ...process.env, VITE_SEIZA_WORLD_ID: "askou", VITE_ASKOU_API: API }, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }); }
  catch (e) { built = false; log = `${e.stdout ?? ""}${e.stderr ?? ""}`; }
}
c.check(built && existsSync(join(OUT, "index.html")), "the village builds for production", log.trim().split("\n").slice(-3).join(" | ").slice(0, 300));
if (built) {
  const files = [];
  (function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(OUT);
  const js = files.filter((f) => /\.(js|mjs)$/.test(f)).map((f) => { const text = readFileSync(f, "utf8"); return { f: f.slice(OUT.length + 1), text, gz: gzipSync(text).length }; });
  const has = (re) => js.filter((j) => re.test(j.text)).map((j) => j.f);
  c.check(has(/askou\.example\.org/).length > 0, "the Askou address given at build time is in the bundle");
  for (const [re, what] of [
    [/(localhost|127\.0\.0\.1):(7173|7080|5199)/, "no development address of Askou or the dev server"],
    [/X-Askou-Test/i, "no test header (only the dev proxy adds it)"],
    [/X-Chat-Log/i, "no recording header (the village never asks Askou to record a talk)"],
    [/__askou/, "no dev-only probe hook"],
    [/ASKOU_URL|ASKOU_TEST/, "no dev proxy setting"],
  ]) { const at = has(re); c.check(at.length === 0, `the bundle holds ${what}`, at.slice(0, 3).join(", ")); }
  const maps = files.filter((f) => f.endsWith(".map")); // Seiza ships them by choice (vite.config.ts: its source is public, AGPL)
  const total = js.reduce((n, j) => n + j.gz, 0), kb = (n) => `${(n / 1024).toFixed(0)} kB`;
  const village = js.filter((j) => /Find a bot/.test(j.text)); // the chunk with the village's own HUD
  console.log(`scripts: ${js.length} files, ${kb(total)} gzipped; largest: ${[...js].sort((a, b) => b.gz - a.gz).slice(0, 4).map((j) => `${j.f.replace(/^assets\//, "")} ${kb(j.gz)}`).join(" · ")}`);
  console.log(`the village's HUD is in: ${village.map((j) => `${j.f.replace(/^assets\//, "")} ${kb(j.gz)}`).join(" · ") || "no chunk found"}`);
  c.check(village.length > 0, "the village's HUD is in the bundle");
  // what a visitor loads before the world shows: the page's entry script and what it preloads (other worlds' rooms and the headset emulator load only when used)
  const html = readFileSync(join(OUT, "index.html"), "utf8"), first = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => js.find((j) => j.f === m[1])).filter(Boolean);
  const start = first.reduce((n, j) => n + j.gz, 0) + village.reduce((n, j) => n + j.gz, 0);
  console.log(`to start: ${first.length} scripts from the page + the village's, ${kb(start)} gzipped; source maps: ${maps.length} (kept apart, loaded by developer tools only)`);
  c.check(first.length > 0 && start < 1200 * 1024, "a visitor loads under 1.2 MB of scripts (gzipped) before the village shows", kb(start));
}
c.done("bundle");
