# Tulay

**Tulay** ("bridge") is the Filipino home of the Seiza family: Seiza came
first, and takes its inspiration from Japan; Tulay is the same platform,
for Filipino learners and partners, at `tulay.seiza.cc`.

This folder is the starting point. Today Tulay is Seiza's own world under
its own name and icon, with the beach, Philippine weather and sky, and no
Japanese seasons (the Philippines has a wet and a dry season instead). The
plan below is what makes it Filipino.

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

### 2. A Filipino place

The built-in hall is Japanese: tatami, shoji, a seiza bench. Rather than a
second set of rooms (and a second set of collision and seats to maintain),
a theme in `world.json` (`"theme": "filipino"`) swaps what things look like
and keeps where they are:

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
```
