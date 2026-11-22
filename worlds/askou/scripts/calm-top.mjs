// Which parts still move for a visitor who asked for less movement? Lists the widest-swinging joints of the figures
// near the arrival spot (bot, joint path, axis, swing in rad, quickest turn in rad/s). A helper for calm.mjs.
// Usage: node worlds/askou/scripts/calm-top.mjs [seconds=12] [rows=24]
import { launch, enter } from "./lib/village.mjs";
const [seconds = 12, top = 24] = process.argv.slice(2).map(Number);
const browser = await launch();
try {
  const { page } = await enter(browser, { query: "skyHour=10", reducedMotion: true, alone: true, settle: 9000 });
  const rows = await page.evaluate(({ seconds, top }) => new Promise((done) => {
    const a = window.__askou, pick = a.scene.getObjectByName("askou-pick"), root = pick.parent.children[pick.parent.children.indexOf(pick) - 1], posts = a.village().posts;
    const joints = [];
    for (const holder of root.children) {
      const key = posts.reduce((b, p) => (Math.hypot(p.x - holder.position.x, p.z - holder.position.z) < Math.hypot(b.x - holder.position.x, b.z - holder.position.z) ? p : b)).key;
      (function walk(o, path) { if (o.children.length) joints.push({ o, key, path, last: [o.rotation.x, o.rotation.y, o.rotation.z], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9], quick: 0 }); o.children.forEach((ch, i) => walk(ch, `${path}/${i}`)); })(holder, "");
    }
    let t0 = performance.now(), last = t0;
    const tick = () => {
      const now = performance.now(), dt = Math.max(0.004, (now - last) / 1000); last = now;
      for (const j of joints) { if (!j.o.visible) continue; const r = [j.o.rotation.x, j.o.rotation.y, j.o.rotation.z];
        for (let i = 0; i < 3; i++) { j.quick = Math.max(j.quick, Math.abs(r[i] - j.last[i]) / dt); j.lo[i] = Math.min(j.lo[i], r[i]); j.hi[i] = Math.max(j.hi[i], r[i]); } j.last = r; }
      if (now - t0 < seconds * 1000) return requestAnimationFrame(tick);
      done(joints.map((j) => { const s = [0, 1, 2].map((i) => j.hi[i] - j.lo[i]), i = s.indexOf(Math.max(...s)); return { key: j.key, path: j.path, axis: "xyz"[i], swing: +s[i].toFixed(2), quick: +j.quick.toFixed(1), name: j.o.name || "" }; }).filter((r) => r.swing > 0.05).sort((x, y) => y.swing - x.swing).slice(0, top));
    };
    requestAnimationFrame(tick);
  }), { seconds, top });
  for (const r of rows) console.log(`${r.key.padEnd(12)} ${r.path.padEnd(16)} ${r.axis} swing ${String(r.swing).padEnd(5)} quickest ${r.quick} rad/s ${r.name}`);
  const by = {}; for (const r of rows) by[r.path + "." + r.axis] = (by[r.path + "." + r.axis] ?? 0) + 1;
  console.log("by joint: " + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(" "));
} finally { await browser.close(); }
