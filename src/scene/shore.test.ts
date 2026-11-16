import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { clampToRooms, coastX, FIELD, floorHeightAt, setShore, SHORE, surfaceAt } from "./layout";

describe("walking down to the beach", () => {
  afterEach(() => setShore(false));

  it("stops at the meadow's edge in a world without a beach", () => {
    const p = new THREE.Vector3(FIELD.maxX + 8, 0, 55);
    clampToRooms(p);
    expect(p.x).toBeLessThanOrEqual(FIELD.maxX);
  });

  it("goes on over the grass, down the sand, and into the shallows", () => {
    setShore(true);
    const onSand = new THREE.Vector3(coastX(55) + 4, 0, 55);
    clampToRooms(onSand);
    expect(onSand.x).toBeCloseTo(coastX(55) + 4);
    // Grass at the outer ground's level, then lower down the sand.
    expect(floorHeightAt(FIELD.maxX + 1, 55)).toBeCloseTo(-0.06);
    expect(floorHeightAt(coastX(55) + 6, 55)).toBeLessThan(-0.06);
    expect(surfaceAt(coastX(55) + SHORE.toWater + 1, 55)).toBe("water");
    // But not out to sea.
    const offshore = new THREE.Vector3(coastX(55) + 60, 0, 55);
    clampToRooms(offshore);
    expect(offshore.x).toBeLessThan(coastX(55) + 20);
  });
});
