// Coconut palms down the top of the beach: a curved, ringed trunk, a
// crown of drooping fronds that sway with the wind, and a cluster of
// coconuts. Every palm's trunk is one mesh, every frond another, the
// coconuts a third: three draw calls for the lot.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { skyState } from "../../../src/sky/skyState";
import { mergeParts } from "./geometry";
import { tulayMaterials } from "./materials";
import { PALMS, type Palm } from "./plan";

const FRONDS = 10;

function rand(seed: number): number {
  const s = Math.sin(seed * 91.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
}

/** Where a palm's trunk is, at t from the foot (0) to the crown (1): it
 *  rises steeply and leans more toward the top, the way they grow. */
function trunkCurve(p: Palm) {
  const dir = new THREE.Vector3(-Math.sin(p.leanYaw), 0, -Math.cos(p.leanYaw));
  const foot = new THREE.Vector3(p.x, p.y - 0.2, p.z);
  const crown = foot.clone().addScaledVector(dir, p.lean).add(new THREE.Vector3(0, p.height, 0));
  const control = foot.clone().addScaledVector(dir, p.lean * 0.15).add(new THREE.Vector3(0, p.height * 0.6, 0));
  return new THREE.QuadraticBezierCurve3(foot, control, crown);
}

function buildTrunk(p: Palm): THREE.BufferGeometry {
  const curve = trunkCurve(p);
  const segments = 12;
  const g = new THREE.TubeGeometry(curve, segments, 0.16, 7, false);
  // Taper toward the crown, flare a little at the foot, and colour the
  // rings the old fronds leave.
  const position = g.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const ring = 8; // radialSegments + 1
  const centre = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const step = Math.floor(i / ring);
    const t = step / segments;
    curve.getPoint(t, centre);
    vertex.fromBufferAttribute(position, i);
    const scale = 1.25 - 0.5 * t + (t < 0.08 ? (0.08 - t) * 4 : 0);
    vertex.sub(centre).multiplyScalar(scale).add(centre);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    const band = step % 2 === 0 ? 1 : 0.82;
    colors[i * 3] = 0.55 * band;
    colors[i * 3 + 1] = 0.47 * band;
    colors[i * 3 + 2] = 0.36 * band;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * The crown's fronds: each a ribbon along an arch that rises from the
 * crown and droops, folded down its midrib, widest a third of the way
 * out. A `sway` attribute (0 at the crown, 1 at the tip) lets the shader
 * move the tips in the wind.
 */
function buildFronds(p: Palm): THREE.BufferGeometry {
  const crown = trunkCurve(p).getPoint(1);
  const positions: number[] = [];
  const uvs: number[] = [];
  const sways: number[] = [];
  const steps = 8;
  for (let f = 0; f < FRONDS; f++) {
    const angle = (f / FRONDS) * Math.PI * 2 + rand(p.seed * 31 + f) * 0.5;
    const length = 2.6 + rand(p.seed * 17 + f) * 0.9;
    const lift = 0.35 + rand(p.seed * 7 + f) * 0.45;
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new THREE.Vector3(-dir.z, 0, dir.x);
    const point = (t: number) =>
      crown
        .clone()
        .addScaledVector(dir, length * t)
        .add(new THREE.Vector3(0, length * (lift * t - 0.75 * t * t), 0));
    const rows: { l: THREE.Vector3; c: THREE.Vector3; r: THREE.Vector3; t: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = point(t);
      const width = 0.5 * Math.sin(Math.min(1, t * 1.25) * Math.PI) + 0.05;
      // Folded: the leaflets droop from the midrib.
      const drop = width * 0.35;
      rows.push({
        l: c.clone().addScaledVector(across, -width).add(new THREE.Vector3(0, -drop, 0)),
        c,
        r: c.clone().addScaledVector(across, width).add(new THREE.Vector3(0, -drop, 0)),
        t,
      });
    }
    const vert = (p3: THREE.Vector3, u: number, vv: number, t: number) => {
      positions.push(p3.x, p3.y, p3.z);
      uvs.push(u, vv);
      sways.push(t * t);
    };
    for (let i = 0; i < steps; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      // Left half (v 1 → 0.5) and right half (0.5 → 0).
      vert(a.l, a.t, 1, a.t);
      vert(a.c, a.t, 0.5, a.t);
      vert(b.c, b.t, 0.5, b.t);
      vert(a.l, a.t, 1, a.t);
      vert(b.c, b.t, 0.5, b.t);
      vert(b.l, b.t, 1, b.t);
      vert(a.c, a.t, 0.5, a.t);
      vert(a.r, a.t, 0, a.t);
      vert(b.r, b.t, 0, b.t);
      vert(a.c, a.t, 0.5, a.t);
      vert(b.r, b.t, 0, b.t);
      vert(b.c, b.t, 0.5, b.t);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("sway", new THREE.Float32BufferAttribute(sways, 1));
  g.computeVertexNormals();
  return g;
}

function buildCoconuts(p: Palm): THREE.BufferGeometry[] {
  const crown = trunkCurve(p).getPoint(1);
  const count = 3 + Math.floor(rand(p.seed + 5) * 3);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + rand(p.seed * 3 + i);
    return new THREE.IcosahedronGeometry(0.12, 1).translate(crown.x + Math.cos(a) * 0.2, crown.y - 0.22 - rand(i + p.seed) * 0.12, crown.z + Math.sin(a) * 0.2);
  });
}

/** The fronds' material: Tulay's frond, with the tips swaying in the wind
 *  in the vertex shader (no per-frame work on the CPU but two uniforms). */
function swayingFronds(base: THREE.MeshStandardMaterial) {
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0 } };
  const material = base.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float sway;\nuniform float uTime;\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float phase = position.x * 0.31 + position.z * 0.23;
        float gust = 0.06 + uWind * 0.03;
        transformed.x += sin(uTime * 1.4 + phase) * gust * sway;
        transformed.z += cos(uTime * 1.1 + phase * 1.3) * gust * sway;
        transformed.y += sin(uTime * 1.8 + phase) * gust * 0.5 * sway;`
      );
  };
  return { material, uniforms };
}

export function Palms() {
  const m = tulayMaterials();
  const geometry = useMemo(
    () => ({
      trunks: mergeParts(PALMS.map(buildTrunk)),
      fronds: (() => {
        // Not through mergeParts: it would drop the sway attribute.
        const parts = PALMS.map(buildFronds);
        const total = parts.reduce((n, g) => n + g.getAttribute("position").count, 0);
        const merged = new THREE.BufferGeometry();
        for (const [name, size] of [
          ["position", 3],
          ["normal", 3],
          ["uv", 2],
          ["sway", 1],
        ] as const) {
          const array = new Float32Array(total * size);
          let offset = 0;
          for (const g of parts) {
            const attribute = g.getAttribute(name);
            array.set(attribute.array as Float32Array, offset);
            offset += attribute.count * size;
          }
          merged.setAttribute(name, new THREE.BufferAttribute(array, size));
        }
        for (const g of parts) g.dispose();
        merged.computeBoundingSphere();
        return merged;
      })(),
      nuts: mergeParts(PALMS.flatMap(buildCoconuts)),
    }),
    []
  );
  const fronds = useMemo(() => swayingFronds(m.frond), [m]);
  useEffect(
    () => () => {
      geometry.trunks.dispose();
      geometry.fronds.dispose();
      geometry.nuts.dispose();
      fronds.material.dispose();
    },
    [geometry, fronds]
  );
  useFrame((_, delta) => {
    fronds.uniforms.uTime.value += Math.min(delta, 0.1);
    fronds.uniforms.uWind.value = skyState.weatherState?.windSpeed() ?? 0;
  });
  return (
    <group>
      <mesh geometry={geometry.trunks} material={m.trunk} castShadow receiveShadow />
      <mesh geometry={geometry.fronds} material={fronds.material} castShadow />
      <mesh geometry={geometry.nuts} material={m.coconut} castShadow />
    </group>
  );
}
