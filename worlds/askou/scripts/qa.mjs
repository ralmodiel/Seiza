// QA of the village, end to end in a headless browser. One verdict line per section and one in all; non-zero on a FAIL.
// Usage: node worlds/askou/scripts/qa.mjs [sections=all]      sections: load,motto,click,ask,inject,dir,keys,offline,phone,perf  (comma separated)
//        ALL=1 prints the passing checks too. Needs the dev server (see lib/village.mjs); ASKOU_TEST=1 there keeps Askou's records clean.
import { launch, enter, state, shot, fps, Checks } from "./lib/village.mjs";

const want = (process.argv[2] || "all").split(",");
const on = (name) => want.includes("all") || want.includes(name);
const c = new Checks();
const browser = await launch();
const A = (page, fn, arg) => page.evaluate(fn, arg);
const thread = (page, key) => A(page, (k) => (window.__askou.village().threads[k] ?? []).map((m) => ({ from: m.from, failed: !!m.failed, pieces: m.pieces.length, text: m.pieces.map((p) => p.text ?? "\n").join("").slice(0, 300), refer: m.refer ?? [], pages: m.answer?.pages.length ?? 0, suggestions: m.answer?.suggestions.length ?? 0 })), key);
/** Where the bot being talked to shows on screen (its chest), and the chat panel's box: the bot must be clear of the panel. */
const framing = (page, key) => A(page, (key) => { const a = window.__askou, p = a.village().posts.find((q) => q.key === key), r = document.querySelector(".av-panel")?.getBoundingClientRect() ?? { right: 0, bottom: 0 }; const [x, y, depth] = a.screen(p.x, (a.heights()[key] ?? 0.2) + 0.9, p.z); return { x: Math.round(x), y: Math.round(y), depth, right: Math.round(r.right), bottom: Math.round(r.bottom), w: innerWidth, h: innerHeight }; }, key);
const settled = (page, key, n, ms = 35000) => page.waitForFunction(({ key, n }) => { const s = window.__askou.village(); return s.busy === null && (s.threads[key] ?? []).length >= n; }, { key, n }, { timeout: ms }).then(() => true, () => false);
/** Stands the visitor in front of a bot, looking at it. */
const standAt = (page, key) => A(page, (key) => {
  const a = window.__askou, p = a.village().posts.find((q) => q.key === key), at = a.store.standBy(p, [66, 0], a.groundAt, a.village().posts);
  a.warp(at); a.face(p.x, p.z);
  return { post: p, y: a.heights()[key] };
}, key);
const inView = (page, sel) => A(page, (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: innerWidth, h: innerHeight, text: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 40) }; }), sel);

try {
  if (on("load") || on("motto") || on("click") || on("ask") || on("inject") || on("dir") || on("keys")) {
    const { page, errors } = await enter(browser, { query: "skyHour=10" });
    const s = await state(page);
    if (on("load")) {
      c.check(s.bots >= 60 && s.posts === s.bots, "every bot of Askou has a place", `${s.bots} bots, ${s.posts} places`);
      c.check(s.live === true, "the village reached Askou");
      c.check(s.ground === s.posts, "every bot stands on walkable ground", `${s.ground} of ${s.posts}`);
      c.check(s.shown.length >= 3, "figures stand near the visitor on arrival", `${s.shown.length} shown`);
      c.check(await page.getByRole("button", { name: /Find a bot/ }).isVisible(), "the 'Find a bot' button shows");
      c.check((await page.locator(".av").innerText()).length > 20, "the welcome tip shows");
    }
    if (on("motto")) {
      // walking up to a bot shows its short line: in a speech bubble by the bot, and in the dock for screen readers (and phones)
      await standAt(page, "fmds");
      await page.waitForFunction(() => window.__askou.village().near === "fmds", null, { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(900);
      const look = () => A(page, () => {
        const a = window.__askou, sp = a.scene.getObjectByName("askou-motto"), dock = document.querySelector(".av-motto");
        // the sprite's box on screen, -1..1 across and up (its painted part lies within it)
        const v = sp.position.clone().applyMatrix4(a.camera.matrixWorldInverse);
        const edge = (fx, fy) => v.clone().add({ x: (fx - sp.center.x) * sp.scale.x, y: (fy - sp.center.y) * sp.scale.y, z: 0 }).applyMatrix4(a.camera.projectionMatrix);
        const lo = edge(0, 0), hi = edge(1, 1);
        return { line: a.store.taglineOf(a.village().bots.find((b) => b.key === "fmds")), near: a.village().near, key: sp.userData.key, shown: sp.visible, opacity: +sp.material.opacity.toFixed(2),
          box: [lo.x, lo.y, hi.x, hi.y].map((n) => +n.toFixed(2)), dock: dock?.textContent ?? null, dockWide: dock ? Math.round(dock.getBoundingClientRect().width) : 0 };
      });
      const m = await look();
      c.check(m.near === "fmds", "standing by a bot makes it the bot nearby", String(m.near));
      c.check(m.key === "fmds" && m.opacity > 0.9, "its short line shows in a speech bubble by the bot", `${m.key} at ${m.opacity}`);
      c.check(m.box[0] > -1 && m.box[2] < 1 && m.box[1] > -1 && m.box[3] < 1, "the speech bubble is on the screen from where a visitor stands to talk", JSON.stringify(m.box));
      c.check(!!m.line && (m.dock ?? "").includes(m.line), "the dock says the same line, for screen readers and phones", String(m.dock));
      c.check(m.dockWide <= 2, "a wide screen does not draw the line twice", `${m.dockWide} px`);
      await A(page, () => window.__askou.store.openBot("fmds"));
      await page.waitForTimeout(700);
      const o = await look();
      c.check(!o.shown, "the bubble steps aside once the talk is open", `opacity ${o.opacity}`);
      c.check((await page.locator(".av-head").innerText()).includes(m.line), "the chat's head carries the bot's line");
      await A(page, () => window.__askou.store.openBot(null));
    }
    if (on("click")) {
      // a real click on the general bot's figure, as a visitor would
      const { post, y } = await standAt(page, "upou");
      await page.waitForTimeout(1600);
      const [x, yy] = await A(page, ({ post, y }) => window.__askou.screen(post.x, y + 0.75, post.z), { post, y });
      await page.mouse.move(x, yy);
      await page.waitForTimeout(250);
      c.check((await A(page, () => document.body.style.cursor)) === "pointer", "the pointer turns into a hand over a bot");
      c.check((await A(page, () => window.__askou.live.hover)) === "upou", "the bot under the pointer is marked");
      await page.mouse.click(x, yy);
      await page.waitForTimeout(400);
      c.check((await state(page)).open === "upou", "a click on a bot opens its chat");
      const dialog = page.getByRole("dialog", { name: /^Chat with/ });
      c.check(await dialog.isVisible(), "the chat panel shows");
      c.check(await settled(page, "upou", 1, 12000), "the bot says hello");
      const hello = await thread(page, "upou");
      c.check(hello[0]?.from === "bot" && hello[0].text.length > 10, "the greeting has words", hello[0]?.text.slice(0, 60));
      c.check(await page.locator(".av-btn", { hasText: /\?/ }).first().isVisible().catch(() => false), "starter questions are offered");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      c.check((await state(page)).open === null, "Escape closes the chat");
    }
    if (on("ask")) {
      await A(page, () => window.__askou.store.visitBot("upou"));
      await settled(page, "upou", 1, 12000);
      const box = page.getByLabel(/^Your question for/);
      await box.fill("How do I enroll?");
      await box.press("Enter");
      c.check(await settled(page, "upou", 3), "a typed question gets a reply");
      const t = await thread(page, "upou"), reply = t[t.length - 1];
      c.check(t[t.length - 2]?.from === "you" && /enroll/.test(t[t.length - 2].text), "the question shows in the talk");
      c.check(reply?.from === "bot" && !reply.failed && reply.pieces > 0, "the reply is an answer from Askou", reply?.text.slice(0, 70));
      c.check((await box.inputValue()) === "", "the box is empty again after sending");
      c.check(await box.evaluate((e) => e === document.activeElement), "the box keeps the focus for the next question");
      // a second question in the same talk (Askou's session carries over), and one it cannot answer
      await box.fill("zxqv plorb");
      await box.press("Enter");
      c.check(await settled(page, "upou", 5), "nonsense gets a reply too");
      const t2 = await thread(page, "upou"), miss = t2[t2.length - 1];
      c.check(miss?.from === "bot" && !miss.failed, "a question without an answer is not shown as an outage", miss?.text.slice(0, 60) || "(no words: the panel says so)");
      // another bot: the registrar's talk is its own
      await A(page, () => window.__askou.store.visitBot("registrar"));
      c.check(await settled(page, "registrar", 1, 12000), "another bot says its own hello");
      await page.waitForTimeout(1200);
      const f = await framing(page, "registrar");
      c.check(f.x > f.right + 60 && f.x < f.w - 60 && f.depth < 1, "the bot being talked to stands clear of the chat panel", JSON.stringify(f));
      const self = (await state(page)).self, post = await A(page, () => window.__askou.village().posts.find((p) => p.key === "registrar"));
      c.check(Math.hypot(self[0] - post.x, self[2] - post.z) < 3, "visiting a bot stands the visitor beside it", `${Math.hypot(self[0] - post.x, self[2] - post.z).toFixed(1)} m`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("v");
      await page.waitForTimeout(1800);
      const selfX = () => A(page, () => { const a = window.__askou, s = a.self(); return a.screen(s[0], s[1] + 1, s[2])[0]; });
      const fv = await framing(page, "registrar"), mv = await selfX();
      c.check(fv.x - mv > 90 && fv.x < fv.w - 40, "stepping behind one's avatar while standing by a bot turns the visitor: the bot stands beside the avatar", `bot ${fv.x}, avatar ${Math.round(mv)}`);
      await A(page, () => window.__askou.store.visitBot("ulibrary"));
      await page.waitForTimeout(1500);
      const f3 = await framing(page, "ulibrary"), me = await selfX();
      c.check(f3.x > f3.right + 60 && f3.x < f3.w - 40 && f3.x - me > 90, "in third person the bot stands beside the visitor's own avatar, not behind it", `bot ${f3.x}, avatar ${Math.round(me)}`);
      await page.keyboard.press("v");
      await A(page, () => window.__askou.store.visitBot("registrar"));
      await page.waitForTimeout(600);
      c.check((await thread(page, "upou")).length >= 5, "the first talk is kept while visiting another bot");
      await shot(page, "qa-ask");
      await A(page, () => window.__askou.store.openBot(null));
    }
    if (on("inject")) {
      // a hostile reply (never sent to Askou: answered here): nothing in it may run, load or leave the page's styling
      await page.route("**/askou/api/chat", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({
        sessionId: "x", replyHtml: `<b>Bold</b> <img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script><a href="javascript:window.__pwned=3">js</a> <a href="https://example.org/a">ok</a> <a href="data:text/html,<script>1</script>">data</a><iframe src="https://example.org"></iframe><style>.av{display:none}</style><svg onload="window.__pwned=4"></svg> &lt;img src=y onerror=window.__pwned=5&gt;`,
        suggestions: [{ text: `<img src=z onerror=window.__pwned=6>` }], excerpts: [{ url: "javascript:window.__pwned=7", title: "bad", text: "x" }, { url: "https://example.org/p", title: `<i onmouseover="window.__pwned=8">Page</i>`, text: "t" }],
      }) }));
      await A(page, () => window.__askou.store.visitBot("upou"));
      const before = (await thread(page, "upou")).length, own = await A(page, () => document.querySelectorAll(".av style").length);
      await A(page, () => void window.__askou.store.askBot("show me"));
      c.check(await settled(page, "upou", before + 2, 8000), "the hostile reply arrives");
      await page.waitForTimeout(400);
      const found = await A(page, (own) => ({
        pwned: window.__pwned ?? null,
        bad: document.querySelectorAll(".av img, .av script, .av iframe, .av style, .av svg[onload]").length - own,
        hrefs: [...document.querySelectorAll(".av a")].map((a) => a.getAttribute("href")),
        rel: [...document.querySelectorAll(".av a")].every((a) => a.target === "_blank" && /noopener/.test(a.rel) && /noreferrer/.test(a.rel)),
        shown: getComputedStyle(document.querySelector(".av")).display !== "none",
        handlers: [...document.querySelectorAll(".av *")].filter((e) => [...e.attributes].some((x) => /^on/i.test(x.name))).length,
      }), own);
      c.check(found.pwned === null, "nothing in a reply runs", `__pwned=${found.pwned}`);
      c.check(found.bad === 0, "no image, script, frame or style from a reply reaches the page", `${found.bad} elements`);
      c.check(found.handlers === 0, "no event handler attribute from a reply reaches the page");
      c.check(found.hrefs.length > 0 && found.hrefs.every((h) => /^(https?:|mailto:|tel:)/.test(h ?? "")), "only web, mail and phone links are kept", found.hrefs.join(" "));
      c.check(found.rel, "links open in a new tab without handing over the opener or the referrer");
      c.check(found.shown, "a reply cannot restyle the HUD");
      await page.unroute("**/askou/api/chat");
      await A(page, () => window.__askou.store.openBot(null));
    }
    if (on("dir")) {
      await page.getByRole("button", { name: /Find a bot/ }).click();
      const list = page.getByRole("dialog", { name: "The bots of Askou Village" });
      c.check(await list.isVisible(), "the list of bots opens");
      const rows = () => list.locator(".av-row").count();
      const all = await rows();
      c.check(all === s.bots, "the list has every bot", `${all} rows`);
      await list.locator("input[type=search]").fill("library");
      await page.waitForTimeout(200);
      const some = await rows();
      c.check(some >= 1 && some < 10, "searching narrows the list", `${some} rows for "library"`);
      await list.locator("input[type=search]").fill("qqqqzz");
      await page.waitForTimeout(200);
      c.check((await rows()) === 0 && /no bot|nothing|not find/i.test(await list.innerText()), "a search without a match says so");
      await list.locator("input[type=search]").fill("library");
      await page.waitForTimeout(200);
      await list.getByRole("button", { name: /^Show the way to/ }).first().click();
      await page.waitForTimeout(700);
      const st = await state(page);
      c.check(st.trail === "ulibrary" && st.directory === false, "'Way' lights the way and closes the list", `trail ${st.trail}`);
      const take = page.getByRole("button", { name: /Take me there/ });
      c.check(await take.isVisible(), "the way can be skipped with 'Take me there'");
      await shot(page, "qa-way");
      await take.click();
      await page.waitForTimeout(700);
      const st2 = await state(page), post = await A(page, () => window.__askou.village().posts.find((p) => p.key === "ulibrary"));
      c.check(st2.open === "ulibrary" && Math.hypot(st2.self[0] - post.x, st2.self[2] - post.z) < 3, "'Take me there' brings the visitor to the bot and opens the talk");
      c.check(st2.trail === null, "the lights go out on arrival");
      await A(page, () => window.__askou.store.openBot(null));
    }
    if (on("keys")) {
      // typing a question must not walk the avatar, and walking keys work again once the chat is closed
      await A(page, () => window.__askou.store.visitBot("upou"));
      await page.waitForTimeout(500);
      const p0 = (await state(page)).self;
      const box = page.getByLabel(/^Your question for/);
      await box.click();
      await page.keyboard.type("wwwwaaaassssdddd", { delay: 30 });
      await page.waitForTimeout(300);
      const p1 = (await state(page)).self;
      c.check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.05, "typing in the chat does not walk the avatar");
      c.check((await box.inputValue()) === "wwwwaaaassssdddd", "the typed letters land in the box");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      c.check((await state(page)).open === null && (await A(page, () => !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))), "closing the chat hands the keyboard back to the world", await A(page, () => document.activeElement.tagName));
      await page.keyboard.down("w");
      await page.waitForTimeout(900);
      await page.keyboard.up("w");
      const p2 = (await state(page)).self;
      c.check(Math.hypot(p2[0] - p1[0], p2[2] - p1[2]) > 0.5, "W walks again once the chat is closed", `${Math.hypot(p2[0] - p1[0], p2[2] - p1[2]).toFixed(2)} m`);
    }
    c.check(errors.length === 0, "no errors on the page (desktop)", errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  if (on("offline")) {
    // Askou cannot be reached: the village still stands (the bots of the last build), says so, and comes back by itself
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route("**/askou/api/**", (route) => route.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${process.env.VILLAGE_URL || "http://localhost:5199"}/?skyHour=10`);
    await page.locator('input[autocomplete="nickname"]').fill("QA Bot");
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !!window.__askou, null, { timeout: 60000 });
    await page.waitForTimeout(5000);
    const s = await state(page);
    c.check(s.live === false && s.bots >= 60, "without Askou the village stands with the bots it was built with", `${s.bots} bots`);
    const notice = page.getByRole("button", { name: /Try now/ });
    c.check(await notice.isVisible(), "the visitor is told the bots cannot answer now");
    await A(page, () => window.__askou.store.visitBot("upou"));
    await page.waitForTimeout(1500);
    const hello = await thread(page, "upou");
    c.check(hello.length === 1 && hello[0].text.length > 10, "a bot still greets (its own words) while Askou is away", hello[0]?.text.slice(0, 50));
    await A(page, () => void window.__askou.store.askBot("How do I enroll?"));
    c.check(await settled(page, "upou", 3, 8000), "a question asked while Askou is away comes back");
    const t = await thread(page, "upou");
    c.check(t[t.length - 1].failed, "it is shown as not delivered, with a way to try again");
    c.check(await page.getByRole("button", { name: /Try again/ }).first().isVisible(), "'Try again' is offered");
    await ctx.unroute("**/askou/api/**");
    await page.getByRole("button", { name: /Try now/ }).click().catch(() => {});
    await page.waitForFunction(() => window.__askou.village().live === true, null, { timeout: 15000 }).catch(() => {});
    c.check((await state(page)).live === true, "the village finds Askou again");
    await page.getByRole("button", { name: /Try again/ }).first().click();
    c.check(await settled(page, "upou", 3), "'Try again' asks the same question again");
    await page.waitForFunction(() => !window.__askou.village().threads.upou.some((m) => m.failed), null, { timeout: 35000 }).catch(() => {});
    const t2 = await thread(page, "upou");
    c.check(!t2[t2.length - 1].failed && t2.filter((m) => m.failed).length === 0 && t2.filter((m) => m.from === "you").length === 1, "the lost answer is replaced by the real one, the question stands once", `${t2.length} messages, ${t2.filter((m) => m.failed).length} failed`);
    c.check(errors.length === 0, "no errors on the page (offline)", errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  if (on("phone")) {
    const { page, errors } = await enter(browser, { query: "skyHour=10", width: 390, height: 844, touch: true });
    const fits = (rects) => rects.every((r) => r.l >= 0 && r.r <= r.w + 1 && r.t >= 0 && r.b <= r.h + 1);
    c.check(fits(await inView(page, ".av-btn, .av-panel")), "the HUD fits a phone screen on arrival");
    // behind their own avatar (Seiza's view on a touch screen) a visitor would see its back where the mascots stand
    const arr = await A(page, () => { const a = window.__askou, s = a.self(), p = a.village().posts.find((q) => q.key === "upou"), me = a.screen(s[0], s[1] + 1, s[2]), bot = a.screen(p.x, (a.heights().upou ?? 0.2) + 0.9, p.z); return { near: a.village().near, me: Math.round(me[0]), bot: Math.round(bot[0]), w: innerWidth }; });
    c.check(arr.near === "upou" && arr.bot - arr.me > 80 && arr.bot < arr.w - 120, "a phone visitor arrives beside the two mascots, not with their own avatar before them", JSON.stringify(arr));
    await standAt(page, "hrdo");
    await page.waitForFunction(() => window.__askou.village().near === "hrdo", null, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    const motto = await inView(page, ".av-motto");
    c.check(motto.length === 1 && fits(motto) && motto[0].r - motto[0].l > 100, "on a phone the dock shows the line of the bot nearby", JSON.stringify(motto[0] ?? null));
    c.check(fits(await inView(page, ".av-btn")), "the dock fits a phone screen beside a bot");
    c.check(await A(page, () => !window.__askou.scene.getObjectByName("askou-motto").visible), "a phone does not draw the line twice (no bubble cut off at the edge)");
    await A(page, () => window.__askou.store.visitBot("upou"));
    await settled(page, "upou", 1, 12000);
    await page.waitForTimeout(500);
    const panel = await inView(page, ".av-panel");
    c.check(panel.length === 1 && fits(panel), "the chat panel fits a phone screen", JSON.stringify(panel[0]));
    await page.waitForTimeout(900);
    c.check(await A(page, () => document.querySelector(".av-list").scrollTop === 0), "a bot's hello is shown from its first line");
    const pf = await framing(page, "upou");
    c.check(pf.y > pf.bottom && pf.y < pf.h && pf.x > 0 && pf.x < pf.w, "on a phone the bot shows under the chat panel", JSON.stringify(pf));
    // links inside a sentence are as tall as their line (WCAG 2.5.8 leaves those out); buttons and boxes are not
    const small = (await inView(page, ".av button:not(.av-link), .av input")).filter((r) => r.b - r.t < 36 || r.r - r.l < 36);
    c.check(small.length === 0, "every button in the chat is big enough for a finger (36 px)", small.slice(0, 4).map((r) => `${r.text} ${r.r - r.l}×${r.b - r.t}`).join(" | "));
    c.check(await A(page, () => document.documentElement.scrollWidth <= innerWidth), "nothing makes the page scroll sideways");
    const size = await page.getByLabel(/^Your question for/).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    c.check(size >= 16, "the question box does not make a phone zoom in (16 px text)", `${size}px`);
    await page.getByLabel(/^Your question for/).fill("How do I enroll?");
    await page.getByRole("button", { name: /^Ask$/ }).tap();
    c.check(await settled(page, "upou", 3), "a question sent by a tap gets a reply");
    await page.waitForTimeout(400);
    c.check(fits(await inView(page, ".av-panel")), "the chat panel still fits with an answer in it");
    await page.waitForTimeout(700);
    const q = await A(page, () => { const l = document.querySelector(".av-list").getBoundingClientRect(), y = [...document.querySelectorAll("[data-you]")].pop().getBoundingClientRect(); return { top: Math.round(y.top - l.top), view: Math.round(l.height) }; });
    c.check(q.top >= 0 && q.top < q.view / 2, "the question just asked is in view, with the start of its answer", JSON.stringify(q));
    await shot(page, "qa-phone-chat");
    await A(page, () => window.__askou.store.setDirectory(true));
    await page.waitForTimeout(300);
    c.check(fits(await inView(page, ".av-panel")), "the list of bots fits a phone screen");
    await shot(page, "qa-phone-list");
    c.check(errors.length === 0, "no errors on the page (phone)", errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  if (on("perf")) {
    const { page } = await enter(browser, { query: "skyHour=10", alone: true }); // counts the village alone, not who else is in the room
    const rate = await fps(page, 3000), s = await state(page);
    c.check(rate >= 50, "the village runs at a full frame rate at the plaza", `${rate} fps`);
    c.check(s.calls < 400, "draw calls stay low", `${s.calls} calls, ${s.triangles} triangles, ${s.shown.length} figures`);
    await page.context().close();
  }
} finally {
  await browser.close();
}
c.done(`qa ${want.join(",")}`);
