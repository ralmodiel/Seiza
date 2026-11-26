import { afterEach, describe, expect, it, vi } from "vitest";
import { ask, mentions, SNAPSHOT, toAnswer, toBots } from "./api";
import { plainText } from "./reply";

describe("toBots", () => {
  it("reads Askou's bot list, the general bot first, and leaves out what is not a bot", () => {
    const bots = toBots(
      [{ key: "fics", name: " Faculty of Information and Communication Studies ", kind: "faculty", parentKey: "upou", nick: null }, { key: "FICS", name: "bad key" }, { key: "fics", name: "twice" }, { key: "noname" }, null, "x", { key: "osa", name: "OSA", parentKey: "<script>" }],
      { key: "upou", name: "UPOU", personaNames: ["Iska", "iskOU"] }
    );
    expect(bots.map((b) => b.key)).toEqual(["upou", "fics", "osa"]);
    expect(bots[0]).toMatchObject({ kind: "general", nick: "Iska & iskOU", parentKey: null });
    expect(bots[1].name).toBe("Faculty of Information and Communication Studies");
    expect(bots[2]).toMatchObject({ kind: "office", parentKey: null });
    expect(toBots("nonsense").map((b) => b.key)).toEqual(["upou"]);
  });

  it("has a snapshot to stand in while Askou cannot be reached", () => {
    expect(SNAPSHOT.length).toBeGreaterThan(50);
    expect(SNAPSHOT[0].key).toBe("upou");
  });
});

describe("toAnswer", () => {
  it("keeps the reply, the pages with web addresses, the dates and the bot consulted", () => {
    const a = toAnswer({
      sessionId: "s1",
      replyHtml: 'Ask <a class="link" href="https://askou.example/b/registrar">the Registrar</a>.<br/><strong>Fees</strong>',
      suggestions: [{ responseId: "1", text: "How do I enroll?" }, { text: 5 }, "x"],
      answers: [{ id: "a1", followUps: ["Another joke!", 7] }],
      excerpts: [{ title: "FAQ", url: "https://registrar.upou.edu.ph/faq", text: "Enrol <b>online</b>." }],
      searchResults: [{ title: "Bad", url: "javascript:alert(1)", digest: "x" }, { title: "Mail", url: "mailto:a@b.c", digest: "x" }, { title: "Ok", url: "https://upou.edu.ph/ok", digest: "A page" }],
      calendar: [{ title: "Registration", startDate: "2027-01-12", endDate: "2027-01-15" }, { title: "No date" }],
      consult: { botKey: "osa", name: "Office of Student Affairs", nick: null, replyHtml: "Scholarships are <strong>open</strong>." },
    });
    expect(a.sessionId).toBe("s1");
    expect(plainText(a.pieces)).toBe("Ask the Registrar.\nFees");
    expect(a.suggestions).toEqual(["How do I enroll?"]);
    expect(a.followUps).toEqual(["Another joke!"]);
    expect(a.pages).toEqual([{ title: "FAQ", url: "https://registrar.upou.edu.ph/faq", text: "Enrol online." }, { title: "Ok", url: "https://upou.edu.ph/ok", text: "A page" }]);
    expect(a.dates).toHaveLength(1); // the entry without a date is left out; how a date is written is the browser's
    expect(a.dates[0]).toMatch(/^Registration: .*12.*2027 – .*15.*2027$/);
    expect(a.consult).toMatchObject({ key: "osa", name: "Office of Student Affairs" });
    expect(a.refer).toEqual(["registrar", "osa"]);
  });

  it("survives a reply that is not what Askou documents", () => {
    for (const odd of [null, "<html>", 7, { replyHtml: 3, suggestions: "no", consult: "x", calendar: {} }]) {
      expect(toAnswer(odd)).toEqual({ sessionId: null, pieces: [], suggestions: [], followUps: [], pages: [], dates: [], consult: null, refer: [] });
    }
  });
});

describe("mentions", () => {
  it("finds the bots a reply names, a programme before the faculty in its name, never the bot itself", () => {
    const bots = toBots([{ key: "fed", name: "Faculty of Education" }, { key: "fedx", name: "Doctor of Philosophy in Education" }, { key: "osa", name: "OSA" }]);
    expect(mentions("See the doctor of philosophy in education of the Faculty of Education. OSA helps.", bots, "upou")).toEqual(["fedx", "fed"]);
    expect(mentions("The Faculty of Education.", bots, "fed")).toEqual([]);
  });
});

describe("ask", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("sends the question, the bot and the talk's session, and nothing else of the visitor", async () => {
    const fetched = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}"));
    vi.stubGlobal("fetch", fetched);
    await ask("fics", "s1", "x".repeat(3000), true);
    const [url, init] = fetched.mock.calls[0];
    expect(url).toMatch(/\/api\/chat$/);
    expect(init.credentials).toBe("omit"); // no cookies, either way
    expect(Object.keys(init.headers as object).sort()).toEqual(["Content-Type", "X-Bot"]); // never X-Chat-Log
    expect(JSON.parse(init.body as string)).toEqual({ sessionId: "s1", sentences: [{ text: "x".repeat(2000) }], source: "suggested" });
  });
});
