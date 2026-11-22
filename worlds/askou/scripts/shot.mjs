// One screenshot of the village (and its state line), for a look or for local_vision.
// Usage: node worlds/askou/scripts/shot.mjs <name> ["query" e.g. "skyHour=21&at=66,0.2,0,-1.57"] [width] [height] [settle ms] [open-bot-key]   env: TOUCH=1 (a phone), VIEW=third (press V on a desktop)
import { launch, enter, state, shot } from "./lib/village.mjs";
const [name = "shot", query = "", width = "1280", height = "800", settle = "7000", open = ""] = process.argv.slice(2);
const browser = await launch();
try {
  const { page, errors } = await enter(browser, { query, width: +width, height: +height, settle: +settle, touch: process.env.TOUCH === "1" });
  if (process.env.VIEW === "third") await page.keyboard.press("v");
  if (open) {
    await page.evaluate((k) => window.__askou.store.visitBot(k), open);
    await page.waitForTimeout(2500);
  }
  const s = await state(page);
  console.log(JSON.stringify({ ...s, shown: s.shown.length, threads: undefined }));
  console.log(await shot(page, name));
  console.log(`${errors.length} errors`, errors.slice(0, 5).join(" | "));
  process.exitCode = errors.length ? 1 : 0;
} finally {
  await browser.close();
}
