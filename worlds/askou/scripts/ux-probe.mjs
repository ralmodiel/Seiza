// Usage: node worlds/askou/scripts/ux-probe.mjs [name=desk] [width=1280] [height=800] [day|night] [touch=1] [steps=hud,dir,chat,ask]
// Measures the village HUD: rects, overlaps with host fixed elements, tap targets, fonts, ellipsis, contrast over the live canvas. Writes .scratch/out/ux-<name>-*.png and .json
import { writeFileSync } from "node:fs";
import { launch, enter, shot, OUT } from "./lib/village.mjs";
const [name = "desk", W = "1280", H = "800", sky = "day", touch = "0", steps = "hud,dir,chat"] = process.argv.slice(2);
const browser = await launch();
const { page, errors } = await enter(browser, { query: `skyHour=${sky === "night" ? 21 : 10}`, width: +W, height: +H, touch: touch === "1", settle: 4500 });
const out = {};

const measure = (label) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const nm = (e) => (e.getAttribute("aria-label") || e.textContent || e.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const av = document.querySelector(".av");
  const clippedOut = (e) => { const l = e.closest(".av-list"); if (!l) return false; const a = e.getBoundingClientRect(), b = l.getBoundingClientRect(); return a.bottom <= b.top + 2 || a.top >= b.bottom - 2; };
  const mine = av ? [...av.querySelectorAll("button,a,input,[role=dialog],[role=status]")].filter((e) => vis(e) && !clippedOut(e)) : [];
  // host fixed/absolute things outside .av
  const host = [...document.body.querySelectorAll("*")].filter((e) => !av?.contains(e) && !e.contains(av) && e.tagName !== "CANVAS" && !["STYLE","SCRIPT","HTML","BODY"].includes(e.tagName) && vis(e) && ["fixed","absolute"].includes(getComputedStyle(e).position) && !e.closest("canvas")).map((e) => ({ tag: e.tagName, name: nm(e) || (typeof e.className === "string" ? e.className.slice(0, 30) : ""), r: R(e), z: getComputedStyle(e).zIndex })).filter((h) => h.r[2]-h.r[0] < innerWidth*0.98 || h.r[3]-h.r[1] < innerHeight*0.98);
  const inter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const items = mine.map((e) => ({ tag: e.tagName, role: e.getAttribute("role"), name: nm(e), r: R(e), fs: parseFloat(getComputedStyle(e).fontSize), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }));
  const tops = items.filter((i) => i.role === "dialog" || i.tag === "BUTTON" || i.tag === "INPUT");
  const overlaps = [];
  for (const i of tops) for (const h of host) { const a = inter(i.r, h.r); if (a > 20) overlaps.push({ hud: i.name, hudR: i.r, host: `${h.tag}:${h.name}`, hostR: h.r, area: a }); }
  const small = items.filter((i) => (i.tag === "BUTTON" || i.tag === "A" || i.tag === "INPUT") && (i.h < 44 || i.w < 44) && !(i.tag === "A")).map((i) => `${i.name} ${i.w}x${i.h}`);
  // text font sizes
  const fsz = {};
  if (av) { const w = document.createTreeWalker(av, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue; const f = parseFloat(getComputedStyle(n.parentElement).fontSize); fsz[f] = (fsz[f] || 0) + 1; } }
  const clipped = av ? [...av.querySelectorAll("*")].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1 && ["ellipsis"].includes(getComputedStyle(e).textOverflow)).map((e) => nm(e)) : [];
  const overflowX = document.documentElement.scrollWidth > innerWidth;
  const dialogs = av ? [...av.querySelectorAll("[role=dialog]")].map((d) => ({ r: R(d), name: d.getAttribute("aria-label"), listScroll: (d.querySelector(".av-list")||{}).scrollHeight, listClient: (d.querySelector(".av-list")||{}).clientHeight })) : [];
  return { vp: [innerWidth, innerHeight], items: items.map((i) => `${i.tag}${i.role ? "/" + i.role : ""} "${i.name}" ${i.r.join(",")} fs${i.fs}`), host: host.map((h) => `${h.tag} "${h.name}" ${h.r.join(",")} z${h.z}`), overlaps, small, fsz, clipped, overflowX, dialogs };
});

// contrast: colour of each text element composited over a screenshot of the canvas without the HUD
const contrast = async (label) => {
  const rows = await page.evaluate(() => {
    const av = document.querySelector(".av"); if (!av) return [];
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
    const res = [];
    const w = document.createTreeWalker(av, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim(); const el = n.parentElement; if (!t || !vis(el) || el.closest("button:disabled")) continue;
      { const l = el.closest(".av-list"); if (l) { const a = el.getBoundingClientRect(), b = l.getBoundingClientRect(); if (a.bottom <= b.top + 2 || a.top >= b.bottom - 2) continue; } }
      // chain of backgrounds (rgba) and opacity
      let op = 1, bgs = []; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); op *= parseFloat(cs.opacity); if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") bgs.unshift(cs.backgroundColor); }
      const range = document.createRange(); range.selectNodeContents(n); const r = range.getBoundingClientRect();
      const cs = getComputedStyle(el);
      res.push({ t: t.slice(0, 30), color: cs.color, op, bgs, fs: parseFloat(cs.fontSize), bold: +cs.fontWeight >= 700, r: [r.left, r.top, r.right, r.bottom] });
    }
    return res;
  });
  if (!rows.length) return [];
  await page.addStyleTag({ content: ".av{visibility:hidden !important}" });
  await page.waitForTimeout(150);
  const buf = await page.screenshot();
  await page.evaluate(() => { [...document.querySelectorAll("style")].filter((s) => s.textContent.includes(".av{visibility:hidden")).forEach((s) => s.remove()); });
  const b64 = buf.toString("base64");
  const res = await page.evaluate(async ({ rows, b64 }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const over = (top, bot) => { const a = top.a; return { r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 }; };
    const out = [];
    for (const row of rows) {
      const [x0, y0, x1, y1] = row.r.map(Math.round);
      const w = Math.max(1, Math.min(x1, c.width) - Math.max(x0, 0)), h = Math.max(1, Math.min(y1, c.height) - Math.max(y0, 0));
      if (x1 <= 0 || y1 <= 0 || x0 >= c.width || y0 >= c.height) continue;
      const d = g.getImageData(Math.max(x0, 0), Math.max(y0, 0), w, h).data;
      // brightest 90th percentile pixel (worst case for white text)
      const ls = []; for (let i = 0; i < d.length; i += 4) ls.push([d[i], d[i + 1], d[i + 2]]);
      ls.sort((p, q) => lum({ r: p[0], g: p[1], b: p[2] }) - lum({ r: q[0], g: q[1], b: q[2] }));
      const px = ls[Math.floor(ls.length * 0.9)];
      let bg = { r: px[0], g: px[1], b: px[2], a: 1 };
      for (const b of row.bgs) bg = over(parse(b), bg);
      const fg0 = parse(row.color); const fg = over({ ...fg0, a: fg0.a * row.op }, bg);
      const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const need = row.fs >= 24 || (row.fs >= 18.66 && row.bold) ? 3 : 4.5;
      out.push({ t: row.t, cr: +cr.toFixed(2), need, fs: row.fs, ok: cr >= need });
    }
    return out;
  }, { rows, b64 });
  return res;
};

for (const step of steps.split(",")) {
  if (step === "hud") { /* initial */ }
  if (step === "dir") await page.evaluate(() => window.__askou.store.setDirectory(true));
  if (step === "chat") { await page.evaluate(() => { window.__askou.store.setDirectory(false); window.__askou.store.visitBot("registrar"); }); await page.waitForTimeout(3500); }
  if (step === "upou") { await page.evaluate(() => window.__askou.store.visitBot("upou")); await page.waitForTimeout(3500); }
  if (step === "close") { await page.evaluate(() => window.__askou.store.openBot(null)); await page.waitForTimeout(800); }
  await page.waitForTimeout(600);
  out[step] = await measure(step);
  const cr = await contrast(step);
  out[step].contrastFail = cr.filter((c) => !c.ok);
  out[step].contrastMin = cr.length ? Math.min(...cr.map((c) => c.cr)) : null;
  out[step].png = await shot(page, `ux-${name}-${step}`);
}
out.errors = errors;
writeFileSync(`${OUT}/ux-${name}.json`, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) { if (k === "errors") continue; console.log(`## ${k} vp=${v.vp} overflowX=${v.overflowX}`); console.log(" overlaps:", JSON.stringify(v.overlaps.slice(0, 6))); console.log(" small:", v.small.slice(0, 8).join(" | ")); console.log(" fonts:", JSON.stringify(v.fsz), " clipped:", v.clipped.slice(0,5).join("|")); console.log(" contrast min", v.contrastMin, "fails", v.contrastFail.length, JSON.stringify(v.contrastFail.slice(0, 5))); console.log(" dialogs", JSON.stringify(v.dialogs)); }
console.log("host:", out.hud?.host.join(" ; "));
console.log("errors", errors.length);
await browser.close();
