// Usage: node worlds/askou/scripts/ux-a11y.mjs   Keyboard/focus/aria probe of the village HUD on desktop 1280x800 and on a touch screen.
// One offered question is asked of Askou (marked as a test by the dev proxy: recorded nowhere).
import { launch, enter, Checks } from "./lib/village.mjs";
const c = new Checks();
const browser = await launch();
const { page } = await enter(browser, { query: "skyHour=10", settle: 4000 });
const act = () => page.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName}${e.getAttribute("aria-label") ? ":" + e.getAttribute("aria-label") : e.textContent ? ":" + e.textContent.trim().slice(0, 25) : ""}` : "none"; });
const tabs = async (n) => { const o = []; for (let i = 0; i < n; i++) { await page.keyboard.press("Tab"); o.push(await act()); } return o; };
// 1 directory via keyboard
await page.locator('button[aria-label^="Find a bot"]').focus();
console.log("start focus:", await act());
await page.keyboard.press("Enter"); await page.waitForTimeout(500);
console.log("after open dir:", await act());
console.log("tab order in dir:", (await tabs(6)).join(" > "));
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
const afterEsc = await act();
c.check(!/BODY|none/.test(afterEsc), "focus returns to a control after closing the list with Escape", afterEsc);
// 2 chat
await page.evaluate(() => window.__askou.store.visitBot("registrar")); await page.waitForTimeout(3500);
console.log("after chat open:", await act());
console.log("tab order in chat:", (await tabs(9)).join(" > "));
// WASD typed into the chat input must not move the avatar
await page.locator('input[aria-label^="Your question"]').focus();
const p0 = await page.evaluate(() => JSON.stringify(window.__askou.self()));
await page.keyboard.type("wasdwasdvq", { delay: 40 }); await page.waitForTimeout(400);
const p1 = await page.evaluate(() => JSON.stringify(window.__askou.self()));
const typed = await page.locator('input[aria-label^="Your question"]').inputValue();
c.check(p0 === p1, "typing wasd in the chat input does not move the avatar", `${p0} -> ${p1}`);
c.check(typed === "wasdwasdvq", "all typed letters reach the input", typed);
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
const e2 = await act();
c.check(!/BODY|none/.test(e2), "focus returns to a control after closing chat with Escape", e2);
// a11y tree facts
await page.evaluate(() => window.__askou.store.visitBot("registrar")); await page.waitForTimeout(3500);
const info = await page.evaluate(() => {
  const d = document.querySelector('.av [role=dialog]');
  return { modal: d.getAttribute("aria-modal"), live: [...d.querySelectorAll("[aria-live]")].map((e) => e.getAttribute("aria-live") + ":" + e.className), divLabels: [...d.querySelectorAll("div[aria-label]:not([role])")].map((e) => e.getAttribute("aria-label")), h: d.querySelectorAll("h1,h2,h3").length, linkTitles: d.querySelectorAll("[title]").length };
});
console.log("aria:", JSON.stringify(info));
const cs = await page.evaluate(() => { const b = document.querySelector('.av button[aria-label="Close the chat"]'); b.focus(); const s = getComputedStyle(b); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`; });
console.log("focus ring on Close:", cs);
// a starter question pressed with the keyboard is gone at once: the keyboard's place stays in the dialog, and the wait is said in words
await page.route("**/askou/api/chat", async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
const starter = page.locator(".av [role=dialog] .av-list button").filter({ hasNotText: /Take me to/ }).first();
if (c.check((await starter.count()) > 0, "the chat offers a question to press")) {
  await starter.focus();
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  const w = await page.evaluate(() => ({ inDialog: !!document.activeElement?.closest(".av [role=dialog]"), said: [...document.querySelectorAll(".av [aria-live] .av-sr")].map((e) => e.textContent).join(" | "), busy: window.__askou.village().busy }));
  c.check(w.inDialog, "after a question is pressed with the keyboard, focus stays in the dialog", await act());
  c.check(w.busy !== null && /finding an answer/.test(w.said), "the wait for an answer is said in words inside the live list (a screen reader reads text, not a label)", JSON.stringify(w));
  await page.waitForFunction(() => window.__askou.village().busy === null, null, { timeout: 35000 }).catch(() => {});
}
await page.unroute("**/askou/api/chat");
// a touch screen: no input is focused (its keyboard would cover the world), so the opened dialog itself takes the keyboard's place
{
  const { page: phone } = await enter(browser, { query: "skyHour=10", settle: 3000, width: 390, height: 844, touch: true, alone: true });
  const where = () => phone.evaluate(() => { const e = document.activeElement; return `${e?.tagName}:${e?.getAttribute("aria-label") ?? ""}`; });
  await phone.locator('button[aria-label^="Find a bot"]').tap(); await phone.waitForTimeout(500);
  c.check(/^DIV:The bots/.test(await where()), "touch: the opened list of bots holds the focus", await where());
  await phone.evaluate(() => { const s = window.__askou.store; s.setDirectory?.(false); s.openBot("registrar"); }); await phone.waitForTimeout(800);
  c.check(/^DIV:Chat with/.test(await where()), "touch: the opened chat holds the focus", await where());
}
c.done("ux-a11y");
await browser.close();
