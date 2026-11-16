# ISCOLab

**ISCOLab** is a Seiza world made of a model of the lab: walk its rooms
with others, talk, share screens, and meet, from a browser or a headset.
Like SeiOU, it doesn't use Seiza's built-in rooms: the model is the whole
world (`"environment": "model"` in `world/world.json`; see DOCS.md, "A world
made of its own model").

## What's in it

- **The lab:** the floor plan from `media-src/ISCOLab.glb`, about 32 by
  17 m, with its walls at a storey's height (3.2 m). It's a blockout: plain
  walls and floor, two colors, no ceiling, so the sky shows overhead.
- **A lawn** round it, so it stands somewhere and people can walk round it.
- **Walking** follows a navmesh baked from the model: through the
  doorways, between the rooms, and out onto the lawn.
- **Arrival** is on the lawn, facing the doorway nearest the middle of the
  front wall.
- **The main lab space** (the large room at the back) is set up for a
  session: a screen on the north wall to share to, six tables with two
  chairs each facing it, and a welcome board in English and Japanese. These
  are the room's starting objects (`defaultObjects` in `world/world.json`),
  so editors can move or remove them, and a new room starts with them.
- Everything else Seiza has: voice, chat, screens, boards, avatars,
  gestures, the shared sky and weather, VR and phones.

## Update the model

The original model isn't committed (`worlds/*/media-src/` is ignored). Put
it at `worlds/iscolab/media-src/ISCOLab.glb`, then:

```bash
node worlds/iscolab/scripts/build-lab.mjs
```

It writes `world/models/lab.glb` and `lab.navmesh` (both committed), and
prints the doorways it found, how much of the floor can be walked to from
the arrival point, and the arrival point itself. Copy that into
`spawnPoint` in `world/world.json` if it moved. If part of the floor can't
be reached, a room has no doorway in the model.

The script:

1. Bakes each node's transform into its mesh.
2. Puts the floor at 0 and the plan's centre at the origin, and brings the
   walls down to `WALL_HEIGHT` (the export was at ten times scale, so they
   stood 20 m high).
3. Recomputes normals and makes the walls two-sided: some faces in the
   model are wound the wrong way and came out black. The floor and the
   columns, which have no material in the model, get plain concrete (glTF's
   default material is fully metallic and renders near-black).
4. Adds the lawn (`LAWN_MARGIN` metres round the lab).
5. Bakes the navmesh, finds the front wall's doorways, and checks reach.
6. Joins meshes by material and meshopt-compresses the geometry.

## Run it locally

```bash
VITE_SEIZA_WORLD_ID=iscolab npm run dev   # PowerShell: $env:VITE_SEIZA_WORLD_ID="iscolab"; npm run dev
npm run worker:dev                        # in a second terminal
```

## Deploy

```bash
npx wrangler login
node worlds/iscolab/build.mjs
npx wrangler deploy --config worlds/iscolab/wrangler.jsonc
```

Then, in the Cloudflare dashboard, for the `iscolab` Worker:

1. **Settings > Variables and Secrets:** add `SEIZA_ADMIN_KEY` (or
   `SEIZA_EDITOR_PASSWORD`), and `CLOUDFLARE_TURN_KEY_ID` and
   `CLOUDFLARE_TURN_KEY_API_TOKEN` for voice across networks. Secrets
   belong to one Worker, so set them again here.
2. **Settings > Domains & Routes > Add > Custom domain:**
   `iscolab.seiza.cc`.

To deploy from git instead, create a Worker from the repository with build
command `node worlds/iscolab/build.mjs` and deploy command
`npx wrangler deploy --config worlds/iscolab/wrangler.jsonc`, as in
Seisugbo's README.

It shares the avatar store (`seiza-avatars`) with the other worlds; to keep
it apart, give it its own namespace id in `wrangler.jsonc` and remove step
3 of `build.mjs`.

## Files

```
worlds/iscolab/
  build.mjs              Builds the deployment into dist/
  wrangler.jsonc         ISCOLab's own Worker
  favicon.svg            ISCOLab's tab icon
  scripts/build-lab.mjs  Prepares the model and bakes the navmesh
  world/world.json       The world's settings
  world/models/          lab.glb and lab.navmesh (committed)
  media-src/             The original model (not committed)
```
