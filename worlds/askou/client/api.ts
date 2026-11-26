// The village's line to Askou, the UPOU chatbot service whose bots stand here. Nothing is answered in this world:
// a visitor's question goes to Askou's public chat endpoint and Askou's own reply comes back.
// Sent: the question, the bot asked, and the session id Askou gave for this visit's talk with that bot.
// Not sent: `X-Chat-Log` (Askou keeps a conversation log only of requests that carry it), a name, the visitor's room id.
import { ROOT, type BotRow } from "./layout";
import { botsIn, parseReply, plainText, safeHref, type Piece } from "./reply";
import snapshot from "./roster.json";

export interface Bot extends BotRow {
  /** The bot's own short name ("Iska & iskOU"), when Askou's admins gave it one. */
  nick: string | null;
  tagline: string | null;
  /** The figure and the thing it holds, as chosen in Askou (null = the one drawn from its key). */
  figure: string | null;
  held: string | null;
}

export interface Answer {
  sessionId: string | null;
  /** Askou's reply; empty when it has no answer of its own. */
  pieces: Piece[];
  /** "Did you mean": prepared questions close to an unanswered one. */
  suggestions: string[];
  /** The first answer's follow-up questions ("Another joke!" under an animal bot's joke): plain text, at most 3. */
  followUps: string[];
  /** What the UPOU pages say, and pages its search found. */
  pages: { title: string; url: string; text: string }[];
  /** Academic calendar dates, when the answer is about dates. */
  dates: string[];
  /** Another bot's own answer to the same question, under a referral to it. */
  consult: { key: string; name: string; pieces: Piece[] } | null;
  /** The other bots the reply points to. */
  refer: string[];
}

/** Where Askou answers. In development Vite forwards /askou to ASKOU_URL (vite.config.ts).
 *  shortcut: a deployed world has no such forwarder; set VITE_ASKOU_API to an Askou that allows this origin (CORS), or add a Worker route. */
const BASE = ((import.meta.env?.VITE_ASKOU_API as string | undefined) || "/askou").replace(/\/+$/, "");
/** As long as Askou's own question box allows. */
export const MAX_QUESTION = 2000;
const MAX_BOTS = 240;
const KEY = /^[a-z][a-z0-9-]{1,29}$/;

const record = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const key = (v: unknown): string | null => (typeof v === "string" && KEY.test(v) && !(v in {}) ? v : null); // not "constructor": the talks are kept by key in a plain object

/** Askou's bot list (GET /api/bot/characters) and its general bot (GET /api/bot) as this world's bots, the general bot
 *  first. Whatever is not a bot with a key and a name is left out: the list comes over the network. */
export function toBots(characters: unknown, general?: unknown): Bot[] {
  const g = record(general);
  const personas = list(g.personaNames).flatMap((n) => str(n, 30) ?? []).slice(0, 2);
  const root: Bot = { key: ROOT, name: str(g.name, 80) ?? "UPOU", kind: "general", parentKey: null, nick: personas.join(" & ") || str(g.nick, 40), tagline: str(g.tagline, 160), figure: null, held: null };
  const seen = new Set([ROOT]);
  const bots = list(characters).flatMap((raw): Bot[] => {
    const c = record(raw), k = key(c.key), name = str(c.name, 80);
    if (!k || !name || seen.has(k)) return [];
    seen.add(k);
    return [{ key: k, name, kind: str(c.kind, 20) ?? "office", parentKey: key(c.parentKey), nick: str(c.nick, 40), tagline: str(c.tagline, 160), figure: str(c.figure, 40), held: str(c.held, 40) }];
  });
  return [root, ...bots.slice(0, MAX_BOTS)];
}

/** The bots as they were when this world was last built: what stands in the village while Askou cannot be reached. */
export const SNAPSHOT: Bot[] = toBots(snapshot.bots, snapshot.general);

const day = (iso: unknown) => {
  const d = typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" }) : null;
};

/** One reply of POST /api/chat as what the world shows. Every text is read as text and every link checked (reply.ts). */
export function toAnswer(raw: unknown): Answer {
  const r = record(raw);
  const pieces = parseReply(str(r.replyHtml, 40_000) ?? "");
  const page = (v: unknown, textOf: string) => {
    const p = record(v), url = safeHref(str(p.url, 500) ?? ""), title = str(p.title, 140);
    return url && /^https?:/i.test(url) && title ? [{ title, url, text: plainText(parseReply(str(p[textOf], 400) ?? "")).slice(0, 240) }] : [];
  };
  const c = record(r.consult), consultKey = key(c.botKey), consultPieces = parseReply(str(c.replyHtml, 40_000) ?? "");
  const consult = consultKey && consultPieces.length ? { key: consultKey, name: str(c.nick, 40) ?? str(c.name, 80) ?? consultKey, pieces: consultPieces } : null;
  return {
    sessionId: str(r.sessionId, 100),
    pieces,
    suggestions: list(r.suggestions).flatMap((s) => str(record(s).text, 200) ?? []).slice(0, 3),
    followUps: list(record(list(r.answers)[0]).followUps).flatMap((q) => str(q, 200) ?? []).slice(0, 3),
    pages: [...list(r.excerpts).flatMap((e) => page(e, "text")), ...list(r.searchResults).flatMap((s) => page(s, "digest"))].slice(0, 4),
    dates: list(r.calendar).flatMap((e) => {
      const entry = record(e), title = str(entry.title, 120), from = day(entry.startDate), to = day(entry.endDate);
      return title && from ? [`${title}: ${from}${to && to !== from ? ` – ${to}` : ""}`] : [];
    }).slice(0, 5),
    consult,
    refer: [...new Set([...botsIn(pieces), ...(consult ? [consult.key] : [])])],
  };
}

/** The other bots a reply names in its words ("… the Faculty of Education …"): the village offers the way to them.
 *  The longest names first, so a programme is found before the faculty its name contains. */
export function mentions(text: string, bots: Bot[], except: string): string[] {
  let rest = text.toLowerCase();
  const found: string[] = [];
  for (const b of [...bots].sort((a, z) => z.name.length - a.name.length)) {
    const name = b.name.toLowerCase();
    if (b.key === except || b.key === ROOT || name.length < 8 || !rest.includes(name)) continue;
    found.push(b.key);
    rest = rest.split(name).join(" ");
  }
  return found;
}

async function json(path: string, init: RequestInit, seconds: number): Promise<unknown> {
  // no cookie goes with a call and none is taken from an answer, whoever serves or forwards `BASE`
  const response = await fetch(`${BASE}${path}`, { ...init, credentials: "omit", signal: AbortSignal.timeout(seconds * 1000) });
  if (!response.ok) throw new Error(`Askou answered ${response.status} for ${path}`);
  return response.json();
}

/** The bots Askou has now. Throws when it cannot be reached or sends none. */
export async function fetchBots(): Promise<Bot[]> {
  const [characters, general] = await Promise.all([json("/api/bot/characters", {}, 10), json("/api/bot", {}, 10)]);
  const bots = toBots(characters, general);
  if (bots.length < 2) throw new Error("Askou sent no bots");
  return bots;
}

/** A bot's greeting, as plain text (Askou writes it with line breaks), or null. */
export async function fetchGreeting(bot: string): Promise<string | null> {
  return str(record(await json(`/api/bot?bot=${encodeURIComponent(bot)}`, {}, 10)).webGreeting, 1200);
}

/** Asks one bot one question. `sessionId` = the one its last answer in this talk carried, or null.
 *  `suggested` = the visitor clicked a question the village offered: Askou counts such a click per bot, text and day
 *  (nothing about the visitor) so its admins see which offered questions are used, as its own chat page does. */
export async function ask(bot: string, sessionId: string | null, text: string, suggested = false): Promise<Answer> {
  return toAnswer(
    await json("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", "X-Bot": bot }, body: JSON.stringify({ sessionId, sentences: [{ text: text.slice(0, MAX_QUESTION) }], ...(suggested && { source: "suggested" }) }) }, 30)
  );
}
