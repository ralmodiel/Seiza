// The 3D figure of every bot character: ONE table, key -> family (palette), silhouette, prop, accent, hat.
// Pure data (no three.js): the gallery tiles, the initials fallback and the lazy 3D chunk (components/figures3d.ts) all read it.
import botItems from './botItems.json'

export type Family = 'upou' | 'fed' | 'fics' | 'fmds' | 'office' | 'project'
/** Silhouette: general = sash; faculty = larger, mortarboard; programme = student (power pack, sensor fin); office = ID lanyard. */
export type Shape = 'general' | 'faculty' | 'programme' | 'office'
/** Head silhouette: dealt out along the table, so neighbours differ and no form is more than one bot in eight. None is a box. */
export const HEADS = ['sphere', 'wedge', 'capsule', 'hex', 'dome', 'saucer', 'drum', 'drop'] as const
export type Head = (typeof HEADS)[number]
/** Body build of the programme and office bots, dealt like the heads: V-shaped on legs, a drum on short legs,
 *  three slim segments on long legs, a pod on a thruster. */
export const BUILDS = ['taper', 'barrel', 'slim', 'hover'] as const
export type Build = (typeof BUILDS)[number]
/** Head gear, all hard-surface: fin = sensor fin, mortar = the faculty's square plate, ring = a doctor's gold loop
 *  aerial, beacon = medic light bar, disc = tilted disc sensor (the arts), hardhat, headphones. */
export type Hat = 'none' | 'fin' | 'mortar' | 'ring' | 'beacon' | 'disc' | 'hardhat' | 'headphones'

export const PROPS = [
  'chat', 'book', 'laptop', 'briefcase', 'palette', 'blueprint', 'apple', 'wifi', 'flask', 'pi', 'letters', 'globe', 'dish',
  'quill', 'hourglass', 'chalkboard', 'brush', 'chip', 'clapper', 'brackets', 'megaphone', 'database', 'microphone', 'shop',
  'ringglobe', 'compass', 'leaf', 'sapling', 'cross', 'stethoscope', 'house', 'mappin', 'plots', 'gear', 'bulb', 'hearthands',
  'umbrella', 'venus', 'heartbeat', 'clipboard', 'storm', 'columns', 'turbine', 'crest', 'scroll', 'key', 'document',
  'bookstack', 'lifebuoy', 'screen', 'calculator', 'coin', 'people', 'box', 'cone', 'pie', 'scales', 'newspaper', 'wrench',
  'equal', 'heart', 'checkshield', 'star', 'balloon',
  'stamp', 'idcard', 'folder', 'gradcap', 'thermometer', 'firstaid', 'ereader', 'catalog', 'magnifier', 'pencil', 'ruler', 'atom', 'microscope', 'camera', 'headset',
  'chart', 'calendar', 'envelope', 'receipt', 'banknote', 'toolbox', 'cloud', 'waterdrop', 'solar', 'ribbon', 'tag', 'backpack', 'map', 'signpost',
] as const
export type Prop = (typeof PROPS)[number]

export const ACCENTS = {
  gold: '#f6b90f', coral: '#ff7a59', sky: '#62c6ff', lime: '#a4dc4c', pink: '#ff8fb5', mint: '#2fd0b0', lilac: '#b9a2ff', cream: '#fff0c9',
} as const
export type Accent = keyof typeof ACCENTS

/** Body shades per family, named after car paints (deep metallics and pearls; the figures' material lacquers them); all dark enough for white initials (AA, tested). */
export const FAMILIES: Record<Family, { label: string; shades: string[] }> = {
  upou: { label: 'UPOU maroon', shades: ['#8a1538'] },
  fed: { label: 'FEd amber', shades: ['#9a4f1c', '#7c5a26', '#8f3d22', '#6e4630'] }, // candy copper, champagne bronze, sienna, mocha
  fics: { label: 'FICS blue', shades: ['#16386a', '#1f4f8f', '#0f5a7a', '#2f3f8a'] }, // midnight, sapphire, petrol, ultramarine
  fmds: { label: 'FMDS green', shades: ['#0f4d3a', '#0e5a5c', '#4a6230', '#2a6a4a'] }, // British racing green, deep teal, moss, emerald
  office: { label: 'Offices violet', shades: ['#45327a', '#5d4d92', '#6f3a7c', '#3f3873'] }, // royal amethyst, violet pearl, plum, gunmetal violet
  project: { label: 'Projects magenta', shades: ['#8c1f4a', '#a13a5c', '#7d2a6a', '#6e2440'] }, // candy raspberry, rose, mulberry, black cherry
}

/** The robot's styling: fem = a swept helmet shell (a bob or an up-do), lash ticks on the LED eyes; masc = a cropped
 *  brow crest, bar eyes; neutral = none of these. The first design has one, the second its counterpart, the backups are neutral. */
export type Look = 'fem' | 'masc' | 'neutral'
/** no = the unit number on its chest display or name plate (1..99). */
/** trim = the colour of the dark parts (sensor fin, thruster nozzle) when it is not a darker body colour. */
export interface FigureSpec { family: Family; shape: Shape; prop: Prop; accent: Accent; hat: Hat; head: Head; build: Build; body: string; no: number; nick?: string; trim?: string; look: Look; /** which variant of the look's styling (fem: 0 bob, 1 up-do, 2 the chancellor's; neutral: 0-2) */ vary: number }

/** nick = the bot's own name: the speaker in its chat bubbles and the big label of its tile. */
type Row = [nick: string, prop: Prop, accent: Accent, hat?: Hat]
/** `later`: bots added after the first deal; they are dealt after the whole table, so no earlier bot's head, build or unit number moves. */
const TABLE: Record<Family, { shape: Shape; later?: boolean; rows: Record<string, Row> }[]> = {
  upou: [{ shape: 'general', rows: { upou: ['Iska & iskOU', 'chat', 'gold'] } }],
  fed: [
    { shape: 'faculty', rows: { fed: ['Guro Guru', 'book', 'cream'] } },
    { shape: 'programme', rows: {
      fedaa: ['Arte Smarty', 'palette', 'sky', 'disc'],           // Associate in Arts
      fedasidt: ['Module Mogul', 'blueprint', 'mint'],              // Instructional Design and Technology
      fedbes: ['Aral Ace', 'apple', 'lime'],                    // Education Studies
      fedgcde: ['Miles Online', 'wifi', 'sky'],                     // Distance Education (certificate)
      feddst: ['Lab Lodi', 'flask', 'mint'],                    // Science Teaching
      feddmt: ['Pi-noy Whiz', 'pi', 'cream'],                      // Mathematics Teaching
      feddlle: ['ABaKaDabra', 'letters', 'pink'],                 // Language and Literacy Education (diploma)
      feddsse: ['Mapa Maven', 'globe', 'lime'],                   // Social Studies Education (diploma)
      fedmde: ['Signal Sensei', 'dish', 'lilac'],                    // Distance Education (master)
      fedmalle: ['Makata Maestro', 'quill', 'cream'],                 // Language and Literacy Education (master)
      fedmasse: ['Kasaysayan Sage', 'hourglass', 'sky'],               // Social Studies Education (master)
      fedphd: ['Doc Dunong', 'chalkboard', 'pink', 'ring'],        // PhD in Education
    } },
  ],
  fics: [
    { shape: 'faculty', rows: { fics: ['Byte Bayani', 'laptop', 'gold'] } },
    { shape: 'programme', rows: {
      ficsaadda: ['Pixel Pintor', 'brush', 'coral', 'disc'],       // Digital Design and Arts
      ficsasit: ['Sir Kit', 'chip', 'lime'],                   // Information Technology
      ficsbams: ['Direk Reel', 'clapper', 'gold', 'headphones'],  // Multimedia Studies
      ficsdcs: ['Algo Rhythm', 'brackets', 'mint'],                // Computer Science
      ficsmdc: ['DevCom Dynamo', 'megaphone', 'coral'],              // Development Communication
      ficsmis: ['Table Turner', 'database', 'cream'],               // Information Systems
      ficsdcomm: ['Dr. Dialogue', 'microphone', 'pink', 'ring'],     // Doctor of Communication
    } },
  ],
  fmds: [
    { shape: 'faculty', rows: { fmds: ['Plano Pro', 'briefcase', 'gold'] } },
    { shape: 'programme', rows: {
      fmdsaade: ['Negosyo Ninja', 'shop', 'coral'],                  // Digital Entrepreneurship
      fmdsgcas: ['ASEAN Ace', 'ringglobe', 'gold'],              // ASEAN Studies (certificate)
      fmdsdenrm: ['Leaf Chief', 'leaf', 'cream'],                 // Environment and Natural Resources (diploma)
      fmdsdih: ['Well Traveller', 'cross', 'sky'],                    // International Health (diploma)
      fmdsdlvm: ['Lot Whisperer', 'house', 'coral'],                 // Land Valuation (diploma)
      fmdsdrdm: ['Gear Genius', 'gear', 'lilac'],                  // R&D Management (diploma)
      fmdsdlup: ['Zoning Zen', 'plots', 'gold'],                  // Land Use Planning
      fmdsdsw: ['Kapwa Champ', 'hearthands', 'pink'],              // Social Work (diploma)
      fmdsdwd: ['Dev Diwata', 'venus', 'lilac'],                  // Women and Development
      fmdsman: ['Nars Nurture', 'heartbeat', 'pink', 'beacon'],      // Nursing
      fmdsmas: ['Kompas Kasama', 'compass', 'cream'],                // ASEAN Studies (master)
      fmdsmcdr: ['Bagyo Buster', 'storm', 'sky'],                   // Climate and Disaster Resilience
      fmdsmenrm: ['Punong Guru', 'sapling', 'gold'],               // Environment and Natural Resources (master)
      fmdsmih: ["Steth O'Scope", 'stethoscope', 'cream'],            // International Health (master)
      fmdsmlvm: ['Pin Pointer', 'mappin', 'coral'],                // Land Valuation (master)
      fmdsmne: ['Chart Smart', 'clipboard', 'sky', 'beacon'],       // Nursing Education
      fmdsmrdm: ['Eureka Engine', 'bulb', 'gold'],                   // R&D Management (master)
      fmdsmpm: ['Haligi Hero', 'columns', 'cream'],                // Public Management
      fmdsmsw: ['Payong Kaibigan', 'umbrella', 'coral'],               // Social Work (master)
      fmdsdsus: ['Doc Evergreen', 'turbine', 'lime', 'ring'],         // Sustainability (doctor)
    } },
  ],
  office: [{ shape: 'office', rows: {
    oc: ['Pinuno Uno', 'crest', 'gold'],                          // Chancellor
    ovcaa: ['Acad Ally', 'scroll', 'cream'],                     // Academic Affairs
    ovcfa: ['Master Key', 'key', 'gold'],                         // Finance and Administration
    registrar: ['Reggie Strar', 'document', 'coral'],
    ulibrary: ['Page Turner', 'bookstack', 'mint'],
    osa: ['Buddy Buoy', 'lifebuoy', 'coral'],                     // Student Affairs
    codtl: ['Digi Turo', 'screen', 'sky'],                       // Open and Digital Teaching and Learning
    accounting: ['Ledger Legend', 'calculator', 'lime'],
    cash: ['Sukli Star', 'coin', 'gold'],
    hrdo: ['People Person', 'people', 'sky'],
    spmo: ['Kahon Keeper', 'box', 'cream'],                         // Supply and Property
    cdmo: ['Campus Kumpuni', 'cone', 'coral', 'hardhat'],             // Campus Development and Maintenance
    budget: ['Pie Planner', 'pie', 'mint'],
    legal: ['Legal Eagle', 'scales', 'gold'],
    opa: ['Scoop Scout', 'newspaper', 'cream'],                    // Public Affairs
    ictdo: ['Ctrl Alt Ayos', 'wrench', 'lime'],
    ogc: ['Patas Pal', 'equal', 'pink'],                         // Gender Concerns
    pahinungod: ['Heart Worker', 'heart', 'coral'],                 // volunteer service
    qao: ['Check Mate', 'checkshield', 'mint'],                   // Quality Assurance
  } }, { shape: 'office', later: true, rows: {
    alumni: ['Batch Buddy', 'gradcap', 'gold'],                    // Alumni Relations (an admin-created bot under opa)
  } }],
  // UPOU projects (kind 'project'): drawn as service units (the office silhouette) in their own colour; props are reused
  project: [{ shape: 'office', rows: {
    moocs: ['MOOCho Gusto', 'wifi', 'sky', 'headphones'],          // massive open online courses (MODeL)
    networks: ['Play Listo', 'clapper', 'coral', 'disc'],          // UPOU Open Educational Resources: OER videos and publications
    sdg: ['Goal Getter', 'ringglobe', 'lime'],                     // SDG Initiatives
    cep: ['Kurso Curioso', 'bulb', 'gold', 'fin'],                 // Continuing Education Program
    conferences: ['Plenary Pal', 'microphone', 'cream'],           // UPOU Conferences
    ijodel: ['Cita Cion', 'newspaper', 'mint'],                    // IJODeL, the journal
    repository: ['Archie Vault', 'box', 'sky'],                    // UPOU Repository: theses and other scholarly work
    news: ['Ano Bago', 'megaphone', 'lilac', 'fin'],               // News and Announcements ("ano'ng bago?" = what's new?)
    admissions: ['Addie Mission', 'clipboard', 'gold'],            // Admissions Guide
    registration: ['Enzo Rollment', 'checkshield', 'sky', 'fin'],  // Registration Guide
    webadmin: ['Webb', 'screen', 'lilac'],                         // Webb Master: feedback on the UPOU sites and on the other bots
  } }],
}

/** The 4 items of every bot of the table, each from its own office's or programme's field: its own item first (the Row's prop),
 *  then 3 more. An admin picks one (bots.held); it is combined with whichever design is chosen. Generated: scripts/kb/bot_items.py. */
const ITEMS = botItems as unknown as Record<string, Prop[]>
/** Backups of a bot the table does not list, by kind; its own item (a star or a balloon) is left out, the first 3 of the rest are offered. */
const SPARE: Record<Shape, Prop[]> = {
  general: ['globe', 'book', 'star', 'bulb'], faculty: ['book', 'chalkboard', 'bookstack', 'bulb'],
  programme: ['book', 'laptop', 'bulb', 'globe'], office: ['clipboard', 'document', 'people', 'key'],
}
const LABELS: Partial<Record<Prop, string>> = {
  chat: 'Chat bubble', pi: 'Pi sign', dish: 'Satellite dish', chip: 'Microchip', clapper: 'Clapperboard', brackets: 'Code brackets',
  ringglobe: 'Ringed globe', cross: 'Medical cross', mappin: 'Map pin', plots: 'Land plots', bulb: 'Light bulb', hearthands: 'Heart in hands',
  venus: 'Venus sign', storm: 'Storm cloud', turbine: 'Wind turbine', bookstack: 'Stack of books', cone: 'Traffic cone', pie: 'Pie chart',
  equal: 'Equals sign', checkshield: 'Shield with a tick', shop: 'Shop front', people: 'People', scales: 'Scales of justice',
  stamp: 'Rubber stamp', idcard: 'ID card', folder: 'Records folder', gradcap: 'Graduation cap', firstaid: 'First-aid kit', ereader: 'E-reader', catalog: 'Catalogue cards',
  magnifier: 'Magnifying glass', ruler: 'Set square', chart: 'Bar chart', banknote: 'Banknotes', cloud: 'Cloud upload', waterdrop: 'Water drop', solar: 'Solar panel',
  ribbon: 'Award ribbon', tag: 'Price tag', map: 'Folded map',
}
/** A plain name for an item, e.g. "Stack of books". */
export const propLabel = (p: Prop): string => LABELS[p] ?? p[0].toUpperCase() + p.slice(1)

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
/** Looks that are not dealt: the chancellor (a lady), the pair (Iska stands in front) and the nicks that are plainly a woman's or a man's name. */
const NAMED: Record<string, Look> = { oc: 'fem', upou: 'fem', fmdsdwd: 'fem' /* Diwata */, ijodel: 'fem' /* Cita */, ficsasit: 'masc' /* Sir */, fedgcde: 'masc' /* Miles */, registrar: 'masc' /* Reggie */, repository: 'masc' /* Archie */, admissions: 'fem' /* Addie */, registration: 'masc' /* Enzo */, webadmin: 'masc' /* Webb */ }
/** The look of a bot's first design: named, or dealt by hash(key), about half each (tested); a bot added later gets one the same way. */
const styleOf = (key: string): Pick<FigureSpec, 'look' | 'vary'> => {
  const h = hash(key + '/look'), look = NAMED[key] ?? (h & 1 ? 'fem' : 'masc')
  return { look, vary: key === 'oc' ? 2 : (h >>> 1) % 2 }
}

/** The face drawn on a figure's screen (components/figures3d faceRig), dealt by a hash of the design so that neighbours differ:
 *  eye = the outline of the eyes (visor = one lens band with both eyes in it), mouth = the family of mouth shapes, seed = when it blinks. */
export const EYES = ['round', 'oval', 'square', 'visor'] as const
export const MOUTHS = ['smile', 'beam', 'cat', 'bar'] as const
export interface FaceStyle { eye: (typeof EYES)[number]; mouth: (typeof MOUTHS)[number]; seed: number }
export function faceOf(f: Pick<FigureSpec, 'no' | 'head' | 'build' | 'look' | 'shape'>): FaceStyle {
  const h = hash(`${f.no}/${f.head}/${f.build}/${f.look}/face`)
  // behind the professor's round glasses the eyes are round or oval; a visor band only lies well on a flat front
  return { eye: EYES[f.shape === 'faculty' ? h % 2 : f.head === 'hex' || f.head === 'wedge' ? h % EYES.length : h % 3], mouth: MOUTHS[(h >>> 4) % 3], seed: h } // the village deals smiles only: face to face, the 'bar' speaker slot read as a grimace, and as a shout when open
}
/** How far the eyelids are open (1 … 0 shut) at second u: one blink of 0.18 s somewhere in every stretch of 2.9 to 4.9 s
 *  (the length by seed, the moment by a hash of seed and stretch), now and then a second one right after it. No two bots blink in step. */
export function blink(u: number, seed: number): number {
  const P = 2.9 + seed % 21 / 10, k = Math.floor(u / P)
  let r = Math.imul(seed ^ Math.imul(k + 1, 0x9e3779b1), 0x85ebca6b); r = (r ^ r >>> 13) >>> 0
  const b = u - k * P - 0.2 - r % 1000 / 1000 * (P - 0.9), one = (x: number) => x > 0 && x < 0.18 ? Math.abs(Math.cos(x / 0.18 * Math.PI)) : 1
  return Math.min(one(b), (r >>> 10) % 4 ? 1 : one(b - 0.3))
}

const KNOWN = new Map<string, FigureSpec>()
let dealt = 0
const shade: Partial<Record<Family, number>> = {}
for (const late of [false, true]) for (const family of Object.keys(TABLE) as Family[]) {
  for (const { shape, rows, later } of TABLE[family]) if (!!later === late) for (const [key, [nick, prop, accent, hat]] of Object.entries(rows)) {
    const shades = FAMILIES[family].shades, i = shade[family] = (shade[family] ?? -1) + 1
    KNOWN.set(key, { nick, no: dealt + 1, family, shape, prop, accent, hat: hat ?? (shape === 'faculty' ? 'mortar' : shape === 'office' ? 'none' : 'fin'), head: key === 'oc' ? 'drop' /* the chancellor: the swept-up head carries her up-do */ : HEADS[(dealt * 3 + 2 * (dealt >> 4)) % HEADS.length], build: BUILDS[(dealt + (dealt++ >> 2)) % BUILDS.length], body: shades[i % shades.length], ...styleOf(key) })
  }
}
export const KNOWN_KEYS = [...KNOWN.keys()]

const GENERIC: Prop[] = ['star', 'balloon']
const SHAPES: Shape[] = ['faculty', 'programme', 'office']

/** The first (built-in) design of a character. A key the table does not list (a bot added later) still gets one: family
 *  from its parent or kind, then hash(key) picks the shade, the accent and a generic prop. */
function firstFigure(key: string, kind?: string | null, parentKey?: string | null): FigureSpec {
  const known = KNOWN.get(key)
  if (known) return known
  const h = hash(key)
  const shape = SHAPES.find(s => s === kind) ?? 'programme'
  const parent = parentKey ? KNOWN.get(parentKey) : undefined
  const family: Family = shape === 'office' ? 'office' : parent && parent.family !== 'upou' ? parent.family : (['fed', 'fics', 'fmds', 'office'] as const)[h % 4]
  const shades = FAMILIES[family].shades, accents = Object.keys(ACCENTS) as Accent[]
  return { family, shape, no: h % 99 + 1, prop: GENERIC[(h >>> 8) % GENERIC.length], accent: accents[(h >>> 4) % accents.length],
    hat: shape === 'faculty' ? 'mortar' : shape === 'office' ? 'none' : 'fin', head: HEADS[(h >>> 16) % HEADS.length], build: BUILDS[(h >>> 20) % BUILDS.length], body: shades[(h >>> 12) % shades.length], ...styleOf(key) }
}

/** What an admin can let a bot hold: 4 items of its field, its own first. */
export function heldChoices(key: string, kind?: string | null, parentKey?: string | null): Prop[] {
  const first = firstFigure(key, kind, parentKey)
  return ITEMS[key] ?? [first.prop, ...SPARE[first.shape].filter(p => p !== first.prop).slice(0, 3)]
}

const ALT_BUILD: Record<Build, Build> = { taper: 'hover', hover: 'taper', barrel: 'slim', slim: 'barrel' } // legs <-> thruster, drum <-> segments
const ALT_HATS: Hat[] = ['headphones', 'disc', 'ring', 'none', 'fin']
/** The second design of a bot, derived from its first: the same family colours, accent, prop, number and name on another
 *  silhouette (another head, another body, other head gear) with the counterpart look (fem <-> masc). The general bot's pair becomes one robot in UPOU maroon, green and gold. */
function altOf(key: string, f: FigureSpec): FigureSpec {
  const look: Look = f.look === 'fem' ? 'masc' : 'fem' // the pair counts as fem (Iska leads), so its single robot is masc
  if (f.shape === 'general') return { ...f, look, vary: 0, shape: 'office', head: 'capsule', build: 'hover', hat: 'fin', trim: '#00573f' }
  const h = hash(key + '/alt'), head = HEADS[(HEADS.indexOf(f.head) + 1 + h % 7) % HEADS.length]
  const bare = f.hat === 'none' || (f.head === 'drop' && f.hat === 'fin') // a pointed head wears no fin (figures3d)
  const hats = ALT_HATS.filter(x => x !== f.hat && !(bare && x === 'none') && !(head === 'drop' && x === 'fin'))
  return { ...f, shape: f.shape === 'programme' ? 'office' : 'programme', head, build: ALT_BUILD[f.build], hat: hats[(h >>> 3) % hats.length], look, vary: (h >>> 7) % 2 }
}

// The 30 backup designs: [head, body, head gear, prop, accent, family, shade]. 'broad' = the wide-shouldered body on a thruster.
type Body = Build | 'broad'
const BODY: Record<Body, string> = { broad: 'broad shoulders, hover base', taper: 'tapered body, legs', barrel: 'barrel body, short legs', slim: 'slim body, long legs', hover: 'pod body, hover base' }
const P: [Head, Shape, Body, Hat, Prop, Accent, Family, number][] = [
  ['sphere', 'programme', 'taper', 'none', 'star', 'coral', 'fed', 0],
  ['hex', 'office', 'barrel', 'ring', 'balloon', 'pink', 'fmds', 0],
  ['drum', 'faculty', 'broad', 'none', 'chat', 'cream', 'project', 0],
  ['wedge', 'programme', 'slim', 'headphones', 'bulb', 'sky', 'fics', 1],
  ['dome', 'office', 'hover', 'disc', 'gear', 'mint', 'office', 1],
  ['drop', 'programme', 'barrel', 'disc', 'globe', 'gold', 'fed', 2],
  ['capsule', 'office', 'taper', 'headphones', 'compass', 'lime', 'fmds', 2],
  ['saucer', 'programme', 'hover', 'ring', 'key', 'lilac', 'project', 2],
  ['sphere', 'office', 'slim', 'fin', 'heart', 'coral', 'fics', 3],
  ['hex', 'programme', 'taper', 'none', 'screen', 'pink', 'office', 3],
  ['drum', 'office', 'barrel', 'ring', 'chip', 'cream', 'upou', 0],
  ['wedge', 'faculty', 'broad', 'headphones', 'wifi', 'sky', 'fics', 0],
  ['dome', 'programme', 'slim', 'headphones', 'checkshield', 'mint', 'office', 0],
  ['drop', 'office', 'hover', 'disc', 'lifebuoy', 'gold', 'fed', 1],
  ['capsule', 'programme', 'barrel', 'disc', 'box', 'lime', 'fmds', 1],
  ['saucer', 'office', 'taper', 'headphones', 'megaphone', 'lilac', 'project', 1],
  ['sphere', 'programme', 'hover', 'ring', 'book', 'coral', 'fics', 2],
  ['hex', 'office', 'slim', 'fin', 'laptop', 'pink', 'office', 2],
  ['drum', 'programme', 'taper', 'none', 'clipboard', 'cream', 'fed', 3],
  ['wedge', 'office', 'barrel', 'ring', 'document', 'sky', 'fmds', 3],
  ['dome', 'faculty', 'broad', 'fin', 'scroll', 'mint', 'project', 3],
  ['drop', 'programme', 'slim', 'headphones', 'bookstack', 'gold', 'fed', 0],
  ['capsule', 'office', 'hover', 'disc', 'people', 'lime', 'fmds', 0],
  ['saucer', 'programme', 'barrel', 'disc', 'hourglass', 'lilac', 'project', 0],
  ['sphere', 'office', 'taper', 'headphones', 'brackets', 'coral', 'fics', 1],
  ['hex', 'programme', 'hover', 'ring', 'database', 'pink', 'office', 1],
  ['drum', 'office', 'slim', 'fin', 'ringglobe', 'cream', 'fed', 2],
  ['wedge', 'programme', 'taper', 'none', 'newspaper', 'sky', 'fmds', 2],
  ['dome', 'office', 'barrel', 'ring', 'wrench', 'mint', 'project', 2],
  ['drop', 'faculty', 'broad', 'disc', 'crest', 'gold', 'fics', 3],
]
export const PRESETS: { id: string; label: string; spec: FigureSpec }[] = P.map(([head, shape, body, hat, prop, accent, family, shade], i) => ({
  id: `preset-${String(i + 1).padStart(2, '0')}`, label: `Preset ${i + 1} · ${head} head, ${BODY[body]}, neutral look`,
  spec: { family, shape, prop, accent, hat, head, build: body === 'broad' ? 'hover' : body, body: FAMILIES[family].shades[shade], no: i + 1, look: 'neutral', vary: hash(`preset-${i}`) % 3 }, // neutral trim, dealt by hash
}))

/** The figure of a character. `figure` = what an admin chose for the bot (the bots table): empty = its first design,
 *  'alt' = its second, 'preset-01'..'preset-30' = a backup design, which keeps the bot's own name, unit number and what it holds
 *  (the item of its office or programme, unless `held` names another). */
export function figureFor(key: string, kind?: string | null, parentKey?: string | null, figure?: string | null, held?: string | null): FigureSpec {
  const first = firstFigure(key, kind, parentKey)
  const preset = PRESETS.find(p => p.id === figure)
  const f = figure === 'alt' ? altOf(key, first) : preset ? { ...preset.spec, no: first.no, nick: first.nick, prop: first.prop } : first
  // `held` = the item an admin chose instead (bots.held), on any design; the general bot's pair holds nothing (their chat bubble stays)
  return holdsItem(f) && (PROPS as readonly string[]).includes(held ?? '') ? { ...f, prop: held as Prop } : f
}
/** Whether the figure has a hand item an admin can choose (all but the general bot's first design, the Iska & iskOU pair). */
export const holdsItem = (f: FigureSpec) => f.shape !== 'general'

/** Badge text when the 3D figures cannot be drawn: the capitals of the name, at most four ("Diploma in Science Teaching" -> "DST"). */
export function initials(name: string): string {
  const first = name.split(' ')[0]
  if (/^[A-Z]{2,4}$/.test(first)) return first // already an acronym
  const caps = name.split(/[\s–-]+/).filter(w => /^[A-ZÀ-Ý]/.test(w)).map(w => w[0]).join('')
  return (caps || name.slice(0, 2).toUpperCase()).slice(0, 4)
}
