// Where every bot stands: the village is drawn as a constellation around the spot where visitors arrive.
// The general bot (Iska and iskOU) greets them; the bots that hang straight under it and lead no others stand in a
// ring around the arrival spot; every bot that leads others (a faculty and its programmes, a vice chancellor's office
// and its offices) is the centre of its own cluster further out, its bots ringed around it.
// Pure geometry from the bot list: a bot added in Askou gets a place without a change here.

export interface BotRow { key: string; name: string; kind: string; parentKey: string | null }

export interface Post {
  key: string
  x: number
  z: number
  /** The bot this one is tied to in the constellation; null for the general bot. */
  parent: string | null
  /** 0 = the general bot, 1 = tied to it, 2 = a member of a cluster. */
  level: 0 | 1 | 2
}

/** How large a bot's light and name tag are drawn: the general bot largest, then a bot others are tied to (`lead`). */
export const bigOf = (p: Post, lead: boolean) => (p.level === 0 ? 1.5 : lead ? 1.25 : 1)
/** How wide a bot's name tag stands over it, metres, to a visitor beside it (Constellation's labels). */
export const tagWide = (p: Post, lead: boolean) => 1.5 * bigOf(p, lead)

/** Where visitors arrive (world.json `spawnPoint`), looking along +x. */
export const HUB = { x: 66, z: 0 }
export const ROOT = 'upou'
/** No two bots stand closer than this (a figure with what it holds is about 1.6 m wide). */
export const MIN_GAP = 2.6

const TAU = Math.PI * 2
/** Half of the opening kept free ahead of the arrival spot: the avenue to the Main Building. */
const FRONT = 0.49
/** The bots asked most stand right ahead, either side of the avenue. */
const AHEAD = ['admissions', 'registration', 'whatsnew', 'news']
const KINDS = ['faculty', 'office', 'programme', 'project']

const byOrder = (a: BotRow, b: BotRow) => (KINDS.indexOf(a.kind) + 9) % 9 - (KINDS.indexOf(b.kind) + 9) % 9 || a.key.localeCompare(b.key)

/** The rings a cluster's `n` members stand on (radius, count): one ring, or two when it would get crowded. */
export function rings(n: number): [number, number][] {
  const r = (count: number, least: number) => Math.max(least, count * 3.5 / TAU)
  if (n <= 12) return n ? [[r(n, 4.2), n]] : []
  const inner = Math.round(n * 0.4), r1 = r(inner, 4.2)
  return [[r1, inner], [r(n - inner, r1 + 3.6), n - inner]]
}

export function layoutVillage(bots: BotRow[]): Post[] {
  const known = new Map(bots.map(b => [b.key, b]))
  // The bot right under the general bot that `b` hangs under (itself when it is one). An unknown parent ends the walk;
  // a bot caught in a loop of parents stands for itself.
  const topOf = (b: BotRow) => {
    const seen = new Set([b.key])
    let c = b
    while (c.parentKey && c.parentKey !== ROOT) {
      const p = known.get(c.parentKey)
      if (!p) break
      if (seen.has(p.key)) return b
      seen.add(p.key); c = p
    }
    return c
  }
  const members = new Map<string, BotRow[]>()
  const tops: BotRow[] = []
  for (const b of [...bots].sort(byOrder)) {
    if (b.key === ROOT) continue
    const top = topOf(b)
    if (top === b) tops.push(b)
    else members.set(top.key, [...(members.get(top.key) ?? []), b])
  }
  const centres = tops.filter(t => members.has(t.key))
  const loose = tops.filter(t => !members.has(t.key)).sort((a, b) => (AHEAD.indexOf(a.key) + 99) % 99 - (AHEAD.indexOf(b.key) + 99) % 99 || byOrder(a, b))

  const posts: Post[] = [{ key: ROOT, x: HUB.x + 6, z: HUB.z, parent: null, level: 0 }]

  // The ring around the arrival spot: slots either side of straight ahead, filled from the front to the back.
  const looseR = loose.length ? Math.max(11, loose.length * 5 / TAU) : 0
  loose.forEach((b, i) => {
    const a = (Math.floor(i / 2) + 0.5) * TAU / loose.length * (i % 2 ? -1 : 1)
    posts.push({ key: b.key, x: HUB.x + looseR * Math.cos(a), z: HUB.z + looseR * Math.sin(a), parent: ROOT, level: 1 })
  })

  // The clusters: each gets a share of the circle (minus the avenue) in proportion to its width.
  const reach = centres.map(c => Math.max(0, ...rings(members.get(c.key)!.length).map(([r]) => r)) + 2.5)
  const arcs = reach.map(r => 2 * r + 3), total = arcs.reduce((a, b) => a + b, 0)
  const open = TAU - 2 * FRONT
  const R = Math.max(26, total / open, looseR + 4.5 + Math.max(0, ...reach))
  let at = FRONT
  centres.forEach((c, i) => {
    const span = open * arcs[i] / total, a = at + span / 2
    at += span
    const cx = HUB.x + R * Math.cos(a), cz = HUB.z + R * Math.sin(a)
    posts.push({ key: c.key, x: cx, z: cz, parent: ROOT, level: 1 })
    let k = 0
    const list = members.get(c.key)!
    rings(list.length).forEach(([r, count], ring) => {
      for (let j = 0; j < count; j++, k++) {
        const t = a + (j + ring * 0.5) * TAU / count // the outer ring stands in the gaps of the inner one
        posts.push({ key: list[k].key, x: cx + r * Math.cos(t), z: cz + r * Math.sin(t), parent: c.key, level: 2 })
      }
    })
  })
  return posts
}
