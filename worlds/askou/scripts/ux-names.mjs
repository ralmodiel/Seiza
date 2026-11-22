// Usage: node worlds/askou/scripts/ux-names.mjs [w=1280] [h=800] [touch=0]   In the "Find a bot" list: how many bot names are ellipsised, and how many rows become indistinguishable after the cut.
import { launch, enter, Checks } from "./lib/village.mjs";
const [W = "1280", H = "800", touch = "0"] = process.argv.slice(2);
const c = new Checks();
const browser = await launch();
const { page } = await enter(browser, { query: "skyHour=10", width: +W, height: +H, touch: touch === "1", settle: 3000 });
await page.evaluate(() => window.__askou.store.setDirectory(true));
await page.waitForTimeout(600);
const r = await page.evaluate(() => {
  const ctx = document.createElement("canvas").getContext("2d");
  const rows = [...document.querySelectorAll(".av-row")];
  const out = []; let titled = 0;
  for (const row of rows) {
    const spans = [...row.querySelectorAll("span > span")].filter((s) => getComputedStyle(s).textOverflow === "ellipsis");
    for (const s of spans) {
      const full = s.textContent.trim(); const cs = getComputedStyle(s); ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = s.clientWidth; if (!w) continue;
      let n = full.length; while (n > 1 && ctx.measureText(full.slice(0, n) + "…").width > w) n--;
      if (ctx.measureText(full).width > w) out.push({ full, shown: full.slice(0, n), hasTitle: !!(s.title || row.title) });
    }
  }
  const byShown = {}; out.forEach((o) => (byShown[o.shown] = (byShown[o.shown] || 0) + 1));
  return { rows: rows.length, clipped: out.length, titled: out.filter((o) => o.hasTitle).length, ambiguous: Object.entries(byShown).filter(([, n]) => n > 1).map(([k, n]) => `${n}x "${k}…"`).slice(0, 8), sample: out.slice(0, 3) };
});
console.log(JSON.stringify(r, null, 1));
c.check(r.clipped === 0, "no bot name is cut in the directory", `${r.clipped} of ${r.rows} rows cut, ${r.titled} with tooltip, ${r.ambiguous.length} ambiguous groups`);
c.done(`ux-names ${W}x${H}`);
await browser.close();
