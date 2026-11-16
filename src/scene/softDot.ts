import * as THREE from "three";

let dot: THREE.Texture | null = null;

/**
 * A tiny soft round sprite for point particles (rain splashes, petals,
 * leaves, snow), so they draw as dots rather than the square a bare point
 * makes. One 16-pixel canvas, shared by all of them and never disposed.
 */
export function softDotTexture(): THREE.Texture {
  if (dot) return dot;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 16, 16);
  dot = new THREE.CanvasTexture(canvas);
  return dot;
}
