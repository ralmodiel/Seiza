import { describe, expect, it } from "vitest";
import { layoutVillage, ROOT } from "./layout";
import { SNAPSHOT, toBots } from "./api";
import { botsIn, parseReply } from "./reply";
import { aimAt, cameraAt, pairMid, setTravel, standBy, standWith, startersOf, taglineOf, type Message } from "./store";
import { groupsOf } from "./VillageHud";
import { answerParts, panelText } from "./VillageXr";

const posts = layoutVillage(SNAPSHOT);

describe("the village", () => {
  it("stands a visitor 2.3 m from a bot, on walkable ground only", () => {
    const post = posts[0];
    // walkable only east of the bot
    const spot = standBy(post, [post.x - 10, post.z], (x) => (x > post.x + 1 ? 0.2 : null), posts);
    expect(spot).not.toBeNull();
    expect(spot![0]).toBeGreaterThan(post.x + 1);
    expect(Math.hypot(spot![0] - post.x, spot![2] - post.z)).toBeCloseTo(2.3, 5);
    expect(standBy(post, [0, 0], () => null, posts)).toBeNull();
  });

  it("in a headset puts the visitor where the bot stands before them, and turns nobody", () => {
    const post = { key: "p", x: 20, z: 5, parent: null, level: 1 as const };
    let spot: number[] | null = null, turned = false;
    const travel = { warp: (at: number[]) => void (spot = at), faceToward: () => void (turned = true), getSelfPosition: (): [number, number, number] => [0, 0, 0], groundAt: () => 0, third: () => false };
    setTravel({ ...travel, ahead: () => [0, -1] }); // looking -z, the bot far off to the side
    standWith(post);
    setTravel(null);
    expect(turned).toBe(false);
    expect([spot![0], spot![2]]).toEqual([post.x, post.z + 2.3].map((n) => expect.closeTo(n, 5))); // -z of the spot is the bot
  });

  it("looks beside a bot in third person, so the visitor's own avatar does not hide it", () => {
    expect(aimAt({ x: 0, z: -2.3 }, [0, 0], false)).toEqual([0, -2.3]);
    // facing -z, the point is to the left (-x): the bot then shows on the right, away from the chat panel
    const [x, z] = aimAt({ x: 0, z: -2.3 }, [0, 0], true);
    expect(x).toBeCloseTo(-1.5, 5);
    expect(z).toBeCloseTo(-2.3, 5);
  });

  it("gives the middle of the free view to the pair, the bot and the visitor's avatar, and is not pulled by a bot behind", () => {
    // the avatar 3 m ahead in the middle (0.3 m to each side), the bot 5.3 m ahead and 1.5 m to the right (its name tag 0.75 m to each side)
    const mid = pairMid([1.5, 5.3], [0, 3], 600, 200);
    expect(mid).toBeCloseTo(((-0.3 / 3) * 600 + (2.25 / 5.3) * 600) / 2);
    expect(pairMid([1.5, 5.3], [0, 3], 600, 40)).toBe(40);
    expect(pairMid([1.5, -2], [0, 3], 600, 200)).toBe(0);
    expect(pairMid([-4, 5.3], [0, 3], 600, 200)).toBe(0);
    expect(pairMid([1.5, 5.3], [0, 3], 600, 200, 1.1)).toBeGreaterThan(mid); // the general bot's tag is wider
    expect(pairMid([1.5, 5.3], [0, 3], 600, 200, 0.75, 200)).toBeCloseTo((2.25 / 5.3) * 600 - 100); // no room for both: the bot's side stays in view
  });

  it("in third person keeps the view from the camera behind the visitor clear of the other bots", () => {
    const ring = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ key: `c${i}`, x: 4.5 * Math.cos((i * Math.PI) / 4), z: 4.5 * Math.sin((i * Math.PI) / 4), parent: "p", level: 2 as const }));
    const post = { key: "p", x: 0, z: 0, parent: null, level: 1 as const }, all = [post, ...ring];
    const spot = standBy(post, [10, 0], () => 0, all, 1.5)!, at: [number, number] = [spot[0], spot[2]];
    const cam = cameraAt(at, aimAt(post, at, true), true);
    expect(Math.hypot(cam[0] - at[0], cam[1] - at[1])).toBeCloseTo(3, 5);
    for (const t of [0, 0.5, 1]) for (const c of ring) expect(Math.hypot(c.x - (at[0] + (cam[0] - at[0]) * t), c.z - (at[1] + (cam[1] - at[1]) * t))).toBeGreaterThan(1.2);
  });

  it("offers questions to ask first, the general bot's included (in a headset they are the only way to ask)", () => {
    expect(startersOf(ROOT).length).toBe(3);
    expect(startersOf("registrar").length).toBeGreaterThan(0);
    expect(startersOf("alumni")[0]).toContain("Alumni"); // Askou's own starters (every roster bot has some since 2026-11-20)
    expect(startersOf("no-such-bot")).toEqual([]);
  });

  it("says a bot's short line: the admin's own when Askou sends one, else the built-in one, none for a bot without", () => {
    const fmds = SNAPSHOT.find((b) => b.key === "fmds")!;
    expect(taglineOf({ ...fmds, tagline: null })).toBe("Managing the world, one good decision at a time.");
    expect(taglineOf({ ...fmds, tagline: "Ours." })).toBe("Ours.");
    expect(taglineOf({ ...fmds, key: "no-such-bot", tagline: null })).toBeNull();
  });

  it("lists every bot once in the directory, the general bot first", () => {
    const groups = groupsOf(SNAPSHOT, posts);
    const keys = groups.flatMap((g) => g.bots.map((b) => b.key));
    expect(keys.length).toBe(SNAPSHOT.length);
    expect(new Set(keys).size).toBe(SNAPSHOT.length);
    expect(keys[0]).toBe(ROOT);
  });

  it("takes no bot whose key names something every object has (the talks are kept by key), and knows a link to a bot with a hyphen in its key", () => {
    expect(toBots([{ key: "constructor", name: "X" }, { key: "grad-school", name: "Graduate School" }]).map((b) => b.key)).toEqual([ROOT, "grad-school"]);
    expect(botsIn(parseReply('<a href="/b/grad-school">the Graduate School</a>'))).toEqual(["grad-school"]);
  });

  it("says in a headset why there is no answer, and cuts a long one at a word", () => {
    const bot = (m: Partial<Message>): Message => ({ id: 1, from: "bot", pieces: [], ...m });
    expect(panelText(undefined, true)).toMatch(/Finding/);
    expect(panelText(bot({ failed: true }), false)).toMatch(/could not reach/);
    expect(panelText(bot({}), false)).toMatch(/do not have an answer/);
    const said = bot({ pieces: [{ t: "text", text: "word ".repeat(400) }] }), long = panelText(said, false);
    expect(long.length).toBeLessThanOrEqual(901);
    expect(long.endsWith("word…")).toBe(true);
    // the rest is read part by part, and no word is lost between the parts
    expect(panelText(said, false, 1).startsWith("…word")).toBe(true);
    expect(answerParts(said).join(" ").split(" ").length).toBe(400);
  });
});
