import { describe, expect, it } from "vitest";
import { CAMPFIRE, coastX, FIELD, SHORE, TENT } from "../../../src/scene/layout";
import { BENCHES, COTTAGE, COTTAGES, HALL, PALMS, parolSeason, POLES, tulayObstacles, tulaySeats } from "./plan";
import world from "../world/world.json";

const inField = (x: number, z: number, margin = 0) =>
  x > FIELD.minX + margin && x < FIELD.maxX - margin && z > FIELD.minZ + margin && z < FIELD.maxZ - margin;

describe("Tulay's plan", () => {
  it("puts the kubo hall on the meadow, clear of the portals, the campsite, and the walk to the beach", () => {
    expect(inField(HALL.x0 - HALL.overhang, HALL.z0 - HALL.overhang, 0.5)).toBe(true);
    expect(inField(HALL.x1 + HALL.overhang, HALL.z1 + HALL.overhang, 0.5)).toBe(true);
    // The portal row runs north–south through world.json's `portals.at`.
    const portals = world.portals.at;
    const span = ((world.portals.worlds.length - 1) * 2.6) / 2 + 1;
    const overlapsPortals = portals.x + 1 > HALL.x0 - HALL.overhang && Math.abs(portals.z - (HALL.z0 + HALL.z1) / 2) < span + (HALL.z1 - HALL.z0) / 2;
    expect(overlapsPortals).toBe(false);
    expect(HALL.x0 - HALL.overhang).toBeGreaterThan(CAMPFIRE[0] + 3);
    expect(HALL.x0 - HALL.overhang).toBeGreaterThan(TENT.x + TENT.width);
    // The shore walk leaves the meadow at its east edge.
    expect(HALL.x1 + HALL.overhang).toBeLessThan(FIELD.maxX - 2);
  });

  it("puts the cottages on the sand, out of the water", () => {
    for (const c of COTTAGES) {
      const fromCoast = c.x - COTTAGE.size / 2 - coastX(c.z);
      expect(fromCoast).toBeGreaterThan(0);
      expect(c.x + COTTAGE.size / 2 - coastX(c.z)).toBeLessThan(SHORE.toWater - 2);
    }
  });

  it("keeps the palms off the cottages, the hall, and each other", () => {
    for (const p of PALMS) {
      for (const c of COTTAGES) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(COTTAGE.size);
      expect(p.x > HALL.x0 - 1 && p.x < HALL.x1 + 1 && p.z > HALL.z0 - 1 && p.z < HALL.z1 + 1).toBe(false);
    }
    for (let i = 0; i < PALMS.length; i++) {
      for (let j = i + 1; j < PALMS.length; j++) expect(Math.hypot(PALMS[i].x - PALMS[j].x, PALMS[i].z - PALMS[j].z)).toBeGreaterThan(1.2);
    }
  });

  it("gives every seat its own id, and two to each bench and cottage", () => {
    const seats = tulaySeats();
    expect(seats).toHaveLength(BENCHES.length * 2 + COTTAGES.length * 2);
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
    for (const seat of seats) expect(seat.id.startsWith("tulay-")).toBe(true);
  });

  it("leaves room to walk between the benches' rows", () => {
    const rows = [...new Set(BENCHES.map((b) => b.z))].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) expect(rows[i] - rows[i - 1] - 0.4).toBeGreaterThan(1);
  });

  it("gives every pole and post a solid footprint", () => {
    const obstacles = tulayObstacles();
    for (const [x, z] of POLES) expect(obstacles.some((o) => o.x === x && o.z === z)).toBe(true);
    expect(obstacles.length).toBeGreaterThan(PALMS.length + COTTAGES.length);
  });

  it("hangs the parols from September to January, Philippine time", () => {
    expect(parolSeason(new Date("2026-09-01T00:00:00+08:00"))).toBe(true);
    expect(parolSeason(new Date("2026-12-25T12:00:00+08:00"))).toBe(true);
    expect(parolSeason(new Date("2027-01-31T12:00:00+08:00"))).toBe(true);
    expect(parolSeason(new Date("2027-02-01T12:00:00+08:00"))).toBe(false);
    expect(parolSeason(new Date("2027-06-15T12:00:00+08:00"))).toBe(false);
  });
});
