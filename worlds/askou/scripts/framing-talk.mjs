// The framing probe (framing.mjs) with a talk open, on every 3rd bot: desktop in third person, upright phone, tablet,
// landscape phone, small phone; and those touch screens without a talk. Usage: node worlds/askou/scripts/framing-talk.mjs [bot-key ...]   env: EVERY, VIEWS
// Each bot's greeting is fetched by the page (marked as a test). Verdict: `framing-talk: N checks, M FAIL`.
process.env.VIEWS ||= "third+talk,phone+talk,tablet+talk,widephone+talk,small+talk,tablet,widephone,small";
process.env.EVERY ||= "3";
process.env.LABEL ||= "framing-talk";
await import("./framing.mjs");
