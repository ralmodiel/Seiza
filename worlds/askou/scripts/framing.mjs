// Is every bot in view from where a visitor is stood to talk to it? Takes the visitor to each bot as the village does
// (store.standWith: no talk is opened) in three views: a desktop in first person, a desktop in third person, an upright
// phone (third person). For each bot it checks: the visitor stands 2.3 m away, the bot's face is on the screen, no other
// bot stands between the camera and it, and in third person the camera is not inside another bot and the bot shows
// beside the visitor's own avatar, and nothing else of the scene (a wall, a tree) lies on the line of sight.
// More views: tablet, tabletwide, widephone, small (touch screens). A view named <view>+talk (e.g. tablet+talk) also opens the talk with
// each bot (its greeting is fetched, marked as a test) and checks the bot and the avatar show in what the panel leaves free.
// Usage: node worlds/askou/scripts/framing.mjs [bot-key ...]     env: VIEWS=first,third,phone (default all three), EVERY=<n> (every nth bot), ROWS=<n> (print n rows)
// Needs the dev server (see lib/village.mjs). Nothing is asked of Askou. Verdict: `framing: N checks, M FAIL`.
import { launch, enter, Checks } from "./lib/village.mjs";

const only = process.argv.slice(2), views = (process.env.VIEWS || "first,third,phone").split(",");
const browser = await launch(), c = new Checks();
const SIZE = { first: [1280, 800], third: [1280, 800], phone: [390, 844], tablet: [768, 1024], tabletwide: [1024, 768], widephone: [844, 390], small: [360, 640] };
const TOUCH = ["phone", "tablet", "tabletwide", "widephone", "small"], HALF = 0.55; // half a bot's body, metres

for (const full of views) {
  const view = full.replace("+talk", ""), talk = full.endsWith("+talk"), every = +(process.env.EVERY || 1);
  const [width, height] = SIZE[view];
  const { page, errors } = await enter(browser, { query: "skyHour=12", width, height, touch: TOUCH.includes(view), settle: 2500, alone: true });
  if (view === "third") { await page.getByRole("button", { name: /third person/i }).first().click(); await page.waitForTimeout(800); }
  const rows = await page.evaluate(async ({ only, HALF, talk, every }) => {
    const a = window.__askou, s = a.village(), home = a.self();
    const THREE = await import("/node_modules/three/build/three.module.js"); // a second copy: only its Raycaster is used
    const ray = new THREE.Raycaster(); ray.camera = a.camera;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const off = (q, A, B) => { const vx = B[0] - A[0], vz = B[1] - A[1], l2 = vx * vx + vz * vz, t = l2 ? Math.max(0, Math.min(1, ((q.x - A[0]) * vx + (q.z - A[1]) * vz) / l2)) : 0; return Math.hypot(q.x - A[0] - t * vx, q.z - A[1] - t * vz); };
    const out = [], leads = new Set(s.posts.map((q) => q.parent));
    for (const [n, p] of s.posts.entries()) {
      if (only.length ? !only.includes(p.key) : n % every) continue;
      a.warp(home); await frame(); await frame(); // from afar, as from the list of bots
      a.store.standWith(p);
      // until the camera has come to rest and the picture with it (its middle is moved for the pair five times a second, then eased)
      let still = 0, last = a.camera.position.clone(), lastX = 0;
      for (let i = 0; i < 240 && still < 16; i++) { await frame(); const [sx] = a.screen(p.x, 1, p.z); still = a.camera.position.distanceTo(last) < 0.004 && Math.abs(sx - lastX) < 0.5 ? still + 1 : 0; last.copy(a.camera.position); lastX = sx; }
      let panel = null;
      if (talk) { a.store.openBot(p.key); await new Promise((r) => setTimeout(r, 1300)); const r = document.querySelector(".av-panel")?.getBoundingClientRect(); panel = r ? [r.left, r.top, r.right, r.bottom].map(Math.round) : null; }
      const self = a.self(), cam = a.camera.position, y = (a.heights()[p.key] ?? 0.2) + 1.25, others = s.posts.filter((q) => q !== p);
      const [x, sy, depth] = a.screen(p.x, y, p.z), [sx] = a.screen(self[0], self[1] + 1.4, self[2]);
      // what of the scene lies between the camera and the bot's face (stopping short of the bot itself)
      const to = new THREE.Vector3(p.x, y, p.z), d = to.distanceTo(cam);
      ray.set(cam.clone(), to.sub(cam).normalize()); ray.near = 0.3; ray.far = Math.max(0.31, d - 1);
      let hit = null;
      try {
        const h = ray.intersectObject(a.scene, true).find((h) => h.object.isMesh && h.object.visible && h.object.material?.opacity !== 0 && h.object.name !== "askou-pick" /* the bots' click boxes are not drawn */);
        if (h) { const names = []; for (let o = h.object; o && names.length < 4; o = o.parent) if (o.name) names.push(o.name); const g = h.object.geometry; g.boundingSphere || g.computeBoundingSphere(); hit = `${names.join("<") || `${h.object.type}/${g.type}/${h.object.material.type}/r${g.boundingSphere.radius.toFixed(1)}${h.object.material.transparent ? "/clear" : ""}`} at ${h.distance.toFixed(1)}m y${h.point.y.toFixed(1)}`; }
      } catch (e) { hit = `ray: ${e.message}`.slice(0, 80); }
      // the bot's two sides, as the camera sees them
      const rt = new THREE.Vector3(1, 0, 0).applyQuaternion(a.camera.quaternion), [xl] = a.screen(p.x - rt.x * HALF, y, p.z - rt.z * HALF), [xr] = a.screen(p.x + rt.x * HALF, y, p.z + rt.z * HALF);
      // its name tag (Constellation's labels): 1.5 m wide, wider for the general bot and for a bot with a family
      const tag = 0.75 * (p.level === 0 ? 1.5 : leads.has(p.key) ? 1.25 : 1), [tl] = a.screen(p.x - rt.x * tag, y, p.z - rt.z * tag), [tr] = a.screen(p.x + rt.x * tag, y, p.z + rt.z * tag);
      out.push({ key: p.key, x: Math.round(x), y: Math.round(sy), depth: +depth.toFixed(3), sx: Math.round(sx), xl: Math.round(xl), xr: Math.round(xr), tl: Math.round(tl), tr: Math.round(tr), w: innerWidth, h: innerHeight, panel,
        dist: +Math.hypot(p.x - self[0], p.z - self[2]).toFixed(2), third: Math.hypot(cam.x - self[0], cam.z - self[2]) > 1,
        nearCam: +Math.min(...others.map((q) => Math.hypot(q.x - cam.x, q.z - cam.z))).toFixed(2), between: +Math.min(...others.map((q) => off(q, [cam.x, cam.z], [p.x, p.z]))).toFixed(2), hit });
      if (talk) a.store.openBot(null);
    }
    return out;
  }, { only, HALF, talk, every });
  const hits = {};
  for (const r of rows) {
    const at = `${full}: ${r.key}`;
    c.check(Math.abs(r.dist - 2.3) < 0.15, `${at}: the visitor stands 2.3 m from the bot`, `${r.dist} m`);
    c.check(r.depth < 1 && r.x > 0.06 * r.w && r.x < 0.94 * r.w && r.y > 0.1 * r.h && r.y < 0.9 * r.h, `${at}: the bot's face is on the screen`, `${r.x},${r.y} of ${r.w}x${r.h}`);
    c.check(r.xl >= 0 && r.xr <= r.w, `${at}: the bot's body is on the screen, side to side`, `${r.xl}..${r.xr} of ${r.w}`);
    c.check(r.tl >= 0 && r.tr <= r.w, `${at}: the bot's name tag is on the screen, side to side`, `${r.tl}..${r.tr} of ${r.w}`);
    c.check(r.between >= 0.75, `${at}: no other bot between the camera and the bot`, `${r.between} m off the line of sight`);
    if (view !== "first") {
      c.check(r.third, `${at}: the view is third person`);
      c.check(r.nearCam >= 0.9, `${at}: the camera is not inside another bot`, `${r.nearCam} m from one`);
      c.check(Math.abs(r.x - r.sx) >= 0.75 * (r.xr - r.xl), `${at}: the bot shows beside the visitor's own avatar`, `bot ${r.xl}..${r.xr}, avatar at ${r.sx} of ${r.w}`);
    }
    if (talk) {
      c.check(!!r.panel, `${at}: the talk is open`);
      const [, , right, bottom] = r.panel ?? [0, 0, 0, 0], beside = right < 0.62 * r.w;
      if (beside) c.check(r.xl >= right - 4 && (view === "first" || r.sx >= right), `${at}: the bot and the avatar show beside the panel`, `bot ${r.xl}..${r.xr}, avatar ${r.sx}, panel ends at ${right}`);
      else c.check(r.y >= bottom, `${at}: the bot's face shows under the panel`, `face at y ${r.y}, panel ends at ${bottom}`);
    }
    c.check(!r.hit, `${at}: nothing of the scene between the camera and the bot`, String(r.hit));
    if (r.hit) (hits[r.hit.replace(/ at .*/, "")] ??= []).push(r.key);
  }
  if (process.env.ROWS) console.log(rows.slice(0, +process.env.ROWS).map((r) => `${r.key}: bot ${r.xl}..${r.x}..${r.xr} tag ${r.tl}..${r.tr} y ${r.y}, avatar ${r.sx} of ${r.w}x${r.h}, panel ${r.panel}`).join("\n"));
  console.log(`${full}: ${rows.length} bots; on the line of sight: ${Object.entries(hits).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([k, v]) => `${k} ×${v.length} (${v.slice(0, 4).join(",")})`).join(" · ") || "nothing"}`);
  c.check(errors.length === 0, `${full}: no errors on the page`, errors.slice(0, 2).join(" | "));
  await page.context().close();
}
await browser.close();
c.done(process.env.LABEL || "framing");
