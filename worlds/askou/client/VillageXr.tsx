// Talking to a bot in a headset, where there is no keyboard: its last answer on a panel beside it, questions to ask as
// buttons (the ones Askou suggests, else the bot's own starters), the bots it refers to, Dance, and Close.
// Point and pull the trigger (or pinch); in a phone viewer look at a button and tap, or keep looking (Seiza's gaze).
// shortcut: no typed or spoken questions in a headset; add a keyboard panel or speech input when visitors ask for it.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { wrapLines } from "../../../src/ui/wrapLines";
import { registerGazeTarget } from "../../../src/xr/hud/gaze";
import { viewerPosition } from "../../../src/xr/viewer";
import { familyOf, TINT } from "./Constellation";
import { plainText } from "./reply";
import { askBot, botOf, dance, nickOf, taglineOf, openBot, postOf, startersOf, useVillage, visitBot, type Message } from "./store";

const PX = 900;
const W = 1.0; // metres
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const MAX_TEXT = 900;

interface Button { x: number; y: number; w: number; h: number; key: string; label: string; fill: string; onPress: () => void }

/** What the panel says for a bot's message: its words, another bot's answer under them, or why there are none. */
/** What a bot said, in parts the panel can hold, each cut at a word: a long answer is read part by part. */
export function answerParts(m: Message): string[] {
  const own = plainText(m.pieces), other = m.answer?.consult;
  const text = [own, other ? `${other.name} says:\n${plainText(other.pieces)}` : ""].filter(Boolean).join("\n\n") || "I do not have an answer to that yet.";
  const parts: string[] = [];
  for (let rest = text.trim(); rest; rest = rest.slice(parts[parts.length - 1].length).trim()) parts.push(rest.length > MAX_TEXT ? rest.slice(0, MAX_TEXT).replace(/\s+\S*$/, "") : rest);
  return parts;
}

export function panelText(m: Message | undefined, busy: boolean, part = 0): string {
  if (busy) return "Finding an answer…";
  if (!m) return "Hi! Pick a question below.";
  if (m.failed) return "I could not reach Askou just now. Please try again in a moment.";
  const parts = answerParts(m), i = Math.min(part, parts.length - 1);
  return `${i ? "…" : ""}${parts[i]}${i < parts.length - 1 ? "…" : ""}`;
}

export function VillageXr({ botKey, ground }: { botKey: string; ground: Map<string, number> }) {
  const { threads, busy } = useVillage();
  const bot = botOf(botKey), post = postOf(botKey);
  const messages = threads[botKey];
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.Mesh>(null);
  const canvas = useMemo(() => document.createElement("canvas"), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const layout = useRef<{ height: number; buttons: Button[] }>({ height: 300, buttons: [] });
  const [height, setHeight] = useState(0.3);
  const [part, setPart] = useState(0); // which part of a long answer is shown
  useEffect(() => setPart(0), [messages?.length]);

  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !bot) return;
    const last = [...(messages ?? [])].reverse().find((m) => m.from === "bot");
    const tint = TINT[familyOf(bot)], pad = 34, waiting = busy === botKey;
    const asked = (messages ?? []).filter((m) => m.from === "you").map((m) => plainText(m.pieces));
    const questions = (last?.answer?.suggestions.length ? last.answer.suggestions : startersOf(botKey).filter((q) => !asked.includes(q))).slice(0, 3);
    const parts = last && !last.failed && !waiting ? answerParts(last).length : 1;
    const choices: Omit<Button, "x" | "y" | "w" | "h">[] = busy !== null // one question at a time, whichever bot is answering (askBot drops a second one)
      ? []
      : [
          ...questions.map((q) => ({ key: `q:${q}`, label: q, fill: "#2f5f9f", onPress: () => void askBot(q, botKey, true) })),
          ...(last?.failed && last.question ? [{ key: "retry", label: "Try again", fill: "#2f5f9f", onPress: () => void askBot(last.question!, botKey) }] : []),
          ...(last?.refer ?? []).slice(0, 2).flatMap((k) => {
            const other = botOf(k);
            return other ? [{ key: `b:${k}`, label: `Ask ${nickOf(other)}${last?.question ? " the same" : ""}`, fill: "#2f8f6f", onPress: () => visitBot(k, last?.question) }] : [];
          }),
          { key: "dance", label: "Let's Dance!", fill: "#8a4fb0", onPress: () => dance(botKey) },
        ];
    if (parts > 1) choices.unshift({ key: "more", label: part < parts - 1 ? `Read on (part ${part + 2} of ${parts})` : "Back to the start of the answer", fill: "#9a6a1c", onPress: () => setPart((part + 1) % parts) });
    choices.push({ key: "close", label: "Close", fill: "#3a4256", onPress: () => openBot(null) });

    const draw = (dry: boolean) => {
      let y = pad;
      const buttons: Button[] = [];
      if (!dry) {
        ctx.fillStyle = "rgba(20,18,26,0.95)";
        ctx.beginPath();
        ctx.roundRect(0, 0, canvas.width, canvas.height, 28);
        ctx.fill();
        ctx.strokeStyle = tint;
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 38px ${FONT}`;
      if (!dry) {
        ctx.fillStyle = tint;
        ctx.fillText(wrapLines(ctx, nickOf(bot), PX - pad * 2)[0] ?? "", pad, y + 34);
      }
      y += 48;
      if (nickOf(bot) !== bot.name) {
        ctx.font = `400 26px ${FONT}`;
        if (!dry) {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fillText(wrapLines(ctx, bot.name, PX - pad * 2)[0] ?? "", pad, y + 24);
        }
        y += 38;
      }
      const motto = taglineOf(bot);
      if (motto) {
        ctx.font = `italic 400 25px ${FONT}`;
        for (const line of wrapLines(ctx, motto, PX - pad * 2).slice(0, 2)) {
          if (!dry) {
            ctx.fillStyle = "rgba(255,255,255,0.86)";
            ctx.fillText(line, pad, y + 24);
          }
          y += 32;
        }
        y += 4;
      }
      y += 10;
      ctx.font = `400 31px ${FONT}`;
      for (const paragraph of panelText(last, waiting, part).split("\n")) {
        for (const line of wrapLines(ctx, paragraph, PX - pad * 2)) {
          if (!dry && line) {
            ctx.fillStyle = "rgba(255,255,255,0.94)";
            ctx.fillText(line, pad, y + 29);
          }
          y += paragraph ? 41 : 20;
        }
      }
      y += 16;
      ctx.font = `600 28px ${FONT}`;
      for (const c of choices) {
        const lines = wrapLines(ctx, c.label, PX - pad * 2 - 44).slice(0, 2);
        const b: Button = { x: pad, y, w: PX - pad * 2, h: lines.length > 1 ? 96 : 66, ...c };
        buttons.push(b);
        if (!dry) {
          ctx.fillStyle = c.fill;
          ctx.beginPath();
          ctx.roundRect(b.x, b.y, b.w, b.h, 18);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textBaseline = "middle";
          lines.forEach((line, i) => ctx.fillText(line, b.x + 22, b.y + b.h / 2 + (i - (lines.length - 1) / 2) * 34));
          ctx.textBaseline = "alphabetic";
        }
        y += b.h + 12;
      }
      return { height: y + pad - 12, buttons };
    };
    canvas.width = PX;
    canvas.height = 2400;
    const measured = draw(true);
    canvas.height = measured.height;
    layout.current = draw(false);
    texture.dispose(); // the GPU keeps a texture at the size of its first picture and refuses one of another height: each picture gets a new one
    texture.needsUpdate = true;
    setHeight((W * measured.height) / PX);
  }, [messages, busy, bot, botKey, canvas, texture, part]);

  // Beside the bot, a step toward the viewer, its middle at eye height, turned to face them.
  const eye = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m || !post) return;
    viewerPosition(camera, eye);
    const dx = eye.x - post.x, dz = eye.z - post.z, far = Math.hypot(dx, dz) || 1, tx = dx / far, tz = dz / far;
    const out = Math.min(0.9, far * 0.4);
    m.position.set(post.x + tx * out + tz * 1.15, (ground.get(botKey) ?? 0.2) + Math.max(1.25, height / 2 + 0.25), post.z + tz * out - tx * 1.15);
    m.lookAt(eye.x, m.position.y, eye.z);
  });

  const at = (uv: THREE.Vector2) => {
    const x = uv.x * PX, y = (1 - uv.y) * layout.current.height;
    return layout.current.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ?? null;
  };
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    return registerGazeTarget(m, { keyAt: (uv) => at(uv)?.key ?? null, select: (uv) => at(uv)?.onPress() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pressed = useRef<string | null>(null);
  const hit = (e: ThreeEvent<PointerEvent>) => (e.uv ? at(e.uv) : null);

  if (!bot || !post) return null;
  return (
    <mesh
      ref={mesh}
      scale={[W, height, 1]}
      renderOrder={20}
      onPointerDown={(e) => {
        e.stopPropagation();
        pressed.current = hit(e)?.key ?? null;
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const start = pressed.current, end = hit(e);
        pressed.current = null;
        if (start && end?.key === start) end.onPress();
      }}
      onClick={(e) => e.stopPropagation()}
      name="askou-xr-panel"
      userData={{ navIgnore: true, layout }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}
