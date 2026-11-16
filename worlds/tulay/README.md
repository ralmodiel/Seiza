# Tulay

**Tulay** ("bridge") is the Filipino home of the Seiza family: Seiza came
first, and takes its inspiration from Japan; Tulay is the same platform,
for Filipino learners and partners, at `tulay.seiza.cc`.

Tulay is Seiza's own grounds, dressed as a Filipino place, under its own
name and icon, with Philippine weather and sky and no Japanese seasons (the
Philippines has a wet and a dry season instead).

## What's in it

- **Seiza's hall and classroom, in the Filipino theme** (`"theme":
  "filipino"` in `world/world.json`; `src/scene/materials.ts`): a banig mat
  where the tatami was, capiz panels in the classroom door, capiz lamps, and
  broadleaf trees round the grounds in place of the cones.
- **A kubo hall** on the meadow (`client/Kubo.tsx`): a big bahay kubo for
  classes, open at the front, with sawali walls, a nipa roof, a chalkboard,
  capiz lamps that come on at dusk, and twelve seats on bamboo benches.
- **Beach cottages**: two kubos on stilts on the sand, open to the sea, each
  with two seats on its edge facing the water.
- **Coconut palms** down the top of the beach (`client/Palms.tsx`), their
  fronds swaying with the wind.
- **A fiesta** (`client/Fiesta.tsx`): banderitas over the garden and in front
  of the kubo hall, with string lights that come on at dusk, and parols over
  the garden door and the kubo hall from September to January.
- The campsite and the tent, the garden and its pond, the portals, and the
  beach, as in Seiza.

Where everything stands, its seats, and its collision are in
`client/plan.ts`, checked by `client/plan.test.ts`.

## Deploy

```bash
npx wrangler login
node worlds/tulay/build.mjs
npx wrangler deploy --config worlds/tulay/wrangler.jsonc
```

Then, in the Cloudflare dashboard, for the `tulay` Worker:

1. **Settings > Variables and Secrets:** add `SEIZA_ADMIN_KEY` (or
   `SEIZA_EDITOR_PASSWORD`), and `CLOUDFLARE_TURN_KEY_ID` and
   `CLOUDFLARE_TURN_KEY_API_TOKEN`. Secrets belong to one Worker.
2. **Settings > Domains & Routes > Add > Custom domain:** `tulay.seiza.cc`.

Run it locally:

```bash
VITE_SEIZA_WORLD_ID=tulay npm run dev   # PowerShell: $env:VITE_SEIZA_WORLD_ID="tulay"; npm run dev
npm run worker:dev                      # in a second terminal
```

## The plan

In order: each step stands on its own, and the first is the one everything
else depends on.

### 1. Filipino in the interface

Seiza's interface is English and Japanese: every string is written as
`L("English", "日本語")` (`src/i18n/lang.ts`).

- Add Filipino as a third language, `fil`: `L(en, ja, fil?)`, falling back
  to English where a string has no Filipino yet, so it can be translated a
  screen at a time.
- A world sets the language newcomers start in (`"defaultLang": "fil"`
  in `world.json`); everyone can still choose.
- The language button becomes a small menu (English · 日本語 · Filipino).

**Decide:** Filipino (Tagalog-based) only, or Cebuano too; and who
reviews the translations (machine translation alone won't do for a public
release).

### 2. A Filipino place (done)

The built-in hall is Japanese: tatami, shoji, a seiza bench. Rather than a
second set of rooms (and a second set of collision and seats to maintain),
a theme in `world.json` (`"theme": "filipino"`) swaps what things look like
and keeps where they are. This is in place (see "What's in it" above); the
table was the plan:

| Seiza | Tulay |
| --- | --- |
| Tatami | Banig (woven mat) |
| Shoji screens | Capiz windows |
| Wooden hall | Bahay kubo or bahay na bato |
| Garden pond | Kept, with a few native plants |
| Campsite | Kept, beside the beach |

**Decide:** bahay kubo (rural, light) or bahay na bato (colonial, stone and
capiz), or one for the hall and one for the classroom.

### 3. Customs

- **Gestures:** *mano po* (the blessing), a wave, a nod; together gestures
  as now, with consent.
- **Seiza endurance** (dozing while kneeling) is off; the seiza posture
  stays available.
- **Sounds:** roosters at dawn, a *tuko* at night, rain on a tin roof.

### 4. A guide

A guide who speaks Filipino, on Seiza's guides (`src/guides/`), which
already understand Filipino and Cebuano words in questions.

### 5. The family under Tulay

Seilaya, Seisugbo, and Seinag already have Filipino roots in their names.
**Decide** whether they're presented under Tulay (`tulay.seiza.cc` linking
to them by portal) and whether Tulay later gets its own domain.

## Files

```
worlds/tulay/
  build.mjs          Builds the deployment into dist/
  wrangler.jsonc     Tulay's own Worker
  favicon.svg        Tulay's tab icon: a bridge over water
  world/world.json   The world's settings
  client/
    index.tsx        Tulay's own scene code, loaded only in Tulay
    plan.ts          Where everything is, its seats, and its collision
    Kubo.tsx         The kubo hall and the beach cottages
    Palms.tsx        The coconut palms
    Fiesta.tsx       Banderitas, string lights, and parols
    materials.ts     Nipa, sawali, bamboo, fronds, the chalkboard
    geometry.ts      Roof, cane, and merging helpers
```
