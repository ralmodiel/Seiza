// The village in a headset, with Seiza's built-in emulator (?xrEmulate=gaze, localhost only): a Cardboard-style viewer,
// no controllers. Checks the panel beside the bot: it is there, readable, its buttons press, and nothing breaks.
// Two offered questions are asked of Askou (marked as a test by the dev proxy: recorded nowhere).
// Usage: node worlds/askou/scripts/xr.mjs [bot=upou]        writes .scratch/out/xr-view.png, xr-panel.png, xr-answer.png
import { writeFileSync } from "node:fs";
import { launch, enter, state, shot, fps, Checks, OUT } from "./lib/village.mjs";

const [key = "upou"] = process.argv.slice(2);
const c = new Checks();
const browser = await launch();
const A = (page, fn, arg) => page.evaluate(fn, arg);
/** The headset panel: where it is, its size, its buttons, and how far the viewer and the bot are from it. */
const panel = (page, key) =>
  A(page, (key) => {
    const a = window.__askou, m = a.scene.getObjectByName("askou-xr-panel");
    if (!m) return null;
    const p = a.village().posts.find((q) => q.key === key), e = a.gl.xr.getCamera().matrixWorld.elements, cam = { x: e[12], z: e[14] }, v = a.camera.view; // the eye in the world, not in the rig
    return {
      at: m.position.toArray().map((n) => +n.toFixed(2)), w: +m.scale.x.toFixed(2), h: +m.scale.y.toFixed(2),
      fromBot: +Math.hypot(m.position.x - p.x, m.position.z - p.z).toFixed(2), fromEye: +Math.hypot(m.position.x - cam.x, m.position.z - cam.z).toFixed(2),
      buttons: m.userData.layout.current.buttons.map((b) => ({ key: b.key, label: b.label, h: b.h })), canvasH: m.userData.layout.current.height,
      shifted: !!(v && v.enabled),
    };
  }, key);
const savePanel = async (page, name) => writeFileSync(`${OUT}/${name}.png`, Buffer.from((await A(page, () => window.__askou.scene.getObjectByName("askou-xr-panel").material.map.image.toDataURL("image/png"))).split(",")[1], "base64"));
/** Presses a button of the panel the way a pointer does (down and up on its middle). */
const press = (page, label) =>
  A(page, (label) => {
    const m = window.__askou.scene.getObjectByName("askou-xr-panel"), l = m.userData.layout.current, b = l.buttons.find((x) => label.test ? label.test(x.label) : x.label.startsWith(label));
    if (!b) return false;
    const e = { uv: { x: (b.x + b.w / 2) / m.material.map.image.width, y: 1 - (b.y + b.h / 2) / l.height }, stopPropagation() {} };
    m.__r3f.handlers.onPointerDown(e);
    m.__r3f.handlers.onPointerUp(e);
    return b.label;
  }, label);

try {
  const { page, errors } = await enter(browser, {
    query: "skyHour=10&xrEmulate=gaze",
    // the emulator fills in only where the browser has no WebXR of its own (src/App.tsx); headless Chromium has one that cannot start
    init: () => {
      delete Navigator.prototype.xr;
      // what the page paints as text (the panel and the bubble are canvases), for the checks below
      const fill = CanvasRenderingContext2D.prototype.fillText, seen = (window.__painted = []);
      CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { if (seen.length < 4000) seen.push(String(text)); return fill.call(this, text, ...rest); };
    },
  });
  await A(page, (k) => window.__askou.store.visitBot(k), key);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Enter VR" }).click();
  const inXr = await page.waitForFunction(() => window.__askou?.gl.xr.isPresenting, null, { timeout: 20000 }).then(() => true, () => false);
  if (c.check(inXr, "the headset session starts")) {
    await page.waitForTimeout(2500);
    const s = await state(page);
    c.check(s.open === key, "the talk stays open when the headset goes on", String(s.open));
    let p = await panel(page, key);
    if (c.check(!!p, "a panel stands beside the bot in the headset")) {
      c.check(p.fromBot > 0.8 && p.fromBot < 2, "the panel is beside the bot, not on it", `${p.fromBot} m`);
      c.check(p.fromEye > 0.7 && p.fromEye < 4, "the panel is at reading distance", `${p.fromEye} m`);
      c.check(p.h > 0.4 && p.h < 2.6 && p.at[1] - p.h / 2 > 0.1, "the panel is a readable size and off the ground", `${p.w}×${p.h} m, middle at ${p.at[1]} m`);
      c.check(!p.shifted, "the picture is not shifted for a panel in a headset");
      c.check(p.buttons.some((b) => b.key === "close"), "the panel has a Close button");
      c.check(p.buttons.length >= 2, "the panel offers questions to ask (no keyboard in a headset)", p.buttons.map((b) => b.label).join(" | ").slice(0, 200));
      const small = p.buttons.filter((b) => (b.h / p.canvasH) * p.h < 0.07);
      c.check(small.length === 0, "every button is tall enough to aim at (7 cm)", small.map((b) => b.label).join(" | "));
      const line = await A(page, (k) => { const st = window.__askou.store; return st.taglineOf(st.botOf(k)) ?? ""; }, key);
      const painted = await A(page, () => window.__painted.join(" "));
      if (line) c.check(painted.includes(line.split(" ").slice(0, 3).join(" ")), "the panel says the bot's short line", line);
      await savePanel(page, "xr-panel");
      await shot(page, "xr-view");
      const q = p.buttons.find((b) => !["close", "dance"].includes(b.key) && !b.key.startsWith("b:"));
      if (c.check(!!q, "an offered question can be pressed", q?.label)) {
        const before = (await state(page)).threads[key] ?? 0, h0 = p.h;
        await A(page, () => { const g = window.__askou.gl.getContext(); while (g.getError()) {} }); // errors from before are not this check's
        await press(page, q.label);
        const answered = await page.waitForFunction(({ key, n }) => { const v = window.__askou.village(); return v.busy === null && (v.threads[key] ?? []).length >= n; }, { key, n: before + 2 }, { timeout: 35000 }).then(() => true, () => false);
        c.check(answered, "pressing it asks Askou and the answer arrives");
        await page.waitForTimeout(800);
        p = await panel(page, key);
        c.check(p.h > 0.4 && p.h < 2.6, "the panel with an answer is still a readable size", `${p.w}×${p.h} m`);
        // a texture keeps the size of its first upload: a panel of another height must be given a new one, or the GPU refuses the picture
        const glError = await A(page, () => window.__askou.gl.getContext().getError());
        c.check(p.h !== h0 && glError === 0, "the panel's picture reaches the GPU when its height changes", `height ${h0} -> ${p.h} m, GL error ${glError}`);
        await shot(page, "xr-answer-view");
        // a long answer is read part by part (the panel holds some 900 letters)
        if (p.buttons.some((x) => x.key === "more")) {
          const first = (await A(page, () => window.__painted.slice(-60).join(" "))).slice(0, 4000);
          await press(page, "Read on");
          await page.waitForTimeout(700);
          const q2 = await panel(page, key), next = await A(page, () => window.__painted.slice(-60).join(" "));
          c.check(q2.buttons.some((x) => x.key === "more" && !/part 2 /.test(x.label)) && next !== first, "Read on shows the next part of a long answer", q2.buttons.find((x) => x.key === "more")?.label);
          await savePanel(page, "xr-answer-2");
        } else console.log("note: this answer fits the panel, Read on not checked");
        await savePanel(page, "xr-answer");
      }
      c.check((await fps(page, 3000)) >= 30, "the headset view keeps 30 frames a second");
      await press(page, "Close");
      await page.waitForTimeout(500);
      c.check((await state(page)).open === null && (await panel(page, key)) === null, "Close puts the panel away");
      // with the talk put away the bot's line shows in a bubble by its head (a headset has no dock to read it in)
      await page.waitForTimeout(1500);
      const b = await A(page, () => {
        const a = window.__askou, m = a.scene.getObjectByName("askou-motto"), eye = a.gl.xr.getCamera().cameras[0];
        if (!m) return null;
        const v = m.position.clone().project(eye);
        return { key: m.userData.key, visible: m.visible, opacity: +m.material.opacity.toFixed(2), x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(3), up: +m.position.y.toFixed(2) };
      });
      if (line) c.check(!!b && b.visible && b.key === key && b.opacity > 0.9, "the bot's line shows in a bubble in the headset", JSON.stringify(b));
      if (line && b) c.check(Math.abs(b.x) < 1 && Math.abs(b.y) < 1 && b.z > -1 && b.z < 1, "the bubble is in the headset's view", JSON.stringify(b));
      await shot(page, "xr-bubble");
      // one question at a time: while one bot is answering, the panel of another offers none (askBot would drop the press unseen)
      const other = key === "registrar" ? "upou" : "registrar", keys = (q) => (q ? q.buttons.map((x) => x.key.slice(0, 12)).join(" ") : "no panel");
      await page.route("**/askou/api/chat", async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
      await A(page, ({ key, other }) => { const s = window.__askou.store; void s.askBot("How do I apply?", key, true); s.openBot(other); }, { key, other });
      await page.waitForTimeout(1000);
      const during = await panel(page, other);
      c.check(!!during && (await state(page)).busy === key && !during.buttons.some((x) => x.key.startsWith("q:")), "while another bot is answering, the panel offers no question", keys(during));
      await page.waitForFunction(() => window.__askou.village().busy === null, null, { timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(700);
      const after = await panel(page, other);
      c.check(!!after && after.buttons.some((x) => x.key.startsWith("q:")), "and offers its questions again once that answer is in", keys(after));
      await page.unroute("**/askou/api/chat");
    }
  }
  c.check(errors.length === 0, "no errors on the page (headset)", errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
c.done("xr");
