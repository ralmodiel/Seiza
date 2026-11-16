// The kubo hall on the meadow and the cottages on the sand: bamboo,
// sawali, and nipa, each material one merged mesh across all of them.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PooledLight } from "../../../src/scene/LightPool";
import { skyState } from "../../../src/sky/skyState";
import { box, cane, hipRoof, mergeParts, post } from "./geometry";
import { tulayMaterials } from "./materials";
import {
  BENCHES,
  BENCH_LENGTH,
  BOARD,
  COTTAGE,
  COTTAGES,
  HALL,
  HALL_CENTRE,
  HALL_POSTS,
  KNEE_WALL,
  POLES,
  POLE_HEIGHT,
  shoreGround,
  TEACHER_TABLE,
  Y,
} from "./plan";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function buildStructures() {
  const bamboo: THREE.BufferGeometry[] = [];
  const deck: THREE.BufferGeometry[] = [];
  const thatch: THREE.BufferGeometry[] = [];
  const sawali: THREE.BufferGeometry[] = [];
  const wood: THREE.BufferGeometry[] = [];

  // --- the kubo hall ---
  const width = HALL.x1 - HALL.x0;
  const depth = HALL.z1 - HALL.z0;
  const [cx, cz] = HALL_CENTRE;
  deck.push(box(cx, Y + 0.03, cz, width + 0.5, 0.06, depth + 0.5));
  for (const [x, z] of HALL_POSTS) bamboo.push(post(x, Y, z, HALL.eave + 0.15, 0.12));
  // Tie beams round the top of the posts, and two across under the roof.
  const top = Y + HALL.eave;
  for (const [a, b] of [
    [v(HALL.x0, top, HALL.z0), v(HALL.x1, top, HALL.z0)],
    [v(HALL.x0, top, HALL.z1), v(HALL.x1, top, HALL.z1)],
    [v(HALL.x0, top, HALL.z0), v(HALL.x0, top, HALL.z1)],
    [v(HALL.x1, top, HALL.z0), v(HALL.x1, top, HALL.z1)],
    [v(cx - 2.5, top, HALL.z0), v(cx - 2.5, top, HALL.z1)],
    [v(cx + 2.5, top, HALL.z0), v(cx + 2.5, top, HALL.z1)],
  ] as const) {
    bamboo.push(cane(a, b, 0.09));
  }
  thatch.push(hipRoof(cx, cz, width, depth, top + 0.08, HALL.ridge - HALL.eave, HALL.overhang));
  // Knee walls of sawali east and west, from a little in from the open
  // front to the back, with a bamboo rail along the top.
  for (const x of [HALL.x0, HALL.x1]) {
    const z0 = HALL.z0 + 0.8;
    sawali.push(box(x, Y + KNEE_WALL / 2, (z0 + HALL.z1) / 2, 0.05, KNEE_WALL, HALL.z1 - z0));
    bamboo.push(cane(v(x, Y + KNEE_WALL, z0), v(x, Y + KNEE_WALL, HALL.z1), 0.06));
  }
  // The back wall, full height, behind the board.
  sawali.push(box(cx, Y + HALL.eave / 2, HALL.z1, width, HALL.eave, 0.05));
  // The board's frame and ledge.
  wood.push(box(BOARD.x, Y + BOARD.y + BOARD.height / 2, BOARD.z - 0.01, BOARD.width + 0.16, BOARD.height + 0.16, 0.04));
  wood.push(box(BOARD.x, Y + BOARD.y - 0.06, BOARD.z - 0.08, BOARD.width, 0.04, 0.12));
  // The teacher's table: a top on four legs.
  const t = TEACHER_TABLE;
  wood.push(box(t.x, Y + 0.76, t.z, t.width, 0.05, t.depth));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.push(box(t.x + sx * (t.width / 2 - 0.06), Y + 0.37, t.z + sz * (t.depth / 2 - 0.06), 0.06, 0.74, 0.06));
  // Bamboo benches (bangko): a slatted seat on four cane legs and two rails.
  for (const b of BENCHES) {
    deck.push(box(b.x, Y + 0.43, b.z, BENCH_LENGTH, 0.05, 0.38));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) bamboo.push(post(b.x + sx * (BENCH_LENGTH / 2 - 0.12), Y, b.z + sz * 0.14, 0.41, 0.035));
    }
    for (const sz of [-1, 1]) bamboo.push(cane(v(b.x - BENCH_LENGTH / 2 + 0.1, Y + 0.16, b.z + sz * 0.14), v(b.x + BENCH_LENGTH / 2 - 0.1, Y + 0.16, b.z + sz * 0.14), 0.025));
  }
  // The flagpoles in front.
  for (const [x, z] of POLES) bamboo.push(post(x, Y, z, POLE_HEIGHT + 0.2, 0.06));

  // --- the cottages ---
  for (const c of COTTAGES) {
    const half = COTTAGE.size / 2;
    const ground = shoreGround(c.x, c.z);
    const floorY = ground + COTTAGE.floor;
    // Stilts at the corners and down the middle of each side, each from
    // the sand under it (the beach slopes) to the eaves.
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
      [0, -1],
      [0, 1],
    ]) {
      const x = c.x + sx * (half - 0.08);
      const z = c.z + sz * (half - 0.08);
      const foot = shoreGround(x, z) - 0.1;
      bamboo.push(cane(v(x, foot, z), v(x, ground + COTTAGE.eave, z), 0.08));
    }
    deck.push(box(c.x, floorY - 0.04, c.z, COTTAGE.size, 0.08, COTTAGE.size));
    // A rail along the landward side, and a back bench of sawali there.
    bamboo.push(cane(v(c.x - half + 0.08, floorY + 0.55, c.z - half + 0.08), v(c.x - half + 0.08, floorY + 0.55, c.z + half - 0.08), 0.04));
    sawali.push(box(c.x - half + 0.08, floorY + 0.27, c.z, 0.04, 0.5, COTTAGE.size - 0.16));
    thatch.push(hipRoof(c.x, c.z, COTTAGE.size, COTTAGE.size, ground + COTTAGE.eave, COTTAGE.ridge - COTTAGE.eave, COTTAGE.overhang));
  }

  return {
    bamboo: mergeParts(bamboo),
    deck: mergeParts(deck),
    thatch: mergeParts(thatch),
    sawali: mergeParts(sawali),
    wood: mergeParts(wood),
  };
}

/** How much the lamps glow: off by day, full after dusk. */
export function dusk(): number {
  return THREE.MathUtils.clamp(1 - skyState.dayness * 1.8, 0, 1);
}

/** Capiz pendant lamps under the kubo hall's roof, lit from dusk. */
function HallLamps() {
  const m = tulayMaterials();
  const lamps: [number, number, number][] = [
    [HALL_CENTRE[0] - 2.5, Y + HALL.eave - 0.45, HALL_CENTRE[1] - 0.6],
    [HALL_CENTRE[0] + 2.5, Y + HALL.eave - 0.45, HALL_CENTRE[1] - 0.6],
  ];
  const geometry = useMemo(
    () =>
      mergeParts(
        lamps.flatMap(([x, y, z]) => [
          new THREE.CylinderGeometry(0.16, 0.24, 0.34, 10).translate(x, y, z),
          new THREE.ConeGeometry(0.17, 0.12, 10).translate(x, y + 0.23, z),
        ])
      ),
    // The lamps are fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const cords = useMemo(() => mergeParts(lamps.map(([x, y, z]) => cane(v(x, y + 0.28, z), v(x, Y + HALL.eave + 0.05, z), 0.008))), []);
  useEffect(
    () => () => {
      geometry.dispose();
      cords.dispose();
    },
    [geometry, cords]
  );
  const intensity = useRef(0);
  useFrame(() => {
    const level = dusk();
    m.capiz.emissiveIntensity = 0.3 + level * 1.1;
    intensity.current = level * 7;
  });
  return (
    <group>
      <mesh geometry={geometry} material={m.capiz} />
      <mesh geometry={cords} material={m.wood} />
      {lamps.map((p) => (
        <PooledLight key={p[0]} position={[p[0], p[1] - 0.25, p[2]]} intensityRef={intensity} distance={11} color="#ffd6a0" />
      ))}
    </group>
  );
}

export function Kubos() {
  const m = tulayMaterials();
  const parts = useMemo(buildStructures, []);
  useEffect(
    () => () => {
      for (const g of Object.values(parts)) g.dispose();
    },
    [parts]
  );
  return (
    <group>
      <mesh geometry={parts.bamboo} material={m.bamboo} castShadow receiveShadow />
      <mesh geometry={parts.deck} material={m.bambooDeck} castShadow receiveShadow />
      <mesh geometry={parts.thatch} material={m.thatch} castShadow receiveShadow />
      <mesh geometry={parts.sawali} material={m.sawali} castShadow receiveShadow />
      <mesh geometry={parts.wood} material={m.wood} castShadow receiveShadow />
      <mesh position={[BOARD.x, Y + BOARD.y + BOARD.height / 2, BOARD.z - 0.035]} rotation={[0, Math.PI, 0]} material={m.board}>
        <planeGeometry args={[BOARD.width, BOARD.height]} />
      </mesh>
      <HallLamps />
    </group>
  );
}
