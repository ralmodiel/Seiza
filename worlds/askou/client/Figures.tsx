// The bots themselves, as 3D figures. Only those near the visitor stand (the others rest as balls of light, see
// Constellation.tsx): a figure pops up as the visitor walks toward it, turns to face them, looks them in the eye, waves
// once when they come close, and shows on its face what the talk is doing (listening, thinking, glad, at a loss).
// One of them is built per frame at most, and the far ones are freed, so walking the village never stalls.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { skyState } from "../../../src/sky/skyState";
import { registerGazeTarget } from "../../../src/xr/hud/gaze";
import { viewerPosition } from "../../../src/xr/viewer";
import type { Bot } from "./api";
import { disposeKit, dropFigure, initKit, MAT, SHADE } from "./figures/figureKit";
import { buildFigure, figureFor, gaze, still } from "./figures/figures3d";
import { HUB, ROOT, type Post } from "./layout";
import { live, openBot, reducedMotion, setNear, village } from "./store";

/** A figure is 1.5 m tall as built; a little under that here, so a visitor's avatar looks it level in the eye. */
export const SCALE = 0.92;
const SHOW = 30, HIDE = 36; // metres: a figure is built within the first and freed beyond the second
const TALK = 3.8; // closer than this the HUD offers to talk
const POP = 0.55; // seconds a figure takes to pop up

type Fig = ReturnType<typeof buildFigure>;
interface Standing {
  key: string;
  /** what the figure was drawn from (lookOf) */
  look: string;
  post: Post;
  fig: Fig;
  holder: THREE.Group;
  born: number;
  gone: number | null;
  yaw: number;
  /** How excited (0..1): it waves. */
  e: number;
  /** what `e` follows (see the tick) */
  lead: number;
  waveUntil: number;
  close: boolean;
  /** typing, thinking, happy, miss, dance: each 0..1, eased. */
  mood: number[];
  glow: number;
  far: number;
}

const HIT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const turn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));
/** What a bot's figure is drawn from: when Askou's list says otherwise (an admin gave the bot another design), the figure is built anew. */
const lookOf = (b: Bot) => JSON.stringify([b.kind, b.parentKey, b.figure, b.held]);
/** Overshoots a little, then settles: a pop, not a fade. */
const pop = (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;

export function Figures({ bots, posts, ground, getSelfPosition, cap }: { bots: Bot[]; posts: Post[]; ground: Map<string, number>; getSelfPosition: () => [number, number, number]; cap: number }) {
  const camera = useThree((s) => s.camera);
  const root = useRef<THREE.Group>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const standing = useRef(new Map<string, Standing>());
  const order = useRef<{ post: Post; d: number }[]>([]);
  const clock = useRef({ sorted: -1, frame: 0 });
  const byKey = useMemo(() => new Map(bots.map((b) => [b.key, b])), [bots]);
  const heightOf = (p: Post) => ground.get(p.key) ?? 0.2;

  useEffect(() => {
    initKit();
    // the shadow under a figure lies on the ground: without this the two flicker
    SHADE.polygonOffset = true;
    SHADE.polygonOffsetFactor = SHADE.polygonOffsetUnits = -3;
    const all = standing.current;
    return () => {
      // off the scene too: when the code changes under an open page this runs while the scene stays, and the old figures stood on beside the new
      for (const s of all.values()) {
        s.holder.removeFromParent();
        dropFigure(s.fig.root);
      }
      all.clear();
      live.shown.clear();
      disposeKit();
      document.body.style.cursor = "";
    };
  }, []);

  // A bot that left Askou, moved, or was given another look gives up its figure; the next frames build it anew where it stands now.
  useEffect(() => {
    for (const s of standing.current.values()) {
      const now = posts.find((p) => p.key === s.key), bot = byKey.get(s.key);
      if (now && bot && now.x === s.post.x && now.z === s.post.z && lookOf(bot) === s.look) continue;
      s.holder.removeFromParent();
      dropFigure(s.fig.root);
      standing.current.delete(s.key);
      live.shown.delete(s.key);
    }
    order.current = [];
    clock.current.sorted = -1;
  }, [posts, byKey]);

  // What a click lands on: one box per bot, standing or resting, in one draw call that draws nothing.
  useEffect(() => {
    // the ground is measured once the world's map has loaded, which may be after a figure was built: it steps onto it
    for (const s of standing.current.values()) s.holder.position.y = heightOf(s.post);
    // the boxes are made anew when the number of bots changes, and a box that is gone says no "pointer out"
    live.hover = null;
    document.body.style.cursor = "";
    const mesh = hits.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    posts.forEach((p, i) => {
      const wide = p.key === ROOT ? 2.9 : 1.9;
      mesh.setMatrixAt(i, m.makeScale(wide, 2.3, wide).setPosition(p.x, heightOf(p) + 1.15, p.z));
    });
    mesh.count = posts.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = null;
    mesh.boundingBox = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, ground]);

  /** The bot the viewer looks straight at: the first click box the middle of the view meets (a phone in a viewer has
   *  nothing to point with: Seiza's gaze, which tells where on a mesh it rests, not which bot's box that is). */
  const sight = useMemo(() => new THREE.Raycaster(), []);
  const aimed = () => {
    const mesh = hits.current;
    if (!mesh) return null;
    viewerPosition(camera, sight.ray.origin); // asked every frame by Seiza's gaze: nothing is made
    camera.getWorldDirection(sight.ray.direction);
    sight.far = 6; // as far as Seiza's gaze reaches (src/xr/hud/gaze.ts)
    const id = sight.intersectObject(mesh, false)[0]?.instanceId;
    return id === undefined ? null : posts[id]?.key ?? null;
  };
  useEffect(() => {
    const mesh = hits.current;
    if (!mesh) return;
    return registerGazeTarget(mesh, { keyAt: aimed, select: () => openBot(aimed()) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, ground]);

  const eye = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    const holder = root.current;
    if (!holder) return;
    const time = state.clock.elapsedTime, dt = Math.min(delta, 0.1), all = standing.current, { open, busy } = village();
    const [sx, , sz] = getSelfPosition();
    viewerPosition(camera, eye);
    // by day the figures are lit as in a studio; at night they keep most of that light: a dim figure with bright eyes is eerie
    MAT.uniforms.lum.value = skyState.active ? 0.72 + 0.28 * (1 - skyState.night) : 1;

    // who is near: sorted a few times a second, not every frame
    if (time - clock.current.sorted > 0.2 || clock.current.sorted < 0) {
      clock.current.sorted = time;
      live.calm = still.on = reducedMotion();
      order.current = posts.map((post) => ({ post, d: Math.hypot(post.x - sx, post.z - sz) })).sort((a, b) => a.d - b.d);
      const wanted = new Set(order.current.slice(0, cap).filter((o) => o.d < HIDE).map((o) => o.post.key));
      if (open) wanted.add(open);
      for (const s of all.values()) if (!wanted.has(s.key) && s.gone === null) s.gone = time;
      const nearest = order.current[0];
      const current = village().near, held = current ? order.current.find((o) => o.post.key === current) : undefined;
      // the bot the visitor stands by keeps the offer to talk until they have walked a step away
      setNear(held && held.d < TALK + 0.9 && !(nearest && nearest.d < held.d - 0.8) ? current : nearest && nearest.d < TALK ? nearest.post.key : null);
    }

    // one new figure a frame: the nearest that does not stand yet
    const next = order.current.find((o, i) => (i < cap && o.d < SHOW) || o.post.key === open ? !all.has(o.post.key) || all.get(o.post.key)!.gone !== null : false);
    if (next) {
      const back = all.get(next.post.key);
      if (back) {
        // it was leaving and the visitor turned round: it stays
        back.born = time - POP * clamp(1 - (time - back.gone!) / 0.3, 0, 1);
        back.gone = null;
      } else {
        const bot = byKey.get(next.post.key);
        if (bot) {
          const fig = buildFigure(figureFor(bot.key, bot.kind, bot.parentKey, bot.figure, bot.held));
          const group = new THREE.Group();
          group.add(fig.root);
          const yaw = Math.atan2(sx - next.post.x, sz - next.post.z);
          group.position.set(next.post.x, heightOf(next.post), next.post.z);
          group.rotation.y = yaw;
          group.scale.setScalar(0.001);
          group.userData.navIgnore = true;
          group.traverse((o) => {
            o.raycast = () => {}; // the hit boxes take the clicks
            o.frustumCulled = true;
          });
          fig.glow.visible = false;
          holder.add(group);
          all.set(bot.key, { key: bot.key, look: lookOf(bot), post: next.post, fig, holder: group, born: time, gone: null, yaw, e: 0, lead: 0, waveUntil: 0, close: false, mood: [0, 0, 0, 0, 0], glow: 0, far: next.d });
        }
      }
    }

    const now = performance.now();
    clock.current.frame++;
    for (const s of all.values()) {
      const k = s.gone === null ? clamp((time - s.born) / POP, 0, 1) : 1 - clamp((time - s.gone) / 0.3, 0, 1);
      if (s.gone !== null && k <= 0) {
        s.holder.removeFromParent();
        dropFigure(s.fig.root);
        all.delete(s.key);
        live.shown.delete(s.key);
        continue;
      }
      live.shown.set(s.key, clamp(k * 1.6, 0, 1));
      const dx = eye.x - s.post.x, dz = eye.z - s.post.z, far = Math.hypot(dx, dz);
      s.far = far;
      s.holder.scale.setScalar(SCALE * Math.max(0.001, s.gone === null && !live.calm ? pop(k) : k));
      // the far ones move on every second or third frame: nobody sees the difference at that distance
      const every = far > 22 ? 3 : far > 13 ? 2 : 1;
      if (every > 1 && (clock.current.frame + s.fig.root.id) % every) continue;
      const step = dt * every;

      // it turns to whoever comes by; left alone it faces the arrival spot
      const target = far < 20 ? Math.atan2(dx, dz) : Math.atan2(HUB.x - s.post.x, HUB.z - s.post.z);
      const off = turn(s.yaw, target);
      s.yaw += off * (1 - Math.exp(-step * 3.2));
      s.holder.rotation.y = s.yaw;

      // a wave, once, as the visitor arrives; and a smaller one under the pointer
      const close = far < (s.close ? 7.5 : 6);
      if (close && !s.close) s.waveUntil = time + 2.4;
      s.close = close;
      const mood = live.moods.get(s.key);
      const want = [open === s.key && live.typing ? 1 : 0, busy === s.key ? 1 : 0, mood && now < mood.happy ? 1 : 0, mood && now < mood.miss ? 1 : 0, mood && now < mood.dance ? 1 : 0];
      for (let i = 0; i < 5; i++) s.mood[i] += (want[i] - s.mood[i]) * (1 - Math.exp(-step * 6));
      // no wave during a dance asked for: the two on one arm made the hand shake
      const excited = live.calm || want[4] ? 0 : time < s.waveUntil ? 1 : live.hover === s.key ? 0.55 : 0;
      // eased twice over, so the arm starts and stops gently when the pointer comes and goes
      const ek = 1 - Math.exp(-step * 9);
      s.lead += (excited - s.lead) * ek;
      s.e += (s.lead - s.e) * ek;

      // eye contact: the eyes lead, the body follows
      gaze.k = far < 12 ? 1 : 0;
      gaze.x = clamp(off * 1.6);
      gaze.y = clamp(((eye.y - (s.holder.position.y + s.fig.fy * SCALE)) / Math.max(far, 1)) * 2.2);
      s.fig.tick(time, s.e, s.mood);

      // the platform of light under the bot being talked to
      s.glow += ((open === s.key ? 1 : 0) - s.glow) * (1 - Math.exp(-step * 7));
      s.fig.glow.visible = s.glow > 0.02;
      if (s.fig.glow.visible) s.fig.glow.scale.setScalar(s.glow);
    }
    gaze.k = 0;
  });

  const keyAt = (e: ThreeEvent<MouseEvent | PointerEvent>) => (e.instanceId === undefined ? null : posts[e.instanceId]?.key ?? null);
  return (
    <>
      <group ref={root} userData={{ navIgnore: true }} />
      <instancedMesh
        ref={hits}
        name="askou-pick"
        args={[undefined, HIT, Math.max(1, posts.length)]}
        key={posts.length}
        frustumCulled={false}
        userData={{ navIgnore: true }}
        onClick={(e) => {
          e.stopPropagation();
          // a drag that looked around and happened to end on a bot is not a click on it
          if (e.delta < 8) openBot(keyAt(e));
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerMove={(e) => {
          e.stopPropagation();
          live.hover = keyAt(e);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          live.hover = null;
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}
