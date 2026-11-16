/**
 * The season's own touches outdoors (src/sky/seasons.ts): a tree in the
 * meadow that blossoms, greens, reddens, and goes bare, with petals or
 * leaves drifting down from it, and cicadas on summer days. The ground and
 * the treeline change colour in Outdoors.tsx, and snow falls in Rain.tsx.
 *
 * Built-in rooms only, and only while a season is on. Cheap: the tree is
 * two meshes (trunk, canopy), the falling petals one points mesh, and the
 * cicadas a synthesized loop.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { skyState } from "../sky/skyState";
import type { Season } from "../sky/seasons";
import { setCicadas } from "../audio/sfx";
import { floorHeightAt, makeObstacle, setSceneryObstacles, sheltered } from "./layout";
import { softDotTexture } from "./softDot";
import { viewerPosition } from "../xr/viewer";

/** Out in the open east side of the meadow: clear of the campsite, the
 *  portals, and the steps, and seen from the top of the steps. */
const TREE_AT: [number, number] = [14, 47];
const TRUNK_RADIUS = 0.3;
/** Where the canopy is, for petals to fall from. */
const CANOPY_Y = 4.2;
const CANOPY_RADIUS = 2.8;

const CANOPY_COLORS: Record<Season, string> = {
  spring: "#f2b9c8", // sakura
  summer: "#4d7b37",
  autumn: "#c4472c", // momiji
  winter: "#ffffff", // bare: the canopy is hidden
};

/** Petals in spring and leaves in autumn, a few each. */
const MAX_FALLING = 140;
const FALLING_COLORS: Partial<Record<Season, THREE.Color[]>> = {
  spring: ["#f7c6d3", "#fbe0e7", "#f2aec1"].map((c) => new THREE.Color(c)),
  autumn: ["#c4472c", "#d8752e", "#b8352a", "#d9a03a"].map((c) => new THREE.Color(c)),
};
/** Beyond this the falling petals aren't drawn or moved. */
const FALLING_RANGE = 45;

const scratchEye = new THREE.Vector3();

function buildTree() {
  // Trunk and a few boughs, tapering, merged into one mesh.
  const trunk = new THREE.CylinderGeometry(0.16, TRUNK_RADIUS, 3.4, 7).translate(0, 1.7, 0);
  const boughs = [
    [0.9, 0.5],
    [-0.8, 0.9],
    [0.2, -1],
  ].map(([x, z]) => {
    const bough = new THREE.CylinderGeometry(0.06, 0.12, 1.8, 5).translate(0, 0.9, 0);
    const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, 1.3, z).normalize());
    return bough.applyQuaternion(tilt).translate(0, 2.8, 0);
  });
  const wood = mergeGeometries([trunk, ...boughs].map((g) => g.toNonIndexed()));
  // The canopy: overlapping low-poly puffs, like the treeline's cones.
  const puffs = [
    [0, 4.4, 0, 1.7],
    [1.3, 4.0, 0.5, 1.2],
    [-1.2, 4.1, 0.7, 1.25],
    [0.3, 4.0, -1.3, 1.2],
    [-0.4, 5.0, -0.3, 1.1],
  ].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z));
  const canopy = mergeGeometries(puffs);
  [trunk, ...boughs, ...puffs].forEach((g) => g.dispose());
  return { wood, canopy };
}

function SeasonalTree({ season }: { season: Season }) {
  const { wood, canopy } = useMemo(buildTree, []);
  const woodMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: "#5a4334", flatShading: true }), []);
  const canopyMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: CANOPY_COLORS[season], flatShading: true }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    canopyMaterial.color.set(CANOPY_COLORS[season]);
  }, [season, canopyMaterial]);
  useEffect(
    () => () => {
      wood.dispose();
      canopy.dispose();
      woodMaterial.dispose();
      canopyMaterial.dispose();
    },
    [wood, canopy, woodMaterial, canopyMaterial]
  );
  // Its trunk is solid while it's there.
  useEffect(() => {
    setSceneryObstacles([makeObstacle(TREE_AT[0], TREE_AT[1], TRUNK_RADIUS + 0.05, TRUNK_RADIUS + 0.05)]);
    return () => setSceneryObstacles([]);
  }, []);
  const y = floorHeightAt(TREE_AT[0], TREE_AT[1]);
  return (
    <group position={[TREE_AT[0], y, TREE_AT[1]]}>
      <mesh geometry={wood} material={woodMaterial} castShadow />
      {season !== "winter" && <mesh geometry={canopy} material={canopyMaterial} castShadow />}
    </group>
  );
}

/** Petals or leaves drifting down from the tree's canopy and settling. */
function Falling({ season }: { season: Season }) {
  const points = useRef<THREE.Points>(null);
  const colors = FALLING_COLORS[season];
  const ground = useMemo(() => floorHeightAt(TREE_AT[0], TREE_AT[1]), []);
  const state = useMemo(() => {
    const s = { x: new Float32Array(MAX_FALLING), y: new Float32Array(MAX_FALLING), z: new Float32Array(MAX_FALLING), phase: new Float32Array(MAX_FALLING), time: 0 };
    for (let i = 0; i < MAX_FALLING; i++) {
      s.x[i] = TREE_AT[0] + (Math.random() - 0.5) * CANOPY_RADIUS * 2;
      s.z[i] = TREE_AT[1] + (Math.random() - 0.5) * CANOPY_RADIUS * 2;
      s.y[i] = ground + Math.random() * CANOPY_Y;
      s.phase[i] = Math.random() * Math.PI * 2;
    }
    return s;
  }, [ground]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_FALLING * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX_FALLING * 3), 3));
    return g;
  }, []);
  useEffect(() => {
    if (!colors) return;
    const c = (geometry.getAttribute("color") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < MAX_FALLING; i++) colors[i % colors.length].toArray(c, i * 3);
    geometry.getAttribute("color").needsUpdate = true;
  }, [colors, geometry]);
  const material = useMemo(
    () => new THREE.PointsMaterial({ size: 0.09, map: softDotTexture(), vertexColors: true, alphaTest: 0.35, fog: true }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame(({ camera }, delta) => {
    const mesh = points.current;
    if (!mesh) return;
    const eye = viewerPosition(camera, scratchEye);
    mesh.visible = Math.hypot(eye.x - TREE_AT[0], eye.z - TREE_AT[1]) < FALLING_RANGE;
    if (!mesh.visible) return;
    const dt = Math.min(delta, 0.1);
    state.time += dt;
    const drift = (skyState.weatherState?.windSpeed() ?? 0) * 0.05;
    const p = (geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < MAX_FALLING; i++) {
      // Petals flutter down slowly, swinging side to side.
      state.y[i] -= (0.35 + 0.25 * Math.sin(state.phase[i] * 3.1)) * dt;
      state.x[i] += drift * dt;
      if (state.y[i] < ground + 0.03) {
        state.x[i] = TREE_AT[0] + (Math.random() - 0.5) * CANOPY_RADIUS * 2;
        state.z[i] = TREE_AT[1] + (Math.random() - 0.5) * CANOPY_RADIUS * 2;
        state.y[i] = ground + CANOPY_Y - Math.random() * 1.2;
      }
      const swing = state.time * (0.9 + 0.4 * Math.sin(state.phase[i])) + state.phase[i];
      p[i * 3] = state.x[i] + Math.sin(swing) * 0.35;
      p[i * 3 + 1] = state.y[i];
      p[i * 3 + 2] = state.z[i] + Math.cos(swing * 0.8) * 0.3;
    }
    geometry.getAttribute("position").needsUpdate = true;
  });

  if (!colors) return null;
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Cicadas by day in summer, outdoors, and not in the rain. Checked a few
 *  times a second; the sound eases itself. */
function Cicadas() {
  const since = useRef(1);
  useEffect(() => () => setCicadas(0), []);
  useFrame(({ camera }, delta) => {
    since.current += delta;
    if (since.current < 0.25) return;
    since.current = 0;
    const eye = viewerPosition(camera, scratchEye);
    const day = Math.min(1, skyState.dayness * 1.5) * (1 - skyState.night);
    const dry = 1 - Math.min(1, skyState.rain * 3);
    const outside = sheltered(eye.x, eye.y, eye.z) ? 0.25 : 1;
    setCicadas(day * dry * outside);
  });
  return null;
}

/** Everything seasonal that isn't a recolour: mount once, in a moving sky. */
export function Seasons({ builtin }: { builtin: boolean }) {
  const season = useSeason();
  if (!season) return null;
  return (
    <>
      {builtin && <SeasonalTree season={season} />}
      {builtin && (season === "spring" || season === "autumn") && <Falling key={season} season={season} />}
      {season === "summer" && <Cicadas />}
    </>
  );
}

/** skyState.season, as React state: it changes rarely (a room's pick, or
 *  the calendar turning), so checking twice a second is plenty. */
function useSeason(): Season | null {
  const [season, setSeason] = useState<Season | null>(skyState.season);
  const since = useRef(0);
  useFrame((_, delta) => {
    since.current += delta;
    if (since.current < 0.5) return;
    since.current = 0;
    setSeason(skyState.season);
  });
  return season;
}
