// usage: node worlds/askou/scripts/roster-snapshot.mjs [base]   Writes worlds/askou/client/roster.json from the running Askou's public bot list (key, name, kind, parentKey only).
import { writeFileSync } from "node:fs";
const B = process.argv[2] ?? process.env.ASKOU_URL;
if (!B) { console.error("give the Askou address as the first argument or in ASKOU_URL"); process.exit(2); }
const get = async (p) => { const r = await fetch(B + p, { headers: { "X-Askou-Test": "1", "X-Bot": "" } }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const [general, list] = await Promise.all([get("/api/bot"), get("/api/bot/characters")]);
const bots = list.map(({ key, name, kind, parentKey }) => ({ key, name, kind, parentKey: parentKey ?? null })).sort((a, b) => a.key.localeCompare(b.key));
const out = { general: { name: general.name, personaNames: general.personaNames ?? [] }, bots };
writeFileSync(new URL("../client/roster.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
const kinds = {}; for (const b of bots) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
console.log(`${bots.length} bots written`, JSON.stringify(kinds), `general: ${out.general.name} (${out.general.personaNames.join(", ")})`);
