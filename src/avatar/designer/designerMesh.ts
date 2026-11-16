import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Influences } from "./designerBody";

/**
 * How a designer avatar becomes a few meshes, and how it gets its outlines.
 *
 * Parts are generated one at a time (a swept limb, a shoe, a lock of hair,
 * a button), but drawing them that way cost about fifty draw calls an
 * avatar, which a full room of them on a standalone headset can't afford.
 * So every part is baked into the avatar's rest pose and skinned: a swept
 * part with its own blended weights, a rigid part (a button, a hand's
 * thumb) weighted wholly to its bone. Then all the parts of one colour are
 * merged into one skinned mesh. A rigid part still moves exactly with its
 * bone, and the first-person view, which hides your head by shrinking the
 * head bone, still hides everything on it.
 *
 * Each merged mesh also gets an outline: the same mesh drawn inside out,
 * pushed out a few millimetres along its normals, in a dark shade of its
 * own colour. It's the line VRoid and anime-styled avatars have, and what
 * keeps a dark suit from reading as one shape. One more draw call a colour.
 */

/** Outline thickness, in metres before the avatar's height scale. */
export const OUTLINE_WIDTH = 0.0032;

/** A part's geometry ready to merge: positions in the rest pose, normals,
 *  and skin weights; no UVs (nothing merged is textured). */
export function prepareForMerge(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(flat.attributes)) {
    if (name !== "position" && name !== "normal" && name !== "skinIndex" && name !== "skinWeight") flat.deleteAttribute(name);
  }
  if (!flat.getAttribute("normal")) flat.computeVertexNormals();
  if (flat !== geometry) geometry.dispose();
  return flat;
}

/** A rigid part: `geometry` placed by `matrix` (rest pose, metres) and
 *  weighted wholly to bone `bone`. */
export function rigidPart(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, bone: number): THREE.BufferGeometry {
  geometry.applyMatrix4(matrix);
  const flat = prepareForMerge(geometry);
  const count = flat.getAttribute("position").count;
  const index = new Uint16Array(count * 4);
  const weight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    index[i * 4] = bone;
    weight[i * 4] = 1;
  }
  flat.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(index, 4));
  flat.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weight, 4));
  return flat;
}

/**
 * A flat piece laid on the front of the torso (a lapel, a shirt front, a
 * pocket): a convex outline in (x, y), given a little thickness and set
 * `lift` in front of the surface `front(y)`, so it follows the chest as
 * it curves back toward the neck. Skinned like the torso under it, so it
 * bends with it.
 */
export function torsoPanel(
  outline: Array<[number, number]>,
  front: (y: number) => number,
  lift: number,
  thickness: number,
  weights: (y: number) => Influences,
  h: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const vertex = (x: number, y: number, outward: number) => {
    positions.push(x * h, y * h, (front(y) + lift + outward) * h);
    const sorted = [...weights(y)].sort((a, b) => b[1] - a[1]).slice(0, 4);
    for (let k = 0; k < 4; k++) {
      skinIndex.push(sorted[k]?.[0] ?? 0);
      skinWeight.push(sorted[k]?.[1] ?? 0);
    }
  };
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    vertex(...a);
    vertex(...b);
    vertex(...c);
  };
  // Wound counterclockwise seen from the front, whatever order it came in.
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % outline.length];
    area += x1 * y2 - x2 * y1;
  }
  const points = area < 0 ? [...outline].reverse() : outline;
  for (let i = 1; i < points.length - 1; i++) {
    tri([...points[0], thickness], [...points[i], thickness], [...points[i + 1], thickness]);
    tri([...points[0], 0], [...points[i + 1], 0], [...points[i], 0]);
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    tri([...a, 0], [...b, 0], [...b, thickness]);
    tri([...a, 0], [...b, thickness], [...a, thickness]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.computeVertexNormals();
  return geometry;
}

/** The outline's colour for a surface colour: the same hue, much darker. */
export function outlineColor(base: THREE.Color): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.1), Math.min(0.2, hsl.l * 0.32));
}

const outlineMaterials = new Map<string, THREE.MeshBasicMaterial>();

/** The inside-out, pushed-out material an outline is drawn with. */
export function outlineMaterial(base: THREE.Color, width: number): THREE.MeshBasicMaterial {
  const color = outlineColor(base);
  const key = `${color.getHexString()}:${width.toFixed(5)}`;
  let material = outlineMaterials.get(key);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: true });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n  transformed += normalize( normal ) * ${width.toFixed(5)};`
      );
    };
    material.customProgramCacheKey = () => `seiza-outline-${width.toFixed(5)}`;
    outlineMaterials.set(key, material);
  }
  return material;
}

/** Merges parts that share a material into one geometry. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts.map(prepareForMerge), false);
  if (!merged) throw new Error("Designer avatar: parts could not be merged");
  for (const part of parts) part.dispose();
  return merged;
}
