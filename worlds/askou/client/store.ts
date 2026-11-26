// The village as this visitor sees it: which bots stand where, who they are talking to, and what was said.
// It lives in this page only and is gone on reload. A question leaves the page through api.ts alone (to Askou).
// The HUD (VillageHud), the headset panel (VillageXr) and the scene (Village) read this one store, so they never disagree.
import { useSyncExternalStore } from "react";
import { ask, fetchBots, fetchGreeting, MAX_QUESTION, mentions, SNAPSHOT, type Answer, type Bot } from "./api";
import { figureFor } from "./figures/figures";
import { HUB, layoutVillage, ROOT, type Post } from "./layout";
import { STARTERS, TAGLINES } from "./figures/botText";
import { plainText, type Piece } from "./reply";

export interface Message {
  id: number;
  from: "you" | "bot";
  pieces: Piece[];
  /** What came with Askou's reply (pages, dates, another bot's answer). */
  answer?: Answer;
  /** Other bots the reply names: the village leads the visitor to them, or asks them the same question. */
  refer?: string[];
  /** The question this replies to. */
  question?: string;
  /** No reply could be fetched. */
  failed?: boolean;
}

export interface VillageState {
  bots: Bot[];
  posts: Post[];
  /** Whether Askou answers; null until the first try. */
  live: boolean | null;
  /** Who the visitor is talking to. */
  open: string | null;
  threads: Record<string, Message[]>;
  /** The bot that is finding an answer. */
  busy: string | null;
  directory: boolean;
  /** The bot the lights on the ground lead to. */
  trail: string | null;
  /** The bot the visitor stands next to (the scene sets it). */
  near: string | null;
}

const fresh = (): VillageState => ({ bots: SNAPSHOT, posts: layoutVillage(SNAPSHOT), live: null, open: null, threads: {}, busy: null, directory: false, trail: null, near: null });
let state = fresh();
const listeners = new Set<() => void>();
const sessions = new Map<string, string>();
const MAX_MESSAGES = 40;
const RETRY_MS = 15_000;
let nextId = 1;
/** Counts the visits to the village: what a request started in an earlier one brings back is dropped. */
let visit = 0;
let retry: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<VillageState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const useVillage = () => useSyncExternalStore(subscribe, () => state);
export const village = () => state;

export const botOf = (key: string | null | undefined): Bot | undefined => state.bots.find((b) => b.key === key);
export const postOf = (key: string | null | undefined): Post | undefined => state.posts.find((p) => p.key === key);
/** What a bot is called in the village: the name Askou's admins gave it, else its figure's own. */
export const nickOf = (b: Bot): string => b.nick ?? figureFor(b.key, b.kind, b.parentKey, b.figure, b.held).nick ?? b.name;
/** A bot's short line about itself: the one Askou's admins wrote, else the one Askou's chat page is built with. */
export const taglineOf = (b: Bot): string | null => b.tagline ?? TAGLINES[b.key] ?? null;

// --- what the scene reads every frame (no re-render) ---------------------------------------------------------------

export type Mood = "happy" | "miss" | "dance";
/** Until when (performance.now) each bot is glad, at a loss, or dancing; whether the visitor is typing; how much of each
 *  bot's figure stands (0..1, the scene writes it); and where an answer just landed (the scene throws sparks there). */
export const live = {
  typing: false,
  moods: new Map<string, Record<Mood, number>>(),
  shown: new Map<string, number>(),
  burst: null as { x: number; y: number; z: number } | null,
  /** The bot under the pointer (or the headset's ray). */
  hover: null as string | null,
  /** The visitor's system asks for less motion: the figures do not perform, wave or bounce, and the lights hardly twinkle. */
  calm: false,
  /** Where the village last stood the visitor by a bot (standWith): while they stay there, the picture keeps the two of them in its middle. */
  stood: null as { x: number; z: number; key: string } | null,
  /** The bot a visitor arrived beside (arrive): the welcome note shows there too. */
  arrivedBy: null as string | null,
};
export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export function setMood(key: string, mood: Mood, seconds: number) {
  const m = live.moods.get(key) ?? { happy: 0, miss: 0, dance: 0 };
  m[mood] = performance.now() + seconds * 1000;
  live.moods.set(key, m);
}
export const setTyping = (on: boolean) => void (live.typing = on);

/** How the visitor is moved and where they are: the scene hands these over (WorldSceneProps). */
export interface Travel {
  warp: (position: [number, number, number]) => void;
  faceToward: (x: number, z: number) => void;
  getSelfPosition: () => [number, number, number];
  /** The height of the walkable ground at a spot, or null where there is none (or the map is not loaded yet). */
  groundAt: (x: number, z: number) => number | null;
  /** Whether the visitor sees their own avatar from behind (third person). */
  third: () => boolean;
  /** In a headset: the way the visitor looks, along the ground (unit length); null on a screen. */
  ahead: () => [number, number] | null;
}
let travel: Travel | null = null;
export const setTravel = (t: Travel | null) => void (travel = t);

// --- Askou ------------------------------------------------------------------------------------------------------

/** Fetches the bots Askou has now; while it cannot be reached the village keeps the last ones and tries again. */
export async function connect() {
  clearTimeout(retry);
  const at = visit;
  try {
    const bots = await fetchBots();
    if (at !== visit) return;
    const same = JSON.stringify(bots) === JSON.stringify(state.bots);
    set(same ? { live: true } : { bots, posts: layoutVillage(bots), live: true });
  } catch {
    if (at !== visit) return;
    set({ live: false });
    retry = setTimeout(connect, RETRY_MS);
  }
}

/** Empties the village's state (the world is left, or entered anew). */
export function leaveVillage() {
  visit++;
  clearTimeout(retry);
  sessions.clear();
  live.moods.clear();
  live.shown.clear();
  live.typing = false;
  live.burst = live.hover = null;
  state = fresh();
  for (const l of listeners) l();
}

function say(key: string, messages: Omit<Message, "id">[], first = false) {
  const added = messages.map((m) => ({ ...m, id: nextId++ }));
  const before = state.threads[key] ?? [];
  set({ threads: { ...state.threads, [key]: (first ? [...added, ...before] : [...before, ...added]).slice(-MAX_MESSAGES) } });
}

const lines = (text: string): Piece[] => text.split(/\r?\n/).flatMap((line, i): Piece[] => [...(i ? [{ t: "br" } as const] : []), ...(line ? [{ t: "text", text: line } as const] : [])]);

/** Opens the talk with a bot (null closes it). Its greeting is fetched from Askou the first time. */
export function openBot(key: string | null) {
  const bot = botOf(key);
  if (key && !bot) return;
  set({ open: key, directory: false });
  if (!bot || state.threads[bot.key]) return;
  const at = visit;
  say(bot.key, []);
  fetchGreeting(bot.key)
    .catch(() => null)
    .then((text) => {
      if (at === visit) say(bot.key, [{ from: "bot", pieces: lines(text ?? `Hi! I answer questions about ${bot.key === ROOT ? "UP Open University" : bot.name}.`) }], true);
    });
}

/** The questions a bot offers to be asked first: those it is known to answer; for the general bot, the three that
 *  Askou's own chat page offers. On screen and in a headset alike (in a headset they are the only way to ask). */
const POPULAR = ["How do I apply?", "What courses or programs can I take?", "What are the application requirements?"];
// The bots Askou's own list of starters leaves out: a question each was seen to answer, then the general ones, which every
// bot passes on to UPOU's general answers. (In a headset the offered questions are the only way to ask.)
// shortcut: checked by hand against the running Askou (seven bots); ask Askou for these once its API lists starters.
const MORE: Record<string, string[] | undefined> = {
  cdmo: ["How can I contact the Campus Development and Maintenance Office?"],
  hrdo: ["How can I contact the Human Resources and Development Office?"],
  ictdo: ["How do I contact the ICTDO?"],
  spmo: ["How can I contact the Supply and Property Management Office?"],
  whatsnew: ["What was carried over from the old system?"],
};
export const startersOf = (key: string): string[] => STARTERS[key] ?? (key === ROOT ? POPULAR : botOf(key) ? [...(MORE[key] ?? []), ...POPULAR].slice(0, 3) : []);

/** Asks a bot (the open one unless named) a question, through Askou. `suggested` = a question the village offered, clicked. */
export async function askBot(text: string, key: string | null = state.open, suggested = false) {
  const question = text.trim().slice(0, MAX_QUESTION);
  if (!key || !botOf(key) || !question || state.busy) return;
  const at = visit;
  // asked again after it was lost: the attempt that failed leaves the talk, so the question stands there once
  const talk = state.threads[key] ?? [], lost = (m?: Message) => !!m?.failed && m.question === question;
  if (talk.some(lost)) set({ threads: { ...state.threads, [key]: talk.filter((m, i) => !lost(m) && !(m.from === "you" && lost(talk[i + 1]))) } });
  say(key, [{ from: "you", pieces: [{ t: "text", text: question }] }]);
  set({ busy: key });
  try {
    const answer = await ask(key, sessions.get(key) ?? null, question, suggested);
    if (at !== visit) return;
    if (answer.sessionId) sessions.set(key, answer.sessionId);
    const answered = answer.pieces.length > 0 || answer.consult !== null;
    const words = `${plainText(answer.pieces)} ${answer.consult ? plainText(answer.consult.pieces) : ""}`;
    // The bots the reply links to, then those it names; a bot at a loss sends the visitor to the general bot.
    const refer = [...new Set([...answer.refer, ...mentions(words, state.bots, key), ...(answered || key === ROOT ? [] : [ROOT])])].filter((k) => k !== key && botOf(k)).slice(0, 3);
    say(key, [{ from: "bot", pieces: answer.pieces, answer, refer, question }]);
    setMood(key, answered ? "happy" : "miss", 3.5);
    const post = postOf(key);
    if (answered && post) live.burst = { x: post.x, y: (travel?.groundAt(post.x, post.z) ?? 0.2) + 1.3, z: post.z };
    set({ busy: null, live: true });
  } catch {
    if (at !== visit) return;
    say(key, [{ from: "bot", pieces: [], failed: true, question }]);
    setMood(key, "miss", 3.5);
    set({ busy: null });
    void connect(); // tells whether Askou is gone or only this answer was lost
  }
}

export const setDirectory = (open: boolean) => set({ directory: open });
export const setNear = (key: string | null) => void (state.near !== key && set({ near: key }));
/** Lights on the ground lead to this bot (null puts them out). */
export const showWay = (key: string | null) => set(key && postOf(key) ? { trail: key, directory: false } : { trail: null }); // putting them out leaves the list as it is (they go out on arrival)
export const dance = (key: string) => setMood(key, "dance", 9);

/** How far a place is from the stretch between a and b (on the ground). */
function offLine(p: { x: number; z: number }, a: [number, number], b: [number, number]): number {
  const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.z - a[1]) * vz) / l2)) : 0;
  return Math.hypot(p.x - a[0] - t * vx, p.z - a[1] - t * vz);
}

const BACK = 3; // shortcut: the third-person camera's distance as the visitor's page starts with (PlayerRig), not as they zoomed it; read it from the rig if zoomed views end up inside a bot

/** Where the camera stands when a visitor at `from` looks at `aim`: at their place, or in third person `BACK` behind them. */
export function cameraAt(from: [number, number], aim: [number, number], third: boolean): [number, number] {
  const dx = from[0] - aim[0], dz = from[1] - aim[1], len = Math.hypot(dx, dz);
  return third && len > 1e-3 ? [from[0] + (dx / len) * BACK, from[1] + (dz / len) * BACK] : from;
}

/** Where a visitor stands to talk to a bot: 2.3 m from it, on the walkable side with the most room, nearest to `from`.
 *  `aside` > 0 = third person (see aimAt): the room counts from the visitor back to their camera, so that no other bot
 *  stands in the view. `pull`: how much nearness to `from` counts against room. */
export function standBy(post: Post, from: [number, number], groundAt: Travel["groundAt"], posts: Post[] = state.posts, aside = 0, pull = 0.2): [number, number, number] | null {
  let best: [number, number, number] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6, x = post.x + 2.3 * Math.cos(a), z = post.z + 2.3 * Math.sin(a), y = groundAt(x, z);
    if (y === null) continue;
    const cam = cameraAt([x, z], aimAt(post, [x, z], aside > 0, aside), aside > 0);
    const room = Math.min(...posts.map((p) => (p === post ? Infinity : offLine(p, [x, z], cam))));
    const score = Math.min(room, 2.4) * 3 - Math.hypot(from[0] - x, from[1] - z) * pull;
    if (score > bestScore) (bestScore = score), (best = [x, y, z]);
  }
  return best;
}

/** Where a visitor looks to talk to a bot: at the bot; in third person `aside` m to its left, so that the bot stands beside
 *  the visitor's own avatar (on the side away from the chat panel) and not behind it. */
export function aimAt(post: { x: number; z: number }, from: [number, number], third: boolean, aside = 1.5): [number, number] {
  const dx = post.x - from[0], dz = post.z - from[1], len = Math.hypot(dx, dz);
  return third && len > 1e-3 ? [post.x + (dz / len) * aside, post.z - (dx / len) * aside] : [post.x, post.z];
}

/** How far right of the picture's middle (px) the middle of a pair stands: the bot a visitor talks to and their own avatar,
 *  each as the camera sees it ([metres to the right, metres ahead]); `f` = px a metre takes at 1 m ahead. Never left of the
 *  middle and never over `most`: a bot the visitor has turned away from pulls the picture no further. `half`: half the
 *  bot's width with its name tag, metres. A pair wider than its `room` (px) keeps its right side in view, the bot's: the
 *  visitor's own avatar is what goes under the panel. */
export function pairMid(bot: [number, number], self: [number, number], f: number, most: number, half = 0.75, room = Infinity): number {
  if (bot[1] < 0.5 || self[1] < 0.5) return 0;
  const bx = (bot[0] / bot[1]) * f, bh = (half / bot[1]) * f, ax = (self[0] / self[1]) * f, ah = (0.3 / self[1]) * f;
  const left = Math.min(bx - bh, ax - ah), right = Math.max(bx + bh, ax + ah);
  return Math.max(0, Math.min(most, Math.max((left + right) / 2, right - room / 2)));
}

/** Stands the visitor by a bot (where they are, when within 4 m of it already) and turns them to it. */
export function standWith(post: Post) {
  if (!travel) return;
  const [x, , z] = travel.getSelfPosition(), ahead = travel.ahead();
  if (ahead) {
    // a headset's view is the visitor's own to turn (Seiza turns nobody there): they are put where the bot stands before them
    const dx = post.x - x, dz = post.z - z, far = Math.hypot(dx, dz);
    if (far <= 4 && dx * ahead[0] + dz * ahead[1] > far * 0.8) return; // it does already
    const spot = standBy(post, [post.x - ahead[0] * 2.3, post.z - ahead[1] * 2.3], travel.groundAt, undefined, 0, 3);
    if (spot) travel.warp(spot);
    return;
  }
  const third = travel.third(); // asked before the warp: the camera follows a frame later
  // an upright phone has less room beside the avatar; under 1.15 m the avatar stands in front of the bot
  const aside = third ? Math.min(1.5, Math.max(1.15, (1.6 * window.innerWidth) / window.innerHeight)) : 0;
  const spot = Math.hypot(post.x - x, post.z - z) > 4 ? standBy(post, [x, z], travel.groundAt, undefined, aside) : null;
  if (spot) travel.warp(spot);
  live.stood = { x: spot ? spot[0] : x, z: spot ? spot[2] : z, key: post.key };
  travel.faceToward(...aimAt(post, [live.stood.x, live.stood.z], third, aside));
}

/** The bot a link names: `/b/<key>`, the same link as Askou's own chat page, so a bot's link works in either. */
export function linkedBot(path = typeof location === "undefined" ? "" : location.pathname): string | null {
  const m = /^\/b\/([a-z0-9_-]{1,64})\/?$/i.exec(path);
  return m ? m[1].toLowerCase() : null;
}

/** The question a response's link carries (`/b/<key>?q=…`): visitor text, trimmed, control characters dropped, at most
 *  200 characters; shown as a text node only. */
export function linkedQuestion(search = typeof location === "undefined" ? "" : location.search): string {
  const q = new URLSearchParams(search).get("q") ?? "";
  return q.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 200).trim();
}

/** The link to a bot, with `q` to its answer to that question: the same links as Askou's share buttons, on this site's origin. */
export function shareLink(origin: string, key: string, q?: string): string {
  const question = linkedQuestion(q ? `?${new URLSearchParams({ q })}` : "");
  return `${origin}/b/${key}${question ? `?q=${encodeURIComponent(question)}` : ""}`;
}

/** The system share sheet where there is one, else the clipboard. */
export async function shareUrl(url: string, title: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

/** A visitor who came by a bot's link (linkedBot) arrives beside that bot, talking to it. A visitor who arrives behind
 *  their own avatar (Seiza's view on a touch screen) sees its back where the two mascots stand, their name over its head:
 *  they arrive standing by the pair, as a visit to a bot does. Everyone else arrives as world.json says. */
export function arrive() {
  const linked = postOf(linkedBot());
  if (travel && linked) {
    live.arrivedBy = linked.key;
    visitBot(linked.key, linkedQuestion() || undefined);
    return;
  }
  const post = postOf(ROOT), at = travel?.getSelfPosition();
  if (!travel || !post || !at || travel.ahead() || !travel.third() || Math.hypot(at[0] - HUB.x, at[2] - HUB.z) > 0.3) return;
  live.arrivedBy = post.key;
  standWith(post);
}

/** Takes the visitor to a bot and opens the talk; with `question`, asks it that too (a hand-over from another bot). */
export function visitBot(key: string, question?: string) {
  const post = postOf(key);
  if (!post) return;
  standWith(post);
  if (state.trail === key) set({ trail: null });
  openBot(key);
  if (question) void askBot(question, key);
}
