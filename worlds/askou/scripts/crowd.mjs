// Do two bots stand in one place, or carry the same name? Reads the village's own bots and posts from the running page.
// Also counts the figures drawn at each post: two at one place is a bot drawn twice. HMR=1 saves a source file anew
// first (as an edit does while a page is open: the page takes the new code in without a reload) and counts again.
// Usage: [HMR=1] node worlds/askou/scripts/crowd.mjs [min metres between two bots, default 2.2]     Verdict: `crowd: N checks, M FAIL`.
// Nothing is asked of Askou.
import { utimesSync } from "node:fs";
import { launch, enter, Checks } from "./lib/village.mjs";
const MIN = +(process.argv[2] || 2.2);
const browser = await launch();
const { page } = await enter(browser, { query: "skyHour=12", settle: 3000, alone: true });
const { posts, bots, nicks } = await page.evaluate(async () => {
  const { nickOf } = await import("/worlds/askou/client/store.ts");
  const s = window.__askou.village();
  return { posts: s.posts.map((p) => ({ key: p.key, x: p.x, z: p.z, parent: p.parent })), bots: s.bots.map((b) => ({ key: b.key, name: b.name, parentKey: b.parentKey })), nicks: Object.fromEntries(s.bots.map((b) => [b.key, nickOf(b)])) };
});
// figures drawn, by the post they stand at
const drawn = () => page.evaluate(() => {
  const a = window.__askou, at = new Map(a.village().posts.map((p) => [`${p.x.toFixed(3)},${p.z.toFixed(3)}`, p.key])), n = {};
  a.scene.traverse((o) => {
    const key = o.isGroup && o.userData.navIgnore && o.parent && at.get(`${o.position.x.toFixed(3)},${o.position.z.toFixed(3)}`);
    if (key) n[key] = (n[key] ?? 0) + 1;
  });
  return n;
});
// figures that do not stand on the ground measured under their post
const afloat = () => page.evaluate(() => {
  const a = window.__askou, h = a.heights(), at = new Map(a.village().posts.map((p) => [`${p.x.toFixed(3)},${p.z.toFixed(3)}`, p.key])), off = [];
  a.scene.traverse((o) => {
    const key = o.isGroup && o.userData.navIgnore && o.parent && at.get(`${o.position.x.toFixed(3)},${o.position.z.toFixed(3)}`);
    if (key && Math.abs(o.position.y - (h[key] ?? 0.2)) > 0.01) off.push(`${key} at ${o.position.y.toFixed(2)}, ground ${h[key]}`);
  });
  return { off, measured: Object.keys(h).length };
});
const c = new Checks();
const twice = (n) => Object.entries(n).filter(([, v]) => v > 1).map(([k, v]) => `${k} x${v}`);
const first = await drawn();
c.check(Object.keys(first).length > 3 && !twice(first).length, "each bot in view is drawn once", `${Object.keys(first).length} drawn; twice: ${twice(first).slice(0, 6).join(", ") || "none"}`);
const feet = await afloat();
c.check(feet.measured > 3 && !feet.off.length, "every figure stands on the ground under it", `${feet.measured} heights measured; off: ${feet.off.slice(0, 4).join(", ") || "none"}`);
if (process.env.HMR === "1") {
  let hot = 0;
  page.on("console", (m) => { if (/hot updated|hmr update/i.test(m.text())) hot++; });
  const now = new Date();
  utimesSync(new URL("../client/figures/figures3d.ts", import.meta.url), now, now);
  await page.waitForTimeout(6000);
  const after = await drawn();
  c.check(hot > 0, "the page took the saved file in without a reload", `${hot} hot updates`);
  c.check(Object.keys(after).length > 3 && !twice(after).length, "each bot in view is still drawn once after the code changed under the page", `${Object.keys(after).length} drawn; twice: ${twice(after).slice(0, 6).join(", ") || "none"}`);
}
await browser.close();
c.check(new Set(bots.map((b) => b.key)).size === bots.length, "every bot key once", `${bots.length} bots`);
c.check(new Set(posts.map((p) => p.key)).size === posts.length && posts.length === bots.length, "one post for every bot", `${posts.length} posts, ${bots.length} bots`);
const byNick = {};
for (const b of bots) (byNick[nicks[b.key]] ??= []).push(b.key);
for (const [nick, keys] of Object.entries(byNick)) c.check(keys.length === 1, `the name "${nick}" belongs to one bot`, keys.join(", "));
let closest = { d: Infinity };
for (let i = 0; i < posts.length; i++)
  for (let j = i + 1; j < posts.length; j++) {
    const d = Math.hypot(posts[i].x - posts[j].x, posts[i].z - posts[j].z);
    if (d < closest.d) closest = { d, a: posts[i].key, b: posts[j].key };
    c.check(d >= MIN, `${posts[i].key} and ${posts[j].key} stand apart`, `${d.toFixed(2)} m (${nicks[posts[i].key]} / ${nicks[posts[j].key]})`);
  }
console.log(`closest pair: ${closest.a} and ${closest.b}, ${closest.d.toFixed(2)} m`);
c.done("crowd");
