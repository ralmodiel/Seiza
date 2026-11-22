// A look at one bot from a few metres away. Usage: node worlds/askou/scripts/look.mjs <bot-key> [metres, default 5] [query, default skyHour=12]
// env: OPEN=1 leaves the talk with the bot open; W, H = the window (default 1280 x 800).
// Writes .scratch/out/look-<key>.png and prints what stands within 6 m of the bot. Nothing is asked of Askou.
import { launch, enter, shot } from "./lib/village.mjs";
const [key, dist = "5", query = "skyHour=12"] = process.argv.slice(2);
const browser = await launch();
const { page } = await enter(browser, { query, settle: 2500, alone: true, width: +(process.env.W || 1280), height: +(process.env.H || 800), touch: +(process.env.W || 1280) < 700 });
const post = await page.evaluate((key) => window.__askou.village().posts.find((p) => p.key === key), key);
if (!post) { console.log(`no post for ${key}`); process.exit(2); }
// stands by the bot as a visitor taken there does; the talk is closed again unless OPEN=1
await page.evaluate(({ key, open }) => { const s = window.__askou.store; s.visitBot(key); if (!open) s.openBot(null); }, { key, open: process.env.OPEN === "1" });
await page.waitForTimeout(4000);
const near = await page.evaluate(({ post }) => {
  const s = window.__askou.village();
  return { self: window.__askou.self(), open: s.open, post, near: s.posts.filter((p) => Math.hypot(p.x - post.x, p.z - post.z) < 6).map((p) => `${p.key} ${Math.hypot(p.x - post.x, p.z - post.z).toFixed(1)}m`) };
}, { post });
console.log(JSON.stringify(near));
console.log(await shot(page, `look-${key}`));
await browser.close();
