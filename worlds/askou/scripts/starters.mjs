// Which bots offer no question to start with (in a headset the offered questions are the only way to ask)?
// Reads the page's own state. Usage: node worlds/askou/scripts/starters.mjs    Needs the dev server. Nothing is asked of Askou beyond what the page itself loads.
// Verdict: `starters: N checks, M FAIL`.
import { launch, enter, Checks } from "./lib/village.mjs";
const browser = await launch(), c = new Checks();
const { page } = await enter(browser, { settle: 1500, alone: true });
const rows = await page.evaluate(() => { const a = window.__askou; return a.village().bots.map((b) => ({ key: b.key, kind: b.kind, parent: b.parentKey, n: a.store.startersOf(b.key).length, long: a.store.startersOf(b.key).filter((q) => q.length > 90) })); });
await browser.close();
for (const r of rows) {
  c.check(r.n > 0, `${r.key}: offers a question to start with`, `${r.kind}, under ${r.parent}`);
  c.check(r.long.length === 0, `${r.key}: its offered questions fit a button (90 characters)`, r.long.join(" | "));
}
c.done("starters");
