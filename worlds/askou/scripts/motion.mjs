// Does any joint of a bot's figure shake? Plays every figure through what the village does to it (arrive, pointer, an
// answer, a dance asked for, a full round of its idle show) at 60 frames a second, long after the page opened, and
// counts how often each joint's turn reverses: more than MAX_HZ back-and-forths a second with a visible swing is a shake
// (a reversal counts once the joint has swung MIN_SWING rad since the last one: a tap of a few hundredths is no shake).
// A snap is one frame that turns a joint far while the frames around it hardly do (a value switched on or off).
// Usage: node worlds/askou/scripts/motion.mjs [bot-key ...]      env: AT=<seconds since the page opened, default 900>, TOP=<rows shown, default 12>
//        TRACE=<path>:<axis>:<seconds in>[:<frames, default 40>] with one bot-key: prints that joint's turn frame by frame (e.g. TRACE=/2/0/3:z:46.9)
// Needs the dev server (see lib/village.mjs). Nothing is sent to Askou. Verdict: `motion: N checks, M FAIL`.
import { readFileSync } from "node:fs";
import { launch, BASE, Checks } from "./lib/village.mjs";

const roster = JSON.parse(readFileSync(new URL("../client/roster.json", import.meta.url), "utf8"));
const all = [{ key: "general", kind: "general" }, ...(Array.isArray(roster) ? roster : roster.bots)];
const only = process.argv.slice(2);
const bots = only.length ? all.filter((b) => only.includes(b.key)) : all;

const browser = await launch();
const page = await (await browser.newContext()).newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const got = await page.evaluate(
  async ({ bots, AT, tr }) => {
    const { buildFigure, figureFor, show } = await import("/worlds/askou/client/figures/figures3d.ts");
    const FPS = 60, dt = 1 / FPS, WINDOW = FPS / 2, SWING = 0.004 /* rad a frame: 0.24 rad/s */, MIN_SWING = 0.03;
    // [phase, seconds, excitement wanted, moods wanted (typing, thinking, happy, at a loss, dance)]
    const PLAN = [
      ["arrive", 2.4, 1, [0, 0, 0, 0, 0]], ["arrive", 3, 0, [0, 0, 0, 0, 0]],
      ["pointer", 2, 0.55, [0, 0, 0, 0, 0]], ["pointer", 2, 0, [0, 0, 0, 0, 0]],
      ["answer", 2, 0, [1, 0, 0, 0, 0]], ["answer", 2, 0, [0, 1, 0, 0, 0]], ["answer", 3, 0, [0, 0, 1, 0, 0]], ["answer", 2, 0, [0, 0, 0, 0, 0]],
      ["dance", 18, 0, [0, 0, 0, 0, 1]],
      // watched with the pointer wandering on and off the bot
      ...[0, 1, 2, 3].flatMap(() => [["dance + pointer", 1.5, 0.55, [0, 0, 0, 0, 1]], ["dance + pointer", 1.5, 0, [0, 0, 0, 0, 1]]]),
      ["dance + pointer", 2, 0, [0, 0, 0, 0, 0]],
      ["idle show", 280, 0, [0, 0, 0, 0, 0]],
    ];
    const out = [], series = [];
    for (const b of bots) {
      const spec = figureFor(b.key, b.kind, b.parentKey, b.figure, b.held), fig = buildFigure(spec);
      const joints = [];
      (function walk(o, path) {
        if (o.children.length) joints.push({ o, path, last: [o.rotation.x, o.rotation.y, o.rotation.z], dir: [0, 0, 0], rev: [o.rotation.x, o.rotation.y, o.rotation.z], turns: [[], [], []], was: [[0, 0], [0, 0], [0, 0]] });
        o.children.forEach((c, i) => walk(c, `${path}/${i}`));
      })(fig.root, "");
      let u = AT, e = 0, lead = 0, frame = 0;
      const mood = [0, 0, 0, 0, 0], worst = new Map(), snaps = new Map(); // phase -> { hz, path, axis, at, act }; phase -> { snap (rad in one frame), … }
      for (const [phase, seconds, wantE, wantM] of PLAN) {
        for (let n = Math.round(seconds * FPS); n > 0; n--, frame++, u += dt) {
          // as Figures.tsx eases them (keep the two alike): no wave during a dance asked for, eased twice over
          const k = 1 - Math.exp(-dt * 9);
          lead += ((wantM[4] ? 0 : wantE) - lead) * k;
          e += (lead - e) * k;
          for (let i = 0; i < 5; i++) mood[i] += (wantM[i] - mood[i]) * (1 - Math.exp(-dt * 6));
          fig.tick(u, e, mood);
          for (const j of joints) {
            const now = [j.o.rotation.x, j.o.rotation.y, j.o.rotation.z];
            // a part put away (an instrument not in the hand) is not seen, whatever it does
            if (!j.o.visible || Math.abs(j.o.scale.x) < 0.05) { j.last = now; j.was = [[0, 0], [0, 0], [0, 0]]; continue; }
            if (tr && j.path === tr.path && Math.abs(u - AT - tr.at) <= tr.half) series.push(+now[tr.a].toFixed(3));
            for (let a = 0; a < 3; a++) {
              const d = now[a] - j.last[a];
              // the frame before this one was a snap if it turned far and its two neighbours hardly did
              // a whole turn more or less looks the same; the first frames go from the pose as built to the first tick
              const [d0, d1] = j.was[a], whole = Math.abs(d1) % (2 * Math.PI), snap = Math.min(whole, 2 * Math.PI - whole);
              if (frame > 3 && snap > 0.06 && snap > 5 * Math.max(Math.abs(d0), Math.abs(d), 0.002) && !(snaps.get(phase)?.snap >= snap)) snaps.set(phase, { snap: +snap.toFixed(3), spath: j.path, saxis: "xyz"[a], sat: +(u - AT).toFixed(2), sact: show(u, spec.no, 0, mood[4]).p });
              j.was[a] = [d1, d];
              if (Math.abs(d) < SWING) continue;
              const dir = Math.sign(d);
              if (j.dir[a] && dir !== j.dir[a] && Math.abs(j.last[a] - j.rev[a]) >= MIN_SWING) {
                j.rev[a] = j.last[a];
                const t = j.turns[a];
                t.push(frame);
                while (t.length && t[0] <= frame - WINDOW) t.shift();
                const hz = t.length; // reversals in half a second = back-and-forths a second
                const w = worst.get(phase);
                if (!w || hz > w.hz) worst.set(phase, { hz, path: j.path, axis: "xyz"[a], at: +(u - AT).toFixed(1), act: show(u, spec.no, Math.min(1, 2 * Math.max(e, ...mood)), mood[4]).p });
              }
              j.dir[a] = dir;
            }
            j.last = now;
          }
        }
      }
      for (const phase of new Set(PLAN.map((p) => p[0]))) out.push({ key: b.key, phase, ...(worst.get(phase) ?? { hz: 0 }), ...(snaps.get(phase) ?? { snap: 0 }) });
    }
    return { out, series };
  },
  { bots, AT: +(process.env.AT || 900), tr: (() => { if (!process.env.TRACE) return null; const [path, axis, at, frames = 40] = process.env.TRACE.split(":"); return { path, a: "xyz".indexOf(axis), at: +at, half: +frames / 120 }; })() }
);
const rows = got.out;
if (process.env.TRACE) console.log(`trace ${process.env.TRACE}: ${got.series.join(" ")}`);
await browser.close();

const MAX_HZ = 4; // the quickest move meant is a wave at under 2 a second
const c = new Checks();
for (const r of rows) {
  c.check(r.hz <= MAX_HZ, `${r.key}: ${r.phase}: no joint shakes`, `${r.hz} a second, joint ${r.path} axis ${r.axis}, ${r.at}s in, act ${r.act}`);
  c.check(!r.snap, `${r.key}: ${r.phase}: no joint snaps`, `${r.snap} rad in one frame, joint ${r.spath} axis ${r.saxis}, ${r.sat}s in, act ${r.sact}`);
}
const top = [...rows].sort((a, b) => b.hz - a.hz).slice(0, +(process.env.TOP || 12));
console.log("quickest joints: " + top.map((r) => `${r.key}/${r.phase} ${r.hz}/s act ${r.act ?? "-"}`).join(" · "));
const byPhase = {};
for (const r of rows) if (r.hz > MAX_HZ) byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1;
console.log("shaking, by phase: " + (JSON.stringify(byPhase) === "{}" ? "none" : JSON.stringify(byPhase)));
const snapActs = {};
for (const r of rows) if (r.snap) snapActs[`act ${r.sact} joint ${r.spath}.${r.saxis}`] = (snapActs[`act ${r.sact} joint ${r.spath}.${r.saxis}`] ?? 0) + 1;
console.log("snapping, by act and joint: " + (JSON.stringify(snapActs) === "{}" ? "none" : JSON.stringify(snapActs)));
c.done("motion");
