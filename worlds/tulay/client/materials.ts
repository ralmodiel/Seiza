// Tulay's own materials, drawn with a 2D canvas at startup like Seiza's
// (src/scene/materials.ts): nipa thatch, sawali (woven bamboo), bamboo,
// a coconut frond, and the chalkboard's greeting. One shared set.
import * as THREE from "three";

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  return texture;
}

/** Fixed pseudo-random numbers, so the textures are the same every time. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Nipa thatch: overlapping rows of dried palm, each row's lower edge
 *  ragged and shadowed by the row over it. U runs along the eave, V up
 *  the slope; one tile is about 1.5 m along and 0.6 m up. */
function thatch() {
  return canvasTexture(256, 256, (ctx) => {
    const r = seeded(7);
    ctx.fillStyle = "#9c7a45";
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8;
    const row = 256 / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * row;
      // Strands down each row.
      for (let s = 0; s < 140; s++) {
        const x = r() * 256;
        const shade = 120 + Math.floor(r() * 70);
        ctx.strokeStyle = `rgba(${shade + 40},${shade + 10},${shade - 40},0.55)`;
        ctx.lineWidth = 1 + r() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 3, y + row * (0.8 + r() * 0.35));
        ctx.stroke();
      }
      // The shadow under the row above, along a ragged edge.
      ctx.fillStyle = "rgba(40,26,10,0.45)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + 3 + r() * 5);
      ctx.lineTo(256, y);
      ctx.closePath();
      ctx.fill();
    }
  });
}

/** Sawali: flattened bamboo strips woven in a twill, in bundles of four.
 *  One tile is about 0.8 m square. */
function sawali() {
  return canvasTexture(256, 256, (ctx) => {
    const r = seeded(11);
    ctx.fillStyle = "#c9a96a";
    ctx.fillRect(0, 0, 256, 256);
    const cell = 32;
    for (let y = 0; y < 256; y += cell) {
      for (let x = 0; x < 256; x += cell) {
        const across = (x / cell + y / cell) % 2 === 0;
        for (let k = 0; k < 4; k++) {
          const light = 196 + Math.floor(r() * 30);
          ctx.fillStyle = `rgb(${light},${light - 30},${light - 92})`;
          if (across) ctx.fillRect(x, y + k * 8 + 1, cell, 6);
          else ctx.fillRect(x + k * 8 + 1, y, 6, cell);
        }
        ctx.fillStyle = "rgba(60,40,15,0.25)";
        ctx.fillRect(x, y, cell, 1);
        ctx.fillRect(x, y, 1, cell);
      }
    }
  });
}

/** Bamboo: pale green-gold with darker nodes; V runs along the cane, one
 *  node every 0.4 m when the UVs are scaled to the cane's length. */
function bamboo() {
  return canvasTexture(64, 128, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 64, 0);
    gradient.addColorStop(0, "#a88a45");
    gradient.addColorStop(0.5, "#d2b672");
    gradient.addColorStop(1, "#a88a45");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = "rgba(90,66,25,0.7)";
    ctx.fillRect(0, 0, 64, 5);
    ctx.fillStyle = "rgba(255,240,200,0.25)";
    ctx.fillRect(0, 5, 64, 3);
  });
}

/** A coconut frond seen from above: a midrib down the middle, and leaflets
 *  angled toward the tip on either side. Transparent between leaflets. U
 *  runs from the crown (0) to the tip (1). */
function frond() {
  return canvasTexture(256, 64, (ctx) => {
    ctx.clearRect(0, 0, 256, 64);
    for (let i = 0; i < 46; i++) {
      const x = 6 + i * 5.4;
      const reach = 30 * Math.sin(Math.min(1, (x / 256) * 1.15) * Math.PI) + 3;
      const green = 90 + ((i * 37) % 40);
      ctx.strokeStyle = `rgb(${46 + (i % 3) * 8},${green + 30},${38})`;
      ctx.lineWidth = 3.2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, 32);
        ctx.quadraticCurveTo(x + reach * 0.35, 32 + side * reach * 0.5, x + reach * 0.75, 32 + side * reach);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#8c8a3c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(256, 32);
    ctx.stroke();
  });
}

/** The kubo hall's chalkboard, with a greeting chalked on it. */
function chalkboard() {
  return canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = "#2f4a3b";
    ctx.fillRect(0, 0, 512, 160);
    // Old chalk, wiped.
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.fillRect((i * 97) % 480, (i * 53) % 140, 90, 14);
    }
    ctx.fillStyle = "rgba(245,245,235,0.92)";
    ctx.textAlign = "center";
    ctx.font = "italic 46px Georgia, serif";
    ctx.fillText("Magandang araw!", 256, 72);
    ctx.font = "26px Georgia, serif";
    ctx.fillStyle = "rgba(245,235,200,0.85)";
    ctx.fillText("Maligayang pagdating sa Tulay", 256, 118);
  });
}

export interface TulayMaterials {
  thatch: THREE.MeshStandardMaterial;
  sawali: THREE.MeshStandardMaterial;
  bamboo: THREE.MeshStandardMaterial;
  bambooDeck: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  frond: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  coconut: THREE.MeshStandardMaterial;
  board: THREE.MeshStandardMaterial;
  flags: THREE.MeshLambertMaterial;
  bulbs: THREE.MeshStandardMaterial;
  capiz: THREE.MeshStandardMaterial;
  parol: THREE.MeshStandardMaterial;
  parolTrim: THREE.MeshStandardMaterial;
}

let cached: TulayMaterials | null = null;

export function tulayMaterials(): TulayMaterials {
  if (cached) return cached;
  const deck = bamboo();
  if (deck) deck.repeat.set(18, 1);
  cached = {
    // Both sides: the roof is seen from under its eaves too.
    thatch: new THREE.MeshStandardMaterial({ color: "#ffffff", map: thatch(), roughness: 0.95, side: THREE.DoubleSide }),
    sawali: new THREE.MeshStandardMaterial({ color: "#ffffff", map: sawali(), roughness: 0.85, side: THREE.DoubleSide }),
    bamboo: new THREE.MeshStandardMaterial({ color: "#ffffff", map: bamboo(), roughness: 0.6 }),
    bambooDeck: new THREE.MeshStandardMaterial({ color: "#e8d8b0", map: deck, roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: "#7a5230", roughness: 0.7 }),
    frond: new THREE.MeshStandardMaterial({ color: "#ffffff", map: frond(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }),
    trunk: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.9 }),
    coconut: new THREE.MeshStandardMaterial({ color: "#5d6b2a", roughness: 0.6 }),
    board: new THREE.MeshStandardMaterial({ color: "#ffffff", map: chalkboard(), roughness: 0.9 }),
    flags: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    bulbs: new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: new THREE.Color("#ffc874"), emissiveIntensity: 0.2 }),
    capiz: new THREE.MeshStandardMaterial({ color: "#fff8ef", emissive: new THREE.Color("#ffd9a6"), emissiveIntensity: 0.3, roughness: 0.3 }),
    parol: new THREE.MeshStandardMaterial({ color: "#ffd24a", emissive: new THREE.Color("#ffb52e"), emissiveIntensity: 0.25, roughness: 0.5, side: THREE.DoubleSide }),
    parolTrim: new THREE.MeshStandardMaterial({ color: "#c8202f", emissive: new THREE.Color("#d8283a"), emissiveIntensity: 0.2, roughness: 0.5, side: THREE.DoubleSide }),
  };
  return cached;
}
