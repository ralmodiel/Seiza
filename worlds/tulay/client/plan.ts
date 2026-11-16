// Where Tulay's own places are, on Seiza's grounds (src/scene/layout.ts):
// the meadow (FIELD: x −24 to 24, z 38 to 72, its floor at FIELD_Y) and
// the beach past its east side (coastX: the sand starts about x 34).
//
//      z 72 ┌──────────────────────────────────────┐ ~~~~~~~~~~~~~~
//           │                    ┌────────────┐    │  palms  sea
//           │ tent  fire  portals│ kubo hall  │    │  cottage
//      z 58 │                    └────────────┘    │  palms
//           │                       banderitas     │  cottage
//      z 38 └────────── garden steps ──────────────┘  palms
//          x −24          x 2   x 9          x 19 x 24   x 34 (sand)
//
// Everything here is plain numbers and functions, so the tests can check
// that nothing is built on top of anything else.
import {
  coastX,
  FIELD,
  FIELD_Y,
  makeObstacle,
  SEAT_HEIGHT,
  SHORE,
  shoreY,
  type Obstacle,
  type Seat,
} from "../../../src/scene/layout";

export const Y = FIELD_Y;

/** The ground on the shore, as the beach shapes it (layout.ts's
 *  floorHeightAt, on the beach's side): computed here rather than asked,
 *  so the plan doesn't depend on the beach having mounted first. */
export function shoreGround(x: number, z: number): number {
  return Math.max(shoreY(Math.max(0, x - coastX(z))), SHORE.seaY - 0.15);
}

// --- the kubo hall --------------------------------------------------------------

/**
 * A big bahay kubo for classes: open on its south side and half-walled
 * east and west with sawali, a blackboard on the north wall, a nipa roof,
 * and bamboo benches facing the board. On the ground (no stilts), so it
 * walks like the meadow round it.
 */
export const HALL = { x0: 9, x1: 19, z0: 59, z1: 67, eave: 2.7, ridge: 5.6, overhang: 1.1 };
export const HALL_CENTRE: [number, number] = [(HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2];
/** The knee walls' height, on the east and west sides. */
export const KNEE_WALL = 0.95;
/** The posts, round the edge: corners, and between them on the long sides. */
export const HALL_POSTS: [number, number][] = [
  [HALL.x0, HALL.z0],
  [(HALL.x0 + HALL.x1) / 2 - 2.5, HALL.z0],
  [(HALL.x0 + HALL.x1) / 2 + 2.5, HALL.z0],
  [HALL.x1, HALL.z0],
  [HALL.x0, HALL.z1],
  [HALL.x1, HALL.z1],
  [HALL.x0, (HALL.z0 + HALL.z1) / 2],
  [HALL.x1, (HALL.z0 + HALL.z1) / 2],
];
export const BOARD = { x: HALL_CENTRE[0], z: HALL.z1 - 0.12, width: 4.2, height: 1.3, y: 1.0 };
export const TEACHER_TABLE = { x: HALL_CENTRE[0] - 3, z: HALL.z1 - 1.2, width: 1.4, depth: 0.7 };

export const BENCH_LENGTH = 2.2;
/** Bamboo benches (bangko) in rows facing the board, two to a row. */
export const BENCHES: { x: number; z: number }[] = [60.6, 62.3, 64.0].flatMap((z) => [
  { x: HALL_CENTRE[0] - 2.2, z },
  { x: HALL_CENTRE[0] + 2.2, z },
]);
/** Facing the board, north (+z): avatars face −z at yaw 0. */
export const BENCH_YAW = Math.PI;

// --- the beach cottages --------------------------------------------------------

/**
 * Cottages on the sand, as at any beach in the Philippines: a bamboo floor
 * on stilts, open on every side, under a nipa roof. You sit on the front
 * edge, facing the sea.
 */
export const COTTAGE = { size: 2.6, floor: 0.62, eave: 2.35, ridge: 3.8, overhang: 0.55 };
export const COTTAGES: { x: number; z: number }[] = [48.5, 63.5].map((z) => ({ x: coastX(z) + 3.2, z }));

// --- the palms ------------------------------------------------------------------

export interface Palm {
  x: number;
  z: number;
  /** Ground under the trunk. */
  y: number;
  height: number;
  /** Which way the trunk leans (radians about Y) and how far its top is
   *  from its foot, horizontally. */
  leanYaw: number;
  lean: number;
  seed: number;
}

/** A small, fixed pseudo-random sequence, so every visitor sees the same palms. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Coconut palms down the top of the sand, leaning seaward, with a gap at
 *  each cottage and a few back on the grass at the meadow's corner. */
export const PALMS: Palm[] = (() => {
  const palms: Palm[] = [];
  for (let i = 0; i < 13; i++) {
    const z = FIELD.minZ + 2.5 + i * 2.55 + (rand(i) - 0.5) * 1.2;
    const x = coastX(z) + 0.6 + rand(i + 40) * 2.2;
    if (COTTAGES.some((c) => Math.hypot(c.x - x, c.z - z) < 3.6)) continue;
    palms.push({ x, z, y: shoreGround(x, z), height: 6.2 + rand(i + 80) * 2.6, leanYaw: -Math.PI / 2 + (rand(i + 9) - 0.5) * 0.9, lean: 0.8 + rand(i + 3) * 1.6, seed: i });
  }
  // On the grass between the meadow and the sand.
  for (const [x, z, k] of [
    [FIELD.maxX + 4.5, FIELD.minZ + 4, 20],
    [FIELD.maxX + 6.5, FIELD.maxZ - 3, 21],
    [FIELD.maxX + 3.2, (FIELD.minZ + FIELD.maxZ) / 2 + 9, 22],
  ]) {
    palms.push({ x, z, y: shoreGround(x, z), height: 7 + rand(k) * 2, leanYaw: -Math.PI / 2 + (rand(k + 1) - 0.5), lean: 0.6 + rand(k + 2), seed: k });
  }
  return palms;
})();

// --- banderitas -----------------------------------------------------------------

/** Two bamboo poles in front of the hall, for the lines of flags. */
export const POLES: [number, number][] = [
  [HALL.x0 - 0.6, HALL.z0 - 3.4],
  [HALL.x1 + 0.6, HALL.z0 - 3.4],
];
export const POLE_HEIGHT = 3.6;

/** Lines of flags: from, to, and how far the middle sags. In the garden
 *  (Seiza's hall wall to its lampposts, and across) and in front of the
 *  kubo hall (pole to pole, and each pole to the eave above it). */
export const BUNTING: { from: [number, number, number]; to: [number, number, number]; sag: number }[] = [
  // The garden: lampposts at (±8.3, 20.6), the hall's wall top at z 16.
  { from: [-11.4, 3.9, 16.3], to: [-8.3, 2.95, 20.6], sag: 0.35 },
  { from: [11.4, 3.9, 16.3], to: [8.3, 2.95, 20.6], sag: 0.35 },
  { from: [-8.3, 2.95, 20.6], to: [8.3, 2.95, 20.6], sag: 0.7 },
  // The kubo hall.
  { from: [POLES[0][0], Y + POLE_HEIGHT, POLES[0][1]], to: [POLES[1][0], Y + POLE_HEIGHT, POLES[1][1]], sag: 0.8 },
  { from: [POLES[0][0], Y + POLE_HEIGHT, POLES[0][1]], to: [HALL.x0, Y + HALL.eave - 0.1, HALL.z0 - 0.4], sag: 0.3 },
  { from: [POLES[1][0], Y + POLE_HEIGHT, POLES[1][1]], to: [HALL.x1, Y + HALL.eave - 0.1, HALL.z0 - 0.4], sag: 0.3 },
];

/** Points along a sagging line, `count` + 1 of them. */
export function sagLine(from: [number, number, number], to: [number, number, number], sag: number, count: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t - sag * 4 * t * (1 - t),
      from[2] + (to[2] - from[2]) * t,
    ]);
  }
  return points;
}

// --- the parol ------------------------------------------------------------------

/** Parols, the Christmas star lanterns: over the garden door of Seiza's
 *  hall, and on the kubo hall's front. */
export const PAROLS: [number, number, number][] = [
  [0, 3.45, 16.3],
  // In front of the eaves, high enough to clear everyone's head.
  [HALL_CENTRE[0], Y + 3.5, HALL.z0 - HALL.overhang - 0.35],
];

/** The Philippines starts Christmas in September (the "ber" months) and
 *  keeps it to January; parols are up all that time. */
export function parolSeason(date: Date): boolean {
  const month = new Date(date.getTime() + 8 * 3600_000).getUTCMonth();
  return month >= 8 || month === 0;
}

// --- seats and collision ----------------------------------------------------------

const SEAT_FORWARD = 0.12;

/** Every seat Tulay adds: two to each bench, two on each cottage's edge. */
export function tulaySeats(): Seat[] {
  const seats: Seat[] = [];
  BENCHES.forEach((bench, i) => {
    for (const side of [-1, 1]) {
      seats.push({
        id: `tulay-bench-${i}-${side > 0 ? "r" : "l"}`,
        // Facing +z: forward is +z, and along the bench is x.
        position: [bench.x + side * BENCH_LENGTH * 0.25, Y, bench.z + SEAT_FORWARD],
        rotationY: BENCH_YAW,
        label: "Bench",
      });
    }
  });
  COTTAGES.forEach((cottage, i) => {
    const edge = cottage.x + COTTAGE.size / 2 - 0.22;
    for (const side of [-1, 1]) {
      const z = cottage.z + side * 0.6;
      const ground = shoreGround(edge, z);
      seats.push({
        id: `tulay-cottage-${i}-${side > 0 ? "r" : "l"}`,
        // Sitting on the floor's edge, facing the sea (+x).
        position: [edge, ground + COTTAGE.floor - SEAT_HEIGHT, z],
        rotationY: -Math.PI / 2,
        label: "Cottage",
        exit: [cottage.x + COTTAGE.size / 2 + 0.7, z],
      });
    }
  });
  return seats;
}

/** Everything solid that Tulay adds. */
export function tulayObstacles(): Obstacle[] {
  const halfX = (HALL.x1 - HALL.x0) / 2;
  const halfZ = (HALL.z1 - HALL.z0) / 2;
  return [
    ...HALL_POSTS.map(([x, z]) => makeObstacle(x, z, 0.16, 0.16)),
    // The knee walls east and west (open south, the board's wall north).
    makeObstacle(HALL.x0, HALL_CENTRE[1] + 0.4, 0.08, halfZ - 0.4),
    makeObstacle(HALL.x1, HALL_CENTRE[1] + 0.4, 0.08, halfZ - 0.4),
    makeObstacle(HALL_CENTRE[0], HALL.z1, halfX, 0.1),
    ...BENCHES.map((b) => makeObstacle(b.x, b.z, BENCH_LENGTH / 2, 0.2)),
    makeObstacle(TEACHER_TABLE.x, TEACHER_TABLE.z, TEACHER_TABLE.width / 2, TEACHER_TABLE.depth / 2),
    ...POLES.map(([x, z]) => makeObstacle(x, z, 0.1, 0.1)),
    ...COTTAGES.map((c) => makeObstacle(c.x, c.z, COTTAGE.size / 2, COTTAGE.size / 2)),
    ...PALMS.map((p) => makeObstacle(p.x, p.z, 0.22, 0.22)),
  ];
}
