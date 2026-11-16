// Small geometry builders for Tulay's structures. Everything of one
// material is merged into one mesh (see mergeParts), so the kubo hall, the
// cottages, and the poles are a handful of draw calls between them.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Merges parts that may differ in index and extra attributes: keeps
 *  position, normal, and uv (and color, when every part has one). */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) return new THREE.BufferGeometry();
  const withColor = parts.every((g) => g.getAttribute("color"));
  const cleaned = parts.map((part) => {
    const g = part.index ? part.toNonIndexed() : part.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv" && !(withColor && name === "color")) g.deleteAttribute(name);
    }
    if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(cleaned) ?? new THREE.BufferGeometry();
  for (const g of cleaned) g.dispose();
  for (const g of parts) g.dispose();
  return merged;
}

/** A box from its centre and size. */
export function box(x: number, y: number, z: number, w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

/** A bamboo cane between two points, its texture's nodes every `node`
 *  metres along it. */
export function cane(from: THREE.Vector3, to: THREE.Vector3, radius: number, node = 0.4): THREE.BufferGeometry {
  const length = from.distanceTo(to);
  const g = new THREE.CylinderGeometry(radius, radius, length, 8, 1, true);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (length / node));
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** An upright cane from the ground to `height`. */
export function post(x: number, y: number, z: number, height: number, radius = 0.1): THREE.BufferGeometry {
  return cane(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + height, z), radius);
}

/**
 * A hip roof over a rectangle (centre cx, cz; width along x, depth along
 * z), its eaves at `eaveY` and its ridge `rise` above them, with an
 * overhang. Square, it comes to a point, the way a cottage's does. UVs
 * for the thatch: U along the eave, V up the slope, a tile every 1.5 m
 * along and 0.6 m up.
 */
export function hipRoof(cx: number, cz: number, width: number, depth: number, eaveY: number, rise: number, overhang: number): THREE.BufferGeometry {
  const W = width + overhang * 2;
  const D = depth + overhang * 2;
  const halfW = W / 2;
  const halfD = D / 2;
  // The ridge runs along the longer side.
  const alongX = W >= D;
  const ridgeHalf = Math.abs(W - D) / 2;
  const r0: [number, number] = alongX ? [-ridgeHalf, 0] : [0, -ridgeHalf];
  const r1: [number, number] = alongX ? [ridgeHalf, 0] : [0, ridgeHalf];
  const corners: [number, number][] = [
    [-halfW, halfD],
    [halfW, halfD],
    [halfW, -halfD],
    [-halfW, -halfD],
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const TILE_U = 1.5;
  const TILE_V = 0.6;
  // One face per side: the eave's two corners and the ridge's end(s) over it.
  const faces: { a: [number, number]; b: [number, number]; top: [number, number][]; run: number }[] = [
    { a: corners[0], b: corners[1], top: alongX ? [r1, r0] : [r1], run: halfD }, // +z
    { a: corners[1], b: corners[2], top: alongX ? [r1] : [r0, r1], run: halfW }, // +x
    { a: corners[2], b: corners[3], top: alongX ? [r0, r1] : [r0], run: halfD }, // −z
    { a: corners[3], b: corners[0], top: alongX ? [r0] : [r1, r0], run: halfW }, // −x
  ];
  for (const face of faces) {
    const slope = Math.hypot(face.run, rise);
    const edge = new THREE.Vector2(face.b[0] - face.a[0], face.b[1] - face.a[1]);
    edge.normalize();
    const u = (p: [number, number]) => ((p[0] - face.a[0]) * edge.x + (p[1] - face.a[1]) * edge.y) / TILE_U;
    const push = (p: [number, number], up: boolean) => {
      positions.push(cx + p[0], eaveY + (up ? rise : 0), cz + p[1]);
      uvs.push(u(p), up ? slope / TILE_V : 0);
    };
    if (face.top.length === 2) {
      // A trapezoid: eave a→b, ridge end over b, ridge end over a.
      push(face.a, false);
      push(face.b, false);
      push(face.top[0], true);
      push(face.a, false);
      push(face.top[0], true);
      push(face.top[1], true);
    } else {
      push(face.a, false);
      push(face.b, false);
      push(face.top[0], true);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
