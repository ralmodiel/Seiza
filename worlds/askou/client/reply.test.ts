import { describe, expect, it } from "vitest";
import { botsIn, parseReply, plainText, safeHref } from "./reply";

describe("parseReply", () => {
  it("keeps line breaks, bold and web links, as pieces", () => {
    const pieces = parseReply('Apply <strong>online</strong>.<br/><br/>See <a class="link" href="https://our.upou.edu.ph/apply?a=1&amp;b=2" target="_blank" rel="noopener">the portal</a> &amp; wait.');
    expect(pieces).toEqual([
      { t: "text", text: "Apply " },
      { t: "text", text: "online", bold: true },
      { t: "text", text: "." },
      { t: "br" },
      { t: "br" },
      { t: "text", text: "See " },
      { t: "link", text: "the portal", href: "https://our.upou.edu.ph/apply?a=1&b=2" },
      { t: "text", text: " & wait." },
    ]);
    expect(plainText(pieces)).toBe("Apply online.\n\nSee the portal & wait.");
  });

  it("drops what could run or mislead, and keeps the words", () => {
    const pieces = parseReply('<script>alert(1)</script><img src=x onerror=alert(1)>Hi <a href="javascript:alert(1)">there</a> <a href="/admin">you</a><style>p{}</style> <span onclick="x()">ok</span> 1 < 2');
    expect(JSON.stringify(pieces)).not.toMatch(/alert|onerror|onclick|javascript|admin|p\{\}/);
    expect(pieces.every((p) => p.t === "text")).toBe(true);
    expect(plainText(pieces)).toBe("Hi there you ok 1 < 2");
  });

  it("finds the bots a reply hands over to", () => {
    const pieces = parseReply('Ask <a class="link" href="https://askou.example/b/registrar" target="_blank" rel="noopener">the Registrar</a> or <a href="https://askou.example/b/fics?x=1">FICS</a>, <a href="https://askou.example/b/registrar">again</a>, <a href="/b/osa">OSA</a>.');
    expect(botsIn(pieces)).toEqual(["registrar", "fics", "osa"]);
    expect(pieces.find((p) => p.t === "link" && p.bot === "osa")).toMatchObject({ href: "", text: "OSA" });
  });

  it("turns lists and paragraphs into lines", () => {
    expect(plainText(parseReply("<p>Bring:</p><ul><li>ID</li><li>Form &#35;5</li></ul>"))).toBe("Bring:\n\n• ID\n\n• Form #5");
  });
});

describe("safeHref", () => {
  it("allows web, mail and phone addresses only", () => {
    expect(safeHref(" https://upou.edu.ph/a ")).toBe("https://upou.edu.ph/a");
    expect(safeHref("mailto:registrar@upou.edu.ph")).toBe("mailto:registrar@upou.edu.ph");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "/b/fics", "https://a.example/\"onmouseover=\"x", ""]) expect(safeHref(bad)).toBeNull();
  });
});
