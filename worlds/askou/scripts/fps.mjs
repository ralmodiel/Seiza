// Frames a second and the renderer's counters at a spot. Usage: [GPU=1] node worlds/askou/scripts/fps.mjs ["query"] [width] [height]
import { launch, enter, state, fps } from "./lib/village.mjs";
const [query = "skyHour=10", width = "1280", height = "800"] = process.argv.slice(2);
const browser = await launch();
try {
  const { page, errors } = await enter(browser, { query, width: +width, height: +height, settle: 5000 });
  const s = await state(page);
  console.log(`fps ${await fps(page)} | calls ${s.calls} | triangles ${s.triangles} | figures ${s.shown.length} | ${s.renderer} | ${errors.length} errors`);
} finally {
  await browser.close();
}
