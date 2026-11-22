// Builds the Askou Village deployment into dist/: Seiza's own client and Worker with the world switched to "askou",
// plus the village's world config and icon, and SeiOU's campus model, navmesh, floors and lights (the village stands
// on SeiOU's campus and loads them from SeiOU's URLs).
//
//   VITE_ASKOU_API=https://<your Askou> node worlds/askou/build.mjs
//   npx wrangler deploy --config worlds/askou/wrangler.jsonc
//
// VITE_ASKOU_API is where the built village asks its questions: an Askou that allows the village's origin (CORS).
// Without it the build asks /askou on its own origin, which only the development server forwards (vite.config.ts).
import { execSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const DIST = join(ROOT, "dist");
const WORLD_ID = "askou";

function step(label, fn) {
  console.log(`\n[askou] ${label}`);
  return fn();
}

if (!process.env.VITE_ASKOU_API) console.warn("[askou] VITE_ASKOU_API is not set: the built village will ask /askou on its own origin, where nothing answers unless you route it to Askou.");

const env = { ...process.env, VITE_SEIZA_WORLD_ID: WORLD_ID };
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: "inherit", env });
step("Building Seiza for the askou world", () => {
  run("node scripts/fetch-assets.mjs");
  run("npx tsc --noEmit");
  run("npx vite build");
  // needs Cloudflare credentials; a local build may have none (the deploy itself reports a missing id)
  try {
    run("node scripts/ensure-kv-namespace.mjs");
  } catch {
    console.warn("[askou] Could not look up the avatar namespace (not logged in to Cloudflare?). Continuing.");
  }
});

step("Adding the world config, SeiOU's campus, and the icon", () => {
  mkdirSync(join(DIST, "worlds", WORLD_ID), { recursive: true });
  cpSync(join(HERE, "world"), join(DIST, "worlds", WORLD_ID), { recursive: true });
  cpSync(join(ROOT, "worlds", "seiou", "world", "models"), join(DIST, "worlds", "seiou", "models"), { recursive: true });
  copyFileSync(join(HERE, "favicon.svg"), join(DIST, "favicon.svg"));
  const indexPath = join(DIST, "index.html");
  const index = readFileSync(indexPath, "utf8");
  const withIcon = index.replace(/href="\/favicon\.svg(\?[^"]*)?"/, 'href="/favicon.svg?v=askou-1"');
  if (withIcon === index) console.warn("[askou] No favicon link found in index.html; the tab may show Seiza's icon.");
  writeFileSync(indexPath, withIcon);
});

step("Linking the avatar store", () => {
  const rootConfig = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
  const id = rootConfig.match(/"binding":\s*"AVATARS"[^}]*"id":\s*"([^"]*)"/)?.[1];
  const ownPath = join(HERE, "wrangler.jsonc");
  const own = readFileSync(ownPath, "utf8");
  if (!id || id.startsWith("REPLACE")) return console.log("[askou] No avatar namespace id in wrangler.jsonc yet; fine for a local build.");
  const updated = own.replace(/("binding":\s*"AVATARS"[^}]*"id":\s*")[^"]*(")/, `$1${id}$2`);
  if (updated !== own) writeFileSync(ownPath, updated);
  console.log(`[askou] Avatar namespace ${id}.`);
});

console.log("\n[askou] Built. Deploy with: npx wrangler deploy --config worlds/askou/wrangler.jsonc");
