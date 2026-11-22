// In a headset, is a visitor taken to a bot put where it stands before them, and does the talk stay with that bot? (A gaze viewer "clicks" what the middle of the view
// rests on: a neighbour standing behind the bot must not take the talk over.) One headset session, every bot in turn.
// Usage: node worlds/askou/scripts/xr-gaze.mjs [bot-key ...]     env: WAIT=<ms watched per bot, default 2600>   Verdict: `xr-gaze: N checks, M FAIL`.
// Needs the dev server (lib/village.mjs). Nothing is asked of Askou beyond what the page itself loads.
import { launch, enter, Checks } from "./lib/village.mjs";

const only = process.argv.slice(2), WAIT = +(process.env.WAIT || 2600);
const c = new Checks();
const browser = await launch();
try {
  const { page, errors } = await enter(browser, { query: "skyHour=10&xrEmulate=gaze", init: () => void delete Navigator.prototype.xr, alone: true });
  await page.getByRole("button", { name: "Enter VR" }).click();
  const inXr = await page.waitForFunction(() => window.__askou?.gl.xr.isPresenting, null, { timeout: 20000 }).then(() => true, () => false);
  if (c.check(inXr, "the headset session starts")) {
    await page.waitForTimeout(1500);
    const keys = await page.evaluate(() => window.__askou.village().posts.map((p) => p.key));
    const rows = [];
    for (const key of only.length ? keys.filter((k) => only.includes(k)) : keys) {
      await page.evaluate((k) => window.__askou.store.visitBot(k), key);
      await page.waitForTimeout(WAIT);
      rows.push(await page.evaluate((key) => {
        const a = window.__askou, s = a.village(), cam = a.gl.xr.getCamera(), e = cam.matrixWorld.elements;
        const eye = { x: e[12], y: e[13], z: e[14] }, f = { x: -e[8], z: -e[10] }, fl = Math.hypot(f.x, f.z) || 1;
        const p = s.posts.find((q) => q.key === key), d = { x: p.x - eye.x, z: p.z - eye.z }, dl = Math.hypot(d.x, d.z) || 1;
        // how far off the middle of the view the bot stands (degrees), and how far away
        const off = Math.acos(Math.max(-1, Math.min(1, (f.x * d.x + f.z * d.z) / (fl * dl)))) * 180 / Math.PI;
        return { key, open: s.open, off: +off.toFixed(1), far: +dl.toFixed(2), eyeY: +eye.y.toFixed(2) };
      }, key));
      await page.evaluate(() => window.__askou.store.openBot(null));
      await page.waitForTimeout(250);
    }
    for (const r of rows) c.check(r.open === r.key, `${r.key}: the talk stays with the bot`, `open: ${r.open}, bot ${r.off}° off the middle of the view, ${r.far} m away`);
    // a headset's view is not turned for the visitor: they are put where the bot is before them (12 spots around it: within 15°, more where the ground or a neighbour is in the way)
    for (const r of rows) c.check(r.off <= 35 && r.far > 1.5 && r.far < 4.2, `${r.key}: the bot stands before the visitor`, `${r.off}° off the middle of the view, ${r.far} m away`);
    const off = rows.map((r) => r.off).sort((a, b) => a - b);
    console.log(`bots: ${rows.length}; off the middle of the view: median ${off[off.length >> 1]}°, most ${off.at(-1)}°; taken over: ${rows.filter((r) => r.open !== r.key).map((r) => `${r.key}→${r.open}`).slice(0, 12).join(" ") || "none"}`);
  }
  c.check(errors.length === 0, "no errors on the page", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
c.done("xr-gaze");
