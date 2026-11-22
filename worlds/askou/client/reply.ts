// Askou's replies arrive as HTML written by its admins (`replyHtml`: line breaks, bold, links). This world never puts
// that HTML into the page: it is read into a short list of plain pieces, which the HUD draws as React nodes and the
// headset panel as text. Anything that is not a line break, bold, italics or a link to a web address is dropped
// (its text is kept), so nothing a reply contains can run or restyle the page.

export type Piece =
  | { t: "text"; text: string; bold?: boolean; italic?: boolean }
  /** `bot` = the link leads to another bot's page (/b/<key>): the world offers to hand over instead of leaving.
   *  `href` is "" when such a link is a path on Askou's own site: there is then nothing to open from here. */
  | { t: "link"; text: string; href: string; bot?: string; bold?: boolean }
  | { t: "br" };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, name: string) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? all;
    const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });

const BOT_LINK = /\/b\/([a-z][a-z0-9-]{1,29})(?:[/?#]|$)/;
/** A web, mail or phone address as written, or null for anything else (javascript:, data:, a path on this site). */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  return /^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i.test(href) ? href : null;
}

const BREAKS = new Set(["p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table", "blockquote"]);
const HIDDEN = new Set(["script", "style", "iframe", "object", "noscript", "template", "svg"]);

export function parseReply(html: string): Piece[] {
  const out: Piece[] = [];
  const last = (back = 1) => out[out.length - back]?.t;
  let bold = 0, italic = 0, hidden = 0;
  let link: { href: string; bot?: string } | null = null;
  const br = () => {
    // at most one empty line in a row, none at the start
    if (out.length && !(last() === "br" && last(2) === "br")) out.push({ t: "br" });
  };
  const text = (raw: string) => {
    const s = decode(raw).replace(/\s+/g, " ");
    if (!s || hidden) return;
    if (s === " " && (!out.length || last() === "br")) return;
    if (link) out.push({ t: "link", text: s, ...link, ...(bold > 0 && { bold: true }) });
    else out.push({ t: "text", text: s, ...(bold > 0 && { bold: true }), ...(italic > 0 && { italic: true }) });
  };
  for (const m of String(html ?? "").matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<!--[\s\S]*?-->|([^<]+)|</g)) {
    if (m[4] !== undefined) { text(m[4]); continue; }
    if (!m[2]) { if (m[0] === "<") text("<"); continue; }
    const tag = m[2].toLowerCase(), closing = m[1] === "/", step = closing ? -1 : 1;
    if (HIDDEN.has(tag)) hidden = Math.max(0, hidden + step);
    else if (tag === "br") br();
    else if (tag === "strong" || tag === "b") bold = Math.max(0, bold + step);
    else if (tag === "em" || tag === "i") italic = Math.max(0, italic + step);
    else if (tag === "a") {
      const raw = closing ? null : /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[3]);
      const href = raw ? decode(raw[1] ?? raw[2] ?? raw[3] ?? "") : "";
      const bot = BOT_LINK.exec(href)?.[1], safe = safeHref(href);
      link = closing ? null : bot ? { href: safe ?? "", bot } : safe ? { href: safe } : null;
    } else if (BREAKS.has(tag)) {
      br();
      if (tag === "li" && !closing) text("• ");
    }
  }
  while (last() === "br") out.pop();
  return out;
}

/** The reply as text, for the panel in a headset (line breaks kept, links as their words). */
export const plainText = (pieces: Piece[]): string => pieces.map((p) => (p.t === "br" ? "\n" : p.text)).join("").replace(/[ \t]+\n/g, "\n").trim();

/** The other bots a reply points to, in the order they appear, once each. */
export const botsIn = (pieces: Piece[]): string[] => [...new Set(pieces.flatMap((p) => (p.t === "link" && p.bot ? [p.bot] : [])))];
