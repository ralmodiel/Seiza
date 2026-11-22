// Does every bot of the village have a short line of its own (Askou's admin override, else the built-in one)?
// Usage: node worlds/askou/scripts/taglines.mjs      Needs the dev server. Nothing is asked of Askou beyond what the page itself loads.
// Verdict: `taglines: N checks, M FAIL`.
import { launch, BASE, Checks } from "./lib/village.mjs";
const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const rows = await page.evaluate(async () => {
  const store = await import("/worlds/askou/client/store.ts");
  await new Promise((r) => setTimeout(r, 2500)); // the live list replaces the snapshot
  return store.village().bots.map((b) => ({ key: b.key, line: store.taglineOf(b), nick: store.nickOf(b) }));
});
await browser.close();
const NONE = ["whatsnew"]; // Askou's own chat page has no line for these either: no bubble, by design
const c = new Checks();
for (const r of rows) {
  c.check(!!r.line || NONE.includes(r.key), `${r.key}: has a short line`);
  c.check(!r.line || r.line.length <= 130, `${r.key}: its line fits a speech bubble (5 lines, about 130 characters)`, `${r.line?.length}`);
}
console.log(`longest: ${rows.filter((r) => r.line).sort((a, b) => b.line.length - a.line.length).slice(0, 3).map((r) => `${r.key} ${r.line.length}`).join(" · ")}`);
c.done("taglines");
