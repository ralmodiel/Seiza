/**
 * The comfort vignette: while the thumbstick moves you, the edges of the
 * view darken, leaving a clear window ahead. Moving through the world while
 * your body stands still is what makes people sick in VR, and most of that
 * comes from motion at the edges of the view; covering it is one of the
 * cheapest and best-known remedies. Walking for real, turning your head,
 * and snap turns don't trigger it.
 *
 * On by default, and switched off from the headset menu (Comfort). The
 * choice is remembered on this device.
 *
 * Cheap: one ring of a few hundred triangles, drawn only while you move.
 * It's a child of the XR camera, so it's placed with the same head pose the
 * frame is rendered from, and never lags behind your head.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import * as THREE from "three";

const STORAGE_KEY = "seiza.comfortVignette";

let enabled = (() => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
})();
const listeners = new Set<() => void>();

export function setComfortVignette(on: boolean) {
  enabled = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private windows and blocked storage: on for this visit only.
  }
  listeners.forEach((listener) => listener());
}

export function useComfortVignette(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled
  );
}

/** How far in front of the eyes the ring sits. Drawn over everything, so
 *  the distance only sets how little the two eyes see it differently. */
const DISTANCE = 1;
/** Radius of the clear window at full strength, at DISTANCE: about 26°
 *  either side of straight ahead. */
const WINDOW = 0.48;
/** How wide the fade from clear to dark is. */
const FEATHER = 0.5;
/** Speed of artificial movement, m/s, that brings it to full strength. */
const FULL_AT = 1.2;
/** Faster than this between two frames is a warp or sitting down, not
 *  walking with the stick. */
const JUMP = 8;

const vertexShader = /* glsl */ `
  varying float vRadius;
  void main() {
    vRadius = length(position.xy);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform float uInner;
  uniform float uStrength;
  varying float vRadius;
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(uInner, uInner + ${FEATHER.toFixed(2)}, vRadius) * uStrength);
  }
`;

export function ComfortVignette() {
  const presenting = useXR((state) => state.session != null);
  const on = useComfortVignette();
  const gl = useThree((state) => state.gl);
  const mesh = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uInner: { value: 1 }, uStrength: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 6, 48, 4), material);
    ring.position.z = -DISTANCE;
    ring.renderOrder = 10000;
    ring.frustumCulled = false;
    ring.visible = false;
    return ring;
  }, []);
  const motion = useMemo(() => ({ last: new THREE.Vector3(), has: false, strength: 0 }), []);

  useEffect(() => {
    if (!presenting || !on) return;
    const camera = gl.xr.getCamera();
    camera.add(mesh);
    motion.has = false;
    return () => {
      camera.remove(mesh);
      mesh.visible = false;
      motion.strength = 0;
    };
  }, [presenting, on, gl, mesh, motion]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh]
  );

  useFrame((_, delta) => {
    if (!presenting || !on) return;
    // The XR origin is what the stick moves (PlayerRig); the headset
    // moving within it is you walking for real.
    const origin = gl.xr.getCamera().parent;
    if (!origin || delta <= 0) return;
    const dx = origin.position.x - motion.last.x;
    const dz = origin.position.z - motion.last.z;
    motion.last.copy(origin.position);
    let speed = motion.has ? Math.hypot(dx, dz) / delta : 0;
    motion.has = true;
    if (speed > JUMP) speed = 0;
    const target = Math.min(1, speed / FULL_AT);
    // In quickly as you start, out gently as you stop.
    motion.strength = THREE.MathUtils.damp(motion.strength, target, target > motion.strength ? 10 : 4, Math.min(delta, 0.1));
    if (motion.strength < 0.01) motion.strength = 0;
    const material = mesh.material as THREE.ShaderMaterial;
    material.uniforms.uStrength.value = motion.strength;
    // The window closes in as it strengthens, from past the edge of view.
    material.uniforms.uInner.value = THREE.MathUtils.lerp(1.6, WINDOW, motion.strength);
    mesh.visible = motion.strength > 0;
  });

  return null;
}
