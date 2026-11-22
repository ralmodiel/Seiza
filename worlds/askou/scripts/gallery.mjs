// A portrait of every bot, as contact sheets: stands the visitor in front of each bot in turn and crops the view.
// Usage: node worlds/askou/scripts/gallery.mjs [name=gallery] ["query" e.g. skyHour=21] [keys,comma,separated | all] [dist=3.2]
// Writes .scratch/out/<name>-<n>.png (24 portraits a sheet, 6 across) and prints one line per bot that has no figure.
import { launch, enter, OUT, Checks } from "./lib/village.mjs";

const [name = "gallery", query = "skyHour=10", which = "all", dist = "3.2"] = process.argv.slice(2);
const CELL = 320, COLS = 6, PER = 24;
const browser = await launch();
const c = new Checks();
try {
  const { page, errors } = await enter(browser, { query, width: 960, height: 720, settle: 4000 });
  const posts = await page.evaluate(() => window.__askou.village().posts.map((p) => ({ key: p.key, x: p.x, z: p.z })));
  const heights = await page.evaluate(() => window.__askou.heights());
  const keys = which === "all" ? posts.map((p) => p.key) : which.split(",");
  // a desktop visitor starts in first person, so their own avatar is not in the portrait (VIEW=third: press V first)
  if (process.env.VIEW === "third") await page.keyboard.press("v");
  const shots = [];
  for (const key of keys) {
    const p = posts.find((q) => q.key === key);
    if (!c.check(!!p, `bot ${key} has a post`)) continue;
    // stand on the side the bot faces when someone is near: it turns to the visitor, so any walkable side will do
    const spot = await page.evaluate(
      ({ p, dist }) => {
        const a = window.__askou, g = a.store;
        const at = g.standBy(p, [66, 0], (x, z) => a.groundAt(x, z), a.village().posts);
        if (!at) return null;
        const dx = at[0] - p.x, dz = at[2] - p.z, len = Math.hypot(dx, dz) || 1;
        const spot = [p.x + (dx / len) * dist, at[1], p.z + (dz / len) * dist];
        a.warp(a.groundAt(spot[0], spot[2]) === null ? at : spot);
        a.face(p.x, p.z);
        return spot;
      },
      { p, dist: +dist }
    );
    if (!c.check(!!spot, `bot ${key} has a walkable spot beside it`)) continue;
    await page.waitForTimeout(1500);
    const shown = await page.evaluate((k) => window.__askou.live.shown.get(k) ?? 0, key);
    c.check(shown > 0.9, `bot ${key} stands as a figure when visited`, `shown ${shown.toFixed(2)}`);
    c.check(heights[key] !== undefined, `bot ${key} stands on measured ground`);
    shots.push({ key, png: (await page.screenshot({ clip: { x: 240, y: 150, width: 480, height: 480 } })).toString("base64") });
  }
  // the sheets, laid out by the browser itself
  const sheet = await browser.newPage({ viewport: { width: COLS * CELL, height: (PER / COLS) * (CELL + 22) } });
  for (let i = 0; i * PER < shots.length; i++) {
    const cells = shots.slice(i * PER, (i + 1) * PER).map((s) => `<figure><img src="data:image/png;base64,${s.png}"><figcaption>${s.key}</figcaption></figure>`).join("");
    await sheet.setContent(`<style>body{margin:0;display:grid;align-content:start;grid-template-columns:repeat(${COLS},${CELL}px);background:#111;font:13px system-ui;color:#fff}figure{margin:0}img{width:${CELL}px;height:${CELL}px;display:block}figcaption{height:22px;line-height:22px;text-align:center}</style>${cells}`);
    await sheet.screenshot({ path: `${OUT}/${name}-${i + 1}.png` });
    console.log(`${OUT}/${name}-${i + 1}.png`);
  }
  c.check(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
c.done("gallery");
