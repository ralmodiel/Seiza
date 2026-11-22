// Usage: node worlds/askou/scripts/ux-overflow.mjs [w=1280] [h=800] [touch=0]   Opens every bot's chat (openBot, no questions) and checks nothing in the panel is wider than its list (clipped text/buttons).
import { launch, enter, Checks } from "./lib/village.mjs";
const [W = "1280", H = "800", touch = "0"] = process.argv.slice(2);
const c = new Checks();
const browser = await launch();
const { page } = await enter(browser, { query: "skyHour=10", width: +W, height: +H, touch: touch === "1", settle: 3000 });
const keys = await page.evaluate(() => window.__askou.village().bots.map((b) => b.key));
let bad = [];
for (const k of keys) {
  await page.evaluate((k) => window.__askou.store.openBot(k), k);
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const d = document.querySelector('.av [role=dialog]'); if (!d) return null; const l = d.querySelector(".av-list"); const lr = l.getBoundingClientRect();
    const wide = [...l.querySelectorAll("button,div,a")].filter((e) => e.getBoundingClientRect().right > lr.right + 1 && e.scrollWidth > 0).map((e) => `${e.tagName}:${e.textContent.trim().slice(0, 40)} +${Math.round(e.getBoundingClientRect().right - lr.right)}px`);
    return { listOver: l.scrollWidth - l.clientWidth, wide: wide.slice(0, 3) };
  });
  if (!r) { c.check(false, `${k}: chat did not open`); continue; }
  if (r.listOver > 1 || r.wide.length) bad.push(k);
  c.check(r.listOver <= 1 && !r.wide.length, `${k}: panel content fits`, `list scrollW-clientW=${r.listOver} ${r.wide.join(" | ")}`);
}
// the panel at its tallest: room to read an answer, and Seiza's menu button (touch) left free
const room = await page.evaluate(() => {
  const d = document.querySelector(".av [role=dialog]"), l = d.querySelector(".av-list"), dr = d.getBoundingClientRect();
  const most = Math.min(parseFloat(getComputedStyle(d).maxHeight), innerHeight - dr.top), menu = document.querySelector('button[aria-label="Show controls"]')?.getBoundingClientRect();
  return { list: Math.round(most - (dr.height - l.getBoundingClientRect().height)), over: !!menu && dr.right > menu.left && dr.top + most > menu.top, bottom: Math.round(dr.top + most), h: innerHeight };
});
c.check(room.list >= 140, "an answer has room to be read", `the list can be ${room.list} px tall`);
c.check(!room.over && room.bottom <= room.h, "the panel at its tallest stays on the screen and off Seiza's menu button", `bottom ${room.bottom} of ${room.h}`);
console.log(`${keys.length} bots, ${bad.length} overflowing: ${bad.slice(0, 20).join(",")}`);
c.done(`ux-overflow ${W}x${H}`);
await browser.close();
