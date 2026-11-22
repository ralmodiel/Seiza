# Askou Village

**Askou Village** puts every bot of Askou, the UP Open University chatbot, on the
UPOU campus as a character you can walk up to and ask. It is a Seiza world
(see the repository's README and DOCS.md) that stands on SeiOU's campus model
(`worlds/seiou/world/models`), so visitors walk the real grounds, meet each
other, and talk to the bots there, on a desktop, a phone or in a headset.

The answers are Askou's own. The village has no answers and no language
model of its own: a question typed to a bot goes to a running Askou
(`POST /api/chat` with that bot's key), and the reply is shown as Askou
wrote it. A proof of concept, not an official UPOU site.

## What's in it

- **Every bot, placed by family.** The general bot (Iska & iskOU) stands at
  the hub in front of the Main Building; offices, faculties and their
  programmes stand in rings and rows around it (`client/layout.ts`). The
  list comes from Askou when the village opens; `client/roster.json` is the
  snapshot it falls back on when Askou cannot be reached.
- **Characters, not markers.** From afar each bot is a light with its name;
  within reach it stands as its own figure with its own colours and the
  thing it holds (`client/figures/`, `client/Figures.tsx`,
  `client/Constellation.tsx`). Figures turn to whoever is near, wave, show
  dots while an answer is on its way, cheer at an answer, and dance if asked.
- **A line of its own.** Walk up to a bot and it says its short line in a
  speech bubble ("Managing the world, one good decision at a time."), the
  line Askou's admins wrote for it, else the one Askou's chat page is built
  with (`client/Motto.tsx`, `client/figures/botText.ts`). A narrow screen
  shows it beside the "Talk to …" button instead; the chat's head and the
  headset's panel carry it too.
- **Talking.** Click a bot (or walk up and press the button that appears) to
  open its chat: its greeting, questions it is known to answer, and a box for
  your own. A reply may carry dates, UPOU pages, "did you mean" questions,
  and a hand-over to the bot that knows better: "Ask …" takes you there with
  your question, "Way" lights a path on the ground to walk.
- **Find a bot.** The list of all bots, searchable, grouped by family.
- **In a headset** the chat is a panel beside the bot with the answer and
  buttons for the offered questions (`client/VillageXr.tsx`). There is no
  keyboard or voice input in VR yet: questions there are the offered ones,
  so every bot offers some (Askou's own where it has them, else the ones
  in `client/store.ts`, each checked against a running Askou). The panel
  shows one question and its answer at a time; a long answer is read part
  by part ("Read on"). With nothing to point with, a gaze picks the bot in
  front, never one standing behind it.
- **Small screens.** A phone held upright has the chat at the top and the
  walking pad below it; the smallest ones (320 by 568) get a one-line head
  so that an answer has room. Held sideways the chat takes the screen's height,
  over the pad, which is back when the chat closes.
- **Behind your own avatar** (Seiza's view on a touch screen, or after
  pressing V) the avatar would stand in front of whoever you face. A visit
  to a bot therefore stands you at an angle to it, and the picture keeps
  the two of you in its middle; such a visitor also arrives beside the two
  mascots instead of 6 m in front of them (`standWith`, `arrive` in
  `client/store.ts`). Stepping behind your avatar while standing by a bot
  turns you the same way (`useFraming` in `client/Village.tsx`).
- **Less movement.** For a visitor whose device asks for reduced motion the
  bots stand still (they keep their faces and blinks), the view makes room
  for the chat at once instead of sliding, and the lights of a shown way
  are lit without running. A dance asked for by its button still plays.
- **Without Askou** the village still stands: the bots are the snapshot,
  each greets in its own words, the visitor is told the bots cannot answer
  now, and a lost question can be asked again once Askou is back.

## Run it

Askou must be running (the `chatbot-react` project; this project never
starts or changes it). Give its address in the environment; no address of
another project lives in this repository.

```sh
npm install
ASKOU_URL=<address of the running Askou> VITE_SEIZA_WORLD_ID=askou npm run dev
npm run worker:dev        # in a second terminal: the room server (other visitors, avatars)
```

- `ASKOU_URL`: the development server forwards three calls there and
  nothing else: `GET /askou/api/bot`, `GET /askou/api/bot/characters` and
  `POST /askou/api/chat` (`askouProxy` in `vite.config.ts`; anything else
  under `/askou/api/` is a 404). It drops the visitor's `cookie`,
  `authorization` and `x-chat-log` headers on the way there and Askou's
  `set-cookie` on the way back. Not set: nothing is forwarded, and the
  village shows its snapshot.
- `ASKOU_TEST=1`: marks every forwarded request as a test
  (`X-Askou-Test: 1`), which Askou records nowhere. Set it for QA, scripts
  and anything that is not a person.

Build and deploy:

```sh
VITE_ASKOU_API=<address of an Askou that allows the village's origin> node worlds/askou/build.mjs
npx wrangler deploy --config worlds/askou/wrangler.jsonc
```

A built village asks `VITE_ASKOU_API` directly, so that Askou must allow the
village's origin (CORS), or a route on the village's own origin must forward
`/askou/api/` to it. Neither is set up here.

## What is sent to Askou, and what is not

- Sent: the question as typed (at most 2000 characters), the bot's key, and
  the session id Askou gave in its previous answer of the same talk, so a
  follow-up is understood. A clicked offered question is marked
  `"source": "suggested"`: Askou counts those per bot, text and day, with
  nothing about the visitor.
- Not sent: the visitor's name, avatar, room or position; no cookies (the
  page sends its calls without any, `credentials: "omit"`, and the
  development forwarder removes them too); and never `X-Chat-Log`, the
  header with which Askou's own chat page asks for a conversation to be
  recorded.
- Talks live in the page's memory only: nothing is written to storage, and
  they are gone on reload. Nothing of a talk goes through the room: other
  visitors see neither the question nor the answer, nor that a bot is busy.
- The chat tells the visitor that the question goes to Askou, asks them not
  to type personal details, and links the UP Data Privacy Notice.
- A reply is treated as text from elsewhere: it is parsed into plain text,
  bold, line breaks and links (`client/reply.ts`); only `http(s)`, `mailto`
  and `tel` links are kept; nothing in it runs.

## Checks

```sh
npx vitest run worlds/askou      # the parser, the layout, the client and the village rules
```

The probes in `scripts/` drive the village in a headless browser against
the dev server of "Run it", started with `ASKOU_TEST=1` so that nothing
they ask is recorded. They need Playwright (`PW=<its folder>`), run from
the repo's root, print one verdict line (`N checks, M FAIL`) and exit
non-zero on a failure. Pictures and reports go to `.scratch/out/`.

```sh
# the whole gate (types, unit tests, every probe), one line in .scratch/rounds.log
bash worlds/askou/scripts/round.sh "<what changed>" all xr,xr-gaze,sec,ux-a11y,ux-overflow,ux-overflow:390:844:1,ux-overflow:768:1024:1,ux-overflow:360:640:1,ux-overflow:320:568:1,ux-overflow:844:390:1,motion,taglines,framing,framing-talk,starters,bundle,calm,'!crowd'
```

A round takes about twelve minutes. `framing-talk` samples every third bot;
`EVERY=1 node worlds/askou/scripts/framing-talk.mjs` is the full sweep
(about twenty minutes), for before landing.

| Probe | What it checks |
|---|---|
| `qa.mjs [sections]` | a visit end to end: arriving, walking up, asking, links, the list, keys, Askou down, a phone, a hostile reply |
| `xr.mjs`, `xr-gaze.mjs` | a headset (Seiza's emulator): the panel beside the bot, its buttons, a long answer, who a gaze picks |
| `sec.mjs` | the dev forwarder against a stand-in Askou: three calls pass, cookies and credentials do not |
| `ux-a11y.mjs` | keyboard, focus and what a screen reader is told |
| `ux-overflow.mjs [w h touch]`, `ux-names.mjs`, `ux-probe.mjs` | nothing cut or overflowing in any bot's panel, room to read an answer; tap targets, contrast |
| `framing.mjs`, `framing-talk.mjs` | every bot and its name tag in view, on every screen shape (`VIEWS`: first, third, phone, tablet, tabletwide, widephone, small, each also `+talk`), with and without a talk |
| `motion.mjs`, `calm.mjs` | no joint of any figure shakes or snaps; still bots for reduced motion |
| `taglines.mjs`, `starters.mjs`, `crowd.mjs` | every bot has its short line and questions to offer; no bot drawn twice (also after a hot reload), each on the ground under it |
| `bundle.mjs` | the production bundle: no development address, test header or probe hook |
| `fps.mjs`, `tris.mjs`, `look.mjs`, `shot.mjs`, `gallery.mjs` | measuring and looking: frame rate, triangles, pictures |
| `roster-snapshot.mjs <askou>` | rewrites `client/roster.json` from a running Askou's public bot list |

The figure drawings in `client/figures/` were adapted from the
`chatbot-react` project, which carries no licence file: clear their use
with its owner before publishing this world.
