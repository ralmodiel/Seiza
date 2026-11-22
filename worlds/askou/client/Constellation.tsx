// What is drawn for EVERY bot, however far: the village as a constellation. Each bot has a ring of light on the ground,
// its name floating above, and a star overhead on a thread of light; the stars are joined as the bots are (a faculty to
// its programmes, the general bot to all), with pulses running along the lines. A bot too far to be worth a 3D figure
// rests as a ball of light in its ring (Figures.tsx wakes it when the visitor comes near).
// Four draw calls for the lot: unlit shaders on instanced quads, nothing here is lit, shadowed or clickable.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { skyState } from "../../../src/sky/skyState";
import type { Bot } from "./api";
import { figureFor, type Family } from "./figures/figures";
import { bigOf, ROOT, tagWide, type Post } from "./layout";
import { live, nickOf } from "./store";

/** The light of each family of bots (their bodies are deep car paints; this is the same hue, lit). */
export const TINT: Record<Family, string> = { upou: "#ffc94d", fed: "#ffa24a", fics: "#58b6ff", fmds: "#4fe3a1", office: "#b89cff", project: "#ff78b4" };
export const familyOf = (b: Bot): Family => figureFor(b.key, b.kind, b.parentKey, b.figure, b.held).family;
/** A number in 0..1 that is always the same for a key: so nothing in the village moves in step. */
export const seedOf = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 9973) / 9973;
};
/** How high a bot's star hangs: the general bot's highest, then the heads of the clusters, then the rest. */
export const starHeight = (p: Post, lead: boolean) => (p.level === 0 ? 17 : lead ? 12.5 : p.level === 1 ? 9 : 6.2 + seedOf(p.key) * 1.6);
/** Where a bot's name floats, above its head. */
export const LABEL_Y = 2.5;

const noRaycast = () => {};
const MOTES = 260;
const SPARKS = 44;
const U = { time: { value: 0 }, night: { value: 0 }, burst: { value: -100 }, burstAt: { value: new THREE.Vector3() } };

// Every shader here writes display colours as they are (no tone mapping, no fog), premultiplied: its alpha is how much
// of what is behind it is hidden. By day the lights are paint (they must show on sunlit ground and a bright sky);
// at night they are light (they add to the dark).
const material = (vertexShader: string, fragmentShader: string, more: THREE.ShaderMaterialParameters = {}) =>
  new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: U, transparent: true, depthWrite: false, premultipliedAlpha: true, side: THREE.DoubleSide, ...more });

const PAD = material(
  `attribute vec4 aAt; attribute vec3 aTint; attribute float aSeed, aOn;
varying vec2 vUv; varying vec3 vTint; varying float vSeed, vOn;
void main() {
  vUv = uv - .5; vTint = aTint; vSeed = aSeed; vOn = aOn;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aAt.x + position.x * aAt.w, aAt.y, aAt.z - position.y * aAt.w, 1.);
}`,
  `uniform float time, night; varying vec2 vUv; varying vec3 vTint; varying float vSeed, vOn;
void main() {
  float r = length(vUv) * 2.;
  if (r > 1.) discard;
  float rim = smoothstep(.05, 0., abs(r - .9));
  float w = fract(time * .2 + vSeed);                                   // a ripple running out to the rim
  float ripple = smoothstep(.07, 0., abs(r - w * .9)) * (1. - w) * (1. - w);
  float dash = smoothstep(.028, 0., abs(r - .75)) * step(.42, fract(atan(vUv.y, vUv.x) * 3.8197 + time * (.05 + vOn * .25) + vSeed)); // 24 dashes, turning
  float glow = rim + ripple * .7 + dash * .55 + smoothstep(1., 0., r) * (.16 + vOn * .3) + vOn * rim * .8;
  glow *= smoothstep(1., .96, r);
  vec3 col = mix(vTint, vec3(1.), min(1., rim * .35 + vOn * rim * .4)) * glow;
  gl_FragColor = vec4(col * mix(.85, 1.15, night), min(1., glow) * mix(.6, .12, night));
}`,
  { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }
);

const RIBBON = material(
  `attribute vec3 aB, aTint; attribute vec2 aUv; attribute float aSeed, aW;
varying vec2 vUv; varying vec3 vTint; varying float vSeed;
void main() {
  vUv = aUv; vTint = aTint; vSeed = aSeed;
  vec3 a = (modelViewMatrix * vec4(position, 1.)).xyz, b = (modelViewMatrix * vec4(aB, 1.)).xyz, p = mix(a, b, aUv.y);
  vec3 across = cross(b - a, p);                                        // the ribbon turns its face to the eye
  p += across / max(length(across), 1e-4) * aUv.x * (aW + length(p) * .0022);
  gl_Position = projectionMatrix * vec4(p, 1.);
}`,
  `uniform float time, night; varying vec2 vUv; varying vec3 vTint; varying float vSeed;
void main() {
  float core = 1. - abs(vUv.x); core *= core;
  float pulse = smoothstep(.1, 0., abs(vUv.y - fract(time * .16 + vSeed)));   // a spark running to the far end
  float g = core * (.28 + pulse) * smoothstep(0., .05, vUv.y) * smoothstep(1., .95, vUv.y);
  gl_FragColor = vec4(mix(vTint, vec3(1.), pulse * .55) * g * mix(.9, 1.15, night), min(1., g) * mix(.5, .05, night));
}`
);

// kind 0 = a star, 1 = a bot at rest (a ball of light), 2 = a mote drifting up, 3 = a spark thrown when an answer lands
const SPARK = material(
  `attribute vec4 aAt; attribute vec3 aTint; attribute float aSeed, aKind, aShow;
uniform float time, burst; uniform vec3 burstAt;
varying vec2 vUv; varying vec3 vTint; varying float vSeed, vKind, vShow;
void main() {
  vUv = position.xy; vTint = aTint; vSeed = aSeed; vKind = aKind; vShow = aShow;
  vec3 at = aAt.xyz; float size = aAt.w;
  if (aKind > 2.5) {
    float age = time - burst, s = aSeed * 6.2832 * 7.;
    at = burstAt + vec3(cos(s) * (.5 + fract(aSeed * 13.)), 1.5 + fract(aSeed * 29.), sin(s) * (.5 + fract(aSeed * 13.))) * age * 1.5 - vec3(0., 1.7 * age * age, 0.);
    vShow = age < 0. || age > 1.6 ? 0. : 1. - age / 1.6;
    size *= .35 + .65 * vShow;
  } else if (aKind > 1.5) {
    float t = fract(time * .045 + aSeed);
    at += vec3(sin(t * 9. + aSeed * 30.) * .9, t * 7.5, cos(t * 7. + aSeed * 50.) * .9);
    vShow = sin(t * 3.1416);
  } else if (aKind > .5) {
    at.y += sin(time * 1.3 + aSeed * 40.) * .07;
    size *= aShow;
  }
  vec4 mv = modelViewMatrix * vec4(at, 1.);
  if (aKind < .5) size = max(size, -mv.z * .007);                       // a far star is still a point of light
  mv.xy += position.xy * size;
  gl_Position = vShow > 0. ? projectionMatrix * mv : vec4(0., 0., 2., 1.);
}`,
  `uniform float time, night; varying vec2 vUv; varying vec3 vTint; varying float vSeed, vKind, vShow;
void main() {
  float d = length(vUv) * 2.;
  if (d > 1.) discard;
  float g, white, veil = .08;
  if (vKind < .5) {                                                     // a hard core, a halo, four rays; it twinkles
    float rays = (max(0., 1. - abs(vUv.x) * 38.) + max(0., 1. - abs(vUv.y) * 38.)) * (1. - d);
    g = (smoothstep(.2, 0., d) + pow(1. - d, 3.) * .55 + rays * .8) * (.78 + .22 * sin(time * (1.6 + vSeed * 3.) + vSeed * 50.));
    white = smoothstep(.3, 0., d);
  } else if (vKind < 1.5) {                                             // a glass ball: a bright shell, a glint, a glow within
    float shell = smoothstep(1., .86, d) * smoothstep(.5, .95, d), glint = smoothstep(.28, 0., length(vUv - vec2(-.14, .17)) * 2.);
    g = pow(1. - d, 1.6) * .75 + shell * .55 + glint * .7 + .12 * sin(time * 2. + vSeed * 40.) * (1. - d);
    white = shell * .3 + glint * .7; veil = .35;
  } else {
    g = pow(1. - d, 2.) * (vKind < 2.5 ? mix(.3, 1., night) : 1.4);
    white = .45;
  }
  g *= vShow;
  gl_FragColor = vec4(mix(vTint, vec3(1.), white) * g * mix(.92, 1.2, night), min(1., g) * mix(.62, veil, night));
}`
);

const LABEL_VERTEX = `attribute vec4 aAt, aCell; attribute vec2 aFar;
varying vec2 vUv; varying float vShow;
void main() {
  vUv = aCell.xy + uv * aCell.zw;
  vec4 mv = modelViewMatrix * vec4(aAt.xyz, 1.);
  float far = -mv.z;
  vShow = smoothstep(aFar.y, aFar.x, far) * smoothstep(.9, 1.6, far);    // gone in the distance, and when walked through
  // its width on screen stays between two shares of its distance: not a billboard in the visitor's face, not a speck across the village
  float w = clamp(aAt.w * (1. + clamp((far - 7.) * .045, 0., aFar.y * .03)), far * (aFar.y > 50. ? .2 : .18), far * .4);
  mv.xy += vec2(position.x * w, (position.y + .5) * w * .25 - aAt.w * .125);                // it grows upwards: its lower edge stays over the bot's head
  gl_Position = vShow > 0. ? projectionMatrix * mv : vec4(0., 0., 2., 1.);
}`;
const LABEL_FRAGMENT = `uniform sampler2D map; varying vec2 vUv; varying float vShow;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a * vShow < .3) discard;   // what is left writes depth: of two names in a line, the nearer one is read
  gl_FragColor = vec4(t.rgb * t.a, t.a) * vShow;
}`;

/** One quad drawn `count` times, each with its own values of `attrs` (name: [values, how many per quad]). */
function quads(count: number, attrs: Record<string, [Float32Array, number]>) {
  const quad = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute("position", quad.getAttribute("position"));
  g.setAttribute("uv", quad.getAttribute("uv"));
  for (const [name, [values, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(values, size));
  g.instanceCount = count;
  return g;
}

const CELL = { w: 384, h: 96, cols: 4 };
/** The name tags of all bots on one canvas: what a bot is called, and under it what it is. */
function drawLabels(rows: { nick: string; name: string; tint: string }[]) {
  const canvas = document.createElement("canvas");
  canvas.width = CELL.w * CELL.cols;
  canvas.height = CELL.h * Math.ceil(rows.length / CELL.cols);
  const ctx = canvas.getContext("2d")!;
  const fit = (text: string, max: number) => {
    if (ctx.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  };
  ctx.textBaseline = "middle";
  rows.forEach((row, i) => {
    const x = (i % CELL.cols) * CELL.w + 6, y = Math.floor(i / CELL.cols) * CELL.h + 6, w = CELL.w - 12, h = CELL.h - 12;
    ctx.fillStyle = "rgba(18,15,28,0.8)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = row.tint; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = row.tint;
    ctx.beginPath(); ctx.arc(x + h / 2, y + h / 2, 11, 0, Math.PI * 2); ctx.fill();
    const own = row.nick !== row.name; // a bot without a name of its own shows what it is, once
    ctx.fillStyle = "#ffffff";
    // as large as the name allows: it is what is read from across the village
    let size = own ? 37 : 30;
    do ctx.font = `700 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    while (ctx.measureText(row.nick).width > w - h - 14 && --size > 25);
    ctx.fillText(fit(row.nick, w - h - 14), x + h - 6, y + (own ? h * 0.36 : h / 2));
    if (!own) return;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "500 20px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(fit(row.name, w - h - 14), x + h - 6, y + h * 0.74);
  });
  const texture = new THREE.CanvasTexture(canvas); // left as drawn (no colour space): the shader writes it as it is
  texture.anisotropy = 4;
  return texture;
}

export function Constellation({ bots, posts, ground, open }: { bots: Bot[]; posts: Post[]; ground: Map<string, number>; open: string | null }) {
  const built = useMemo(() => {
    const n = posts.length;
    const bot = new Map(bots.map((b) => [b.key, b]));
    const leads = new Set(posts.map((p) => p.parent));
    const rows = posts.map((p) => {
      const b = bot.get(p.key)!, tint = TINT[familyOf(b)], y = ground.get(p.key) ?? 0.2, lead = leads.has(p.key);
      return { p, b, tint, color: new THREE.Color(tint), y, seed: seedOf(p.key), star: y + starHeight(p, lead), big: bigOf(p, lead), tag: tagWide(p, lead) };
    });
    const index = new Map(rows.map((r, i) => [r.p.key, i]));
    const rgb = (into: Float32Array, i: number, c: THREE.Color) => into.set([c.r, c.g, c.b], i * 3);

    // rings on the ground
    const padAt = new Float32Array(n * 4), padTint = new Float32Array(n * 3), padSeed = new Float32Array(n), padOn = new Float32Array(n);
    rows.forEach((r, i) => { padAt.set([r.p.x + (r.p.key === ROOT ? 0.15 : 0), r.y + 0.04, r.p.z, r.p.key === ROOT ? 4.6 : 2.5 * r.big], i * 4); rgb(padTint, i, r.color); padSeed[i] = r.seed; });
    const pads = quads(n, { aAt: [padAt, 4], aTint: [padTint, 3], aSeed: [padSeed, 1], aOn: [padOn, 1] });

    // stars, the bots at rest, motes over the village, and the sparks of an answer
    const count = n * 2 + MOTES + SPARKS;
    const at = new Float32Array(count * 4), tint = new Float32Array(count * 3), seed = new Float32Array(count), kind = new Float32Array(count), show = new Float32Array(count).fill(1);
    rows.forEach((r, i) => {
      at.set([r.p.x, r.star, r.p.z, 0.34 * r.big * r.big], i * 4); rgb(tint, i, r.color); seed[i] = r.seed;
      at.set([r.p.x, r.y + 1.05, r.p.z, 0.62 * r.big], (n + i) * 4); rgb(tint, n + i, r.color); seed[n + i] = r.seed; kind[n + i] = 1;
    });
    for (let j = 0; j < MOTES; j++) {
      const i = n * 2 + j, r = rows[j % n], a = j * 2.399963, d = 1.5 + ((j * 7) % 11);
      at.set([r.p.x + Math.cos(a) * d, r.y + 0.2, r.p.z + Math.sin(a) * d, 0.07 + (j % 3) * 0.025], i * 4); rgb(tint, i, r.color); seed[i] = (j * 0.6180339887) % 1; kind[i] = 2;
    }
    for (let j = 0; j < SPARKS; j++) { const i = n * 2 + MOTES + j; at[i * 4 + 3] = 0.16; tint.set([1, 0.86, 0.45], i * 3); seed[i] = (j + 0.5) / SPARKS; kind[i] = 3; }
    const sparks = quads(count, { aAt: [at, 4], aTint: [tint, 3], aSeed: [seed, 1], aKind: [kind, 1], aShow: [show, 1] });

    // threads of light from each bot up to its star, and the lines of the constellation between the stars
    const segments: { a: number[]; b: number[]; c: THREE.Color; seed: number; w: number }[] = [];
    for (const r of rows) {
      segments.push({ a: [r.p.x, r.y + LABEL_Y + 0.45 * r.big, r.p.z], b: [r.p.x, r.star, r.p.z], c: r.color, seed: r.seed, w: 0.035 * r.big });
      const parent = r.p.parent === null ? undefined : rows[index.get(r.p.parent) ?? -1];
      if (parent) segments.push({ a: [parent.p.x, parent.star, parent.p.z], b: [r.p.x, r.star, r.p.z], c: r.color, seed: r.seed + 0.37, w: 0.05 });
    }
    const m = segments.length;
    const from = new Float32Array(m * 12), to = new Float32Array(m * 12), uv = new Float32Array(m * 8), lineTint = new Float32Array(m * 12), lineSeed = new Float32Array(m * 4), width = new Float32Array(m * 4), order = new Uint16Array(m * 6);
    segments.forEach((s, i) => {
      [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([x, y], v) => {
        const k = i * 4 + v;
        from.set(s.a, k * 3); to.set(s.b, k * 3); uv.set([x, y], k * 2); rgb(lineTint, k, s.c); lineSeed[k] = s.seed; width[k] = s.w;
      });
      order.set([0, 1, 2, 2, 1, 3].map((v) => i * 4 + v), i * 6);
    });
    const ribbons = new THREE.BufferGeometry();
    ribbons.setIndex(new THREE.BufferAttribute(order, 1));
    for (const [name, values, size] of [["position", from, 3], ["aB", to, 3], ["aUv", uv, 2], ["aTint", lineTint, 3], ["aSeed", lineSeed, 1], ["aW", width, 1]] as const) ribbons.setAttribute(name, new THREE.BufferAttribute(values, size));

    // names: a bot's own within a short walk, those of the heads of the clusters from across the village
    const map = drawLabels(rows.map((r) => ({ nick: nickOf(r.b), name: r.b.key === ROOT ? "Ask us anything about UPOU" : r.b.name, tint: r.tint })));
    const lines = Math.ceil(n / CELL.cols), labelAt = new Float32Array(n * 4), cell = new Float32Array(n * 4), far = new Float32Array(n * 2);
    rows.forEach((r, i) => {
      labelAt.set([r.p.x, r.y + LABEL_Y + (r.p.key === ROOT ? 0.35 : 0), r.p.z, r.tag], i * 4);
      cell.set([(i % CELL.cols) / CELL.cols, 1 - (Math.floor(i / CELL.cols) + 1) / lines, 1 / CELL.cols, 1 / lines], i * 4);
      far.set(r.big > 1 ? [70, 95] : [22, 28], i * 2);
    });
    const labels = quads(n, { aAt: [labelAt, 4], aCell: [cell, 4], aFar: [far, 2] });
    const labelMaterial = new THREE.ShaderMaterial({ vertexShader: LABEL_VERTEX, fragmentShader: LABEL_FRAGMENT, uniforms: { map: { value: map } }, transparent: true, premultipliedAlpha: true });

    return { pads, sparks, ribbons, labels, labelMaterial, map, index, n, padOn: pads.getAttribute("aOn"), show: sparks.getAttribute("aShow"), rows };
  }, [bots, posts, ground]);

  useEffect(() => () => { for (const g of [built.pads, built.sparks, built.ribbons, built.labels]) g.dispose(); built.labelMaterial.dispose(); built.map.dispose(); }, [built]);

  // the ring of the bot the visitor talks to burns brighter
  useEffect(() => {
    const on = built.padOn.array as Float32Array;
    on.fill(0);
    const i = open === null ? undefined : built.index.get(open);
    if (i !== undefined) on[i] = 1;
    built.padOn.needsUpdate = true;
  }, [built, open]);

  useFrame(({ clock }) => {
    U.time.value = clock.elapsedTime * (live.calm ? 0.15 : 1);
    U.night.value = skyState.active ? skyState.night : 0;
    // a bot whose figure stands (Figures.tsx) is no longer a ball of light
    const show = built.show.array as Float32Array;
    let changed = false;
    built.rows.forEach((r, i) => {
      const rest = 1 - (live.shown.get(r.p.key) ?? 0);
      if (show[built.n + i] !== rest) (show[built.n + i] = rest), (changed = true);
    });
    if (changed) built.show.needsUpdate = true;
    if (live.burst) {
      const { x, y, z } = live.burst;
      U.burstAt.value.set(x, y, z);
      if (!live.calm) U.burst.value = clock.elapsedTime;
      live.burst = null;
    }
  });

  return (
    <>
      <mesh geometry={built.pads} material={PAD} frustumCulled={false} raycast={noRaycast} userData={{ navIgnore: true }} renderOrder={1} />
      <mesh geometry={built.ribbons} material={RIBBON} frustumCulled={false} raycast={noRaycast} userData={{ navIgnore: true }} renderOrder={2} />
      <mesh geometry={built.sparks} material={SPARK} frustumCulled={false} raycast={noRaycast} userData={{ navIgnore: true }} renderOrder={3} />
      <mesh geometry={built.labels} material={built.labelMaterial} frustumCulled={false} raycast={noRaycast} userData={{ navIgnore: true }} renderOrder={4} />
    </>
  );
}
