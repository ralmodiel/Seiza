// For a visitor whose device asks for less movement (prefers-reduced-motion): do the bots keep still, and does the page
// stop sliding and fading? Watches the figures standing near the arrival spot frame by frame, with and without the
// setting, and reads the page's own animations. A dance the visitor asks for by its button is theirs to ask.
// Usage: node worlds/askou/scripts/calm.mjs      env: SECONDS=<watched, default 14>     Verdict: `calm: N checks, M FAIL`.
// Needs the dev server (lib/village.mjs). Nothing is asked of Askou beyond what the page itself loads.
import { launch, enter, Checks, OUT } from "./lib/village.mjs";

const SECONDS = +(process.env.SECONDS || 14);
const c = new Checks();
const browser = await launch();
/** Watches every figure standing in the scene: the quickest turn of any joint (rad/s), the widest swing (rad), how many joints swung more than 0.3 rad. */
const watch = (page, seconds) =>
  page.evaluate(
    (seconds) =>
      new Promise((done) => {
        const a = window.__askou, pick = a.scene.getObjectByName("askou-pick"), root = pick.parent.children[pick.parent.children.indexOf(pick) - 1];
        const joints = [];
        for (const holder of root.children) holder.traverse((o) => { if (o !== holder && o.children.length) joints.push({ o, last: [o.rotation.x, o.rotation.y, o.rotation.z], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }); });
        let quick = 0, t0 = performance.now(), last = t0;
        const tick = () => {
          const now = performance.now(), dt = Math.max(0.004, (now - last) / 1000);
          last = now;
          for (const j of joints) {
            if (!j.o.visible) continue;
            const r = [j.o.rotation.x, j.o.rotation.y, j.o.rotation.z];
            for (let i = 0; i < 3; i++) {
              const whole = Math.abs(r[i] - j.last[i]) % (2 * Math.PI), d = Math.min(whole, 2 * Math.PI - whole);
              quick = Math.max(quick, d / dt);
              j.lo[i] = Math.min(j.lo[i], r[i]);
              j.hi[i] = Math.max(j.hi[i], r[i]);
            }
            j.last = r;
          }
          if (now - t0 < seconds * 1000) return requestAnimationFrame(tick);
          const swings = joints.map((j) => Math.max(0, ...[0, 1, 2].map((i) => j.hi[i] - j.lo[i])));
          done({ figures: root.children.length, joints: joints.length, quick: +quick.toFixed(2), widest: +Math.max(0, ...swings).toFixed(2), wide: swings.filter((s) => s > 0.3).length, calm: a.live.calm });
        };
        requestAnimationFrame(tick);
      }),
    seconds
  );
try {
  const rows = {};
  for (const reduced of [false, true]) {
    const { page, errors, ctx } = await enter(browser, { query: "skyHour=10", reducedMotion: reduced, alone: true, settle: 9000 });
    rows[reduced] = await watch(page, SECONDS);
    if (reduced) {
      const r = rows[true];
      c.check(r.calm === true, "the village knows the visitor asked for less movement");
      c.check(r.figures >= 5, "bots stand near the arrival spot", `${r.figures} figures, ${r.joints} joints`);
      await page.screenshot({ path: `${OUT}/calm.png` });
      // the way shown to a bot: its arrows are lit, the light does not run along them
      const far = await page.evaluate(() => { const a = window.__askou, [x, , z] = a.self(); return a.village().posts.reduce((m, p) => (Math.hypot(p.x - x, p.z - z) > Math.hypot(m.x - x, m.z - z) ? p : m)).key; });
      await page.evaluate((k) => window.__askou.store.showWay(k), far);
      await page.waitForTimeout(900);
      const light = () => page.evaluate(() => { let t = null; window.__askou.scene.traverse((o) => { if (o.isInstancedMesh && o.material?.uniforms?.time) t = o.material.uniforms.time.value; }); return t; });
      const t0 = await light();
      await page.waitForTimeout(500);
      const t1 = await light();
      c.check(t0 !== null && t0 === t1, "the light on the way shown to a bot does not run", `time ${t0} then ${t1}`);
      await page.evaluate(() => window.__askou.store.showWay(null));
      // a dance the visitor asks for: theirs to ask, so it plays
      const key = await page.evaluate(() => window.__askou.village().posts[0].key);
      await page.evaluate((k) => window.__askou.store.dance(k), key);
      await page.waitForTimeout(1500);
      const danced = await watch(page, 4);
      c.check(danced.widest > 0.3, "a dance the visitor asks for by its button still plays", `widest swing ${danced.widest} rad`);
      await page.waitForTimeout(6500); // and ends
      const after = await watch(page, 3);
      c.check(after.widest <= 0.3, "after the dance the bots stand still again", `widest swing ${after.widest} rad`);
      await page.evaluate((k) => window.__askou.store.visitBot(k), key);
      await page.waitForTimeout(1200);
      const css = await page.evaluate(() => {
        const p = document.querySelector(".av-panel"), s = p && getComputedStyle(p);
        return { panel: !!p, animation: s?.animationName, duration: s?.animationDuration };
      });
      c.check(css.panel && (css.animation === "none" || parseFloat(css.duration) === 0), "the chat panel opens without sliding in", JSON.stringify(css));
      const scroll = await page.evaluate(() => [...document.querySelectorAll(".av-panel *")].filter((e) => getComputedStyle(e).animationName !== "none" && parseFloat(getComputedStyle(e).animationDuration) > 0).map((e) => e.className || e.tagName).slice(0, 5));
      c.check(scroll.length === 0, "nothing in the chat panel animates", scroll.join(", "));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      // the bubble of the bot nearby: there at once, not faded in (needs a roomy screen: 1280×800 here)
      const b = await page.evaluate(() => { const m = window.__askou.scene.getObjectByName("askou-motto"); return m ? { visible: m.visible, opacity: +m.material.opacity.toFixed(2) } : null; });
      c.check(!!b && (!b.visible || b.opacity === 1), "the bot's line shows at once, without fading in", JSON.stringify(b));
    }
    c.check(errors.length === 0, `no errors on the page (${reduced ? "less movement" : "as usual"})`, errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
  const n = rows[false], r = rows[true];
  console.log(`as usual:      ${n.figures} figures, quickest joint ${n.quick} rad/s, widest swing ${n.widest} rad, ${n.wide} of ${n.joints} joints swing over 0.3 rad`);
  console.log(`less movement: ${r.figures} figures, quickest joint ${r.quick} rad/s, widest swing ${r.widest} rad, ${r.wide} of ${r.joints} joints swing over 0.3 rad`);
  c.check(r.widest <= 0.3, "with less movement asked for no bot swings a joint over 0.3 rad (no waving, no idle show)", `${r.widest} rad, ${r.wide} joints`);
  c.check(r.quick <= 1.2, "with less movement asked for no joint turns faster than 1.2 rad/s", `${r.quick} rad/s`);
} finally {
  await browser.close();
}
c.done("calm");
