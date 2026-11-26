// The village on a screen: who is here (a directory to search), the talk with one bot, and the way to the others.
// Shown through Seiza's world overlay. Every reply is drawn from the pieces reply.ts made of it, as React nodes:
// Askou's HTML itself is never put into the page.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { panelStyle, pillButtonStyle } from "../../../src/ui/styles";
import { MAX_QUESTION, type Bot } from "./api";
import { familyOf, TINT } from "./Constellation";
import type { Post } from "./layout";
import type { Piece } from "./reply";
import { askBot, botOf, connect, dance, live as scene, nickOf, openBot, setDirectory, setTyping, shareLink, shareUrl, showWay, startersOf, taglineOf, useVillage, visitBot, type Message } from "./store";

const CSS = `
.av { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; }
.av-dock { position: fixed; top: 64px; left: 16px; z-index: 30; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; pointer-events: none; max-width: calc(100vw - 32px); }
.av-dock > * { pointer-events: auto; }
.av-panel { position: fixed; top: 64px; left: 16px; width: min(400px, calc(100vw - 32px)); max-height: min(640px, calc(100dvh - 176px)); display: flex; flex-direction: column; z-index: 30; pointer-events: auto; font-size: 14px; line-height: 1.45; }
.av-btn { transition: background .12s, transform .12s; }
.av-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.av-btn:active:not(:disabled) { transform: scale(0.97); }
.av-btn:disabled { opacity: .45; cursor: default; }
/* !important: these buttons carry the host's pill style inline, whose grey background would win over the gold */
.av-main { background: linear-gradient(135deg, #ffd98a, #f0a83c) !important; border: 1px solid rgba(255,220,150,.7) !important; color: #23180a; font-weight: 700; box-shadow: 0 4px 18px rgba(240,168,60,.35); }
.av-main:hover:not(:disabled) { background: linear-gradient(135deg, #ffe3a6, #f5b656) !important; }
.av :focus-visible { outline: 2px solid #ffd98a; outline-offset: 2px; }
.av-small { font-size: 12px; padding: 5px 11px; white-space: normal; text-align: left; line-height: 1.3; }
.av-list { flex: 1; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.4) transparent; }
.av-list[data-more] { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 40px), transparent); }
.av-clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.av-note-short { display: none; }
.av-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; min-height: 44px; }
.av-row:hover { background: rgba(255,255,255,.09); }
.av-dot { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #1c1420; letter-spacing: .02em; }
.av-input { flex: 1; min-width: 0; border-radius: 999px; border: 1px solid rgba(255,255,255,.22); background: rgba(0,0,0,.28); color: inherit; padding: 9px 14px; font: inherit; font-size: 16px; }
.av-input::placeholder { color: rgba(255,255,255,.5); }
.av-link { color: #9fd0ff; text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
.av-bubble { padding: 8px 11px; border-radius: 14px; overflow-wrap: anywhere; }
.av-dots span { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 50%; background: currentColor; animation: av-dot 1.1s infinite ease-in-out; }
.av-dots span:nth-child(2) { animation-delay: .15s; } .av-dots span:nth-child(3) { animation-delay: .3s; }
/* said to a screen reader, not shown */
.av-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@keyframes av-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
@keyframes av-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.av-panel, .av-dock > * { animation: av-in .18s ease-out; }
@media (max-width: 560px) {
  .av-dock { top: 56px; left: 8px; max-width: calc(100vw - 16px); }
  .av-panel { top: 56px; left: 8px; right: 8px; width: auto; max-height: min(58dvh, calc(100dvh - 150px)); }
}
/* the head's two buttons: one over the other where the dance button shows its words (they are as wide as the two were side by side
   with one word), so the bot's own lines keep their width; side by side on a narrow or a short screen */
.av-acts { display: flex; flex: none; align-items: center; gap: 9px; }
@media (min-width: 481px) and (min-height: 501px) { .av-acts { flex-direction: column; align-items: stretch; gap: 5px; } .av-acts > button { justify-content: center; } }
/* a narrow phone: the dance button is its note alone (its label stays for screen readers), so the bot's own lines have the width */
@media (max-width: 480px) { .av-word { display: none; } }
/* a small phone: one line of notice, so an answer has room */
@media (max-width: 480px) and (max-height: 700px) { .av-note-long { display: none; } .av-note-short { display: inline; } }
/* the smallest phones (320x568): a slim head too, as on a short screen; the bot's line is said in the dock on the way up */
@media (max-width: 480px) and (max-height: 600px) { .av-head { padding-top: 5px !important; padding-bottom: 5px !important; } .av-hint { display: none; } .av-clamp { -webkit-line-clamp: 1; } }
/* a phone: above the host's "is close" chip, which sits over this corner there */
@media (max-width: 640px) { .av-dock, .av-panel { z-index: 37; } }
/* a short screen (a phone on its side): one line of notice and a slim head, so an answer has room */
@media (max-height: 500px) {
  /* a phone on its side: the talk takes the height (over the walking pad, which is back when it closes) and stops short of Seiza's menu button, 21px right of the middle */
  .av-panel { top: 56px; left: 8px; right: auto; width: min(480px, calc(50vw + 5px)); max-height: calc(100dvh - 64px); }
  .av-head { padding-top: 5px !important; padding-bottom: 5px !important; }
  .av-note-long, .av-hint { display: none; } .av-note-short { display: inline; }
  .av-clamp { -webkit-line-clamp: 1; }
}
/* a wide screen shows the line of the bot nearby in a speech bubble in the world (Motto.tsx): there the dock's copy is for screen readers only */
@media (min-width: 701px) and (min-height: 501px) { .av-motto { position: absolute; width: 1px; height: 1px; padding: 0 !important; border: 0 !important; overflow: hidden; clip-path: inset(50%); white-space: nowrap; } }
@media (pointer: coarse) { .av-small, .av-dock button, .av-input { min-height: 44px; box-sizing: border-box; } }
@media (prefers-reduced-motion: reduce) { .av-panel, .av-dock > *, .av-dots span { animation: none; } .av-btn { transition: none; } }
`;

// the host's pill does not wrap; a question or a bot's name on a button must, or it runs out of the panel
const small = { ...pillButtonStyle, whiteSpace: "normal" } as const;
/** Fades the end of a list that has more below, so a cut answer does not read as its end. */
const markMore = (el: HTMLElement | null) => void el?.toggleAttribute("data-more", el.scrollHeight - el.scrollTop - el.clientHeight > 12);
/** As Askou's own chat page says of itself, and the notice it links to. */
const POC = "A proof of concept, not an official UPOU site.";
const PRIVACY = "https://www.upou.edu.ph/up-data-privacy-notice-for-students/";
const tintOf = (b: Bot) => TINT[familyOf(b)];
const short = (b: Bot) => nickOf(b).split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Dot({ bot, size = 30 }: { bot: Bot; size?: number }) {
  return (
    <span className="av-dot" aria-hidden style={{ background: tintOf(bot), width: size, height: size, fontSize: size * 0.37 }}>
      {short(bot)}
    </span>
  );
}

export function VillageHud() {
  const { bots, posts, open, threads, busy, directory, trail, near, live } = useVillage();
  const bot = botOf(open), nearBot = botOf(near), trailBot = botOf(trail);
  const [tip, setTip] = useState(true);
  // the welcome note steps aside by a bot (its button and its line are there), but not by the pair a visitor arrived beside
  const welcome = tip && !trailBot && (!nearBot || nearBot.key === scene.arrivedBy);
  useEffect(() => {
    if (open) setTip(false);
  }, [open]);
  // A panel that closes takes the keyboard's place with it: hand it to the button that is back, not to the page's top.
  const find = useRef<HTMLButtonElement>(null), panel = !!bot || directory, hadPanel = useRef(false);
  useEffect(() => {
    if (hadPanel.current && !panel && document.activeElement === document.body) find.current?.focus({ preventScroll: true });
    hadPanel.current = panel;
  }, [panel]);
  // Escape closes whatever is open, wherever the keyboard is
  useEffect(() => {
    if (!open && !directory) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (directory) setDirectory(false);
      else openBot(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, directory]);

  return (
    <div className="av">
      <style>{CSS}</style>
      {!bot && !directory && (
        <div className="av-dock">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button ref={find} type="button" className="av-btn" style={{ ...pillButtonStyle, fontWeight: 600 }} onClick={() => setDirectory(true)} aria-label={`Find a bot: all ${bots.length} bots of Askou Village`}>
              <span aria-hidden>🧭</span> Find a bot <span style={{ opacity: 0.6 }}>{bots.length}</span>
            </button>
            {nearBot && (
              <button type="button" className="av-btn av-main" style={{ ...pillButtonStyle, color: "#23180a" }} onClick={() => openBot(nearBot.key)}>
                <span aria-hidden>💬</span> Talk to {nickOf(nearBot)}
              </button>
            )}
          </div>
          {nearBot && taglineOf(nearBot) && !welcome && (
            <div className="av-motto" role="status" style={{ ...panelStyle, padding: "6px 11px", fontSize: 13, lineHeight: 1.35, maxWidth: 330, pointerEvents: "none" }}>
              <strong style={{ color: tintOf(nearBot) }}>{nickOf(nearBot)}</strong> <i>{taglineOf(nearBot)}</i>
            </div>
          )}
          {trailBot && (
            <div style={{ ...panelStyle, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} role="status">
              <Dot bot={trailBot} size={24} />
              <span>
                Follow the lights to <strong>{nickOf(trailBot)}</strong>
              </span>
              <button type="button" className="av-btn av-small" style={small} onClick={() => visitBot(trailBot.key)}>
                Take me there
              </button>
              <button type="button" className="av-btn av-small" style={small} onClick={(e) => { showWay(null); if (e.detail === 0) find.current?.focus({ preventScroll: true }); }}>
                Stop
              </button>
            </div>
          )}
          {live === false && <Offline />}
          {welcome && (
            <div style={{ ...panelStyle, padding: "8px 12px", maxWidth: 330, fontSize: 13, lineHeight: 1.4, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span>
                <strong>Welcome to Askou Village.</strong> Every light is a UPOU bot. Walk up to one, or click it, and ask your question. <span style={{ opacity: 0.75 }}>{POC}</span>
              </span>
              <button type="button" className="av-btn av-small" style={{ ...small, flex: "none" }} onClick={(e) => { setTip(false); if (e.detail === 0) find.current?.focus({ preventScroll: true }); }} aria-label="Hide this tip">
                Got it
              </button>
            </div>
          )}
        </div>
      )}
      {directory && <Directory bots={bots} posts={posts} near={near} />}
      {bot && !directory && <Chat key={bot.key} bot={bot} messages={threads[bot.key] ?? []} busy={busy === bot.key} waiting={busy !== null} near={near === bot.key} live={live} />}
    </div>
  );
}

function Offline() {
  const [trying, setTrying] = useState(false);
  return (
    <div style={{ ...panelStyle, padding: "8px 12px", maxWidth: 330, fontSize: 13, lineHeight: 1.4, borderColor: "rgba(255,170,120,.5)" }} role="status">
      Askou cannot be reached right now, so the bots cannot answer. They will try again on their own.{" "}
      <button
        type="button"
        className="av-btn av-small"
        style={{ ...small, marginTop: 6 }}
        disabled={trying}
        onClick={() => {
          setTrying(true);
          void connect().finally(() => setTrying(false));
        }}
      >
        {trying ? "Trying…" : "Try now"}
      </button>
    </div>
  );
}

/** The bots in the order they stand: the general bot and those around the arrival spot, then each cluster under its head. */
export function groupsOf(bots: Bot[], posts: Post[]): { title: string; bots: Bot[] }[] {
  const bot = new Map(bots.map((b) => [b.key, b]));
  const heads = new Set(posts.map((p) => p.parent));
  const rows = (keep: (p: Post) => boolean) => posts.filter(keep).flatMap((p) => bot.get(p.key) ?? []);
  return [
    { title: "Start here", bots: rows((p) => p.level === 0 || (p.level === 1 && !heads.has(p.key))) },
    ...posts.filter((p) => p.level === 1 && heads.has(p.key)).map((head) => ({ title: bot.get(head.key)?.name ?? head.key, bots: rows((p) => p.key === head.key || p.parent === head.key) })),
  ].filter((g) => g.bots.length);
}

function Directory({ bots, posts, near }: { bots: Bot[]; posts: Post[]; near: string | null }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // a touch screen's keyboard would cover the world: there the dialog itself takes the keyboard's place (a screen reader then reads it)
    (window.matchMedia("(pointer: fine)").matches ? input : dialog).current?.focus({ preventScroll: true });
  }, []);
  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (b: Bot) => {
      const hay = `${nickOf(b)} ${b.name} ${b.key} ${taglineOf(b) ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    };
    return groupsOf(bots, posts).map((g) => ({ ...g, bots: g.bots.filter(match) })).filter((g) => g.bots.length);
  }, [bots, posts, query]);
  const found = groups.reduce((n, g) => n + g.bots.length, 0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => markMore(list.current), [found]);
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-label="The bots of Askou Village" className="av-panel" style={{ ...panelStyle, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 8px" }}>
        <strong style={{ flex: 1, fontSize: 15 }}>Find a bot</strong>
        <button type="button" className="av-btn av-small" style={small} onClick={() => setDirectory(false)} aria-label="Close the list of bots">
          Close
        </button>
      </div>
      <div style={{ padding: "0 12px 8px" }}>
        <input ref={input} className="av-input" style={{ width: "100%", boxSizing: "border-box" }} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: admission, registrar, nursing…" aria-label="Search the bots" maxLength={60} />
        <div className={query ? undefined : "av-hint"} style={{ fontSize: 12, opacity: 0.7, marginTop: 5 }} aria-live="polite">
          {query ? `${found} of ${bots.length} bots` : "Pick a bot to go to it and talk, or let the lights show you the way."}
        </div>
      </div>
      <div ref={list} className="av-list" style={{ padding: "0 6px 8px" }} onScroll={(e) => markMore(e.currentTarget)}>
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 style={{ margin: "8px 8px 2px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6 }}>{g.title}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {g.bots.map((b) => (
                <li key={b.key} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button type="button" className="av-row" onClick={() => visitBot(b.key)} aria-label={`Go to ${nickOf(b)}, ${b.name}`}>
                    <Dot bot={b} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {nickOf(b)}
                        {b.key === near && <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 11 }}> · right here</span>}
                      </span>
                      {nickOf(b) !== b.name && <span className="av-clamp" style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.3 }}>{b.name}</span>}
                    </span>
                  </button>
                  <button type="button" className="av-btn av-small" style={{ ...small, flex: "none", whiteSpace: "nowrap" }} onClick={() => showWay(b.key)} aria-label={`Show the way to ${nickOf(b)}`} title="Lights on the ground lead you there">
                    <span aria-hidden>✨</span> Show the way
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!found && <p style={{ margin: "14px 10px", opacity: 0.75 }}>No bot matches “{query}”. Try a shorter word, or ask Iska &amp; iskOU at the arrival spot: they know who answers what.</p>}
      </div>
    </div>
  );
}

/** Shares a bot's link (with `question`, the link to its answer): the share sheet, else copied, and a small note says so. */
function Share({ bot, question, label }: { bot: Bot; question?: string; label: string }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 2500);
    return () => clearTimeout(t);
  }, [note]);
  const run = async () => {
    const link = shareLink(location.origin, bot.key, question), got = await shareUrl(link, `${nickOf(bot)} in Askou Village`);
    setNote(got === "copied" ? "Link copied" : got === "failed" ? `Copy this link: ${link}` : "");
  };
  return (
    <>
      <button type="button" data-share className="av-btn av-small" style={{ ...small, flex: "none" }} onClick={() => void run()} aria-label={label} title={label}>
        <span aria-hidden>🔗</span><span className="av-word"> Share</span>
      </button>
      <span role="status" className={note ? undefined : "av-sr"} style={note ? { ...panelStyle, position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)", padding: "6px 12px", fontSize: 13, zIndex: 50, maxWidth: "calc(100vw - 32px)", wordBreak: "break-all" } : undefined}>{note}</span>
    </>
  );
}

/** A reply's pieces as nodes. A link to another bot becomes a button that takes the visitor (and the question) there. */
function Pieces({ pieces, question, waiting }: { pieces: Piece[]; question?: string; waiting?: boolean }): ReactNode {
  return pieces.map((p, i) => {
    if (p.t === "br") return <br key={i} />;
    if (p.t === "text") return p.bold ? <strong key={i}>{p.text}</strong> : p.italic ? <em key={i}>{p.text}</em> : <span key={i}>{p.text}</span>;
    const other = botOf(p.bot);
    if (other)
      return (
        <button key={i} type="button" className="av-link" style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer", fontWeight: p.bold ? 700 : undefined }} disabled={waiting} onClick={() => visitBot(other.key, question)} title={`Go to ${nickOf(other)}`}>
          {p.text}
        </button>
      );
    return p.href ? (
      <a key={i} className="av-link" href={p.href} target="_blank" rel="noopener noreferrer" style={{ fontWeight: p.bold ? 700 : undefined }}>
        {p.text}
      </a>
    ) : (
      <span key={i}>{p.text}</span>
    );
  });
}

function BotMessage({ bot, m, last, waiting }: { bot: Bot; m: Message; last: boolean; waiting: boolean }) {
  const a = m.answer, tint = tintOf(bot);
  const empty = !m.failed && a !== undefined && m.pieces.length === 0 && !a.consult;
  const consulted = a?.consult ? botOf(a.consult.key) : undefined;
  const refer = (m.refer ?? []).flatMap((k) => botOf(k) ?? []);
  return (
    <div style={{ justifySelf: "start", maxWidth: "94%", display: "grid", gap: 6 }}>
      {(m.pieces.length > 0 || m.failed || empty) && (
        <div className="av-bubble" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${tint} 38%, transparent)` }}>
          {m.failed ? "I could not reach Askou just now, so I have no answer for you yet." : empty ? "I do not have an answer to that yet." : <Pieces pieces={m.pieces} question={m.question} waiting={waiting} />}
        </div>
      )}
      {a?.consult && (
        <div className="av-bubble" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
            {consulted && <Dot bot={consulted} size={18} />} Here is what {consulted ? nickOf(consulted) : a.consult.name} says
          </div>
          <Pieces pieces={a.consult.pieces} question={m.question} waiting={waiting} />
        </div>
      )}
      {a && a.dates.length > 0 && (
        <ul style={{ margin: 0, padding: "0 0 0 2px", listStyle: "none", fontSize: 13, display: "grid", gap: 2 }}>
          {a.dates.map((d) => (
            <li key={d}>
              <span aria-hidden>📅</span> {d}
            </li>
          ))}
        </ul>
      )}
      {a && a.pages.length > 0 && (
        <div style={{ fontSize: 12.5 }}>
          <div style={{ opacity: 0.65, marginBottom: 2 }}>{empty ? "These UPOU pages may help:" : "From the UPOU pages:"}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
            {a.pages.slice(0, 3).map((p) => (
              <li key={p.url}>
                <a className="av-link" href={p.url} target="_blank" rel="noopener noreferrer" title={p.text || undefined}>
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(refer.length > 0 || (m.failed && m.question)) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {m.failed && m.question && (
            <button type="button" className="av-btn av-small" style={small} disabled={waiting} onClick={() => void askBot(m.question!, bot.key)}>
              Try again
            </button>
          )}
          {refer.map((other) => (
            <span key={other.key} style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
              <button type="button" className="av-btn av-small" style={{ ...small, borderColor: tintOf(other) }} disabled={waiting} onClick={() => visitBot(other.key, m.question)} title={`Go to ${nickOf(other)}${m.question ? " and ask the same question" : ""}`}>
                <span aria-hidden>➜</span>
                <span>
                  Ask {nickOf(other)}
                  {nickOf(other) !== other.name && <span style={{ display: "block", fontSize: 11, opacity: 0.72 }}>{other.name}</span>}
                </span>
              </button>
              <button type="button" className="av-btn av-small" style={small} onClick={() => (openBot(null), showWay(other.key))} aria-label={`Show the way to ${nickOf(other)}`} title="Lights on the ground lead you there">
                <span aria-hidden>✨</span> Show the way
              </button>
            </span>
          ))}
        </div>
      )}
      {last && a && a.followUps.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {a.followUps.map((q) => (
            <button key={q} type="button" className="av-btn av-small" style={small} disabled={waiting} onClick={() => void askBot(q, bot.key, true)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {!m.failed && m.question && (
        <div style={{ justifySelf: "start" }}>
          <Share bot={bot} question={m.question} label="Share a link to this answer" />
        </div>
      )}
      {last && a && a.suggestions.length > 0 && (
        <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
          <div style={{ fontSize: 12, opacity: 0.65 }}>Did you mean:</div>
          {a.suggestions.map((s) => (
            <button key={s} type="button" className="av-btn av-small" style={small} disabled={waiting} onClick={() => void askBot(s, bot.key, true)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Chat({ bot, messages, busy, waiting, near, live }: { bot: Bot; messages: Message[]; busy: boolean; waiting: boolean; near: boolean; live: boolean | null }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const idle = useRef<ReturnType<typeof setTimeout>>();
  const nick = nickOf(bot), tagline = taglineOf(bot);
  useEffect(() => {
    // An answer is read from its start: the question last asked goes to the top of the list, its answer under it
    // (the hello, when nothing was asked yet), and not the end of a long answer.
    const el = list.current, asked = el && [...el.querySelectorAll("[data-you]")].pop();
    if (!el) return;
    const top = asked ? asked.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 8 : 0;
    el.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    markMore(el);
    // a button that asks is gone once pressed, and a touch screen focuses no input: the keyboard's place stays in the dialog, not at the page's top
    if (document.activeElement === document.body) dialog.current?.focus({ preventScroll: true });
  }, [messages.length, busy]);
  useEffect(() => {
    // A phone's keyboard would cover the world; focus only with a real keyboard.
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
    return () => {
      clearTimeout(idle.current);
      setTyping(false);
    };
  }, []);
  const send = (q: string, suggested = false) => {
    if (!q.trim() || waiting) return;
    void askBot(q, bot.key, suggested);
    setText("");
    setTyping(false);
  };
  const asked = messages.some((m) => m.from === "you");
  const starters = asked ? [] : startersOf(bot.key).slice(0, 4);
  const lastId = messages.length ? messages[messages.length - 1].id : -1;
  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-label={`Chat with ${nick}`} className="av-panel" style={{ ...panelStyle, padding: 0, borderColor: `color-mix(in srgb, ${tintOf(bot)} 45%, transparent)` }}>
      <div className="av-head" style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Dot bot={bot} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</strong>
          {nick !== bot.name && <div className="av-clamp" style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.25 }} title={bot.name}>{bot.name}</div>}
          {tagline ? <i className={`av-clamp${nick !== bot.name ? " av-hint" : ""}`} style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.25 }} title={tagline}>{tagline}</i> : nick === bot.name && <div style={{ fontSize: 12, opacity: 0.72 }}>UPOU bot</div>}
        </div>
        <div className="av-acts">
          <Share bot={bot} label={`Share a link to ${nick}`} />
          <button type="button" className="av-btn av-small" style={{ ...small, flex: "none" }} onClick={() => dance(bot.key)} aria-label={`Ask ${nick} to dance`}>
            <span aria-hidden>🎵</span><span className="av-word"> Let's Dance</span>
          </button>
          <button type="button" className="av-btn av-small" style={{ ...small, flex: "none" }} onClick={() => openBot(null)} aria-label="Close the chat">
            Close
          </button>
        </div>
      </div>
      <div ref={list} className="av-list" style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, alignContent: "start" }} aria-live="polite" onScroll={(e) => markMore(e.currentTarget)}>
        {!near && (
          <button type="button" className="av-btn av-small" style={{ ...small, justifySelf: "start" }} onClick={() => visitBot(bot.key)}>
            <span aria-hidden>📍</span> Take me to {nick}
          </button>
        )}
        {live === false && <div style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 10, background: "rgba(255,150,90,.14)", border: "1px solid rgba(255,170,120,.4)" }}>Askou cannot be reached right now. You can still ask: I will try.</div>}
        {messages.length === 0 && (
          <div className="av-dots" style={{ opacity: 0.6 }}>
            <span />
            <span />
            <span />
            <div className="av-sr">{nick} is saying hello</div>
          </div>
        )}
        {messages.map((m) =>
          m.from === "you" ? (
            <div key={m.id} data-you className="av-bubble" style={{ justifySelf: "end", maxWidth: "88%", background: "rgba(122,162,255,0.22)", border: "1px solid rgba(122,162,255,0.38)" }}>
              <Pieces pieces={m.pieces} />
            </div>
          ) : (
            <BotMessage key={m.id} bot={bot} m={m} last={m.id === lastId && !busy} waiting={waiting} />
          )
        )}
        {busy && (
          <div className="av-bubble av-dots" style={{ justifySelf: "start", background: "rgba(255,255,255,.07)" }}>
            <span />
            <span />
            <span />
            <div className="av-sr">{nick} is finding an answer</div>
          </div>
        )}
        {starters.length > 0 && messages.length > 0 && (
          <div style={{ display: "grid", gap: 5, justifyItems: "start", marginTop: 2 }}>
            <div style={{ fontSize: 12, opacity: 0.65 }}>You could ask:</div>
            {starters.map((s) => (
              <button key={s} type="button" className="av-btn av-small" style={small} disabled={waiting} onClick={() => send(s, true)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        style={{ padding: "8px 10px 10px", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <input
            ref={input}
            className="av-input"
            value={text}
            maxLength={MAX_QUESTION}
            enterKeyHint="send"
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
              // the bot leans in to read along while the visitor types, and sits back when they pause
              setTyping(e.target.value.length > 0);
              clearTimeout(idle.current);
              idle.current = setTimeout(() => setTyping(false), 1500);
            }}
            onBlur={() => setTyping(false)}
            placeholder={`Ask ${nick}…`}
            aria-label={`Your question for ${nick}`}
          />
          <button type="submit" className="av-btn av-main" style={{ ...pillButtonStyle, color: "#23180a" }} disabled={!text.trim() || waiting}>
            Ask
          </button>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 6, lineHeight: 1.4 }}>
          <span className="av-note-long">Your question is sent to the Askou service to find an answer. Please don't type personal details. </span>
          <span className="av-note-short">Sent to Askou. Please don't type personal details. </span>
          <a className="av-link" href={PRIVACY} target="_blank" rel="noopener noreferrer">
            UP Data Privacy Notice
          </a>
          <span className="av-note-long">. {POC}</span>
        </div>
      </form>
    </div>
  );
}
