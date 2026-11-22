// What the bot beside the visitor says of itself: its short line in a speech bubble by its head, there while the
// visitor stands by it (in a headset too, where there is no dock to read it in). One bubble, repainted for each bot.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { wrapLines } from "../../../src/ui/wrapLines";
import { familyOf, TINT } from "./Constellation";
import { botOf, postOf, reducedMotion, taglineOf } from "./store";

const PX = 512, PY = 256; // the canvas
const WIDE = 1.4, HIGH = (WIDE * PY) / PX; // how large it stands in the world (metres)
const UP = 2.3; // the bubble's middle above the ground: beside the name tag, over the arms and what they hold
const ASIDE = 0.66; // from the bot's middle to the tip of the tail, to the viewer's right (the HUD keeps to the left)
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const noRaycast = () => {};
const CENTER = new THREE.Vector2(-ASIDE / WIDE, 0.5); // the sprite hangs to the right of its place, by the tail's tip

/** Paints the bubble of a bot, its tail at the left edge of the canvas; false when the bot has no line. */
function paint(ctx: CanvasRenderingContext2D, key: string): boolean {
  const bot = botOf(key), line = bot && taglineOf(bot);
  ctx.clearRect(0, 0, PX, PY);
  if (!bot || !line) return false;
  ctx.font = `italic 500 31px ${FONT}`;
  const all = wrapLines(ctx, line, 400), lines = all.slice(0, 5);
  if (all.length > 5) lines[4] = lines[4].replace(/\s*\S*$/, "…"); // an admin's line may be longer than a bubble
  const tail = 26, r = 20;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44, h = lines.length * 40 + 26;
  const x = tail + 4, x1 = x + w, y = (PY - h) / 2, y1 = y + h, ty = y1 - r - 18; // the tail leaves the foot of the left side, down to the bot's face
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x1, y, x1, y1, r);
  ctx.arcTo(x1, y1, x, y1, r);
  ctx.arcTo(x, y1, x, y, r);
  ctx.lineTo(x, ty + 16);
  ctx.lineTo(x - tail, ty + 34);
  ctx.lineTo(x, ty);
  ctx.arcTo(x, y, x1, y, r);
  ctx.closePath();
  ctx.fillStyle = "rgba(18,15,28,0.86)"; // as the name tags
  ctx.fill();
  ctx.strokeStyle = TINT[familyOf(bot)];
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 13 + 20 + i * 40));
  return true;
}

/** `botKey`: the bot to speak for; null for none (nobody near, or a talk is open and its panel says the line). */
export function Motto({ botKey, ground }: { botKey: string | null; ground: Map<string, number> }) {
  const sprite = useRef<THREE.Sprite>(null);
  const { ctx, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = PX;
    canvas.height = PY;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { ctx: canvas.getContext("2d")!, texture };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const still = useMemo(reducedMotion, []);
  const now = useRef<{ key: string | null; has: boolean }>({ key: null, has: false }); // whose line is painted
  // a small screen reads the line in the dock (VillageHud's .av-motto: keep the two rules alike), where a bubble is cut off at the edge
  const roomy = useMemo(() => window.matchMedia("(min-width: 701px) and (min-height: 501px)"), []);

  useFrame(({ gl }, dt) => {
    const s = sprite.current;
    if (!s) return;
    const m = s.material, c = now.current;
    // the next bot's line is painted once the last one has faded out
    if (c.key !== botKey && m.opacity < 0.02) {
      c.key = botKey;
      c.has = !!botKey && paint(ctx, botKey);
      texture.needsUpdate = true;
    }
    const to = c.key === botKey && c.has && (roomy.matches || gl.xr.isPresenting) ? 1 : 0; // a headset has no dock
    m.opacity = still ? to : m.opacity + (to - m.opacity) * (1 - Math.exp(-dt * 10));
    s.visible = m.opacity > 0.01;
    const post = s.visible ? postOf(c.key) : undefined;
    if (post) s.position.set(post.x, (ground.get(post.key) ?? 0.2) + UP - (1 - m.opacity) * 0.1, post.z); // it rises into place
    s.userData.key = s.visible ? c.key : null; // for the probes
  });

  return (
    <sprite ref={sprite} name="askou-motto" visible={false} center={CENTER} scale={[WIDE, HIGH, 1]} raycast={noRaycast} renderOrder={5}>
      <spriteMaterial map={texture} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
