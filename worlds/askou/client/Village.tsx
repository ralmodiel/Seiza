// The village in the 3D world: the constellation of all bots, the figures of those nearby, the lights that lead to a
// bot, and (in a headset) the panel beside the bot being talked to.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import * as THREE from "three";
import type { WorldSceneProps } from "../../../src/worlds/WorldExtension";
import { Constellation } from "./Constellation";
import { Figures } from "./Figures";
import { tagWide, type Post } from "./layout";
import { Motto } from "./Motto";
import * as store from "./store";
import { arrive, live, pairMid, postOf, setTravel, showWay, standBy, standWith, useVillage, village } from "./store";
import { VillageXr } from "./VillageXr";

type Props = Pick<WorldSceneProps, "warp" | "faceToward" | "getSelfPosition" | "findPath">;
const noRaycast = () => {};

export function Village({ warp, faceToward, getSelfPosition, findPath }: Props) {
  const { bots, posts, open, trail, near } = useVillage();
  const inXr = useXR((s) => s.session != null);
  // the newest of each, for callbacks that outlive a render
  const fns = useRef({ warp, faceToward, getSelfPosition, findPath });
  fns.current = { warp, faceToward, getSelfPosition, findPath };

  /** The height of the walkable ground at a spot; null off the walkable ground, or before the world's map has loaded. */
  const groundAt = useMemo(() => {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    return (x: number, z: number) => {
      const p = fns.current.findPath(a.set(x, 0.6, z), b.set(x + 0.4, 0.6, z))?.[0];
      return p && Math.hypot(p.x - x, p.z - z) < 0.7 ? p.y : null;
    };
  }, []);

  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    setTravel({
      warp: (at) => fns.current.warp(at),
      faceToward: (x, z) => fns.current.faceToward(x, z),
      getSelfPosition: () => fns.current.getSelfPosition(),
      groundAt,
      // behind one's own avatar = the camera stands well away from where the visitor does
      third: () => ((p) => Math.hypot(camera.position.x - p[0], camera.position.z - p[2]) > 1)(fns.current.getSelfPosition()),
      ahead: () => {
        if (!gl.xr.isPresenting) return null;
        const d = camera.getWorldDirection(new THREE.Vector3()), flat = Math.hypot(d.x, d.z);
        return flat > 0.2 ? [d.x / flat, d.z / flat] : null; // looking straight up or down tells no way
      },
    });
    return () => setTravel(null);
  }, [groundAt, camera, gl]);
  useFraming(getSelfPosition);

  // The ground under each bot, once the world's map has loaded (asked again until it has).
  const [ground, setGround] = useState(() => new Map<string, number>());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const heights = new Map<string, number>();
      for (const p of posts) {
        const y = groundAt(p.x, p.z);
        if (y !== null) heights.set(p.key, y);
      }
      // the same heights again (Askou's list came in with the bots where they stood): nothing is drawn anew
      if (heights.size) setGround((was) => (was.size === heights.size && [...heights].every(([k, y]) => was.get(k) === y) ? was : heights));
      else timer = setTimeout(measure, 600);
    };
    measure();
    return () => clearTimeout(timer);
  }, [posts, groundAt]);

  // Arrival, once the map has loaded (standing by a bot needs the ground) and Seiza has put the camera where it stays (a few frames).
  const frames = useRef(0);
  useFrame(() => {
    if (ground.size && frames.current < 4 && ++frames.current === 4) arrive();
  });

  // Development only: what the probes in .scratch/ read (the renderer's counters, the village's state).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __askou?: unknown };
    w.__askou = { gl, scene, camera, store, village: store.village, live: store.live, ground: () => ground.size, heights: () => Object.fromEntries(ground), self: () => fns.current.getSelfPosition(), groundAt, screen: (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(camera); return [((v.x + 1) / 2) * gl.domElement.clientWidth, ((1 - v.y) / 2) * gl.domElement.clientHeight, v.z]; }, warp: (at: [number, number, number]) => fns.current.warp(at), face: (x: number, z: number) => fns.current.faceToward(x, z) };
    return () => void delete w.__askou;
  }, [gl, scene, camera, ground, groundAt]);

  const target = trail ? postOf(trail) : undefined;
  return (
    <>
      <Constellation bots={bots} posts={posts} ground={ground} open={open} />
      <Figures bots={bots} posts={posts} ground={ground} getSelfPosition={getSelfPosition} cap={inXr ? 8 : 14} />
      {target && <Trail key={target.key} to={target} posts={posts} findPath={findPath} getSelfPosition={getSelfPosition} groundAt={groundAt} />}
      <Motto botKey={open ? null : near} ground={ground} />
      {inXr && open && <VillageXr botKey={open} ground={ground} />}
    </>
  );
}

const SEEN = new THREE.Vector3();
/** A place as the camera sees it: [metres to the right, metres ahead]. */
const seenFrom = (camera: THREE.Camera, x: number, y: number, z: number): [number, number] => (SEEN.set(x, y, z).applyMatrix4(camera.matrixWorldInverse), [SEEN.x, -SEEN.z]);

/** Keeps what the visitor looks at in view while a panel covers part of the screen: the middle of the picture moves to
 *  the middle of what the panel leaves free (beside it on a wide screen, under it on a phone). In third person that
 *  middle is given to the pair, the bot of the talk and the visitor's own avatar, so that a narrow screen shows both
 *  (a tablet cut the bot off at its edge, a phone had the avatar stand in front of it); also with no panel, while the
 *  visitor stays where the village stood them by a bot. Not in a headset. */
function useFraming(getSelfPosition: Props["getSelfPosition"]) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera, gl = useThree((s) => s.gl), size = useThree((s) => s.size);
  const f = useRef({ x: 0, y: 0, tx: 0, ty: 0, due: 0, set: "", third: false });
  useEffect(() => () => camera.clearViewOffset?.(), [camera]);
  useFrame((_, delta) => {
    const s = f.current;
    if ((s.due -= delta) <= 0) {
      s.due = 0.2;
      const r = gl.xr.isPresenting ? undefined : document.querySelector(".av-panel")?.getBoundingClientRect();
      const beside = !!r && r.width < size.width * 0.6;
      const [x, y, z] = getSelfPosition();
      // the bot of the talk; with no panel, the bot the village stood the visitor by (a visit, an arrival), until they walk on
      const by = r ? village().open : !gl.xr.isPresenting && live.stood && Math.hypot(x - live.stood.x, z - live.stood.z) < 0.3 ? live.stood.key : null;
      const post = postOf(by);
      const third = Math.hypot(camera.position.x - x, camera.position.z - z) > 1; // behind their own avatar
      // a visitor who steps behind their avatar while standing by a bot is turned so that it stands beside the avatar, not
      // behind it; only within the reach in which standWith turns and does not move them. Not on the way back: a wall
      // behind the visitor pulls the camera in (Seiza's limitView), and a turn each way would then swing them to and fro
      if (third && !s.third && post && !gl.xr.isPresenting && Math.hypot(post.x - x, post.z - z) <= 4) standWith(post);
      s.third = third;
      const pair = post && third
        ? pairMid(seenFrom(camera, post.x, y, post.z), seenFrom(camera, x, y, z), size.height / 2 / Math.tan((camera.fov * Math.PI) / 360), size.height * 0.12,
            tagWide(post, village().posts.some((q) => q.parent === post.key)) / 2, (beside ? size.width - r!.right : size.width) - 16) // its name tag is the widest of a bot
        : 0;
      s.tx = (r && beside ? r.right / 2 : 0) - pair;
      s.ty = r && !beside ? Math.min(r.bottom / 2, size.height * 0.3) : 0;
    }
    const k = gl.xr.isPresenting || live.calm ? 1 : 1 - Math.exp(-7 * delta);
    s.x += (s.tx - s.x) * k;
    s.y += (s.ty - s.y) * k;
    const x = Math.round(s.x), y = Math.round(s.y), now = `${x},${y},${size.width},${size.height}`;
    if (now === s.set || !camera.isPerspectiveCamera) return;
    s.set = now;
    if (x || y) camera.setViewOffset(size.width, size.height, -x, -y, size.width, size.height);
    else camera.clearViewOffset();
  });
}

const MARKS = 90;
const TRAIL = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  transparent: true,
  depthWrite: false,
  premultipliedAlpha: true,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
  vertexShader: `attribute float aI; varying vec2 vUv; varying float vI;
void main() { vUv = uv; vI = aI; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float time; varying vec2 vUv; varying float vI;
void main() {
  float arrow = smoothstep(.13, .08, abs(vUv.y - (.72 - abs(vUv.x - .5)))) * smoothstep(.5, .42, abs(vUv.x - .5));
  float run = .35 + .65 * pow(.5 + .5 * sin(time * 4. - vI * .9), 3.);   // light runs along the arrows, toward the bot
  float a = arrow * run;
  gl_FragColor = vec4(vec3(1., .86, .42) * a, a * .9);
}`,
});
const ARROW = new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2);
ARROW.setAttribute("aI", new THREE.InstancedBufferAttribute(Float32Array.from({ length: MARKS }, (_, i) => i), 1));

/** Arrows of light on the ground, from the visitor along the walking route to a bot; gone once they have arrived. */
function Trail({ to, posts, findPath, getSelfPosition, groundAt }: { to: Post; posts: Post[]; findPath: Props["findPath"]; getSelfPosition: Props["getSelfPosition"]; groundAt: (x: number, z: number) => number | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const laid = useRef(-1);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    TRAIL.uniforms.time.value = live.calm ? 0 : clock.elapsedTime; // less movement asked for: the arrows are lit, the light does not run along them
    if (clock.elapsedTime - laid.current < 0.5 && laid.current >= 0) return;
    laid.current = clock.elapsedTime;
    const [x, y, z] = getSelfPosition();
    if (Math.hypot(to.x - x, to.z - z) < 3.4) return showWay(null);
    const spot = standBy(to, [x, z], groundAt, posts) ?? [to.x, y, to.z];
    const path = findPath(new THREE.Vector3(x, y + 0.4, z), new THREE.Vector3(spot[0], spot[1] + 0.4, spot[2])) ?? [new THREE.Vector3(x, y, z), new THREE.Vector3(spot[0], spot[1], spot[2])];
    // an arrow every 1.15 m along the route, the first a step ahead of the visitor
    const at = new THREE.Matrix4(), turn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    let n = 0, carry = 1.2;
    for (let i = 1; i < path.length && n < MARKS; i++) {
      const a = path[i - 1], b = path[i], len = a.distanceTo(b);
      turn.setFromAxisAngle(up, Math.atan2(a.x - b.x, a.z - b.z));
      for (; carry <= len && n < MARKS; carry += 1.15) m.setMatrixAt(n++, at.compose(p.lerpVectors(a, b, carry / len).setY(p.y + 0.05), turn, one));
      carry -= len;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[ARROW, TRAIL, MARKS]} frustumCulled={false} raycast={noRaycast} userData={{ navIgnore: true }} renderOrder={2} />
  );
}
