// A fiesta's dressing: banderitas (lines of little paper flags) with
// string lights along them that come on at dusk, and parols, the star
// lanterns of a Filipino Christmas, from September to January.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeParts } from "./geometry";
import { dusk } from "./Kubo";
import { tulayMaterials } from "./materials";
import { BUNTING, parolSeason, PAROLS, sagLine } from "./plan";

const FLAG_COLORS = ["#d7263d", "#f4c430", "#1e5aa8", "#2a9d5c", "#e75a9c", "#f7f3e8"].map((c) => new THREE.Color(c));
const FLAG_SPACING = 0.34;
const FLAG_DROP = 0.27;

function buildBunting() {
  const positions: number[] = [];
  const colors: number[] = [];
  const bulbs: THREE.BufferGeometry[] = [];
  const cords: number[] = [];
  let n = 0;
  for (const line of BUNTING) {
    const length = Math.hypot(line.to[0] - line.from[0], line.to[1] - line.from[1], line.to[2] - line.from[2]);
    const count = Math.max(2, Math.round(length / FLAG_SPACING));
    const points = sagLine(line.from, line.to, line.sag, count);
    for (let i = 0; i < count; i++) {
      const [ax, ay, az] = points[i];
      const [bx, by, bz] = points[i + 1];
      cords.push(ax, ay, az, bx, by, bz);
      // A triangle hanging from the cord, a little narrower than the gap.
      const inset = 0.12;
      const lx = ax + (bx - ax) * inset;
      const ly = ay + (by - ay) * inset;
      const lz = az + (bz - az) * inset;
      const rx = bx - (bx - ax) * inset;
      const ry = by - (by - ay) * inset;
      const rz = bz - (bz - az) * inset;
      positions.push(lx, ly, lz, rx, ry, rz, (lx + rx) / 2, (ly + ry) / 2 - FLAG_DROP, (lz + rz) / 2);
      const color = FLAG_COLORS[n++ % FLAG_COLORS.length];
      for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
      if (i % 2 === 0) bulbs.push(new THREE.IcosahedronGeometry(0.035, 0).translate(ax, ay - 0.03, az));
    }
  }
  const flags = new THREE.BufferGeometry();
  flags.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  flags.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  flags.computeVertexNormals();
  const cord = new THREE.BufferGeometry();
  cord.setAttribute("position", new THREE.Float32BufferAttribute(cords, 3));
  return { flags, cord, bulbs: mergeParts(bulbs) };
}

/** A five-pointed star with a ring round it and two tails: the classic
 *  bamboo-and-paper parol, about 0.9 m across. */
function buildParol() {
  const star = (outer: number, inner: number) => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outer : inner;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    return shape;
  };
  const body = new THREE.ExtrudeGeometry(star(0.42, 0.19), { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04);
  const trim = mergeParts([
    new THREE.ShapeGeometry(star(0.24, 0.11)).translate(0, 0, 0.045),
    new THREE.ShapeGeometry(star(0.24, 0.11)).rotateY(Math.PI).translate(0, 0, -0.045),
    new THREE.TorusGeometry(0.47, 0.018, 6, 40),
    // The tails, hanging from the lower points.
    new THREE.PlaneGeometry(0.06, 0.75).translate(-0.17, -0.62, 0),
    new THREE.PlaneGeometry(0.06, 0.75).translate(0.17, -0.62, 0),
  ]);
  return { body, trim };
}

export function Fiesta() {
  const m = tulayMaterials();
  const bunting = useMemo(buildBunting, []);
  const parol = useMemo(buildParol, []);
  const cordMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: "#3a3226" }), []);
  const showParols = useMemo(() => parolSeason(new Date()), []);
  useEffect(
    () => () => {
      bunting.flags.dispose();
      bunting.cord.dispose();
      bunting.bulbs.dispose();
      parol.body.dispose();
      parol.trim.dispose();
      cordMaterial.dispose();
    },
    [bunting, parol, cordMaterial]
  );
  useFrame(({ clock }) => {
    const level = dusk();
    // A slow, uneven twinkle, the way a string of old bulbs does.
    m.bulbs.emissiveIntensity = 0.15 + level * (1.6 + 0.15 * Math.sin(clock.elapsedTime * 2.3));
    m.parol.emissiveIntensity = 0.25 + level * 1.3;
    m.parolTrim.emissiveIntensity = 0.2 + level * 0.9;
  });
  return (
    <group>
      <mesh geometry={bunting.flags} material={m.flags} />
      <lineSegments geometry={bunting.cord} material={cordMaterial} />
      <mesh geometry={bunting.bulbs} material={m.bulbs} />
      {showParols &&
        PAROLS.map((p) => (
          <group key={`${p[0]}-${p[2]}`} position={p}>
            <mesh geometry={parol.body} material={m.parol} />
            <mesh geometry={parol.trim} material={m.parolTrim} />
          </group>
        ))}
    </group>
  );
}
