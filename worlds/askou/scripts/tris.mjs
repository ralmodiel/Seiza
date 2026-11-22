// What the picture is made of: visible meshes and triangles under each named part of the scene, the largest first.
// Usage: node worlds/askou/scripts/tris.mjs ["query"] [rows=14]     Needs the dev server (see lib/village.mjs). Nothing is asked of Askou.
import { launch, enter } from "./lib/village.mjs";
const [query = "skyHour=10", rows = "14"] = process.argv.slice(2);
const browser = await launch();
const { page } = await enter(browser, { query, settle: 4000, alone: true });
const got = await page.evaluate(() => {
  const by = new Map(); let all = 0, meshes = 0;
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  window.__askou.scene.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine) || !shown(o) || !o.geometry) return;
    const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3 * (o.isInstancedMesh ? o.count : 1);
    // the name of the nearest named ancestor two levels under the scene, else the object's own type
    const chain = []; for (let p = o; p && p.parent; p = p.parent) chain.unshift(p.name || p.type);
    const key = chain.slice(0, 3).join(" > ").slice(0, 70);
    const r = by.get(key) ?? { tris: 0, meshes: 0 }; r.tris += n; r.meshes++; by.set(key, r); all += n; meshes++;
  });
  return { all: Math.round(all), meshes, rows: [...by.entries()].sort((a, b) => b[1].tris - a[1].tris).map(([k, v]) => `${Math.round(v.tris)} tris, ${v.meshes} meshes: ${k}`) };
});
console.log(got.rows.slice(0, +rows).join("\n"));
console.log(`tris: ${got.all} triangles in ${got.meshes} visible meshes (before culling)`);
await browser.close();
