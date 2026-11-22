import { importNavMesh, init, NavMeshQuery } from "recast-navigation";
import { describe, expect, it } from "vitest";
import { HUB, layoutVillage, MIN_GAP, rings, ROOT, type BotRow } from "./layout";
import roster from "./roster.json";

const bots: BotRow[] = [{ key: ROOT, name: "UPOU", kind: "general", parentKey: null }, ...roster.bots];

const closest = (posts: { x: number; z: number }[]) => {
  let least = Infinity;
  for (let i = 0; i < posts.length; i++) for (let j = 0; j < i; j++) least = Math.min(least, Math.hypot(posts[i].x - posts[j].x, posts[i].z - posts[j].z));
  return least;
};

describe("layoutVillage", () => {
  const posts = layoutVillage(bots);

  it("gives every bot one place, none too close to another", () => {
    expect(posts.map((p) => p.key).sort()).toEqual(bots.map((b) => b.key).sort());
    expect(closest(posts)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it("puts programmes around their faculty and the guides visitors ask most right ahead", () => {
    const at = new Map(posts.map((p) => [p.key, p]));
    expect(at.get("ficsbams")).toMatchObject({ parent: "fics", level: 2 });
    expect(at.get("registrar")).toMatchObject({ parent: "ovcaa", level: 2 });
    expect(at.get("fics")).toMatchObject({ parent: ROOT, level: 1 });
    for (const key of ["admissions", "registration"]) expect(at.get(key)!.x).toBeGreaterThan(HUB.x + 8);
  });

  it("stands every bot on the walkable ground of the campus", async () => {
    // The app's types leave Node out, so the file reader is typed by hand (as in seiou's navmesh test).
    const { readFileSync }: { readFileSync: (path: URL) => Uint8Array } = await import(/* @vite-ignore */ `node:${"fs"}`);
    await init();
    const query = new NavMeshQuery(importNavMesh(new Uint8Array(readFileSync(new URL("../../seiou/world/models/campus.navmesh", import.meta.url)))).navMesh);
    const off = posts.filter((p) => {
      const found = query.findClosestPoint({ x: p.x, y: 0.5, z: p.z }, { halfExtents: { x: 0.4, y: 3, z: 0.4 } });
      return !found.success || !found.polyRef || Math.hypot(found.point.x - p.x, found.point.z - p.z) > 0.1 || found.point.y > 1;
    });
    expect(off.map((p) => p.key)).toEqual([]);
  });

  it("copes with a bot list it has not seen: unknown parents, a loop, a crowd", () => {
    const odd: BotRow[] = [
      { key: "a", name: "A", kind: "office", parentKey: "nobody" },
      { key: "b", name: "B", kind: "office", parentKey: "c" },
      { key: "c", name: "C", kind: "office", parentKey: "b" },
      ...Array.from({ length: 40 }, (_, i) => ({ key: `p${i}`, name: `P${i}`, kind: "programme", parentKey: "a" })),
    ];
    const placed = layoutVillage(odd);
    expect(placed).toHaveLength(odd.length + 1); // the general bot always has a place
    expect(closest(placed)).toBeGreaterThanOrEqual(MIN_GAP);
    expect(rings(40).map(([, n]) => n)).toEqual([16, 24]);
  });
});
