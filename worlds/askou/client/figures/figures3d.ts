// The animated 3D figures of the bot gallery (lazy chunk: the only importer of three.js on the chat page).
// ONE WebGL canvas lies over the scrolling tile grid; each visible tile is drawn into its own scissor rectangle.
// A figure = a robot body (4 builds, 8 head forms, 7 kinds of head gear) presenting the prop of its topic (lib/figures.ts).
import * as THREE from 'three'
import { ACCENTS, blink, faceOf, figureFor, type FaceStyle, type FigureSpec, type Hat, type Head, type Look, type Prop } from './figures'
import {
  Geo, G, GLOW, shade, finish, initKit, piv, hinge, bolt, disposeKit, dropFigure, sph, sphHi, box, cyl, cone, pyr, dome, tor, frus, wedge, lathe, ext, rr, poly,
  heartShape, starShape, gearShape, leafShape, shieldShape, mix, ease, type V3,
} from './figureKit'

export { figureFor, initials } from './figures'

/** u = seconds (offset per figure), e = 0..1 how excited the figure is (pointer or focus on its tile). */
/** m = how much the bot is, 0..1 each: [watching the user type, thinking about a reply, pleased with its answer, at a loss]. */
type Tick = (u: number, e: number, m?: number[]) => void
const MOODS = ['typing', 'thinking', 'happy', 'miss', 'dance']
type Part = Geo | THREE.Object3D
const W = '#ffffff', K = '#2b2530', RED = '#e5484d', GRN = '#3fae5a', BRN = '#9a6a3a', GREY = '#aab2bb', BLU = '#3b82c4',
  GOLD = '#f6b90f', CREAM = '#fff0c9', GLASS = '#dff3fb', SKIN = '#f3c9a5', BOARD = '#2f5d46', MAROON = '#8a1538'
const PI = Math.PI, H = PI / 2, TAU = PI * 2
const N = () => new Geo()
/** A disc facing the camera. */
const disc = (g: Geo, hex: string, r: number, x = 0, y = 0, z = 0, d = 0.06) => g.add(cyl, hex, { p: [x, y, z], r: [H, 0, 0], s: [r, d, r] })
/** A polyline of bars in the plane z. */
const line = (g: Geo, hex: string, pts: [number, number][], z = 0.05, w = 0.05, d = 0.03) => {
  for (let i = 1; i < pts.length; i++) g.stroke(hex, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], z, w, d)
  return g
}
const pulse = (o: THREE.Object3D, on: (f: Tick) => void, k = 0.08, w = 4) => { on(u => o.scale.setScalar(1 + k * Math.max(0, Math.sin(u * w)))); return o }
/** A ball with patches of land. */
const planet = (r: number) => {
  const g = N().add(sphHi, BLU, { s: r })
  for (const [la, lo, k] of [[0.5, 0.3, 1], [0.1, 0.9, 0.8], [-0.4, 0.5, 0.7], [0.4, 2.6, 1.1], [-0.2, 3.4, 0.9], [0.7, 4.6, 0.7], [-0.5, 5.3, 0.8], [0.0, 1.9, 0.6]])
    g.add(sph, GRN, { p: [Math.cos(la) * Math.sin(lo) * r * 0.8, Math.sin(la) * r * 0.8, Math.cos(la) * Math.cos(lo) * r * 0.8], s: r * 0.33 * k })
  return g
}
/** `part` turning about the axis y tilted by `tilt`. */
const spun = (part: Part, on: (f: Tick) => void, tilt: V3, w: number) => {
  const inner = G(part)
  on(u => { inner.rotation.y = u * w })
  return piv(inner, [0, 0, 0], tilt)
}

// Every prop is authored in a box of about ±0.5 around its own centre, facing +z.
const PROP: Record<Prop, (a: string, on: (f: Tick) => void) => Part> = {
  chat: (a, on) => {
    const dots = [-0.24, 0, 0.24].map(x => piv(N().add(sph, a, { s: 0.085 }), [x, 0.08, 0.1]))
    on(u => dots.forEach((d, i) => { d.position.y = 0.08 + Math.max(0, Math.sin(u * 5 - i * 0.9)) * 0.1 }))
    return G(N().add(rr(0.98, 0.66, 0.22, 0.16), W, { p: [0, 0.08, 0] }).add(pyr, W, { p: [-0.2, -0.3, 0], r: [0, 0, PI + 0.5], s: [0.14, 0.26, 0.08] }), ...dots)
  },
  book: a => {
    const g = N()
    for (const s of [-1, 1]) {
      g.add(box, a, { p: [s * 0.24, 0, -0.03], r: [0, -s * 0.3, 0], s: [0.52, 0.7, 0.05] }).add(box, W, { p: [s * 0.23, 0, 0.02], r: [0, -s * 0.3, 0], s: [0.46, 0.62, 0.05] })
      for (const y of [0.18, 0.06, -0.06, -0.18]) g.add(box, GREY, { p: [s * 0.23, y, 0.055], r: [0, -s * 0.3, 0], s: [0.3, 0.03, 0.02] })
    }
    return g.add(box, RED, { p: [0.3, -0.26, 0.06], r: [0, -0.3, 0], s: [0.06, 0.2, 0.02] })
  },
  laptop: a => {
    const lid = { p: [0, -0.24, -0.14] as V3, r: [-0.25, 0, 0] as V3 }
    const g = N().add(box, GREY, { p: [0, -0.26, 0.1], s: [0.9, 0.05, 0.5] }).add(box, K, { p: [0, -0.23, 0.08], s: [0.7, 0.02, 0.26] })
      .add(box, K, { ...lid, o: [0, 0.31, 0], s: [0.9, 0.6, 0.04] }).add(box, a, { ...lid, o: [0, 0.31, 0.025], s: [0.78, 0.48, 0.02] })
    for (const [y, w] of [[0.42, 0.4], [0.32, 0.55], [0.22, 0.3]]) g.add(box, K, { ...lid, o: [-0.34 + w / 2, y, 0.04], s: [w, 0.035, 0.01] })
    return g
  },
  briefcase: a => N().add(rr(0.92, 0.6, 0.08, 0.26), BRN).add(tor(0.15, 0.035, PI), K, { p: [0, 0.3, 0] }).add(box, mix(BRN, K, 0.4), { p: [0, 0.08, 0.13], s: [0.92, 0.04, 0.02] })
    .add(rr(0.16, 0.14, 0.03, 0.04), a, { p: [0, 0.08, 0.14] }).add(box, mix(BRN, K, 0.4), { p: [-0.3, 0, 0.13], s: [0.05, 0.6, 0.02] }).add(box, mix(BRN, K, 0.4), { p: [0.3, 0, 0.13], s: [0.05, 0.6, 0.02] }),
  palette: a => {
    const g = N().add(cyl, '#e2b98a', { r: [H, 0, 0], s: [0.5, 0.07, 0.4] })
    disc(g, K, 0.07, -0.24, -0.12, 0.02)
    for (const [x, y, c] of [[-0.3, 0.1, RED], [-0.12, 0.24, GOLD], [0.1, 0.25, BLU], [0.3, 0.12, GRN], [0.32, -0.1, a]] as [number, number, string][])
      g.add(sph, c, { p: [x, y, 0.05], s: [0.085, 0.085, 0.05] })
    return g
  },
  blueprint: a => {
    const g = N().add(rr(0.95, 0.68, 0.03, 0.04), '#2f6fd0').add(cyl, a, { p: [-0.48, 0, 0.03], s: [0.06, 0.72, 0.06] })
    line(g, W, [[-0.3, -0.2], [0.14, -0.2], [0.14, 0.2], [-0.3, 0.2], [-0.3, -0.2]], 0.03, 0.03, 0.02)
    line(g, W, [[-0.08, -0.2], [-0.08, 0.04], [-0.3, 0.04]], 0.03, 0.025, 0.02)
    return g.add(tor(0.1, 0.012), W, { p: [0.3, 0, 0.03] }).stroke(W, 0.22, -0.26, 0.4, -0.26, 0.03, 0.02, 0.02)
  },
  apple: a => N().add(sphHi, RED, { p: [0, -0.06, 0], s: [0.42, 0.38, 0.4] }).add(sph, '#ff9a9a', { p: [-0.16, 0.06, 0.3], s: [0.07, 0.11, 0.05] })
    .add(cyl, BRN, { p: [0.02, 0.36, 0], r: [0, 0, -0.2], s: [0.028, 0.18, 0.028] }).add(ext('leaf', leafShape, 0.03), a, { p: [0.17, 0.4, 0], r: [0, 0, -1], s: 0.36 }),
  wifi: (a, on) => {
    const arcs = [0.22, 0.42, 0.62].map(R => piv(N().add(tor(R, 0.055, H), a, { r: [0, 0, PI / 4] }), [0, -0.32, 0]))
    on(u => { const step = Math.floor(u * 2) % 4; arcs.forEach((m, i) => { m.visible = step === 0 || i < step }) })
    return G(N().add(sph, a, { p: [0, -0.32, 0], s: 0.09 }), ...arcs)
  },
  flask: (a, on) => {
    const bub = [0, 1].map(() => G(N().add(sph, a, { s: 0.05 })))
    on(u => bub.forEach((b, i) => { const k = (u * 0.35 + i * 0.5) % 1; b.position.set(i ? 0.05 : -0.04, 0.42 + k * 0.3, 0); b.scale.setScalar(1.2 - k) }))
    return G(N().add(frus(0.12, 0.4), a, { p: [0, -0.18, 0], s: [1, 0.46, 1] }).add(cyl, GLASS, { p: [0, 0.19, 0], s: [0.12, 0.3, 0.12] })
      .add(tor(0.13, 0.03), GLASS, { p: [0, 0.35, 0], r: [H, 0, 0] }).add(cyl, mix(a, K, 0.3), { p: [0, -0.42, 0], s: [0.41, 0.03, 0.41] })
      .add(box, W, { p: [0.05, -0.2, 0.3], r: [-0.55, 0, 0], s: [0.1, 0.03, 0.01] }).add(box, W, { p: [0.05, -0.28, 0.34], r: [-0.55, 0, 0], s: [0.14, 0.03, 0.01] }), ...bub)
  },
  pi: a => {
    const g = disc(N(), K, 0.46).add(tor(0.46, 0.04), a)
    line(g, a, [[-0.27, 0.17], [0.27, 0.17]], 0.06, 0.09, 0.05)
    return line(line(g, a, [[-0.11, 0.17], [-0.15, -0.24]], 0.06, 0.08, 0.05), a, [[0.11, 0.17], [0.13, -0.2], [0.2, -0.24]], 0.06, 0.08, 0.05)
  },
  letters: a => {
    const g = N().add(box, a, { p: [-0.14, -0.2, 0], s: 0.5 }).add(box, BLU, { p: [0.17, 0.26, 0], s: 0.42 })
    line(g, K, [[-0.28, -0.36], [-0.14, -0.02], [0, -0.36]], 0.25, 0.055)
    g.stroke(K, -0.21, -0.25, -0.07, -0.25, 0.25, 0.05)
    return line(g, W, [[0.05, 0.38], [0.29, 0.38], [0.05, 0.14], [0.29, 0.14]], 0.21, 0.055)
  },
  globe: (a, on) => G(N().add(tor(0.42, 0.03, PI), a, { r: [0, 0, -H - 0.35] }).add(cyl, a, { p: [0, -0.47, 0], s: [0.22, 0.05, 0.22] }).add(cyl, a, { p: [0.08, -0.42, 0], s: [0.03, 0.1, 0.03] }),
    spun(planet(0.34), on, [0, 0, -0.35], 0.8)),
  dish: a => N().add(dome, W, { p: [0, 0.08, 0], r: [-1.9, 0, 0.9], s: [0.44, 0.2, 0.44] }).add(cyl, GREY, { p: [0, 0.08, 0], r: [-1.9, 0, 0.9], o: [0, -0.06, 0], s: [0.016, 0.52, 0.016] })
    .add(sph, a, { p: [0, 0.08, 0], r: [-1.9, 0, 0.9], o: [0, -0.32, 0], s: 0.07 }).add(cyl, GREY, { p: [0, -0.26, -0.08], s: [0.04, 0.4, 0.04] }).add(cyl, mix(GREY, K, 0.4), { p: [0, -0.46, -0.08], s: [0.24, 0.05, 0.24] }),
  quill: a => N().add(ext('leaf', leafShape, 0.03), a, { p: [0.08, 0.1, 0], r: [0, 0, -0.5], s: [0.6, 1.15, 1] }).stroke(K, -0.2, -0.42, 0.33, 0.56, 0.03, 0.025)
    .add(cyl, K, { p: [-0.24, -0.36, 0.06], s: [0.17, 0.2, 0.17] }).add(tor(0.12, 0.035), BLU, { p: [-0.24, -0.26, 0.06], r: [H, 0, 0] }),
  hourglass: (a, on) => {
    const g = N()
    for (const s of [-1, 1]) {
      g.add(cyl, BRN, { p: [0, s * 0.43, 0], s: [0.3, 0.06, 0.3] })
      for (let i = 0; i < 3; i++) g.add(cyl, BRN, { p: [Math.cos(i * TAU / 3 + 0.5) * 0.25, 0, Math.sin(i * TAU / 3 + 0.5) * 0.25], s: [0.02, 0.84, 0.02] })
    }
    g.add(cone, GLASS, { p: [0, 0.2, 0], r: [PI, 0, 0], s: [0.22, 0.4, 0.22] }).add(cone, a, { p: [0, 0.31, 0], r: [PI, 0, 0], s: [0.225, 0.18, 0.225] })
      .add(cone, GLASS, { p: [0, -0.2, 0], s: [0.22, 0.4, 0.22] }).add(cone, a, { p: [0, -0.3, 0], s: [0.225, 0.2, 0.225] })
    const o = G(g)
    on(u => { const k = Math.min(1, Math.max(0, (u % 6) - 5)); o.rotation.z = (Math.floor(u / 6) + k * k * (3 - 2 * k)) * PI })
    return o
  },
  chalkboard: a => {
    const g = N().add(rr(0.98, 0.7, 0.04, 0.06), BRN).add(box, BOARD, { p: [0, 0, 0.025], s: [0.88, 0.6, 0.03] }).add(box, BRN, { p: [0, -0.37, 0.07], s: [0.6, 0.04, 0.1] })
    line(g, W, [[-0.32, -0.1], [-0.2, 0.2], [-0.08, -0.1]], 0.05, 0.04, 0.02).stroke(W, -0.26, 0, -0.14, 0, 0.05, 0.035, 0.02)
    g.stroke(W, 0.04, 0.06, 0.2, 0.06, 0.05, 0.04, 0.02).stroke(W, 0.12, -0.02, 0.12, 0.14, 0.05, 0.04, 0.02)
    return g.stroke(a, -0.34, -0.2, 0.34, -0.2, 0.05, 0.035, 0.02).add(box, W, { p: [0.2, -0.34, 0.08], s: [0.12, 0.03, 0.03] })
  },
  brush: a => N().add(tor(0.3, 0.06, 2.4), a, { p: [-0.08, -0.12, -0.06], r: [0, 0, 0.2] }).add(cyl, BRN, { r: [0, 0, -0.7], o: [0, -0.2, 0], s: [0.045, 0.6, 0.045] })
    .add(cyl, GREY, { r: [0, 0, -0.7], o: [0, 0.16, 0], s: [0.058, 0.14, 0.058] }).add(cone, a, { r: [0, 0, -0.7], o: [0, 0.37, 0], s: [0.085, 0.3, 0.06] }),
  chip: a => {
    const g = N().add(rr(0.62, 0.62, 0.06, 0.12), K).add(rr(0.32, 0.32, 0.04, 0.02), a, { p: [0, 0, 0.07] })
    for (const q of [-0.2, -0.07, 0.07, 0.2]) for (const s of [-1, 1]) g.stroke(GREY, s * 0.31, q, s * 0.45, q, 0, 0.04).stroke(GREY, q, s * 0.31, q, s * 0.45, 0, 0.04)
    return disc(g, K, 0.03, -0.1, 0.1, 0.085, 0.01)
  },
  clapper: (a, on) => {
    const g = N().add(rr(0.92, 0.5, 0.04, 0.08), K, { p: [0, -0.18, 0] }).add(box, K, { p: [0, 0.12, 0], s: [0.92, 0.12, 0.09] })
    const arm = N().add(box, K, { o: [0.46, 0.06, 0], s: [0.92, 0.12, 0.09] })
    for (const x of [-0.3, -0.1, 0.1, 0.3]) {
      g.add(box, W, { p: [x, 0.12, 0.05], r: [0, 0, 0.5], s: [0.07, 0.13, 0.02] })
      arm.add(box, a, { p: [x + 0.46, 0.06, 0.05], r: [0, 0, -0.5], s: [0.07, 0.13, 0.02] })
    }
    g.stroke(GREY, -0.34, -0.14, 0.34, -0.14, 0.05, 0.03).stroke(GREY, -0.34, -0.28, 0.1, -0.28, 0.05, 0.03)
    const o = piv(arm, [-0.46, 0.19, 0])
    on(u => { o.rotation.z = Math.max(0, Math.sin(u * 2.5)) * 0.45 })
    return G(g, o)
  },
  brackets: a => {
    const g = N().add(rr(0.98, 0.72, 0.1, 0.08), K)
    ;[RED, GOLD, GRN].forEach((c, i) => disc(g, c, 0.035, -0.38 + i * 0.1, 0.26, 0.045, 0.01))
    for (const s of [-1, 1]) line(g, a, [[s * 0.2, 0.08], [s * 0.37, -0.06], [s * 0.2, -0.2]], 0.06, 0.06)
    return g.stroke(a, -0.07, -0.22, 0.07, 0.1, 0.06, 0.06)
  },
  megaphone: (a, on) => {
    const waves = [0.5, 0.64].map(R => G(N().add(tor(R, 0.028, 0.8), W, { r: [0, 0, -0.03] })))
    on(u => waves.forEach((w, i) => { w.visible = Math.floor(u * 3) % 3 >= i }))
    return piv(G(N().add(frus(0.36, 0.09), a, { r: [0, 0, -1.2], s: [1, 0.6, 1] }).add(cyl, mix(a, K, 0.55), { r: [0, 0, -1.2], o: [0, 0.302, 0], s: [0.31, 0.01, 0.31] })
      .add(tor(0.36, 0.035), W, { p: [0.28, 0.11, 0], r: [H, -1.2, 0] }).add(cyl, K, { r: [0, 0, -1.2], o: [0, -0.36, 0], s: [0.11, 0.14, 0.11] })
      .add(box, K, { p: [-0.12, -0.26, 0], s: [0.08, 0.28, 0.08] }), ...waves), [-0.14, 0, 0])
  },
  database: a => {
    const g = N()
    for (const y of [-0.27, 0, 0.27]) g.add(cyl, a, { p: [0, y, 0], s: [0.38, 0.2, 0.38] }).add(sph, GRN, { p: [0.2, y, 0.33], s: 0.035 }).add(box, K, { p: [-0.1, y, 0.375], s: [0.26, 0.03, 0.01] })
    for (const y of [-0.135, 0.135]) g.add(cyl, K, { p: [0, y, 0], s: [0.33, 0.08, 0.33] })
    return g.add(cyl, mix(a, W, 0.5), { p: [0, 0.372, 0], s: [0.32, 0.01, 0.32] })
  },
  microphone: a => piv(N().add(sphHi, GREY, { p: [0, 0.27, 0], s: [0.2, 0.24, 0.2] }).add(tor(0.2, 0.04), a, { p: [0, 0.12, 0], r: [H, 0, 0] })
    .add(frus(0.13, 0.08), K, { p: [0, -0.2, 0], s: [1, 0.62, 1] }).add(box, a, { p: [0, -0.06, 0.12], s: [0.05, 0.1, 0.02] }), [0, 0, 0], [0, 0, -0.4]),
  shop: a => {
    const g = N().add(box, CREAM, { p: [0, -0.16, 0], s: [0.82, 0.52, 0.4] }).add(box, BRN, { p: [-0.2, -0.26, 0.205], s: [0.2, 0.32, 0.02] }).add(box, BLU, { p: [0.16, -0.16, 0.205], s: [0.32, 0.22, 0.02] })
      .add(rr(0.44, 0.15, 0.04, 0.05), K, { p: [0, 0.42, 0] }).add(sph, GOLD, { p: [-0.13, -0.26, 0.22], s: 0.02 })
    for (let i = 0; i < 5; i++) g.add(box, i % 2 ? W : a, { p: [-0.36 + i * 0.18, 0.2, 0.28], r: [0.7, 0, 0], s: [0.18, 0.3, 0.03] })
    return g
  },
  ringglobe: (a, on) => {
    const ring = N().add(tor(0.45, 0.022), a, { r: [H, 0, 0] })
    for (let i = 0; i < 10; i++) ring.add(sph, GOLD, { p: [Math.cos(i * TAU / 10) * 0.45, 0, Math.sin(i * TAU / 10) * 0.45], s: 0.055 }) // the ten ASEAN members
    return G(planet(0.28), spun(ring, on, [0.35, 0, 0.3], 0.9))
  },
  compass: (a, on) => {
    const g = disc(N(), W, 0.42).add(tor(0.42, 0.05), a)
    for (let i = 0; i < 8; i++) g.stroke(K, Math.cos(i * PI / 4) * 0.3, Math.sin(i * PI / 4) * 0.3, Math.cos(i * PI / 4) * 0.36, Math.sin(i * PI / 4) * 0.36, 0.04, i % 2 ? 0.02 : 0.04, 0.01)
    const needle = piv(N().add(ext('ndl', () => poly([[-0.08, 0], [0.08, 0], [0, 0.3]]), 0.04), RED).add(ext('ndl', () => poly([[-0.08, 0], [0.08, 0], [0, 0.3]]), 0.04), K, { r: [0, 0, PI] }).add(sph, GOLD, { s: 0.05 }), [0, 0, 0.07])
    on(u => { needle.rotation.z = 0.4 + Math.sin(u * 1.2) * 0.5 })
    return G(g, needle)
  },
  leaf: (a, on) => {
    const g = N().add(ext('leaf', leafShape, 0.05), GRN, { s: 1.02 }).stroke('#bff0c5', 0, -0.42, 0, 0.42, 0.035, 0.03)
    for (const y of [-0.2, 0, 0.2]) for (const s of [-1, 1]) g.stroke('#bff0c5', 0, y, s * 0.2, y + 0.14, 0.035, 0.025)
    const o = piv(g.stroke(BRN, 0, -0.44, 0, -0.56, 0, 0.04, 0.04).add(sph, a, { p: [0.13, 0.04, 0.06], s: [0.06, 0.08, 0.04] }), [0, -0.5, 0])
    on(u => { o.rotation.z = -0.3 + Math.sin(u * 1.4) * 0.12 })
    return piv(o, [0, 0.5, 0])
  },
  sapling: (a, on) => {
    const top = N().stroke(GRN, 0, 0, 0, 0.38, 0, 0.045, 0.045).add(ext('leaf', leafShape, 0.04), GRN, { p: [-0.16, 0.42, 0], r: [0, 0, 0.9], s: 0.46 })
      .add(ext('leaf', leafShape, 0.04), '#57c46f', { p: [0.16, 0.46, 0], r: [0, 0, -0.9], s: 0.46 }).add(ext('leaf', leafShape, 0.04), GRN, { p: [0, 0.6, 0], s: 0.3 })
    const o = piv(top, [0, -0.2, 0])
    on(u => { o.rotation.z = Math.sin(u * 1.6) * 0.1 })
    return G(N().add(frus(0.24, 0.16), a, { p: [0, -0.36, 0], s: [1, 0.26, 1] }).add(cyl, mix(a, K, 0.2), { p: [0, -0.22, 0], s: [0.26, 0.05, 0.26] }).add(cyl, '#5b3d22', { p: [0, -0.19, 0], s: [0.22, 0.02, 0.22] }), o)
  },
  cross: a => disc(N(), W, 0.44, 0, 0, 0, 0.08).add(tor(0.44, 0.05), a).add(box, RED, { p: [0, 0, 0.05], s: [0.52, 0.18, 0.05] }).add(box, RED, { p: [0, 0, 0.05], s: [0.18, 0.52, 0.05] }),
  stethoscope: a => {
    const g = N().add(tor(0.22, 0.035, PI), K, { p: [0, 0.1, 0], r: [0, 0, PI] }).stroke(K, 0, -0.12, 0, -0.26, 0, 0.07, 0.07)
    for (const s of [-1, 1]) g.stroke(K, s * 0.22, 0.1, s * 0.15, 0.44, 0, 0.06, 0.06).add(sph, a, { p: [s * 0.15, 0.46, 0], s: 0.06 })
    return disc(disc(g, GREY, 0.16, 0, -0.36, 0, 0.07), a, 0.09, 0, -0.36, 0.04, 0.02)
  },
  house: a => N().add(box, CREAM, { p: [0, -0.2, 0], s: [0.62, 0.44, 0.5] }).add(pyr, a, { p: [0, 0.2, 0], r: [0, PI / 4, 0], s: [0.58, 0.36, 0.58] })
    .add(box, BRN, { p: [-0.12, -0.3, 0.255], s: [0.14, 0.24, 0.02] }).add(box, BLU, { p: [0.14, -0.16, 0.255], s: [0.16, 0.14, 0.02] })
    .add(cyl, GOLD, { p: [0.36, -0.32, 0.32], r: [H, 0, 0], s: [0.13, 0.03, 0.13] }).stroke(K, 0.33, -0.4, 0.33, -0.25, 0.34, 0.025, 0.01).add(tor(0.04, 0.012, PI), K, { p: [0.33, -0.29, 0.34], r: [0, 0, -H] }),
  mappin: (a, on) => {
    const pin = G(N().add(sphHi, a, { p: [0, 0.2, 0], s: 0.26 }).add(cone, a, { p: [0, -0.12, 0], r: [PI, 0, 0], s: [0.225, 0.46, 0.225] }).add(sph, W, { p: [0, 0.22, 0.2], s: [0.1, 0.1, 0.08] }))
    on(u => { pin.position.y = Math.abs(Math.sin(u * 2.2)) * 0.1 })
    return G(N().add(cyl, GRN, { p: [0, -0.42, 0], s: [0.44, 0.04, 0.3] }).add(cyl, '#2b8a45', { p: [0, -0.4, 0], s: [0.1, 0.02, 0.07] }), pin)
  },
  plots: a => {
    const g = N().add(box, BRN, { p: [0, -0.03, 0], s: [0.94, 0.03, 0.94] })
    ;[GRN, GOLD, GRN, GREY, a, BLU, GOLD, GRN, GREY].forEach((c, i) => g.add(box, c, { p: [(i % 3 - 1) * 0.3, 0, (Math.floor(i / 3) - 1) * 0.3], s: [0.27, 0.04, 0.27] }))
    return piv(g.add(cone, '#2b8a45', { p: [-0.3, 0.15, -0.3], s: [0.1, 0.26, 0.1] }).add(cone, '#2b8a45', { p: [-0.3, 0.13, 0.3], s: [0.08, 0.2, 0.08] }).add(box, W, { p: [0.3, 0.13, -0.3], s: [0.14, 0.24, 0.14] })
      .add(box, RED, { p: [0, 0.08, 0], s: [0.14, 0.12, 0.14] }).add(pyr, K, { p: [0, 0.18, 0], r: [0, PI / 4, 0], s: [0.13, 0.08, 0.13] }), [0, -0.08, 0], [0.8, 0, 0])
  },
  gear: (a, on) => {
    const g1 = piv(N().add(ext('g8', gearShape(8, 0.36, 0.27, 0.1), 0.1), GREY), [-0.12, -0.1, 0]), g2 = piv(N().add(ext('g6', gearShape(6, 0.24, 0.16, 0.06), 0.1), a), [0.3, 0.26, 0])
    on(u => { g1.rotation.z = u * 0.8; g2.rotation.z = 0.3 - u * 0.8 * 8 / 6 })
    return G(g1, g2)
  },
  bulb: (a, on) => {
    const rays = N()
    for (let i = 0; i < 7; i++) { const t = -0.35 + i * (PI + 0.7) / 6; rays.stroke(a, Math.cos(t) * 0.37, Math.sin(t) * 0.37, Math.cos(t) * 0.48, Math.sin(t) * 0.48, 0, 0.045) }
    return G(N().add(sphHi, '#ffd95a', { p: [0, 0.1, 0], s: 0.27 }).add(frus(0.2, 0.12), '#ffd95a', { p: [0, -0.17, 0], s: [1, 0.16, 1] }).add(cyl, GREY, { p: [0, -0.3, 0], s: [0.12, 0.12, 0.12] })
      .add(cyl, K, { p: [0, -0.3, 0], s: [0.125, 0.025, 0.125] }).add(sph, K, { p: [0, -0.38, 0], s: [0.07, 0.05, 0.07] }), pulse(piv(rays, [0, 0.1, 0]), on, 0.12))
  },
  hearthands: (a, on) => {
    const hands = N().add(tor(0.33, 0.075, PI), SKIN, { p: [0, -0.1, 0], r: [0, 0, PI] })
    for (const s of [-1, 1]) hands.add(sph, SKIN, { p: [s * 0.33, -0.08, 0], s: 0.085 })
    return G(hands, pulse(piv(N().add(ext('heart', heartShape, 0.16), a, { s: 0.62 }), [0, 0.12, 0]), on))
  },
  umbrella: (a, on) => {
    const top = N().add(dome, a, { p: [0, 0.08, 0], s: [0.5, 0.32, 0.5] }).add(cone, K, { p: [0, 0.44, 0], s: [0.03, 0.1, 0.03] })
    for (let i = 0; i < 8; i++) top.add(sph, i % 2 ? W : a, { p: [Math.cos(i * PI / 4) * 0.48, 0.08, Math.sin(i * PI / 4) * 0.48], s: 0.065 })
    return piv(G(spun(top, on, [0, 0, 0], 0.7), N().add(cyl, K, { p: [0, -0.12, 0], s: [0.022, 0.62, 0.022] }).add(tor(0.07, 0.022, PI), K, { p: [0.07, -0.43, 0], r: [0, 0, PI] })), [0, 0, 0], [0, 0, 0.25])
  },
  venus: a => N().add(tor(0.22, 0.07), a, { p: [0, 0.18, 0] }).stroke(a, 0, -0.06, 0, -0.44, 0, 0.13, 0.13).stroke(a, -0.16, -0.26, 0.16, -0.26, 0, 0.13, 0.13),
  heartbeat: (a, on) => pulse(G(line(N().add(ext('heart', heartShape, 0.16), RED, { s: 0.98 }), W, [[-0.36, 0.06], [-0.18, 0.06], [-0.1, 0.22], [0, -0.14], [0.09, 0.12], [0.15, 0.06], [0.36, 0.06]], 0.095, 0.045, 0.02)
    .add(sph, a, { p: [0.36, 0.06, 0.1], s: 0.045 })), on, 0.1, 5),
  clipboard: a => {
    const g = N().add(rr(0.66, 0.88, 0.06, 0.05), BRN).add(box, W, { p: [0, -0.03, 0.03], s: [0.54, 0.72, 0.02] }).add(rr(0.28, 0.11, 0.03, 0.06), GREY, { p: [0, 0.41, 0.04] })
    for (const y of [0.18, 0.02, -0.14, -0.3]) g.add(box, a, { p: [-0.18, y, 0.045], s: [0.085, 0.085, 0.02] }).stroke(GREY, -0.07, y, 0.2, y, 0.045, 0.035, 0.01)
    return g
  },
  storm: (a, on) => {
    const bolt = G(N().add(ext('bolt', () => poly([[0.04, 0.06], [-0.16, -0.22], [-0.03, -0.22], [-0.12, -0.5], [0.16, -0.12], [0.03, -0.12], [0.12, 0.06]]), 0.06), GOLD))
    on(u => { bolt.visible = (u * 1.3) % 1 < 0.7 })
    const g = N().add(sph, '#d5dbe2', { p: [-0.22, 0.2, 0], s: 0.2 }).add(sphHi, '#d5dbe2', { p: [0.04, 0.28, 0], s: 0.27 }).add(sph, '#d5dbe2', { p: [0.27, 0.18, 0], s: 0.18 }).add(sph, '#b9c2cc', { p: [0.02, 0.1, 0], s: [0.44, 0.13, 0.2] })
    for (const [x, y] of [[-0.3, -0.12], [0.3, -0.08], [-0.26, -0.36], [0.26, -0.34]]) g.stroke(a, x, y, x - 0.05, y - 0.13, 0, 0.035)
    return G(g, bolt)
  },
  columns: a => {
    const g = N().add(box, GREY, { p: [0, -0.42, 0], s: [0.94, 0.07, 0.38] }).add(box, W, { p: [0, -0.35, 0], s: [0.84, 0.06, 0.34] }).add(box, W, { p: [0, 0.2, 0], s: [0.86, 0.07, 0.34] })
      .add(ext('ped', () => poly([[-0.47, 0], [0.47, 0], [0, 0.25]]), 0.32), a, { p: [0, 0.235, 0] }).add(cyl, W, { p: [0, 0.32, 0.165], r: [H, 0, 0], s: [0.05, 0.01, 0.05] })
    for (const x of [-0.31, -0.105, 0.105, 0.31]) g.add(cyl, W, { p: [x, -0.08, 0.04], s: [0.058, 0.5, 0.058] })
    return g
  },
  turbine: (a, on) => {
    const blades = N().add(sph, W, { s: 0.06 })
    for (let i = 0; i < 3; i++) blades.add(cone, W, { r: [0, 0, i * TAU / 3], o: [0, 0.2, 0], s: [0.05, 0.4, 0.016] })
    const o = piv(blades, [0, 0.14, 0.1])
    on(u => { o.rotation.z = -u * 1.8 })
    return G(N().add(frus(0.028, 0.06), W, { p: [0, -0.16, 0], s: [1, 0.62, 1] }).add(sph, GREY, { p: [0, 0.14, 0.03], s: [0.065, 0.06, 0.11] }).add(dome, a, { p: [0, -0.5, 0], s: [0.44, 0.1, 0.26] }), o)
  },
  crest: a => N().add(ext('shield', shieldShape, 0.08), a, { s: 1.02 }).add(ext('shield', shieldShape, 0.08), MAROON, { p: [0, 0, 0.03], s: 0.84 }).add(ext('star5', starShape(5, 0.21, 0.09), 0.05), GOLD, { p: [0, 0.02, 0.09] })
    .stroke(a, -0.2, -0.24, 0.2, -0.24, 0.08, 0.03, 0.02),
  scroll: a => {
    const g = N().add(box, CREAM, { s: [0.56, 0.62, 0.03] })
    for (const s of [-1, 1]) g.add(cyl, CREAM, { p: [0, s * 0.33, 0.02], r: [0, 0, H], s: [0.07, 0.68, 0.07] }).add(sph, BRN, { p: [-0.36, s * 0.33, 0.02], s: 0.06 }).add(sph, BRN, { p: [0.36, s * 0.33, 0.02], s: 0.06 })
    for (const y of [0.16, 0.06, -0.04]) g.stroke(GREY, -0.2, y, 0.2, y, 0.02, 0.03, 0.01)
    return disc(g, RED, 0.09, 0.13, -0.16, 0.03, 0.03).stroke(a, 0.1, -0.2, 0.06, -0.42, 0.03, 0.05, 0.02).stroke(a, 0.16, -0.2, 0.2, -0.42, 0.03, 0.05, 0.02)
  },
  key: (a, on) => {
    const o = piv(N().add(tor(0.17, 0.06), a, { p: [-0.28, 0, 0] }).stroke(a, -0.1, 0, 0.42, 0, 0, 0.09, 0.09).stroke(a, 0.28, -0.02, 0.28, -0.16, 0, 0.07, 0.07).stroke(a, 0.4, -0.02, 0.4, -0.12, 0, 0.07, 0.07), [0, 0, 0])
    on(u => { o.rotation.z = 0.7 + Math.sin(u * 1.5) * 0.15 })
    return o
  },
  document: a => {
    const g = N().add(ext('doc', () => poly([[-0.31, -0.43], [0.31, -0.43], [0.31, 0.25], [0.13, 0.43], [-0.31, 0.43]]), 0.04), W).add(ext('fold', () => poly([[0.13, 0.43], [0.31, 0.25], [0.13, 0.25]]), 0.02), GREY, { p: [0, 0, 0.03] })
    for (const y of [0.2, 0.09, -0.02]) g.stroke(GREY, -0.2, y, y > 0.15 ? 0.04 : 0.2, y, 0.03, 0.035, 0.01)
    return disc(g, a, 0.11, 0.12, -0.25, 0.03, 0.03).add(ext('star5s', starShape(5, 0.07, 0.03), 0.02), W, { p: [0.12, -0.25, 0.055] }).stroke(GREY, -0.2, -0.2, -0.06, -0.2, 0.03, 0.035, 0.01)
  },
  bookstack: a => {
    const g = N()
    ;([[-0.3, RED, 0.12], [-0.1, BLU, -0.18], [0.1, a, 0.08], [0.3, GRN, -0.1]] as [number, string, number][]).forEach(([y, c, r], i) =>
      g.add(box, c, { p: [0, y, 0], r: [0, r, 0], s: [0.74 - i * 0.05, 0.19, 0.5] }).add(box, W, { p: [0, y, 0], r: [0, r, 0], o: [0.03, 0, 0.02], s: [0.72 - i * 0.05, 0.12, 0.5] }))
    return g
  },
  lifebuoy: (a, on) => {
    const g = N()
    for (let i = 0; i < 4; i++) g.add(tor(0.32, 0.12, H), i % 2 ? a : W, { r: [0, 0, i * H] })
    const o = G(g)
    on(u => { o.rotation.z = u * 0.6 })
    return o
  },
  screen: a => N().add(rr(0.98, 0.66, 0.06, 0.06), K, { p: [0, 0.09, 0] }).add(box, a, { p: [0, 0.09, 0.03], s: [0.86, 0.54, 0.02] })
    .add(ext('play', () => poly([[-0.09, -0.13], [0.15, 0], [-0.09, 0.13]]), 0.03), W, { p: [0, 0.09, 0.05] }).add(box, GREY, { p: [0, -0.31, 0], s: [0.09, 0.16, 0.05] }).add(box, GREY, { p: [0, -0.4, 0], s: [0.4, 0.04, 0.22] }),
  calculator: a => {
    const g = N().add(rr(0.62, 0.9, 0.08, 0.1), K).add(box, '#bfe3c8', { p: [0, 0.27, 0.055], s: [0.48, 0.2, 0.02] }).stroke(K, 0.06, 0.27, 0.18, 0.27, 0.07, 0.04, 0.01)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.add(box, r === 3 && c === 2 ? a : c === 2 ? GOLD : GREY, { p: [-0.16 + c * 0.16, 0.06 - r * 0.135, 0.06], s: [0.12, 0.1, 0.03] })
    return g
  },
  coin: (a, on) => {
    const g = disc(N(), a, 0.42, 0, 0, 0, 0.08).add(tor(0.42, 0.045), mix(a, BRN, 0.45))
    for (const z of [-0.05, 0.05]) g.stroke(BRN, -0.08, -0.22, -0.08, 0.22, z, 0.055, 0.01).add(tor(0.11, 0.028, PI), BRN, { p: [-0.08, 0.11, z], r: [0, 0, -H] })
      .stroke(BRN, -0.2, 0.15, 0.1, 0.15, z, 0.03, 0.01).stroke(BRN, -0.2, 0.07, 0.1, 0.07, z, 0.03, 0.01)
    return spun(g, on, [0, 0, 0], 1.3)
  },
  people: a => {
    const g = N()
    for (const [x, z, c, k] of [[-0.29, -0.08, BLU, 0.8], [0.29, -0.08, GRN, 0.8], [0, 0.12, a, 1]] as [number, number, string, number][])
      g.add(dome, c, { p: [x, -0.46, z], s: [0.22 * k, 0.46 * k, 0.17 * k] }).add(sph, mix(c, W, 0.45), { p: [x, -0.46 + 0.56 * k, z], s: 0.135 * k })
    return g
  },
  box: a => {
    const c = '#c8935a', c2 = '#a97a45'
    const g = N().add(box, c, { p: [0, -0.14, 0], s: [0.64, 0.5, 0.64] }).add(box, a, { p: [0, -0.14, 0], s: [0.14, 0.505, 0.645] }).add(box, K, { p: [0, 0.105, 0], s: [0.6, 0.01, 0.6] })
    for (const s of [-1, 1]) g.add(box, c2, { p: [s * 0.32, 0.11, 0], r: [0, 0, s * 0.7], o: [s * 0.16, 0, 0], s: [0.32, 0.02, 0.64] })
    for (let i = 0; i < 5; i++) g.stroke(K, 0.14 + i * 0.03, -0.32, 0.14 + i * 0.03, -0.22, 0.325, i % 2 ? 0.008 : 0.016, 0.005)
    return piv(g, [0, 0, 0], [0, 0.5, 0])
  },
  cone: a => N().add(box, a, { p: [0, -0.44, 0], s: [0.6, 0.06, 0.6] }).add(frus(0.2, 0.27), a, { p: [0, -0.3, 0], s: [1, 0.22, 1] }).add(frus(0.135, 0.2), W, { p: [0, -0.09, 0], s: [1, 0.2, 1] })
    .add(frus(0.075, 0.135), a, { p: [0, 0.1, 0], s: [1, 0.18, 1] }).add(frus(0.035, 0.075), W, { p: [0, 0.27, 0], s: [1, 0.16, 1] }).add(sph, a, { p: [0, 0.36, 0], s: 0.04 }),
  pie: a => N().add(wedge(0, 2.4), a, { r: [H, 0, 0], s: [0.43, 0.1, 0.43] }).add(wedge(2.4, 2.2), BLU, { r: [H, 0, 0], s: [0.43, 0.1, 0.43] })
    .add(wedge(4.6, TAU - 4.6), GOLD, { p: [-0.06, -0.05, 0.03], r: [H, 0, 0], s: [0.43, 0.1, 0.43] }),
  scales: (a, on) => {
    const beam = N().stroke(a, -0.42, 0, 0.42, 0, 0, 0.05, 0.05).add(sph, a, { s: 0.06 })
    for (const s of [-1, 1]) beam.stroke(GREY, s * 0.4, 0, s * 0.52, -0.3, 0, 0.015).stroke(GREY, s * 0.4, 0, s * 0.28, -0.3, 0, 0.015).add(dome, mix(a, BRN, 0.3), { p: [s * 0.4, -0.3, 0], r: [PI, 0, 0], s: [0.15, 0.09, 0.15] })
    const o = piv(beam, [0, 0.3, 0])
    on(u => { o.rotation.z = Math.sin(u * 1.5) * 0.14 })
    return G(N().add(cyl, a, { p: [0, -0.06, -0.02], s: [0.03, 0.76, 0.03] }).add(frus(0.1, 0.26), a, { p: [0, -0.45, -0.02], s: [1, 0.08, 1] }), o)
  },
  newspaper: a => {
    const g = N().add(rr(0.86, 0.68, 0.02, 0.03), GREY, { p: [0.03, -0.03, -0.03] }).add(rr(0.86, 0.68, 0.02, 0.03), '#f4f1ea').stroke(K, -0.34, 0.22, 0.12, 0.22, 0.02, 0.09, 0.01)
      .add(box, a, { p: [0.22, 0, 0.02], s: [0.28, 0.24, 0.01] })
    for (const y of [0.08, 0, -0.08]) g.stroke(GREY, -0.34, y, 0.02, y, 0.02, 0.03, 0.01)
    for (const y of [-0.18, -0.26]) g.stroke(GREY, -0.34, y, 0.34, y, 0.02, 0.03, 0.01)
    return piv(g, [0, 0, 0], [0, 0, -0.08])
  },
  wrench: a => G(N().add(cyl, a, { p: [0, 0, -0.06], r: [0, 0, 0.6], o: [0, -0.26, 0], s: [0.075, 0.32, 0.075] }).add(cyl, GREY, { p: [0, 0, -0.06], r: [0, 0, 0.6], o: [0, 0.12, 0], s: [0.028, 0.5, 0.028] }),
    piv(N().stroke(GREY, 0, -0.36, 0, 0.18, 0, 0.11, 0.06).add(tor(0.15, 0.06, 4.4), GREY, { p: [0, 0.3, 0], r: [0, 0, 2.51] }).add(tor(0.09, 0.045), GREY, { p: [0, -0.42, 0] }), [0, 0, 0], [0, 0, -0.6])),
  equal: a => disc(N(), a, 0.45, 0, 0, 0, 0.08).add(tor(0.45, 0.04), W).stroke(W, -0.22, 0.11, 0.22, 0.11, 0.06, 0.1, 0.04).stroke(W, -0.22, -0.11, 0.22, -0.11, 0.06, 0.1, 0.04),
  heart: (a, on) => pulse(G(N().add(ext('heart', heartShape, 0.22), a, { s: 1.02 }).add(ext('heart', heartShape, 0.22), W, { p: [0, 0.02, 0.06], s: 0.4 })), on, 0.1, 3),
  checkshield: a => line(N().add(ext('shield', shieldShape, 0.1), a, { s: 1.02 }).add(ext('shield', shieldShape, 0.1), mix(a, K, 0.25), { p: [0, 0, -0.02], s: 1.1 }), W, [[-0.2, 0], [-0.05, -0.17], [0.24, 0.2]], 0.07, 0.09, 0.04),
  star: (a, on) => spun(N().add(ext('star5b', starShape(5, 0.48, 0.2), 0.12), a), on, [0, 0, 0], 0.9),
  balloon: (a, on) => {
    const o = piv(N().add(sphHi, a, { p: [0, 0.64, 0], s: [0.3, 0.36, 0.3] }).add(cone, a, { p: [0, 0.25, 0], s: [0.05, 0.07, 0.05] }).add(sph, W, { p: [-0.1, 0.76, 0.24], s: [0.05, 0.08, 0.03] }).stroke(GREY, 0, 0.22, 0, 0, 0, 0.015), [0, -0.5, 0])
    on(u => { o.rotation.z = Math.sin(u * 1.3) * 0.15 })
    return o
  },
  // The items of the desk, the clinic, the lab and the campus (lib/botItems.json deals four to every bot).
  stamp: a => N().add(sphHi, BRN, { p: [0, 0.34, 0], s: 0.15 }).add(cyl, BRN, { p: [0, 0.12, 0], s: [0.06, 0.34, 0.06] }).add(frus(0.1, 0.3), BRN, { p: [0, -0.12, 0], s: [1, 0.16, 1] })
    .add(cyl, K, { p: [0, -0.25, 0], s: [0.32, 0.1, 0.32] }).add(cyl, a, { p: [0, -0.33, 0], s: [0.3, 0.06, 0.3] }),
  idcard: a => {
    const g = N().add(rr(0.6, 0.8, 0.06, 0.05), W, { p: [0, -0.08, 0] }).add(box, a, { p: [0, 0.2, 0.03], s: [0.58, 0.14, 0.02] }).add(box, GLASS, { p: [-0.13, -0.1, 0.03], s: [0.24, 0.28, 0.01] })
    disc(g, GREY, 0.065, -0.13, -0.05, 0.04, 0.01).add(dome, GREY, { p: [-0.13, -0.23, 0.035], s: [0.1, 0.1, 0.02] })
    for (const y of [0, -0.1, -0.2]) g.stroke(GREY, 0.07, y, 0.22, y, 0.03, 0.035, 0.01)
    return g.stroke(K, -0.2, -0.38, 0.2, -0.38, 0.03, 0.04, 0.01).add(box, K, { p: [0, 0.33, 0], s: [0.14, 0.05, 0.07] }).add(tor(0.13, 0.02, PI), a, { p: [0, 0.35, 0] })
  },
  folder: a => N().add(rr(0.9, 0.62, 0.04, 0.04), '#d9a441', { p: [0, -0.02, -0.04] }).add(rr(0.34, 0.14, 0.04, 0.04), '#d9a441', { p: [-0.26, 0.32, -0.04] })
    .add(box, W, { p: [0.03, 0.06, 0], r: [0, 0, 0.05], s: [0.76, 0.56, 0.02] }).add(rr(0.9, 0.54, 0.04, 0.04), '#f2c14e', { p: [0, -0.08, 0.04] })
    .add(box, W, { p: [0.1, -0.06, 0.065], s: [0.4, 0.16, 0.01] }).stroke(a, -0.04, -0.06, 0.24, -0.06, 0.075, 0.04, 0.01),
  gradcap: (a, on) => {
    const tassel = piv(N().stroke(GOLD, 0.38, 0.1, 0.38, -0.16, 0.12, 0.025, 0.025).add(cyl, GOLD, { p: [0.38, -0.22, 0.12], s: [0.04, 0.12, 0.04] }), [0.38, 0.1, 0.12])
    on(u => { tassel.rotation.z = Math.sin(u * 2) * 0.25 })
    return G(N().add(cyl, K, { p: [0, -0.1, 0], s: [0.3, 0.24, 0.3] }).add(box, K, { p: [0, 0.06, 0], r: [0, PI / 4, 0], s: [0.78, 0.04, 0.78] }).add(sph, a, { p: [0, 0.1, 0], s: 0.05 })
      .stroke(GOLD, 0, 0.1, 0.38, 0.1, 0.06, 0.025, 0.025), tassel)
  },
  thermometer: a => {
    const g = N().add(cyl, W, { p: [0, 0.06, 0], s: [0.08, 0.7, 0.08] }).add(sph, W, { p: [0, 0.41, 0], s: 0.08 }).add(sphHi, RED, { p: [0, -0.34, 0], s: 0.15 }).add(box, RED, { p: [0, -0.06, 0.07], s: [0.05, 0.4, 0.02] })
      .add(tor(0.15, 0.025), a, { p: [0, -0.34, 0] })
    for (const y of [0.3, 0.2, 0.1, 0]) g.stroke(K, 0.03, y, 0.07, y, 0.085, 0.02, 0.01)
    return piv(g, [0, 0, 0], [0, 0, -0.5])
  },
  firstaid: a => N().add(rr(0.86, 0.6, 0.08, 0.3), W, { p: [0, -0.08, 0] }).add(tor(0.14, 0.035, PI), K, { p: [0, 0.22, 0] }).add(box, a, { p: [0, 0.1, 0.155], s: [0.84, 0.04, 0.01] })
    .add(box, RED, { p: [0, -0.1, 0.16], s: [0.3, 0.1, 0.02] }).add(box, RED, { p: [0, -0.1, 0.16], s: [0.1, 0.3, 0.02] }),
  ereader: a => {
    const g = N().add(rr(0.64, 0.9, 0.07, 0.05), K).add(box, '#f4f1ea', { p: [0, 0.03, 0.03], s: [0.52, 0.7, 0.01] }).add(box, a, { p: [-0.1, 0.28, 0.04], s: [0.28, 0.06, 0.01] })
    for (const y of [0.16, 0.07, -0.02, -0.11, -0.2]) g.stroke(GREY, -0.2, y, y < -0.15 ? 0.02 : 0.2, y, 0.04, 0.03, 0.01)
    return disc(g, GREY, 0.03, 0, -0.39, 0.03, 0.01)
  },
  catalog: a => {
    const g = N()
    ;([[-0.12, 0.1, CREAM, -0.24], [-0.04, 0.04, a, 0], [0.04, -0.02, W, 0.24]] as [number, number, string, number][]).forEach(([z, y, c, x]) =>
      g.add(box, c, { p: [0, y, z], s: [0.72, 0.5, 0.03] }).add(box, c, { p: [x, y + 0.29, z], s: [0.22, 0.1, 0.03] }))
    for (const y of [0.1, 0, -0.1]) g.stroke(GREY, -0.24, y, 0.24, y, 0.06, 0.03, 0.01)
    return g.add(box, BRN, { p: [0, -0.32, 0.02], s: [0.82, 0.24, 0.3] }).add(tor(0.06, 0.02, PI), GOLD, { p: [0, -0.3, 0.18], r: [0, 0, PI] })
  },
  magnifier: a => piv(N().add(tor(0.26, 0.05), a, { p: [0, 0.14, 0] }).add(cyl, GLASS, { p: [0, 0.14, 0], r: [H, 0, 0], s: [0.25, 0.03, 0.25] }).add(sph, W, { p: [-0.1, 0.24, 0.03], s: [0.06, 0.04, 0.02] })
    .add(cyl, K, { p: [0, -0.3, 0], s: [0.055, 0.34, 0.055] }).add(cyl, GREY, { p: [0, -0.12, 0], s: [0.06, 0.05, 0.06] }), [0, 0, 0], [0, 0, -0.6]),
  pencil: a => piv(N().add(bolt, GOLD, { p: [0, 0.02, 0], s: [0.1, 0.62, 0.1] }).add(cone, CREAM, { p: [0, -0.38, 0], r: [PI, 0, 0], s: [0.1, 0.18, 0.1] }).add(cone, K, { p: [0, -0.44, 0], r: [PI, 0, 0], s: [0.035, 0.06, 0.035] })
    .add(cyl, GREY, { p: [0, 0.36, 0], s: [0.105, 0.07, 0.105] }).add(cyl, a, { p: [0, 0.44, 0], s: [0.1, 0.1, 0.1] }), [0, 0, 0], [0, 0, -0.6]),
  ruler: a => {
    const g = N().add(ext('sq', () => poly([[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.44]]), 0.05), a).add(ext('sqi', () => poly([[-0.27, -0.25], [0.1, -0.25], [-0.27, 0.12]]), 0.02), mix(a, W, 0.65), { p: [0, 0, 0.02] })
    for (let i = 0; i < 7; i++) g.stroke(K, -0.34 + i * 0.1, -0.39, -0.34 + i * 0.1, i % 2 ? -0.35 : -0.32, 0.03, 0.015, 0.01)
    return g
  },
  atom: (a, on) => {
    const g = N().add(sphHi, a, { s: 0.13 })
    for (let i = 0; i < 3; i++) g.add(tor(0.42, 0.02), W, { r: [0, 0, i * PI / 3], s: [1, 0.38, 1] }).add(sph, GOLD, { p: [Math.cos(i * PI / 3) * 0.42, Math.sin(i * PI / 3) * 0.42, 0], s: 0.055 })
    return pulse(G(g), on, 0.06, 3)
  },
  microscope: a => N().add(box, K, { p: [0, -0.42, 0], s: [0.56, 0.08, 0.36] }).add(box, K, { p: [-0.16, -0.12, 0], r: [0, 0, -0.25], s: [0.09, 0.6, 0.09] }).add(box, GREY, { p: [0.06, -0.24, 0], s: [0.34, 0.04, 0.26] })
    .add(cyl, a, { p: [0.04, 0.12, 0], r: [0, 0, 0.45], s: [0.085, 0.5, 0.085] }).add(cyl, GREY, { p: [-0.09, 0.39, 0], r: [0, 0, 0.45], s: [0.06, 0.12, 0.06] })
    .add(cyl, GREY, { p: [0.16, -0.13, 0], r: [0, 0, 0.45], s: [0.05, 0.1, 0.05] }).add(cyl, GREY, { p: [-0.2, -0.2, 0.06], r: [H, 0, 0], s: [0.07, 0.04, 0.07] }),
  camera: a => disc(disc(N().add(rr(0.88, 0.56, 0.08, 0.26), K, { p: [0, -0.06, 0] }).add(box, K, { p: [-0.18, 0.26, 0], s: [0.26, 0.1, 0.2] }).add(cyl, RED, { p: [0.26, 0.24, 0], s: [0.06, 0.05, 0.06] })
    .add(box, a, { p: [0, 0.12, 0.135], s: [0.86, 0.05, 0.01] }).add(cyl, GREY, { p: [0, -0.08, 0.16], r: [H, 0, 0], s: [0.21, 0.14, 0.21] }), GLASS, 0.15, 0, -0.08, 0.235, 0.01), W, 0.04, -0.05, -0.03, 0.245, 0.01),
  headset: a => {
    const g = N().add(tor(0.34, 0.045, PI), K)
    for (const s of [-1, 1]) g.add(cyl, a, { p: [s * 0.36, -0.1, 0], r: [0, 0, H], s: [0.15, 0.12, 0.15] }).add(cyl, K, { p: [s * 0.3, -0.1, 0], r: [0, 0, H], s: [0.12, 0.04, 0.12] })
    return g.stroke(K, -0.36, -0.2, -0.12, -0.4, 0.1, 0.035, 0.035).add(sph, GREY, { p: [-0.1, -0.41, 0.1], s: 0.06 })
  },
  chart: a => {
    const g = N().add(rr(0.94, 0.76, 0.06, 0.04), W).stroke(GREY, -0.36, -0.28, 0.38, -0.28, 0.03, 0.03, 0.01)
    ;[0.16, 0.28, 0.24, 0.44].forEach((h, i) => g.add(box, i === 3 ? a : [BLU, GRN, GOLD][i], { p: [-0.27 + i * 0.18, -0.27 + h / 2, 0.035], s: [0.12, h, 0.03] }))
    return line(g, RED, [[-0.3, 0], [-0.1, 0.14], [0.06, 0.1], [0.3, 0.3]], 0.065, 0.03, 0.01)
  },
  calendar: a => {
    const g = N().add(rr(0.8, 0.8, 0.06, 0.06), W, { p: [0, -0.04, 0] }).add(box, a, { p: [0, 0.25, 0.035], s: [0.78, 0.18, 0.02] })
    for (const x of [-0.22, 0.22]) g.add(cyl, GREY, { p: [x, 0.36, 0.03], s: [0.03, 0.14, 0.03] })
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.add(box, r === 1 && c === 2 ? RED : GREY, { p: [-0.24 + c * 0.16, 0.06 - r * 0.15, 0.035], s: [0.1, 0.09, 0.01] })
    return g
  },
  envelope: a => disc(N().add(rr(0.92, 0.62, 0.04, 0.05), W).add(ext('flap', () => poly([[-0.46, 0.31], [0.46, 0.31], [0, -0.06]]), 0.02), CREAM, { p: [0, 0, 0.035] })
    .stroke(GREY, -0.44, -0.29, -0.08, 0, 0.03, 0.02, 0.01).stroke(GREY, 0.44, -0.29, 0.08, 0, 0.03, 0.02, 0.01), a, 0.08, 0, -0.05, 0.05, 0.02),
  receipt: a => {
    const g = N().add(ext('rcpt', () => poly([[-0.28, 0.46], [0.28, 0.46], [0.28, -0.4], [0.2, -0.46], [0.12, -0.4], [0.04, -0.46], [-0.04, -0.4], [-0.12, -0.46], [-0.2, -0.4], [-0.28, -0.46]]), 0.03), W)
      .stroke(K, -0.12, 0.34, 0.12, 0.34, 0.02, 0.06, 0.01)
    for (const y of [0.2, 0.1, 0, -0.1]) g.stroke(GREY, -0.18, y, 0.04, y, 0.02, 0.03, 0.01).stroke(GREY, 0.13, y, 0.18, y, 0.02, 0.03, 0.01)
    return g.stroke(a, -0.18, -0.26, 0.18, -0.26, 0.02, 0.06, 0.01)
  },
  banknote: a => {
    const g = N().add(rr(0.94, 0.5, 0.03, 0.03), '#8fcf9a', { p: [0.03, 0.08, -0.04], r: [0, 0, 0.12] }).add(rr(0.94, 0.5, 0.03, 0.03), GRN).add(rr(0.82, 0.38, 0.02, 0.01), '#bff0c5', { p: [0, 0, 0.015] })
    for (const s of [-1, 1]) disc(g, a, 0.05, s * 0.32, 0, 0.02, 0.01)
    return disc(g, GRN, 0.13, 0, 0, 0.02, 0.01)
  },
  toolbox: a => N().add(box, a, { p: [0, -0.2, 0], s: [0.86, 0.4, 0.4] }).add(box, mix(a, K, 0.3), { p: [0, 0.04, 0], s: [0.9, 0.1, 0.44] }).add(tor(0.16, 0.035, PI), K, { p: [0, 0.09, 0] })
    .add(box, GREY, { p: [0, -0.04, 0.22], s: [0.12, 0.12, 0.02] }),
  cloud: (a, on) => {
    const up = G(N().stroke(a, 0, -0.2, 0, 0.04, 0.26, 0.07, 0.04).add(ext('tri', () => poly([[-0.14, 0], [0.14, 0], [0, 0.16]]), 0.04), a, { p: [0, 0.05, 0.26] }))
    on(u => { up.position.y = Math.sin(u * 2) * 0.04 })
    return G(N().add(sph, W, { p: [-0.24, -0.04, 0], s: 0.2 }).add(sphHi, W, { p: [0.02, 0.08, 0], s: 0.28 }).add(sph, W, { p: [0.27, -0.03, 0], s: 0.19 }).add(sph, W, { p: [0.02, -0.12, 0], s: [0.44, 0.13, 0.2] }), up)
  },
  waterdrop: a => N().add(sphHi, BLU, { p: [0, -0.14, 0], s: 0.3 }).add(cone, BLU, { p: [0, 0.24, 0], s: [0.25, 0.46, 0.25] }).add(sph, W, { p: [-0.12, -0.08, 0.25], s: [0.05, 0.09, 0.03] })
    .add(tor(0.36, 0.02), a, { p: [0, -0.44, 0], r: [H, 0, 0] }),
  solar: a => {
    const tilt = { p: [0, -0.04, 0] as V3, r: [-0.5, 0, 0] as V3 }
    const g = N().add(box, a, { ...tilt, s: [0.92, 0.56, 0.03] }).add(box, '#1f3f7a', { ...tilt, o: [0, 0, 0.02], s: [0.86, 0.5, 0.02] }).add(box, W, { ...tilt, o: [0, 0, 0.035], s: [0.86, 0.012, 0.01] })
    for (const x of [-0.215, 0, 0.215]) g.add(box, W, { ...tilt, o: [x, 0, 0.035], s: [0.012, 0.5, 0.01] })
    return g.add(cyl, GREY, { p: [0, -0.34, -0.08], s: [0.035, 0.3, 0.035] }).add(sphHi, GOLD, { p: [0.32, 0.38, -0.1], s: 0.11 })
  },
  ribbon: a => N().stroke(a, -0.06, -0.1, -0.16, -0.46, -0.03, 0.14, 0.03).stroke(a, 0.06, -0.1, 0.16, -0.46, -0.03, 0.14, 0.03)
    .add(ext('ros', gearShape(14, 0.34, 0.29, 0.02), 0.06), a, { p: [0, 0.12, 0] }).add(cyl, GOLD, { p: [0, 0.12, 0.03], r: [H, 0, 0], s: [0.22, 0.04, 0.22] }).add(ext('star5r', starShape(5, 0.13, 0.055), 0.03), W, { p: [0, 0.12, 0.06] }),
  tag: a => piv(disc(N().add(ext('tag', () => poly([[-0.28, -0.44], [0.28, -0.44], [0.28, 0.16], [0, 0.44], [-0.28, 0.16]]), 0.05), a), K, 0.05, 0, 0.24, 0.03, 0.01)
    .add(tor(0.09, 0.015), GREY, { p: [0, 0.33, 0.03] }).stroke(W, -0.16, -0.04, 0.16, -0.04, 0.03, 0.05, 0.01).stroke(W, -0.16, -0.2, 0.06, -0.2, 0.03, 0.05, 0.01), [0, 0, 0], [0, 0, 0.4]),
  backpack: a => N().add(rr(0.7, 0.84, 0.2, 0.34), a, { p: [0, -0.04, 0] }).add(rr(0.46, 0.3, 0.08, 0.1), mix(a, K, 0.3), { p: [0, -0.2, 0.2] }).add(tor(0.1, 0.03, PI), K, { p: [0, 0.38, 0] })
    .stroke(K, -0.24, 0.16, 0.24, 0.16, 0.175, 0.025, 0.01).add(sph, GOLD, { p: [0.24, 0.14, 0.18], s: 0.035 }),
  map: a => {
    const g = N()
    for (const i of [-1, 0, 1]) g.add(box, i ? '#e3efd0' : '#f4f1ea', { p: [i * 0.29, 0, i ? 0 : 0.05], r: [0, i ? 0.35 : -0.35, 0], s: [0.31, 0.7, 0.02] })
    line(g, RED, [[-0.34, -0.2], [-0.12, 0.02], [0.08, -0.1], [0.24, 0.1]], 0.08, 0.03, 0.01).stroke(BLU, -0.38, 0.2, -0.2, 0.28, 0.07, 0.04, 0.01)
    return g.add(sph, a, { p: [0.25, 0.2, 0.1], s: 0.07 }).add(cone, a, { p: [0.25, 0.12, 0.1], r: [PI, 0, 0], s: [0.05, 0.12, 0.05] })
  },
  signpost: a => N().add(cyl, BRN, { p: [0, -0.04, -0.04], s: [0.04, 0.9, 0.04] }).add(cyl, GREY, { p: [0, -0.48, -0.04], s: [0.2, 0.04, 0.2] })
    .add(ext('sgn', () => poly([[-0.3, -0.1], [0.24, -0.1], [0.4, 0], [0.24, 0.1], [-0.3, 0.1]]), 0.05), a, { p: [0.02, 0.26, 0] })
    .add(ext('sgn', () => poly([[-0.3, -0.1], [0.24, -0.1], [0.4, 0], [0.24, 0.1], [-0.3, 0.1]]), 0.05), GRN, { p: [-0.02, 0, 0], r: [0, 0, PI] })
    .stroke(W, -0.16, 0.26, 0.2, 0.26, 0.03, 0.03, 0.01).stroke(W, -0.2, 0, 0.16, 0, 0.03, 0.03, 0.01),
}

/** Head gear, all hard-surface; `top` = y of the crown, `hw` = half the head's width, in head coordinates. */
function hat(h: Hat, a: string, dk: string, top: number, hw: number): Geo | null {
  const g = N()
  switch (h) {
    case 'fin': return g.add(rr(0.4, 0.13, 0.06, 0.05), dk, { p: [0, top + 0.04, -0.02], r: [0, H, 0] }).add(box, a, { p: [0, top + 0.05, 0.17], s: [0.07, 0.06, 0.05] }) // a sensor fin, not a stalk
    case 'mortar': return g.add(cyl, K, { p: [0, top - 0.03, 0], s: [0.3, 0.16, 0.28] }).add(box, K, { p: [0, top + 0.07, 0], r: [0, PI / 4, 0], s: [0.8, 0.045, 0.8] }).add(sph, a, { p: [0, top + 0.1, 0], s: 0.045 })
      .stroke(a, 0, top + 0.1, 0.34, top + 0.1, 0.22, 0.03, 0.03).stroke(a, 0.34, top + 0.1, 0.34, top - 0.14, 0.22, 0.03, 0.03).add(box, a, { p: [0.34, top - 0.18, 0.22], s: [0.07, 0.1, 0.05] })
    case 'ring': return g.add(tor(0.11, 0.035), GOLD, { p: [0, top + 0.15, 0], r: [0, 0.35, 0] }).add(cyl, GRAPH, { p: [0, top + 0.02, 0], s: [0.07, 0.08, 0.07] }) // a doctor's gold loop aerial
    case 'beacon': return g.add(box, GRAPH, { p: [0, top + 0.02, 0], s: [0.46, 0.05, 0.2] }).add(rr(0.4, 0.11, 0.05, 0.14), RED, { p: [0, top + 0.09, 0] }) // a medic light bar
      .add(box, W, { p: [0, top + 0.09, 0.075], s: [0.12, 0.035, 0.01] }).add(box, W, { p: [0, top + 0.09, 0.075], s: [0.035, 0.1, 0.01] })
    case 'disc': return g.add(cyl, GRAPH, { p: [0, top + 0.07, 0], s: [0.03, 0.18, 0.03] }).add(cyl, a, { p: [0, top + 0.17, 0], r: [0.5, 0, -0.25], s: [0.3, 0.035, 0.3] }) // a tilted disc sensor on a post
      .add(cyl, K, { p: [0, top + 0.17, 0], r: [0.5, 0, -0.25], o: [0, 0.01, 0], s: [0.13, 0.04, 0.13] })
    case 'hardhat': return g.add(dome, GOLD, { p: [0, top - 0.12, 0], s: [hw + 0.03, 0.34, hw + 0.01] }).add(cyl, GOLD, { p: [0, top - 0.12, 0.1], s: [hw + 0.08, 0.04, hw + 0.1] }).add(box, '#ffe08a', { p: [0, top + 0.2, 0], s: [0.1, 0.06, 0.62] })
    case 'headphones': return g.add(tor(0.5, 0.045, PI), K, { p: [0, 0.34, 0], s: [(hw + 0.05) / 0.5, (top - 0.28) / 0.5, 1] }).add(cyl, a, { p: [-hw - 0.04, 0.32, 0], r: [0, 0, H], s: [0.16, 0.12, 0.16] }).add(cyl, a, { p: [hw + 0.04, 0.32, 0], r: [0, 0, H], s: [0.16, 0.12, 0.16] })
    default: return null
  }
}

const HEXP: [number, number][] = [[-0.6, 0], [-0.32, 0.42], [0.32, 0.42], [0.6, 0], [0.32, -0.42], [-0.32, -0.42]]
const WEDP: [number, number][] = [[-0.62, 0.4], [0.62, 0.4], [0.34, -0.36], [-0.34, -0.36]]
/** hw = half width at the ears, top = y of the crown; the face is drawn at (0, ey, ez): eyes `es` apart from the middle on a
 *  surface of radius `rc` (0 = flat), the whole face scaled by `fs`. */
/** bz = z of the shell just above the visor, where a brow crest or a sensor stud sits (0 = no room for one). */
interface Skull { g: Geo; hw: number; top: number; ey: number; ez: number; es: number; rc: number; fs: number; bz: number }
/** The 8 head forms in coordinates of the neck joint: white plating with the family colour as a panel, and a glass visor
 *  that follows the form (porthole on a ball, band round a drum, arch on a dome, the head's own outline on a flat front). */
function skull(form: Head, c: string, face: string): Skull {
  const g = N()
  const flat = (key: string, pts: [number, number][], y: number, vs: V3) => {
    const shell = ext(key, () => poly(pts), 0.56, 0.07), pane = ext(key, () => poly(pts), 0.06, 0.02)
    g.add(shell, PLATE, { p: [0, y, 0] }).add(shell, c, { p: [0, y, -0.14], s: [1.03, 1.03, 0.52] }).add(pane, face, { p: [0, y + 0.02, 0.28], s: vs }).add(pane, SEAM, { p: [0, y + 0.02, 0.268], s: [vs[0] + 0.05, vs[1] + 0.05, 1] })
  }
  switch (form) {
    case 'hex': flat('hdh', HEXP, 0.38, [0.74, 0.66, 1]); return { g, hw: 0.58, top: 0.8, ey: 0.39, ez: 0.32, es: 0.17, rc: 0, fs: 1, bz: 0.3 }
    case 'wedge': flat('hdw', WEDP, 0.36, [0.76, 0.62, 1]); return { g, hw: 0.47, top: 0.76, ey: 0.39, ez: 0.32, es: 0.17, rc: 0, fs: 1, bz: 0.3 }
    case 'capsule':
      g.add(sphHi, PLATE, { p: [0, 0.28, 0], s: 0.31 }).add(cyl, PLATE, { p: [0, 0.42, 0], s: [0.31, 0.28, 0.31] }).add(sphHi, PLATE, { p: [0, 0.56, 0], s: 0.31 }).add(cyl, c, { p: [0, 0.63, 0], s: [0.318, 0.06, 0.318] })
        .add(sphHi, c, { p: [0, 0.74, 0], s: [0.2, 0.14, 0.2] }).add(sphHi, face, { p: [0, 0.36, 0.15], s: [0.25, 0.25, 0.2] }).add(sphHi, SEAM, { p: [0, 0.36, 0.15], s: [0.268, 0.268, 0.172] })
      return { g, hw: 0.31, top: 0.87, ey: 0.37, ez: 0.355, es: 0.11, rc: 0.3, fs: 0.84, bz: 0.31 }
    case 'saucer':
      g.add(sphHi, PLATE, { p: [0, 0.3, 0], s: [0.68, 0.26, 0.5] }).add(cyl, c, { p: [0, 0.3, -0.03], s: [0.7, 0.05, 0.5] }).add(sphHi, c, { p: [0, 0.5, 0], s: [0.36, 0.1, 0.28] }).add(sphHi, face, { p: [0, 0.31, 0.25], s: [0.5, 0.19, 0.3] }).add(sphHi, SEAM, { p: [0, 0.31, 0.25], s: [0.525, 0.208, 0.262] })
      return { g, hw: 0.68, top: 0.57, ey: 0.31, ez: 0.555, es: 0.2, rc: 0.6, fs: 0.8, bz: 0 }
    case 'drum':
      g.add(cyl, PLATE, { p: [0, 0.33, 0], s: [0.43, 0.66, 0.43] }).add(cyl, face, { p: [0, 0.36, 0], s: [0.445, 0.4, 0.445] }).add(cyl, SEAM, { p: [0, 0.36, 0], s: [0.438, 0.43, 0.438] }).add(cyl, c, { p: [0, 0.67, 0], s: [0.44, 0.07, 0.44] }).add(cyl, c, { p: [0, 0.03, 0], s: [0.44, 0.07, 0.44] })
      return { g, hw: 0.43, top: 0.7, ey: 0.36, ez: 0.45, es: 0.17, rc: 0.445, fs: 0.95, bz: 0.45 }
    case 'dome':
      g.add(dome, PLATE, { p: [0, 0.04, 0], s: [0.5, 0.66, 0.5] }).add(cyl, c, { p: [0, 0.02, 0], s: [0.6, 0.1, 0.58] }).add(cyl, GRAPH, { p: [0, 0.08, 0], s: [0.52, 0.03, 0.52] }).add(dome, face, { p: [0, 0.12, 0.29], s: [0.37, 0.44, 0.22] }).add(dome, SEAM, { p: [0, 0.12, 0.29], s: [0.395, 0.465, 0.19] })
      return { g, hw: 0.46, top: 0.7, ey: 0.3, ez: 0.5, es: 0.16, rc: 0.45, fs: 1, bz: 0.29 }
    case 'drop':
      g.add(lathe('drop', [[0.001, -0.04], [0.28, -0.02], [0.44, 0.1], [0.5, 0.27], [0.46, 0.44], [0.34, 0.62], [0.18, 0.8], [0.06, 0.92], [0.001, 0.96]]), PLATE, { s: [1, 0.9, 1] })
        .add(lathe('tip', [[0.125, 0.86], [0.065, 0.92], [0.001, 0.965]]), GRAPH, { s: [1, 0.9, 1] }).add(sphHi, c, { p: [0, 0.24, -0.1], s: [0.52, 0.3, 0.44] }).add(sphHi, face, { p: [0, 0.27, 0.3], s: [0.34, 0.26, 0.21] }).add(sphHi, SEAM, { p: [0, 0.27, 0.3], s: [0.362, 0.28, 0.18] })
      return { g, hw: 0.48, top: 0.86, ey: 0.27, ez: 0.51, es: 0.16, rc: 0.45, fs: 1, bz: 0.36 }
    default:
      g.add(sphHi, PLATE, { p: [0, 0.36, 0], s: 0.48 }).add(sphHi, c, { p: [0, 0.36, -0.14], s: [0.495, 0.49, 0.42] }).add(sphHi, face, { p: [0, 0.34, 0.27], s: [0.36, 0.33, 0.23] }).add(sphHi, SEAM, { p: [0, 0.34, 0.27], s: [0.382, 0.352, 0.2] })
      return { g, hw: 0.48, top: 0.84, ey: 0.34, ez: 0.495, es: 0.17, rc: 0.4, fs: 1, bz: 0.42 }
  }
}
/** Two of `geo` where the eyes are: on a flat face side by side, on a round one turned to follow it. */
const pair = (g: Geo, geo: THREE.BufferGeometry, hex: string, es: number, rc: number, s: number | V3) => {
  for (const d of [-1, 1]) { const t = rc ? d * es / rc : 0; g.add(geo, hex, { p: rc ? [Math.sin(t) * rc, 0, (Math.cos(t) - 1) * rc] : [d * es, 0, 0], r: [0, t, 0], s }) }
  return g
}

/** A place on the face `x` beside and `y` above its middle, `z` in front of the screen: flat, or turned to follow a round one. */
const onFace = (x: number, y: number, rc: number, z = 0): { p: V3; r: V3 } => {
  const t = rc ? x / rc : 0
  return { p: rc ? [Math.sin(t) * (rc + z), y, Math.cos(t) * (rc + z) - rc] : [x, y, z], r: [0, t, 0] }
}
/** The digits of `n` as seven-segment strokes `h` high, centred on (x, y) in the plane z. */
function digits(g: Geo, hex: string, n: string, x: number, y: number, z: number, h: number) {
  const w = h * 0.5, t = h * 0.16, SEG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abfgcd']
  const at: Record<string, number[]> = { a: [0, 1, 1, 1], g: [0, 0.5, 1, 0.5], d: [0, 0, 1, 0], f: [0, 0.5, 0, 1], b: [1, 0.5, 1, 1], e: [0, 0, 0, 0.5], c: [1, 0, 1, 0.5] }
  ;[...n].forEach((ch, i) => { const x0 = x + (i - n.length / 2) * w * 1.6 + w * 0.3, y0 = y - h / 2
    for (const k of SEG[+ch]) { const [a, b, c2, d] = at[k]; g.stroke(hex, x0 + a * w, y0 + b * h, x0 + c2 * w, y0 + d * h, z, t, 0.01) } })
  return g
}
/** open = how far the eyelids are open, shape = which mouth shows (both for probes). `act` takes the real clock, how excited the
 *  figure is, its moods (typing, thinking, happy, miss), dn = how delighted (dancing, playing) and live = false for a still picture. */
interface Face { face: THREE.Group; open: number; shape: string; act: (u: number, e: number, ty: number, th: number, ha: number, mi: number, dn: number, live: boolean, lids?: number) => void; sing: (open: number) => void }
/** Where the eyes of the figure being drawn look, -1..1 across and up (the pointer, see mount), and k = how much they follow it. */
export const gaze = { x: 0, y: 0, k: 0 }
const ARC = (n: number, half = false): [number, number][] => Array.from({ length: n }, (_, i) => { const a = i * (half ? PI : TAU) / (half ? n - 1 : n); return [Math.cos(a), Math.sin(a) - (half ? 1 : 0)] })
/** Flat unit shapes facing +z, one deep: a disc, and its upper half hanging from y = 0 (an eyelid: scaled in y it comes down). */
const coin = () => ext('coin', () => poly(ARC(64)), 1), half = () => ext('half', () => poly(ARC(33, true)), 1)
/** The face on the screen, as in an animated film: eyes (a dark rim, a white ball, an iris in the bot's colours, a pupil, a steady
 *  catch light) that look about and at the pointer, upper and lower lids that blink (lib/figures `blink`: every bot at its own
 *  moments), brow plates that rise, sink and slant, and a mouth that changes shape (its rest shape, open to talk or grin, an "o").
 *  `st` deals the outline of the eyes and the kind of mouth. Everything is flat and unlit, in layers 0.005 apart; nothing lights up or dims.
 *  vh = how much room the screen has above and below its middle, cap = the widest an eye may be (glasses), lip = the colour of the mouth. */
function faceRig(es: number, rc: number, st: FaceStyle, o: { look?: Look; iris: string; lid: string; tint?: string; vh?: number; cap?: number; mouth?: Geo; my?: number; lip?: string; brows?: false }): Face {
  const k = Math.min(1, (o.vh ?? 0.27) / 0.27), cap = o.cap ?? 0.115, visor = st.eye === 'visor', sq = st.eye === 'square', lip = o.lip ?? INK
  const rx = visor ? es + 0.105 : Math.min(st.eye === 'oval' ? cap * 0.84 : sq ? cap * 0.9 : cap, es * (st.eye === 'oval' ? 0.56 : sq ? 0.6 : 0.65))
  const ry = (visor ? 0.1 : st.eye === 'oval' ? 0.13 : sq ? 0.108 : Math.min(rx, 0.116)) * k, cy = 0.045 * k, RIM = 0.013
  const ir = Math.min(visor ? 1 : rx * 0.7, ry * 0.78), TX = visor ? 0.05 : (rx - ir) * 0.9, TY = Math.max(0.012, (ry - ir) * 0.9), EH = 2 * (ry + RIM)
  const ball = N(), dots = N(), up = N(), low = N(), joy = N()
  /** The outline of one eye (or of the visor) grown by `g`, in layer z; lid = 1 its upper half hanging from the top, -1 its lower half standing on the bottom. */
  const lens = (to: Geo, hex: string, d: number, g: number, z: number, lid = 0) => {
    if (visor) { // one band across a flat front (lib/figures faceOf deals it to no other), with round ends
      if (d < 0) return
      const hh = ry + g, hw = lid ? rx + g : rx - ry
      to.add(box, hex, { p: [0, 0, z], o: [0, -lid / 2, 0], s: [2 * hw, lid ? 1 : 2 * hh, 0.01] })
      if (!lid) for (const s of [-1, 1]) to.add(coin(), hex, { p: [s * hw, 0, z], s: [hh, hh, 0.01] })
    } else if (sq) to.add(rr(2, 2, 0.75, 1), hex, { ...onFace(d * es, 0, rc, z), o: [0, -lid / 2, 0], s: [rx + g, lid ? 0.5 : ry + g, 0.01] })
    else to.add(lid ? half() : coin(), hex, { ...onFace(d * es, 0, rc, z), s: [rx + g, lid || ry + g, 0.01] })
  }
  const brows = [-1, 1].map(d => {
    lens(ball, INK, d, RIM, 0); lens(ball, visor ? o.tint ?? W : W, d, 0, 0.005)
    lens(up, o.lid, d, RIM, 0.025, 1); lens(low, o.lid, d, RIM, 0.025, -1)
    if (o.look === 'fem') { const c = onFace(d * (visor ? rx + 0.02 : es + rx * 0.95), ry * 0.75, rc); ball.add(box, INK, { p: c.p, r: [0, c.r[1], d * 0.5], s: [0.07, 0.026, 0.01] }) } // one lash tick at the outer corner
    dots.add(coin(), o.iris, { ...onFace(d * es, 0, rc, 0.01), s: [ir, ir, 0.01] }).add(coin(), K, { ...onFace(d * es, 0, rc, 0.015), s: [ir * 0.56, ir * 0.56, 0.01] })
      .add(coin(), W, { ...onFace(d * es + ir * 0.36, ir * 0.38, rc, 0.02), s: [ir * 0.3, ir * 0.3, 0.01] }).add(coin(), W, { ...onFace(d * es - ir * 0.4, -ir * 0.36, rc, 0.02), s: [ir * 0.14, ir * 0.14, 0.01] })
    joy.add(tor(0.085, 0.024, PI), INK, { ...onFace(d * es, -0.02, rc), s: [Math.min(rx, 0.1) / 0.095, 1, 1] })
    // a brow plate: heavy and flat (masc), fine (fem), plain (neutral)
    const b = onFace(d * (es + 0.006), 0, rc, 0.012), bw = Math.min(visor ? 0.14 : 1.9 * rx, 0.19), brow = N().add(o.look === 'masc' ? box : rr(2, 2, 0.9, 1), INK, { s: o.look === 'masc' ? [bw, 0.042, 0.012] : [bw / 2, o.look === 'fem' ? 0.012 : 0.016, 0.012] }).mesh(GLOW)
    brow.position.set(b.p[0], 0, b.p[2]); brow.rotation.y = b.r[1]
    return brow
  })
  const by = cy + ry + RIM + (o.look === 'masc' ? 0.05 : 0.042) * k
  const balls = ball.mesh(GLOW), iris = piv(piv(dots.mesh(GLOW), [0, 0, rc]), [0, 0, -rc]), lu = up.mesh(GLOW), ll = low.mesh(GLOW), shut = joy.mesh(GLOW)
  lu.position.y = ry + RIM; ll.position.y = -ry - RIM
  const eyes = piv(G(balls, iris, lu, ll, shut), [0, cy, 0])
  // The mouth: its rest shape (a line), the open one (a filled half disc hanging from its flat top; no tongue: it read as a tongue stuck out) and the "o".
  const my = o.my ?? -0.108 * k, m = N(), gap = N()
  if (st.mouth === 'beam') { m.add(tor(0.092, 0.019, PI * 0.8), lip, { r: [0, 0, PI * 1.1] }); for (const s of [-1, 1]) m.add(coin(), lip, { p: [s * 0.094, -0.022, 0], s: [0.024, 0.024, 0.02] }) } // a broad smile with dimples
  else if (st.mouth === 'cat') for (const s of [-1, 1]) m.add(tor(0.042, 0.017, PI), lip, { p: [s * 0.042, -0.01, 0], r: [0, 0, PI] }) // two small bows
  else if (st.mouth === 'bar') { m.add(tor(0.17, 0.019, 0.9), lip, { p: [0, 0.125, 0], r: [0, 0, -H - 0.45] }); for (const s of [-1, 1]) m.stroke(lip, s * 0.076, -0.005, s * 0.076, -0.05, 0, 0.022, 0.03) } // a shallow speaker slot between two ticks
  else m.add(tor(0.075, 0.02, PI), lip, { r: [0, 0, PI] })
  if (st.mouth === 'bar') gap.add(rr(2, 1, 0.35, 1), lip, { p: [0, -0.5, 0], s: [0.07, 1, 0.01] })
  else gap.add(half(), lip, { p: [0, -1, 0], s: [0.078, -1, 0.01] })
  const rest = piv((o.mouth ?? m).mesh(GLOW), [0, my, 0]), wide = o.mouth ? undefined : piv(gap.mesh(GLOW), [0, my + 0.022, 0])
  const oh = piv(N().add(coin(), lip, { s: [0.05, 0.06, 0.01] }).mesh(GLOW), [0, my - 0.035, 0])
  const lips = G(rest, oh); if (wide) lips.add(wide)
  lips.scale.setScalar(o.mouth ? 1 : k); lips.position.y = o.mouth ? 0 : my * (1 - k) // on a low screen (saucer, drum) the mouth is smaller, about its own place
  const LOOK = [0, 1, 0, -1, 0, 0.6, -0.6, 0], side = st.seed & 1 ? 1 : -1
  let sung = 0
  shut.visible = oh.visible = lu.visible = ll.visible = false
  if (wide) wide.visible = false
  brows.forEach(b => { b.visible = o.brows !== false }) // a house cat has no painted brows
  const face = G(eyes, brows[0], brows[1], lips)
  return {
    face, open: 1, shape: 'rest',
    sing(open) { sung = open },
    act(u, e, ty, th, ha, mi, dn, live, lids = 0) {
      const op = this.open = Math.min(live ? blink(u, st.seed) : 1, 1 - lids), x = Math.min(1, e), glad = Math.max(ha, dn)
      const laugh = dn > 0.5 && u % 4 < 1.2 // delighted: the eyes shut in a laugh now and then
      shut.visible = laugh; balls.visible = iris.visible = !laugh
      // the lids: the upper one droops in thought and at a loss, the lower one rises with a smile; a blink brings them together
      const droop = Math.min(0.5, 0.3 * th + 0.24 * mi), smile = Math.min(0.3, 0.22 * glad + 0.12 * x)
      const U = droop + (0.7 - droop) * (1 - op), L = smile + (Math.max(0.32, smile) - smile) * (1 - op)
      lu.visible = !laugh && U > 0.02; ll.visible = !laugh && L > 0.02; lu.scale.y = U * EH; ll.scale.y = L * EH
      eyes.scale.y = 1 + 0.07 * ty + 0.07 * x // wide when attentive
      // the eyes: a quick look aside now and then, held, and back; they follow the pointer; up and aside in thought, down at the message box, down and away at a loss
      const q = u / 2.3 + st.seed % 7, i = Math.floor(q), glance = LOOK[(i + 7) & 7] + (LOOK[i & 7] - LOOK[(i + 7) & 7]) * ease(Math.min(1, (q - i) / 0.06))
      const calm = live ? (1 - th) * (1 - ty) * (1 - mi) : 0
      const gx = calm * (gaze.x + 0.55 * glance * (1 - gaze.k)) + side * th * (0.6 + 0.3 * Math.sin(u * 1.3)) - side * 0.5 * mi, gy = calm * gaze.y + 0.75 * th - 0.7 * ty - 0.55 * mi
      if (rc) iris.rotation.y = gx * TX / rc; else iris.position.x = gx * TX
      iris.position.y = gy * TY
      // the brows: up when attentive or glad, one up and one down in thought, slanted (inner ends up) at a loss; they bounce to a dance
      brows.forEach((b, j) => { const d = j ? 1 : -1, on = d === side ? 1 : 0
        b.position.y = by + k * (0.03 * ty + 0.022 * glad + 0.028 * x + th * (on ? 0.04 : -0.014) + 0.012 * dn * Math.sin(u * TAU) + (live ? 0.005 * Math.sin(u * 0.9 + j) : 0)) - 0.5 * U * EH * (1 - op) * 0.3
        b.rotation.z = -d * 0.36 * mi + d * 0.16 * th * on })
      // the mouth: talks while it is pleased with its answer, grins when greeted or dancing, an "o" when it sings, a small one aside in thought, a lopsided frown at a loss
      const talk = ha * (0.2 + 0.8 * Math.abs(Math.sin(u * 10.5)) * (0.55 + 0.45 * Math.sin(u * 3.3 + 1))), gape = Math.max(talk, 0.7 * Math.max(x, dn)) * (1 - mi)
      const round = sung > 0.05 || th > 0.45, open = !round && !!wide && gape > 0.3
      this.shape = round ? 'oh' : gape > 0.3 ? 'open' : mi > 0.45 ? 'frown' : 'rest'
      oh.visible = round; rest.visible = !round && !open
      if (wide) { wide.visible = open; wide.scale.set(1 + 0.25 * Math.max(x, dn), 0.03 + 0.1 * gape, 1) }
      if (round) { const s = sung > 0.05 ? 1 : 0.6; oh.scale.set(s * (1 - 0.3 * sung), s * (sung > 0.05 ? 0.25 + 0.75 * sung : 1), 1); oh.position.x = sung > 0.05 ? 0 : side * 0.035 * th }
      rest.scale.set(1 + (live ? 0.05 * Math.sin(u * 1.3) : 0) + 0.12 * ty - 0.4 * mi, (1 - 1.5 * mi) * (wide ? 1 : 1 + 0.9 * gape), 1)
      rest.rotation.z = side * 0.14 * mi
    },
  }
}

/** glow = the gold platform of the current bot, scaled in and out by the gallery. */
/** fy = height of the middle of the head (the chat portrait looks there). */
/** The show. A bot idles for ten seconds, then performs: six poses of five seconds, six dances of six or eight and four performances
 *  on an instrument of eight, taking turns, sixteen in a round: 104 s of show in every 272 s (the idle sway alone repeats after 63 s). `no` shifts the round and turns its
 *  order, so neighbours are never in step; `calm` (a mood, the pointer) takes the act away. T = the idle clock, which stands still
 *  during an act; p = which act (0-5 poses, 6-11 dances, 12-15 performances), d = its seconds, t = how far into it (0..1), w = how much of it shows
 *  (eased in and out), on = 1 - calm. */
const REST = TAU * 10 / 6, DUR = [5, 5, 5, 5, 5, 5, 8, 6, 8, 6, 8, 6, 8, 8, 8, 8], SEQ = [0, 6, 1, 12, 7, 2, 8, 13, 3, 9, 4, 14, 10, 5, 11, 15], ROUND = 16 * REST + 104
/** dn = asked about dancing (the 'dance' mood): no waiting for a turn, all six dances back to back, three seconds each. */
function show(u: number, no: number, calm: number, dn = 0) {
  const v = u + no * 7.3, r = Math.floor(v / ROUND), on = Math.max(0, 1 - calm)
  let s = v - r * ROUND, i = 0, p = 0, d = 5
  for (; ; i++) { p = SEQ[(i * (no & 1 ? 15 : 1) + no) % 16]; d = DUR[p]; if (i === 15 || s < REST + d) break; s -= REST + d }
  const t = Math.min(1, Math.max(0, (s - REST) / d)), k = 0.7 / d
  const T = still.on ? no * 7.3 : (r * 16 + i) * REST + Math.min(s, REST), q = u / 3 // less motion asked for: the idle clock stands still for good, each bot in a stance of its own
  // the dance comes in over the second half of dn: by then calm (2 dn or more) has taken the act of the round away, so nothing jumps
  if (dn > 0.5) { const g = ease(2 * dn - 1); return { T, p: 6 + (Math.floor(q) + no) % 6, d: 3, t: q - Math.floor(q), on: g, w: g } }
  return { T, p, d, t, on, w: ease(Math.min(1, t / k, (1 - t) / k)) * on }
}
/** A whole turn can only be shown whole: at half weight (a visitor came by half way) it ended half way round and snapped back.
 *  So a turn is followed, not weighted: towards TAU * turn while the show is on and towards 0 when it is not, the short way
 *  round and never in one jump. One per turning part; u = the clock. */
function spinner() {
  let a = 0, last = 0
  return (u: number, sh: { on: number }, turn: number) => {
    const to = sh.on > 0.5 ? TAU * turn : 0, k = 1 - Math.exp(-Math.min(0.1, Math.abs(u - last)) * 14)
    last = u
    return a += Math.atan2(Math.sin(to - a), Math.cos(to - a)) * k
  }
}
/** The dances, on a beat of 120 a minute (b = beats into the dance): what one adds to the idle stance, written into `mv` (one
 *  object, nothing allocated per frame). ry/rz/bx/up/dip move the body (hips sway side to side only), hy/hx/hz the head,
 *  la/lx the free arm, ra the arm with the prop. No arm is held up straight: the free arm stays below the shoulder and keeps moving. */
const mv = { ry: 0, rz: 0, bx: 0, up: 0, dip: 0, hy: 0, hx: 0, hz: 0, la: 0, lx: 0, ra: 0, py: 0, turn: 0, h: 0, sing: 0, tz: 0, gx: 0, gy: 0, gz: 0, qx: 0, qy: 0 }
function dance(k: number, t: number, d: number) {
  const b = t * d * 2, h = seg(t, 0.05, 0.15) - seg(t, 0.86, 0.96), sw = Math.sin(H * Math.cos(PI * b)) /* side to side, held on the beat */, bob = 0.5 + 0.5 * Math.cos(TAU * b)
  mv.ry = mv.rz = mv.bx = mv.up = mv.hy = mv.hx = mv.hz = mv.la = mv.lx = mv.ra = mv.py = mv.turn = 0
  mv.dip = 0.7 * h * bob // sinks into every beat
  switch (k) {
    case 0: mv.bx = 0.07 * h * sw; mv.rz = 0.05 * h * sw; mv.hz = -0.13 * h * sw; mv.hx = 0.1 * h * bob; mv.la = -0.3 * h - 0.22 * h * sw; mv.lx = -0.25 * h * sw; mv.ra = 0.1 * h * sw; break // the groove: steps side to side, the hips sway, the head bobs
    case 1: { const n = Math.floor(b), q = n + seg(b - n, 0, 0.3), a = Math.sin(H * q), c = Math.cos(H * q) // the robot: one joint at a time snaps to its place and holds
      mv.dip = 0; mv.ry = 0.3 * h * a; mv.hy = 0.45 * h * c; mv.hz = 0.16 * h * a; mv.la = -0.85 * h * Math.max(0, c); mv.lx = -0.55 * h * Math.max(0, -c); mv.ra = 0.14 * h * Math.max(0, -a); mv.up = 0.03 * h * Math.max(0, a); break }
    case 2: { const g = seg(t, 0.2, 0.42) - seg(t, 0.58, 0.8), air = Math.sin(PI * seg(t, 0.2, 0.42)) + Math.sin(PI * seg(t, 0.58, 0.8)) // a turn one way, a few steps, a turn back, the arms flung out by it
      mv.turn = g; mv.la = -0.3 * h - 0.6 * air - 0.12 * h * sw; mv.py = 0.22 * air; mv.up = 0.05 * air; mv.bx = 0.05 * h * sw * (1 - air); mv.rz = 0.04 * h * sw * (1 - air); mv.hz = -0.1 * h * sw; break }
    case 3: mv.la = -0.55 * h - 0.45 * h * Math.sin(PI * b); mv.rz = 0.05 * h * Math.sin(PI * b - 0.8); mv.bx = 0.05 * h * Math.sin(PI * b - 0.8); mv.hz = 0.14 * h * Math.sin(PI * b - 1.4); mv.ra = 0.16 * h * Math.sin(PI * b - 2); mv.up = 0.04 * h * (1 - bob); break // the wave: runs from the free hand through the shoulders and the head to the other hand
    case 4: { const low = Math.sin(PI * seg(t, 0.2, 0.8)) // the twist: the body swivels under a head that keeps looking ahead, sinking low and coming up again
      mv.ry = 0.3 * h * sw; mv.hy = -0.26 * h * sw; mv.lx = 0.45 * h * sw; mv.la = -0.32 * h; mv.ra = -0.08 * h * sw; mv.hx = 0.08 * h * bob; mv.dip = 0.3 * h * bob + 1.2 * h * low; break }
    default: mv.ry = 0.5 * h; mv.bx = 0.12 * h * Math.cos(PI * seg(t, 0.16, 0.84)); mv.rz = 0.035 * h * sw; mv.hx = 0.12 * h * bob; mv.lx = -0.38 * h * sw; mv.la = -0.15 * h; mv.dip = 0.45 * h * bob // the glide: side on, sliding backwards on the beat
  }
}
/** The animals' acts, on the show's timing and act table (a pet plays no instrument and waves no hand): five moves each, act p
 *  doing move p % 5, each a real dog's or cat's behaviour with its legs. Writes `mv` as a dance does (the whole body: bx, up, ry, rz,
 *  turn; the head: hx down, hy, hz), and `pm`: rx = the trunk turned about the hips (+ chest down, - sitting up), lo = the hips lowered,
 *  rl = the trunk rolled, l{0-3}{y,z} = a paw lifted and moved forward from its place (0, 1 the far and near front paw, 2, 3 the
 *  hind ones), kf = 1: a lifted front paw folds back at the wrist (0: the elbow bends behind), ft = the hind feet lying flat (sitting),
 *  sp = the near hind leg swung out, fw = a jump forward, wag = tail (wag, swish), up = the cat's tail straight up, wrap = wrapped
 *  round its feet, arch = the back arched, fluff = the heron's crest raised, step = which leg the heron stands on (0 left, 1 right),
 *  shut = eyelids closed. */
const pm = { rx: 0, lo: 0, rl: 0, l0y: 0, l0z: 0, l1y: 0, l1z: 0, l2y: 0, l2z: 0, l3y: 0, l3z: 0, kf: 0, ft: 0, sp: 0, fw: 0, wag: 0, up: 0, wrap: 0, arch: 0, fluff: 0, step: 0, shut: 0 }
const LEGY = ['l0y', 'l1y', 'l2y', 'l3y'] as const, LEGZ = ['l0z', 'l1z', 'l2z', 'l3z'] as const
function petAct(pet: 'dog' | 'cat' | 'heron', k: number, t: number, d: number) {
  const b = t * d * 2, h = seg(t, 0.05, 0.15) - seg(t, 0.86, 0.96), sw = Math.sin(H * Math.cos(PI * b)), bob = 0.5 + 0.5 * Math.cos(TAU * b), s = t * d /* seconds in */
  const hold = (a: number, z: number) => seg(t, a, a + 0.15) - seg(t, z, z + 0.15) // in at a, out at z
  const sit = (g: number, lo: number, rx: number) => { pm.lo = lo * g; pm.rx = -rx * g; pm.l2z = pm.l3z = 0.12 * g; pm.ft = g } // haunches down, hind feet flat and forward, front legs straight
  mv.ry = mv.rz = mv.bx = mv.up = mv.hy = mv.hx = mv.hz = mv.la = mv.lx = mv.ra = mv.py = mv.turn = mv.dip = 0
  for (const key in pm) pm[key as keyof typeof pm] = 0
  switch (`${pet}${k}`) {
    case 'dog0': { const c = Math.sin(TAU * 0.75 * s), A = h * Math.max(0, c), B = h * Math.max(0, -c) // trots on the spot: diagonal pairs of legs lift by turns
      pm.l0y = pm.l3y = 0.16 * A; pm.l1y = pm.l2y = 0.16 * B; pm.l0z = pm.l3z = 0.06 * A; pm.l1z = pm.l2z = 0.06 * B; pm.kf = 1
      mv.up = 0.025 * h * Math.abs(c); mv.hx = 0.06 * h * Math.abs(c); mv.rz = 0.03 * h * c; pm.wag = h; break }
    case 'dog1': { const g = hold(0.06, 0.8), p = hold(0.3, 0.64) * g // sits, then gives a paw and shakes it
      sit(g, 0.3, 0.45); pm.l1y = (0.55 + 0.05 * Math.sin(TAU * 2 * s)) * p; pm.l1z = 0.3 * p; mv.hz = 0.2 * p; mv.hx = -0.1 * g; pm.wag = g; break }
    case 'dog2': { const g = hold(0.08, 0.74) // a play bow: front legs folded flat, chest down, rump and tail up, bouncing to play
      pm.rx = (0.5 + 0.06 * bob) * g; pm.l0z = pm.l1z = 0.14 * g; mv.hx = -0.45 * g; mv.rz = 0.04 * g * sw; pm.wag = g; break }
    case 'dog3': { const g = hold(0.06, 0.82), c = hold(0.2, 0.68) * g // sits and scratches behind its ear with a hind leg, eyes shut
      sit(g, 0.3 - 0.1 * c, 0.45); pm.l3y = (0.62 + 0.08 * Math.sin(TAU * 5 * s)) * c; pm.l3z = 0.5 * c; pm.sp = 0.25 * c
      mv.hz = -0.6 * c; mv.hx = 0.45 * c; mv.hy = -0.3 * c; pm.rl = -0.25 * c; pm.shut = 0.8 * c; pm.wag = 0.3 * g; break }
    case 'dog4': { const g = hold(0.1, 0.76), c = Math.sin(TAU * 4.5 * s) // shakes itself dry: head first, the body twisting after it, ears flapping
      pm.rl = 0.36 * g * c; mv.hz = 0.45 * g * Math.sin(TAU * 4.5 * s + 0.9); mv.hy = 0.15 * g * c; mv.up = 0.02 * g * Math.abs(c); pm.wag = g; pm.shut = 0.5 * g; break }
    case 'cat0': { const a = hold(0.05, 0.42), c = hold(0.5, 0.8) // the stretch: front legs reaching far forward, rump up; then one hind leg stretched back
      pm.rx = 0.45 * a - 0.08 * c; pm.l0z = pm.l1z = 0.26 * a + 0.06 * c; mv.hx = -0.15 * a + 0.1 * c; pm.up = 0.5 * a
      pm.l3z = -0.26 * c; pm.l3y = 0.08 * c; pm.l2z = -0.04 * c; pm.shut = 0.6 * a; break }
    case 'cat1': { const g = hold(0.05, 0.6), wg = hold(0.28, 0.45) * g, j = seg(t, 0.62, 0.76), air = Math.sin(PI * j), back = seg(t, 0.8, 0.98) // hunts: a crouch, the rump wiggles, then the pounce
      pm.lo = 0.18 * g; pm.rx = 0.04 * g - 0.25 * air; pm.l0z = pm.l1z = 0.05 * g + 0.16 * air; pm.l0y = pm.l1y = 0.07 * air; pm.l2z = pm.l3z = -0.12 * air; pm.ft = 0.4 * g
      pm.rl = 0.12 * wg * Math.sin(TAU * 3 * s); pm.wag = 0.5 * g + wg; mv.hx = -0.08 * g; mv.up = 0.28 * air; pm.fw = 0.35 * (j - back); break }
    case 'cat2': { const g = hold(0.05, 0.84), lk = hold(0.15, 0.48) * g, wp = hold(0.52, 0.74) * g // sits and grooms: licks a raised front paw, then wipes its face with it
      sit(g, 0.24, 0.45); pm.wrap = g; pm.l1y = 0.62 * lk + (0.72 + 0.05 * Math.sin(TAU * 1.5 * s)) * wp; pm.l1z = 0.2 * lk + 0.14 * wp
      mv.hx = (0.35 + 0.08 * Math.sin(TAU * 3 * s)) * lk + 0.1 * wp; mv.hz = 0.2 * wp * Math.sin(TAU * 1.5 * s); pm.shut = 0.6 * (lk + wp); break }
    case 'cat3': { const g = hold(0.05, 0.84), c = Math.sin(TAU * s) // kneads: front paws pressing down by turns, eyes half shut, purring
      sit(g, 0.16, 0.2); pm.wrap = 0.5 * g; pm.kf = 1; pm.l0y = 0.08 * g * Math.max(0, c); pm.l1y = 0.08 * g * Math.max(0, -c); pm.l0z = pm.l1z = 0.03 * g
      pm.shut = 0.65 * g; mv.hx = 0.1 * g; mv.hz = 0.05 * g * c; break }
    case 'cat4': { const g = hold(0.06, 0.8), hp = seg(t, 0.3, 0.7) // the Halloween cat: back arched high, tail straight up, side on, hopping sideways
      pm.arch = g; pm.up = g; mv.ry = -0.4 * g; mv.hx = 0.08 * g; mv.bx = 0.12 * g * Math.sin(PI * hp); mv.up = 0.05 * g * Math.abs(Math.sin(TAU * 1.5 * s)) * Math.sin(PI * hp); break }
    case 'heron0': mv.hz = 0.3 * h * sw; mv.hy = 0.15 * h * sw; mv.bx = 0.05 * h * sw; break // sways its neck and head
    case 'heron1': { const f = Math.abs(Math.sin(TAU * b)); mv.la = -1.3 * h * f; mv.ra = 0.35 * h * f; mv.up = 0.06 * h * f; pm.fluff = 0.4 * h; break } // flaps its wings
    case 'heron2': { const s = seg(t, 0.4, 0.6); pm.step = s > 0.5 ? 1 : 0; mv.up = 0.1 * Math.sin(PI * s) * h; mv.rz = 0.07 * h * (1 - 2 * s); break } // steps from one leg onto the other
    case 'heron3': { const g = hold(0.15, 0.7); pm.rx = 0.25 * g; mv.hx = 0.65 * g; break } // a bow, the neck dipping
    default: pm.fluff = h * (0.6 + 0.4 * Math.abs(Math.sin(TAU * b))); mv.hz = 0.1 * h * sw; mv.hx = -0.12 * h // fluffs its crest
  }
}
/** The performances (acts 12-15), on the same beat and without a sound: the bot takes out an instrument, plays and puts it away.
 *  0 sings into a microphone, 1 shakes a tambourine, 2 plays a keytar worn high across the chest, 3 a keyboard hovering before it.
 *  Adds to `mv` as a dance does (no hip moves: a light bounce and the head); h = how far the instrument is out, g = where the free
 *  hand is and q = the other one (keytar, keyboard), from the shoulder (x towards the middle, z from the front of the chest).
 *  The hands stay close to the chest, so both elbows are bent: no arm is held out or up straight. */
function perform(k: number, t: number, d: number) {
  const b = t * d * 2, h = seg(t, 0.05, 0.15) - seg(t, 0.86, 0.96), sw = Math.sin(H * Math.cos(PI * b)), bob = 0.5 + 0.5 * Math.cos(TAU * b)
  mv.ry = mv.rz = mv.bx = mv.up = mv.hy = mv.hx = mv.la = mv.lx = mv.ra = mv.py = mv.turn = mv.sing = mv.tz = mv.qx = mv.qy = 0
  mv.h = h; mv.dip = 0.45 * h * bob; mv.hz = -0.1 * h * sw; mv.gx = 0.2; mv.gy = 0.02; mv.gz = 0.05
  switch (k) {
    case 0: mv.sing = h * (0.2 + 0.8 * Math.abs(Math.sin(PI * b * 0.75)) * (0.6 + 0.4 * Math.sin(b * 0.9))); mv.hz = 0.13 * h * Math.sin(H * b); mv.hx = -0.1 * h + 0.05 * h * bob; mv.gy = 0.03 + 0.015 * bob; mv.gz = 0.08; mv.ra = 0.1 * h * sw; break // sings: the mouth opens and closes, the head sways, chin up
    case 1: mv.gx = 0.1; mv.gy = -0.07 + 0.05 * Math.sin(TAU * b); mv.gz = 0.09; mv.tz = 0.3 * Math.sin(TAU * b); mv.hx = 0.08 * h * bob; mv.bx = 0.04 * h * sw; mv.ra = 0.1 * h * sw; break // the tambourine: shaken twice a beat before the shoulder
    case 2: mv.gx = 0.2 + 0.035 * Math.sin(H * b); mv.qx = 0.22; mv.qy = -0.12 + 0.03 * Math.sin(TAU * b); mv.ry = -0.12 * h; mv.hx = 0.1 * h * bob; break // the keytar: one hand moves along the neck, the other plays the keys
    default: mv.gx = 0.16 + 0.04 * Math.sin(H * b); mv.qx = 0.16 - 0.04 * Math.sin(H * b + 1); mv.gy = -0.05 + 0.05 * Math.max(0, Math.sin(PI * b)); mv.qy = -0.05 + 0.05 * Math.max(0, -Math.sin(PI * b)); mv.gz = 0.08; mv.hx = 0.14 * h; mv.hy = 0.12 * h * sw // the keyboard: the hands take turns, the head follows them
  }
}
const A1 = 0.28, A2 = 0.23 /* upper arm, forearm */, vd = new THREE.Vector3(), vn = new THREE.Vector3(), vz = new THREE.Vector3(), mb = new THREE.Matrix4(), qa = new THREE.Quaternion()
/** Bends an arm so that its hand is at (x, y, z) from the shoulder, the elbow low and to the side `out`; k = how much of the way from where it is. */
function reach(arm: THREE.Object3D, fore: THREE.Object3D, x: number, y: number, z: number, out: number, k: number) {
  const d = Math.min(0.49, Math.hypot(x, y, z))
  vd.set(x, y, z).normalize(); vn.set(out * 0.5, -1, -0.2); vn.crossVectors(vd, vn).normalize()
  vd.applyAxisAngle(vn, Math.acos((A1 * A1 + d * d - A2 * A2) / (2 * A1 * d))).negate() // the upper arm, turned from the hand towards the elbow's side
  arm.quaternion.slerp(qa.setFromRotationMatrix(mb.makeBasis(vn, vd, vz.crossVectors(vn, vd))), k)
  fore.rotation.x = k * (Math.acos((A1 * A1 + A2 * A2 - d * d) / (2 * A1 * A2)) - PI)
}
/** 0 before a, 1 after b, eased between: one move of a pose. */
const seg = (t: number, a: number, b: number) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))))
/** Set by the scene when the visitor's system asks for less motion: the figures then stand still (no idle sway, no acts, no turning props) and
 *  keep their blinks, their eyes on the visitor, their moods as poses, and a dance the visitor asks for. */
export const still = { on: false }
const calmOf = (e: number, m?: number[]) => m && !still.on ? Math.min(1, 2 * Math.max(e, ...m)) : 1 // a still picture (no moods given) never poses

interface Fig { root: THREE.Group; tick: Tick; bots: THREE.Group[]; rest: THREE.Object3D[]; glow: THREE.Group; fy: number; rig: Face; tools: THREE.Object3D[] /* the instruments of the performances, hidden unless played */ }

const HAIR = '#2a1b17', SHIRT = '#f8f4ee', GREEN = '#00573f', SHELL = '#f6ecdf', PLATE = '#f2f3f6', GRAPH = '#3b4252', VISOR = '#141a26' /* chest displays only */, SEAM = '#9ea3b2' /* gaskets, panel lines */, TAN = '#ecc9a4' /* a light kayumanggi face for about a third of the bots */, FACE = '#f1d4d5' /* pale UP maroon */, INK = '#4a0a0c'
// Finishes (roughness, metalness, own light): enamelled shells, brushed-metal joints, rubber, glass screens.
for (const hex of [PLATE, SHELL, SHIRT, W]) finish(hex, 0.16)
finish(GRAPH, 0.36, 0.85); finish(GREY, 0.3, 0.85); finish(GOLD, 0.2, 0.2); finish(K, 0.75); finish(HAIR, 0.22)
finish(SEAM, 0.6); finish(VISOR, 0.04); finish(GLASS, 0.04); finish(FACE, 0.08, 0, 0.4); finish(TAN, 0.08, 0, 0.4) // the face is a lit screen: light in any lighting
const BARONG = '#efe2bf' /* piña ecru */, BARO = '#fbf4e6', TRIM = mix(BARONG, '#8a6a2a', 0.35) /* seams, placket, cuffs */, EMB = mix(GOLD, BARONG, 0.4) /* embroidery thread */
/** UPOU's mascots as service robots: Iska (0: long hair as a sculpted helmet, wide LED smile) and Iskou (1: short hair,
 *  his glasses as bright frames on the visor), in national dress under the sablay: she in a baro't saya (butterfly sleeves,
 *  panuelo, a maroon saya under a green tapis), he in a barong Tagalog over dark trousers. */
function mascot(who: 0 | 1): { bot: THREE.Group; arm: THREE.Group; side: number; rig: Face; tick: (u: number, e: number, m: number[] | undefined, u0: number, dn: number) => void } {
  const torso = N(), head = N(), side = who ? 1 : -1 // the arm on the outside of the pair does the talking
  for (const s of [-1, 1]) torso.add(dome, K, { p: [s * 0.17, 0, 0.05], s: [0.16, 0.12, 0.24] }).add(cyl, who ? '#39405a' : GRAPH, { p: [s * 0.16, 0.24, 0], s: [who ? 0.09 : 0.06, 0.34, who ? 0.09 : 0.06] })
  torso.add(rr(0.74, 0.8, 0.3, 0.56, 0.1), who ? BARONG : BARO, { p: [0, 0.78, 0] }).add(cyl, GRAPH, { p: [0, 1.2, 0], s: [0.11, 0.14, 0.11] })
  let saya: THREE.Group | undefined
  if (who) { // the barong: untucked to the hips with side slits, a pointed collar, a placket and an embroidered front
    torso.add(rr(0.72, 0.26, 0.08, 0.54, 0.05), BARONG, { p: [0, 0.38, 0] }).stroke(TRIM, 0, 1.02, 0, 0.28, 0.285, 0.035, 0.02)
    for (const s of [-1, 1]) {
      torso.stroke(TRIM, s * 0.16, 1.14, s * 0.02, 1.02, 0.285, 0.06, 0.03).add(box, TRIM, { p: [s * 0.36, 0.3, 0], s: [0.025, 0.11, 0.07] }).stroke(EMB, s * 0.1, 0.98, s * 0.1, 0.5, 0.285, 0.02, 0.02)
      for (const y of [0.9, 0.74, 0.58]) torso.add(box, EMB, { p: [s * 0.2, y, 0.285], r: [0, 0, PI / 4], s: [0.06, 0.06, 0.02] })
    }
  } else { // the baro't saya: a panuelo over the baro, a full saya with the tapis over it (it hides the legs), swaying from the waist
    for (const s of [-1, 1]) torso.stroke(BARONG, s * 0.3, 1.16, 0, 0.9, 0.285, 0.1, 0.03)
    torso.add(sph, GOLD, { p: [0, 0.9, 0.3], s: 0.035 })
    const z: V3 = [1, 1, 0.85]
    saya = piv(N().add(lathe('saya', [[0.4, -0.02], [0.46, -0.26], [0.54, -0.52], [0.6, -0.73]]), MAROON, { s: z }).add(lathe('tapis', [[0.3, 0.01], [0.415, 0], [0.475, -0.26], [0.49, -0.32]]), GREEN, { s: z })
      .add(lathe('tapisHem', [[0.495, -0.31], [0.51, -0.36]]), GOLD, { s: z }).add(lathe('sayaHem', [[0.6, -0.67], [0.615, -0.73]]), GOLD, { s: z }), [0, 0.76, 0])
  }
  const sash = { p: [0, 0.8, 0] as V3, r: [H, 0.62, 0] as V3 }
  torso.add(tor(0.41, 0.05), MAROON, { ...sash, s: [1.05, 0.9, 1.8] }).add(tor(0.41, 0.028), GREEN, { ...sash, o: [0, 0, 0.075], s: [1.06, 0.91, 1] }).add(tor(0.41, 0.028), GOLD, { ...sash, o: [0, 0, -0.075], s: [1.06, 0.91, 1] })

  // head: a round shell with a glass porthole; what is on the visor glows
  head.add(sphHi, SHELL, { p: [0, 0.36, 0], s: [0.5, 0.47, 0.47] }).add(sphHi, FACE, who ? { p: [0, 0.3, 0.26], s: [0.4, 0.29, 0.24] } : { p: [0, 0.25, 0.26], s: [0.42, 0.36, 0.24] }) // Iska's face reaches her chin: the shaded shell below it read as a beard
  for (const s of [-1, 1]) head.add(cyl, GRAPH, { p: [s * 0.49, 0.3, 0], r: [0, 0, H], s: [0.1, 0.06, 0.1] })
  if (who) head.add(sph, SEAM, { p: [0, 0.3, 0.26], s: [0.425, 0.31, 0.205] }) // not on Iska: a grey rim round her jaw read as a beard
  // the smile: Iska's is open and rose (a wide dark one low on the face read as a goatee), Iskou's a grin
  const lip = who ? INK : '#b03a55', rig = faceRig(0.165, 0.42, { eye: 'round', mouth: 'smile', seed: who ? 0x51c0 : 0x15ca }, { iris: '#7a4526', lid: FACE, cap: 0.105, lip, my: who ? -0.17 : -0.15,
    mouth: N().add(ext('grin', () => { const g = new THREE.Shape(); g.moveTo(-1, 0); g.absarc(0, 0, 1, PI, TAU, false); g.closePath(); return g }, 0.03), lip, { s: who ? [0.11, 0.05, 1] : [0.12, 0.065, 1] }) })
  const hd = piv(G(head, piv(rig.face, [0, 0.36, 0.505])), [0, 1.2, 0])
  let hair: THREE.Group | undefined, specs: THREE.Group | undefined
  // the hair as a sculpted helmet: a crown tilted back over the brow and a shell round the back of the head
  const cap = N().add(dome, HAIR, { p: [0, 0.42, -0.02], r: [-0.35, 0, 0], s: [0.545, 0.5, 0.52] }).add(sphHi, HAIR, { p: [0, 0.37, -0.1], s: [0.535, 0.5, 0.45] })
  if (who) {
    hd.add(cap.add(sph, HAIR, { p: [0.12, 0.7, 0.42], r: [0.3, 0, -0.2], s: [0.26, 0.09, 0.14] }).mesh())
    const g = pair(N(), tor(0.135, 0.02), GRAPH, 0.17, 0.42, 1).stroke(GRAPH, -0.05, 0, 0.05, 0, 0, 0.022, 0.02)
    hd.add(specs = piv(g, [0, 0.4, 0.53]))
  } else {
    hd.add(cap.add(sph, HAIR, { p: [-0.16, 0.62, 0.43], r: [0, 0, 0.35], s: [0.36, 0.1, 0.07] }).add(sph, HAIR, { p: [0.33, 0.58, 0.36], r: [0, 0.5, -0.7], s: [0.2, 0.08, 0.07] }).mesh())
    // a bob that ends at the jaw: hair showing under the chin read as a beard
    const g = N().add(rr(0.98, 0.66, 0.3, 0.2), HAIR, { p: [0, -0.33, -0.24] })
    for (const s of [-1, 1]) g.add(rr(0.15, 0.7, 0.07, 0.36), HAIR, { p: [s * 0.5, -0.34, 0.02] })
    hd.add(hair = piv(g, [0, 0.52, -0.1]))
  }
  const cloth = who ? BARONG : SHIRT
  const arm = () => { // his long sleeves end in cuffs; her butterfly sleeves stand stiff round the shoulders, turning with the arms
    const a = N().add(sph, GRAPH, { s: 0.11 }).add(cyl, cloth, { p: [0, -0.16, 0], s: [0.085, 0.2, 0.085] }).add(sph, GRAPH, { p: [0, -0.28, 0], s: 0.08 }).add(cyl, cloth, { p: [0, -0.37, 0], s: [0.085, 0.14, 0.085] }).add(sph, SHELL, { p: [0, -0.49, 0], s: 0.11 })
    return who ? a.add(cyl, TRIM, { p: [0, -0.425, 0], s: [0.095, 0.035, 0.095] }) : a.add(sph, BARO, { p: [0, 0.05, 0], s: [0.26, 0.23, 0.13] })
  }
  const idle = piv(arm(), [-side * 0.42, 1, 0]), busy = piv(arm(), [side * 0.42, 1, 0])
  const bot = G(torso, hd, idle, busy)
  if (saya) bot.add(saya)
  return {
    bot, arm: idle, side, rig,
    tick(u, e, m, u0, dn) {
      const [ty, th, ha, mi] = m ?? [0, 0, 0, 0]
      bot.position.y = Math.abs(Math.sin(u * 2.2)) * 0.03 + (e + ha) * Math.abs(Math.sin(u * 7)) * 0.14
      bot.rotation.z = Math.sin(u * 1.1) * 0.03
      hd.rotation.z = Math.sin(u * 1.3) * 0.09 + 0.2 * th * side - 0.16 * mi * side
      hd.rotation.x = Math.sin(u * 0.9) * 0.05 + 0.26 * ty + 0.18 * ha * Math.sin(u * 5.5) ** 2
      rig.act(u0, e, ty, th, ha, mi, dn, !!m)
      idle.rotation.z = -side * (0.2 + Math.sin(u * 2.2) * 0.06)
      if (hair) { // Iska waves; her hair sways
        hair.rotation.z = Math.sin(u * 1.6) * 0.07
        saya!.rotation.z = Math.sin(u * 2.2 - 0.8) * 0.03
        const q = Math.min(1, e) // two waves of a fixed speed, mixed: a speed that grows with e (sin(u * (4 + 5e))) shakes the arm whenever e moves, the more the longer the page is open
        busy.rotation.z = side * (2.5 + ((1 - q) * Math.sin(u * 4) + q * Math.sin(u * 9)) * 0.3)
      } else if (specs) { // Iskou's glasses hop now and then (all the time while he has the pointer) while he gives a low wave.
        // The arm stays below the shoulder, bent out to the side and always wagging: a straight arm held up and forward read as a salute.
        const q = (u % 5.2) / 0.9, k = Math.max(e, q < 1 ? ease(Math.min(1, 2 - Math.abs(q * 4 - 2))) : 0)
        busy.rotation.set(0, 0, side * (0.2 + k * (0.55 + 0.25 * Math.sin(u * 9))))
        specs.position.y = 0.4 + 0.035 * k * (0.5 + 0.5 * Math.sin(u * 9))
      }
    },
  }
}

/** The gold platform, its shadow and the topic's prop held up beside the figure. */
function stage(f: FigureSpec, a: string, on: (x: Tick) => void) {
  const item = G(PROP[f.prop](a, on))
  item.rotation.x = 0.22
  const prop = piv(item, [0.7, 1.44, 0.3])
  const base = shade(2.3, 1.4)
  base.position.set(0.05, -0.02, 0)
  const lit = N().add(cyl, GOLD, { p: [0.05, -0.035, 0], s: [0.9, 0.05, 0.55] }).add(cyl, MAROON, { p: [0.05, -0.07, 0], s: [1, 0.05, 0.63] }).mesh(), glow = G(lit)
  return { prop, base, lit, glow }
}

type P2 = [number, number]
/** A quadruped's leg (beast): hip, joint, hock (the front leg's is its wrist, fixed) and paw pivots, their rest points (y, z) and z of the hip. */
type Leg = { hip: THREE.Group; mid: THREE.Group; low: THREE.Group; paw: THREE.Group; front: boolean; J: P2; K: P2; F: P2; z: number }
/** Two bones hanging from a pivot, the joint at rest at J and the end at E (y, z): the turns of the pivot and the joint that put the end
 *  at (y, z), the joint bent in front of the line (fw = 1) or behind it (-1). Out of reach, the leg points there, straight or folded. */
function ik(y: number, z: number, J: P2, E: P2, fw: number): P2 {
  const a = Math.hypot(J[0], J[1]), b = Math.hypot(E[0] - J[0], E[1] - J[1]), d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-3, Math.hypot(y, z)))
  const pu = Math.atan2(z, -y) + fw * Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))), al = Math.atan2(J[1], -J[0]) - pu
  const jy = -a * Math.cos(pu), jz = a * Math.sin(pu)
  return [al, Math.atan2(E[1] - J[1], -(E[0] - J[0])) - al - Math.atan2(z - jz, -(y - jy))]
}
/** A bar of radius r from (y1, z1) to (y2, z2) in the plane x, with a ball at its end: a leg, a toe, a plume. */
const limb = (g: Geo, hex: string, x: number, y1: number, z1: number, y2: number, z2: number, r: number) =>
  g.add(cyl, hex, { p: [x, (y1 + y2) / 2, (z1 + z2) / 2], r: [Math.atan2(z2 - z1, y2 - y1), 0, 0], s: [r, Math.hypot(y2 - y1, z2 - z1), r] }).add(sph, hex, { p: [x, y2, z2], s: r })
type Pet = NonNullable<FigureSpec['animal']>
/** The animals' build (lib/figures PETS): the hips at y, the shoulders 2L in front of them, the body's half sizes, the leg's
 *  thickness, the head's radius, the neck's top (nY, nZ from the hips) and the size of the whole animal. */
const QUAD = {
  dog: { y: 0.5, L: 0.3, bw: 0.29, bh: 0.26, bl: 0.5, lr: 0.075, R: 0.34, nY: 0.36, nZ: 0.74, nr: 0.14, S: 1.3 },
  cat: { y: 0.44, L: 0.25, bw: 0.21, bh: 0.2, bl: 0.4, lr: 0.06, R: 0.31, nY: 0.27, nZ: 0.56, nr: 0.11, S: 1.32 }, // a compact house cat
}
const DOG = finish('#d39a5c', 0.6), DOGL = finish('#f7e4c6', 0.6), DOGD = finish('#9c6234', 0.6), CAT = finish('#e3974e', 0.95), CATL = finish('#fbf5ec', 0.95), CATD = finish('#b5632a', 0.95) /* an orange tabby with a white chest and socks */
const PINK = '#f4a3b6', HERON = finish('#8b8fa0', 0.55), CHEST = finish('#9a4b2d', 0.6), RUFOUS = finish('#b8683e', 0.6), BUFF = finish('#cf9466', 0.6), WING = finish('#6d6787', 0.55), LEG = finish('#d8b94e', 0.4)
/** An animal's body and its moving parts, in its own coordinates: facing +z, the ground at y = 0. No robot part (no visor,
 *  plating, joints or arms): the eyes, lids and brows are the face rig's, drawn straight onto the fur. */
function beast(f: FigureSpec, pet: Pet) {
  const st: FaceStyle = { ...faceOf(f), eye: 'round' }, quiet = N() // the rig's own mouth stays empty: the animal has its own
  if (pet === 'heron') {
    // long legs bending backwards at the ankle, long toes; one leg tucked up (mirrored when it changes legs)
    const legs = N()
    for (const [x, up] of [[-0.07, 0], [0.07, 1]]) {
      if (up) { limb(legs, LEG, x, 1.0, 0.02, 0.64, -0.12, 0.022); limb(legs, LEG, x, 0.64, -0.12, 0.8, 0.08, 0.02); for (const a of [-0.4, 0, 0.4]) legs.add(box, LEG, { p: [x + 0.03 * a, 0.78, 0.13], r: [0.9, a, 0], s: [0.014, 0.014, 0.1] }) }
      else {
        limb(legs, LEG, x, 1.0, 0.02, 0.52, -0.07, 0.024); limb(legs, LEG, x, 0.52, -0.07, 0.03, 0.02, 0.02)
        for (const a of [-0.55, 0, 0.55]) legs.add(box, LEG, { p: [x + Math.sin(a) * 0.1, 0.012, 0.02 + Math.cos(a) * 0.1], r: [0, a, 0], s: [0.016, 0.014, 0.2] })
        legs.add(box, LEG, { p: [x, 0.012, -0.06], s: [0.016, 0.014, 0.12] }) // the hind toe
      }
    }
    // a narrow tilted body, a short tail, an S-neck about as long as the body with a dark stripe down each side
    const body = N().add(sphHi, HERON, { p: [0, 0.1, 0], r: [-0.45, 0, 0], s: [0.15, 0.16, 0.36] }).add(sphHi, CHEST, { p: [0, 0.1, 0.16], r: [-0.45, 0, 0], s: [0.125, 0.14, 0.2] })
      .add(sph, '#3d3a4e', { p: [0, -0.07, -0.34], r: [0.5, 0, 0], s: [0.08, 0.035, 0.13] }).add(sphHi, HERON, { p: [0, 0.03, 0.05], s: [0.12, 0.08, 0.12] }) // thighs in feathers
    for (let i = 0; i <= 28; i++) { const t = i / 28, y = 0.22 + 0.6 * t, z = 0.24 + 0.1 * Math.sin(TAU * t), r = 0.066 - 0.024 * t
      body.add(sph, RUFOUS, { p: [0, y, z], s: r }); if (i % 2) for (const s of [-1, 1]) body.add(sph, K, { p: [s * r * 0.72, y, z + r * 0.45], s: [0.012, 0.03, 0.012] }) }
    const wings = [-1, 1].map(s => piv(N().add(sphHi, WING, { p: [0, -0.07, -0.2], r: [-0.4, 0, 0], s: [0.04, 0.12, 0.32] }).add(sphHi, CHEST, { p: [s * 0.004, -0.12, -0.08], r: [-0.4, 0, 0], s: [0.042, 0.065, 0.18] })
      .add(sph, '#3a3448', { p: [0, -0.1, -0.44], r: [-0.4, 0, 0], s: [0.034, 0.05, 0.14] }), [s * 0.13, 0.2, 0.1]))
    // a small head: a black crown and crest plume, buff cheeks with a dark stripe, a long pointed yellow beak (tilted down: head-on it still shows)
    const head = N().add(sphHi, BUFF, { p: [0, 0.03, 0.02], s: [0.09, 0.085, 0.12] }).add(dome, K, { p: [0, 0.045, 0], s: [0.092, 0.06, 0.115] })
      .add(cone, GOLD, { p: [0, -0.02, 0.29], r: [H + 0.25, 0, 0], s: [0.03, 0.34, 0.024] })
    for (const s of [-1, 1]) head.add(box, K, { p: [s * 0.075, 0.0, 0.05], r: [0, s * 0.5, -0.3 * s], s: [0.012, 0.018, 0.12] })
    const plume = N(); limb(plume, K, 0, 0, 0, -0.08, -0.3, 0.012); limb(plume, K, 0, 0, 0, -0.14, -0.24, 0.011)
    const crest = piv(plume, [0, 0.07, -0.08])
    const rig = faceRig(0.15, 0.28, st, { iris: GOLD, lid: BUFF, mouth: quiet }), face = piv(rig.face, [0, 0.045, 0.115])
    face.scale.setScalar(0.36)
    const hd = piv(G(head, face, crest), [0, 0.8, 0.22]), trunk = piv(G(body, hd, ...wings), [0, 1.0, 0]), legsM = legs.mesh()
    return { pet, inner: G(trunk, legsM), trunk, hd, rig, crest, wings, legsM, fy: 1.83, hipY: 1.0 }
  }
  const q = QUAD[pet], dog = pet === 'dog', fur = dog ? DOG : CAT, light = dog ? DOGL : CATL, dark = dog ? DOGD : CATD, { y: h, L, bw, bh, bl, lr, R } = q
  // the trunk, about the hips: a barrel chest and belly (lighter below), haunches, a neck rising forward of the shoulders
  const by = dog ? 0.12 : 0.1, chest = N().add(sphHi, fur, { s: [bw, bh, bl] }).add(sphHi, light, { p: [0, -bh * 0.35, 0.03], s: [bw * 0.8, bh * 0.7, bl * 0.82] })
  if (dog) chest.add(sphHi, fur, { p: [0, 0.03, bl * 0.5], s: [bw * 1.06, bh * 1.1, bl * 0.5] }).add(sphHi, light, { p: [0, -0.02, bl * 0.82], s: [bw * 0.62, bh * 0.85, 0.16] })
  else { for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const z = -bl * 0.45 + i * bl * 0.42, k = Math.sqrt(1 - (z / bl) ** 2) // a few soft tabby stripes down the flanks, uneven, not rings
    chest.add(sphHi, dark, { p: [s * bw * k * 0.6, bh * k * 0.66, z], r: [0.25 * (i % 2 ? 1 : -1), 0, s * 0.8], s: [0.02, bh * 0.36, 0.03 + 0.008 * (i % 2)] }) }
    chest.add(sphHi, light, { p: [0, -0.02, bl * 0.7], s: [bw * 0.74, bh * 0.85, 0.16] }) } // a white chest
  const belly = piv(chest, [0, by, L]), trunk = N()
  for (const s of [-1, 1]) trunk.add(sphHi, fur, { p: [s * bw * 0.66, -0.06, 0.03], s: [bw * 0.42, bh * 1.05, bh * 0.95] }) // haunches over the thighs
    .add(sphHi, fur, { p: [s * bw * 0.6, 0.0, 2 * L], s: [bw * 0.38, bh * 0.85, bh * 0.7] }) // shoulders over the upper arms
  limb(trunk, fur, 0, by + 0.04, 2 * L - 0.04, q.nY, q.nZ, q.nr)
  { const a = Math.atan2(-(q.nY - by), q.nZ - 2 * L), cy = by + 0.6 * (q.nY - by), cz = 2 * L + 0.6 * (q.nZ - 2 * L) // a collar round the neck: the dog's red with a gold tag, the house cat's blue with a bell
    trunk.add(tor(q.nr + 0.015, dog ? 0.03 : 0.022), dog ? RED : '#2f6fd0', { p: [0, cy, cz], r: [a, 0, 0] })
    if (dog) trunk.add(cyl, GOLD, { p: [0, cy - 0.15, cz + 0.07], r: [H, 0, 0], s: [0.05, 0.02, 0.05] })
    else trunk.add(sphHi, GOLD, { p: [0, cy - q.nr - 0.035, cz + 0.05], s: 0.036 }) }
  // the legs, from the hips and shoulders, jointed so that they fold and lift (animal poses them): a front leg bends at the elbow
  // (J), a hind one forward at the knee (J) and back at the hock (K); each ends in a paw at F. The cat wears white socks.
  const legs: Leg[] = []
  for (const front of [true, false]) for (const s of [-1, 1]) {
    const J: P2 = front ? [-0.5 * h, 0.01] : [-0.42 * h, 0.08], F: P2 = [-h + 0.05, front ? 0.02 : -0.02], Hk: P2 = front ? F : [-0.72 * h, -0.06], sock = dog ? fur : light
    const up = N(), mid = N(), pw = N().add(sphHi, light, { p: [0, -0.015, 0.04], s: [lr * 1.35, 0.045, lr * 1.8] }) // a round paw
    if (!dog) { for (const x of [-1, 0, 1]) pw.add(sph, light, { p: [x * lr * 0.62, -0.012, 0.04 + lr * 1.45 - Math.abs(x) * 0.012], s: lr * 0.42 }) // toes
      pw.add(sph, PINK, { p: [0, -0.05, 0.04], s: [lr * 0.8, 0.012, lr * 0.9] }) } // a pink pad under it
    let low: THREE.Group
    if (front) { limb(up, fur, 0, 0.04, 0, J[0], J[1], lr * 1.25); limb(mid, sock, 0, 0, 0, F[0] - J[0], F[1] - J[1], lr * 0.95); low = piv(G(), [0, F[0] - J[0], F[1] - J[1]]) }
    else { limb(up, fur, 0, 0, 0, J[0], J[1], lr * 1.3); limb(mid, fur, 0, 0, 0, Hk[0] - J[0], Hk[1] - J[1], lr * 1.05)
      const m = N(); limb(m, sock, 0, 0, 0, F[0] - Hk[0], F[1] - Hk[1], lr * 0.9); low = piv(m, [0, Hk[0] - J[0], Hk[1] - J[1]]) }
    const paw = piv(pw, front ? [0, 0, 0] : [0, F[0] - Hk[0], F[1] - Hk[1]]); low.add(paw)
    const midG = piv(G(mid, low), [0, J[0], J[1]]), z = front ? 2 * L : 0
    legs.push({ hip: piv(G(up, midG), [s * bw * 0.62, 0, z]), mid: midG, low, paw, front, J, K: Hk, F, z })
  }
  // the head: big and round; a dog's muzzle, dark nose and floppy ears; a house cat's soft round face, full white cheeks, small ears, pink nose, whiskers
  const sz = dog ? 0.95 : 0.92, head = N().add(sphHi, fur, { p: [0, 0.14, 0.1], s: dog ? [R, R * 0.94, R * sz] : [R * 1.08, R * 0.92, R * sz] }), fz = 0.1 + R * sz // fz = the front of the face
  let ears: THREE.Group[] = []
  const mouthAt: V3 = dog ? [0, -0.01, fz + 0.15] : [0, 0.04, fz + 0.03], mr = dog ? 0.045 : 0.03
  if (dog) {
    head.add(sphHi, light, { p: [0, 0.02, fz - 0.02], s: [0.17, 0.13, 0.19] }).add(sphHi, fur, { p: [0, 0.12, fz - 0.08], s: [0.12, 0.08, 0.16] }).add(sphHi, K, { p: [0, 0.1, fz + 0.15], s: [0.07, 0.05, 0.05] })
    ears = [-1, 1].map(s => piv(N().add(sphHi, dark, { p: [s * 0.03, -0.16, 0], s: [0.1, 0.2, 0.055] }), [s * R * 0.72, 0.14 + R * 0.66, 0.08], [0, 0, s * 0.35]))
  } else {
    for (const s of [-1, 1]) {
      head.add(cone, fur, { p: [s * R * 0.62, 0.13 + R * 0.8, 0.05], r: [0, 0, -s * 0.38], s: [0.09, 0.15, 0.06] }).add(cone, PINK, { p: [s * R * 0.62, 0.12 + R * 0.8, 0.08], r: [0, 0, -s * 0.38], s: [0.052, 0.09, 0.02] })
        .add(sphHi, light, { p: [s * 0.065, 0.035, fz - 0.06], s: [0.095, 0.075, 0.08] }) // full cheeks round a short muzzle
      for (const d of [-0.025, 0, 0.025]) head.stroke(W, s * 0.1, 0.045 + d / 2, s * 0.32, 0.055 + d * 2, fz, 0.012, 0.01) // white whiskers, past the cheeks
    }
    head.add(sphHi, light, { p: [0, -0.01, fz - 0.07], s: [0.07, 0.05, 0.06] }) // the chin
    head.add(cone, PINK, { p: [0, 0.075, fz + 0.012], r: [PI, 0, 0], s: [0.032, 0.03, 0.02] })
    for (const x of [-0.06, 0, 0.06]) head.add(box, dark, { p: [x, 0.14 + R * 0.74, 0.1 + R * 0.52], r: [-0.95, 0, x * 2], s: [0.02, 0.09, 0.012] }) // the tabby's M on the brow
  }
  const rest = N(), open = N() // the mouth under the nose: a small "w", and open (talking, panting) a dark one with a pink tongue
  for (const s of [-1, 1]) rest.add(tor(mr, 0.012, PI), K, { p: [s * mr, 0, 0], r: [0, 0, PI] })
  open.add(sphHi, K, { p: [0, -0.02, 0], s: [mr * 1.5, mr * 1.1, 0.02] }).add(sphHi, PINK, { p: [0, -0.035, 0.012], s: [mr, mr * 0.7, 0.015] })
  const mouth = [piv(rest, mouthAt), piv(open, mouthAt)]
  const rig = faceRig(dog ? 0.15 : 0.13, R, st, { iris: dog ? '#6b3f1f' : '#8dbf2f', lid: fur, cap: dog ? 0.11 : 0.1, mouth: quiet, brows: dog ? undefined : false }), face = piv(rig.face, [0, 0.2, 0.1 + Math.sqrt(R * R - 0.06 ** 2) * sz])
  const hd = piv(G(head, face, ...ears, ...mouth), [0, q.nY, q.nZ])
  // the tail, a chain from the rump: a dog's curls up over its back, a cat's long thick one curves up like a question mark
  const segs: THREE.Group[] = [], n = dog ? 5 : 8, len = dog ? 0.09 : 0.085, r = dog ? 0.045 : 0.05
  for (let i = 0; i < n; i++) {
    const g = piv(N().add(cyl, dog && i === n - 1 ? light : !dog && i === n - 1 ? dark : fur, { p: [0, len / 2, 0], s: [r, len, r] }).add(sph, !dog && i === n - 1 ? dark : fur, { p: [0, len, 0], s: r }), [0, i ? len : 0, 0], [i ? (dog ? 0.45 : 0.3) : dog ? -0.5 : -1.9, 0, 0])
    if (i) segs[i - 1].add(g); segs.push(g)
  }
  const tail = piv(segs[0], [0, by + bh * 0.5, L - bl * 0.92])
  const tr = piv(G(trunk, belly, hd, tail, ...legs.map(l => l.hip)), [0, h, -L])
  const inner = G(tr); inner.scale.setScalar(q.S)
  return { pet, inner, trunk: tr, belly, by, hd, rig, legs, ears, mouth, tail, segs, q, fy: q.S * (h + q.nY + 0.14), hipY: h }
}
/** An animal bot: its body (beast), on the platform with the topic's prop lying beside it, doing the show's acts as its own
 *  five moves (petAct) and its moods as an animal would: looks down at the message box (typing), tilts its head (thinking),
 *  wags and hops (happy), droops its head, ears and tail (at a loss). */
function animal(f: FigureSpec, pet: Pet, a: string, ticks: Tick[], on: (x: Tick) => void): Fig {
  const { prop, base, glow } = stage(f, a, on), b = beast(f, pet), bot = piv(b.inner, [0, 0, 0]), bird = b.pet === 'heron'
  const turn0 = bird ? -0.9 : -0.5, yaw = bird ? 0.4 : 0.3 // side on, the face turned to the viewer
  prop.position.set(0.85, 0.22, 0.55); prop.scale.setScalar(0.42) // lying beside it
  const Z = (o: Record<string, number>) => { for (const k in o) o[k] = 0 }
  return {
    root: G(base, glow, bot, prop), bots: [bot], rest: [base, glow, prop], glow, fy: b.fy, tools: [], rig: b.rig,
    tick(u0, e, m) {
      const [ty, th, ha, mi] = m ?? [0, 0, 0, 0], sh = show(u0, f.no, calmOf(e, m), m?.[4]), u = sh.T, w = Math.max(0, sh.w)
      if (w) petAct(pet, sh.p % 5, sh.t, sh.d); else { Z(mv); Z(pm) }
      const x = Math.min(1.2, e + ha), hop = Math.abs(Math.sin(u * 5.5)), land = x * (1 - hop) ** 3
      const hopK = b.pet === 'dog' ? 0 : 1 // a happy dog bounces on its front paws instead
      bot.position.set(w * mv.bx, hopK * x * hop * 0.1 + w * mv.up, 0)
      bot.rotation.set(0, turn0 + Math.sin(u * 0.7) * 0.15 * (1 - ty) + 0.45 * mi + w * mv.ry + sh.on * TAU * mv.turn, Math.sin(u * 1.1) * 0.02 + w * mv.rz)
      bot.position.x += w * pm.fw * Math.sin(bot.rotation.y); bot.position.z += w * pm.fw * Math.cos(bot.rotation.y) // a pounce
      bot.scale.set(1 + 0.05 * hopK * land, 1 - 0.08 * hopK * land, 1 + 0.05 * hopK * land)
      const dip = w * mv.dip, pitch = w * pm.rx, breathe = 0.02 * Math.sin(u * 2.4)
      if (b.pet === 'heron') {
        b.trunk.position.y = b.hipY - 0.03 * dip; b.trunk.rotation.x = pitch + 0.03 * Math.sin(u * 1.2)
        b.legsM.scale.x = w && pm.step ? -1 : 1
        const open = Math.max(0, -w * mv.la) + 0.15 * ha * hop
        b.wings.forEach((g, i) => { g.rotation.z = (i ? 1 : -1) * open })
        b.crest.rotation.x = -(0.9 * w * pm.fluff + 0.25 * th + 0.2 * x)
      } else {
        // the pose: the trunk turns about the hips (pm.rx: + chest down, - sitting up), drops (pm.lo) and rolls (pm.rl); every paw
        // goes to its place on the ground plus the act's offset and its leg bends to reach it (two bones; a hind leg's hock tips flat by pm.ft)
        const { y: h, L } = b.q, dog = b.pet === 'dog', idle = 1 - w, bnc = dog ? ha : 0 // a happy dog bounces on its front paws
        const lift = idle * (1 - ty) * Math.max(0, Math.sin(u * 0.37 + f.no)) ** 16 // now and then it lifts a front paw
        const pt = pitch + 0.02 * Math.sin(u * 0.45) - 0.08 * bnc, roll = w * pm.rl + 0.025 * idle * Math.sin(u * 0.6) /* shifts its weight */, cp = Math.cos(pt), sp = Math.sin(pt)
        const hy = h - w * pm.lo, fw = w * pm.kf + idle > 0.5 ? 1 : -1 // fw: a lifted front paw folds back at the wrist; else the elbow bends behind
        b.trunk.position.y = hy; b.trunk.rotation.set(pt, 0, roll)
        b.belly.scale.y = 1 + breathe + 0.5 * w * pm.arch; b.belly.position.y = b.by + 0.09 * w * pm.arch // an arched back
        b.legs.forEach((l, i) => {
          const oy = w * pm[LEGY[i]] + (i === 1 ? 0.07 * lift : 0) + (i < 2 ? 0.08 * bnc * Math.max(0, Math.sin(u0 * 9 + i * PI)) : 0), oz = w * pm[LEGZ[i]] + (i === 1 ? 0.02 * lift : 0)
          let ty1 = h + l.F[0] + oy, tz = -L + l.z + l.F[1] + oz, m = 0, r0 = 0
          if (!l.front) { // the hock: above the paw standing, behind it lying flat
            const dy = l.F[0] - l.K[0], dz = l.F[1] - l.K[1], n = Math.hypot(dy, dz); r0 = Math.atan2(dz, -dy); m = r0 + w * pm.ft * (1.45 - r0)
            ty1 += n * Math.cos(m); tz -= n * Math.sin(m)
          }
          const wy = ty1 - (hy - l.z * sp), wz = tz - (-L + l.z * cp), [al, be] = ik(wy * cp + wz * sp, -wy * sp + wz * cp, l.J, l.front ? l.F : l.K, l.front ? fw : 1)
          const ka = l.front ? 0 : r0 - pt - al - be - m
          l.hip.rotation.set(al, 0, i === 3 ? w * pm.sp : 0); l.mid.rotation.x = be; l.low.rotation.x = ka
          l.paw.rotation.x = 0.7 * Math.min(1, oy / 0.1) - (pt + al + be + ka) // flat on the ground; its toes droop when it is lifted
        })
        b.ears.forEach((g, i) => { const s = i ? 1 : -1; g.rotation.z = s * (0.35 + 0.06 * Math.sin(u * 3.1 + s) + 0.35 * mi - 0.15 * ty + 0.15 * x * Math.sin(u * 9)) })
        const wag = w * pm.wag + 0.3 * x + 0.5 * ha
        if (dog) { b.tail.rotation.set(-0.5 + 0.9 * mi, 0, Math.sin(u0 * (7 + 9 * wag)) * (0.2 + 0.5 * wag)) }
        else { // the cat's tail: swishing, held straight up (pm.up) or wrapped round its feet (pm.wrap)
          const up = w * pm.up, wr = w * pm.wrap
          b.tail.rotation.x = (1 - wr) * (-1.9 + 0.6 * mi - 0.5 * w * pm.wag + 3.6 * up) + wr * (0.1 - pt)
          b.segs.forEach((g, i) => { if (i) g.rotation.x = 0.3 * (1 - up - wr); g.rotation.z = 0.38 * wr + Math.sin(u0 * (1.6 + 2 * wag) - i * 0.6) * (0.12 + 0.25 * wag) * (1 - 0.7 * wr) })
        }
        const talk = b.rig.shape === 'open' || b.rig.shape === 'oh'
        b.mouth[0].visible = !talk; b.mouth[1].visible = talk
      }
      b.hd.rotation.set(Math.sin(u * 0.9) * 0.05 + 0.28 * ty + 0.2 * ha * Math.abs(Math.sin(u * 8)) + 0.3 * mi + w * mv.hx,
        yaw * (1 - mi) + 0.2 * Math.sin(u * 0.45) * (1 - ty) + w * mv.hy, Math.sin(u * 1.3) * 0.08 + 0.22 * th - 0.18 * mi + w * mv.hz)
      b.rig.act(u0, e, ty, th, ha, mi, Math.max(m?.[4] ?? 0, sh.p > 5 ? w : 0), !!m, w * pm.shut)
      prop.rotation.y = Math.sin(u * 0.8) * 0.3
      for (const k of ticks) k(u, e)
    },
  }
}

function build(f: FigureSpec): Fig {
  const no = String(f.no).padStart(2, '0'), c = f.shape === 'general' ? finish(f.body, 0.2, 0.45) : finish(f.body, 0.45, 0.6, 0, 1) /* the mascots wear cloth, the robots car paint */, dk = finish(f.trim ?? mix(c, '#000000', 0.4), 0.35, 0.7), a = ACCENTS[f.accent] // the body: car paint
  const ticks: Tick[] = [], on = (x: Tick) => { ticks.push(x) }
  if (f.animal) return animal(f, f.animal, a, ticks, on)
  // A friendly service robot: white plating, the family colour as panels, graphite joints, a glass visor with LED eyes
  // and smile. No chest light: a pulsing lamp on the tummy read as flashing. `lights` = everything unlit besides the face.
  const torso = N(), lights = N(), led = mix(a, W, 0.25)
  let sx = 0.48, chest: V3 = [0, 0.82, 0.335], front = 0.33 // front = z of the front of the chest
  const legs = (x: number, hip: number) => { for (const s of [-1, 1]) {
    torso.add(dome, PLATE, { p: [s * (x + 0.01), 0, 0.05], s: [0.19, 0.14, 0.26] }).add(cyl, GRAPH, { p: [s * x, hip / 2, 0], s: [0.07, hip, 0.07] }).add(sph, GRAPH, { p: [s * x, hip, 0], s: 0.1 })
  } }
  const thruster = (y: number, r: number) => { // a waist joint on a nozzle (no light ring: nothing glows below the chest)
    torso.add(cyl, GRAPH, { p: [0, y, 0], s: [r * 0.55, 0.16, r * 0.55] }).add(frus(r, r * 0.5), dk, { p: [0, y - 0.18, 0], s: [1, 0.24, 1] })
  }
  if (f.shape === 'faculty' || f.shape === 'general') { // broad shoulders tapering to a waist joint, on one thruster; light strips on the shoulders
    sx = 0.56; chest = [0, 1, 0.355]
    torso.add(frus(0.46, 0.3), c, { p: [0, 0.82, 0], s: [1, 0.6, 0.8] }).add(cyl, SEAM, { p: [0, 0.95, 0], s: [0.418, 0.012, 0.334] }).add(frus(0.47, 0.455), GRAPH, { p: [0, 1.135, 0], s: [1, 0.03, 0.8] })
    thruster(0.45, 0.32)
    for (const s of [-1, 1]) { torso.add(sph, PLATE, { p: [s * 0.47, 1.06, 0], s: [0.17, 0.11, 0.2] }); lights.add(box, led, { p: [s * 0.47, 1.165, 0.05], s: [0.2, 0.03, 0.07] }); torso.add(bolt, GREY, { p: [s * 0.47, 1.06, 0.195], r: [H, 0, 0], s: [0.03, 0.02, 0.03] }) }
  } else { // four builds in the family colour: a chest display, shoulder plates, a power pack on the back
    let fz = 0.285, dy = 0.9
    if (f.build === 'taper') { // V-shaped, on two legs
      sx = 0.53; chest = [0, 0.62, 0.245]
      torso.add(frus(0.46, 0.28), c, { p: [0, 0.78, 0], s: [1, 0.66, 0.7] }).add(cyl, SEAM, { p: [0, 0.93, 0], s: [0.424, 0.012, 0.297] }).add(frus(0.47, 0.465), GRAPH, { p: [0, 1.12, 0], s: [1, 0.03, 0.7] }).add(cyl, GRAPH, { p: [0, 0.43, 0], s: [0.24, 0.08, 0.17] })
      legs(0.16, 0.4)
    } else if (f.build === 'barrel') { // a drum on short legs
      sx = 0.51; chest = [0, 0.6, 0.34]; fz = 0.35
      torso.add(lathe('brl', [[0.001, -0.32], [0.32, -0.32], [0.41, -0.18], [0.44, 0], [0.41, 0.18], [0.32, 0.32], [0.001, 0.32]]), c, { p: [0, 0.76, 0], s: [1, 1, 0.82] })
        .add(cyl, GRAPH, { p: [0, 0.76, 0], s: [0.445, 0.025, 0.365] })
      legs(0.2, 0.36)
    } else if (f.build === 'slim') { // three segments on long legs
      sx = 0.42; chest = [0, 0.53, 0.19]; fz = 0.215; dy = 0.94
      torso.add(rr(0.68, 0.34, 0.12, 0.42, 0.05), c, { p: [0, 0.94, 0] }).add(cyl, GRAPH, { p: [0, 0.69, 0], s: [0.11, 0.22, 0.11] }).add(cyl, PLATE, { p: [0, 0.73, 0], s: [0.15, 0.04, 0.15] }).add(cyl, PLATE, { p: [0, 0.66, 0], s: [0.15, 0.04, 0.15] })
        .add(rr(0.46, 0.18, 0.08, 0.36, 0.04), c, { p: [0, 0.53, 0] })
      legs(0.15, 0.42)
    } else { // a pod on a thruster
      sx = 0.5; chest = [0, 0.66, 0.29]
      torso.add(rr(0.82, 0.58, 0.26, 0.56, 0.09), c, { p: [0, 0.84, 0] }).add(box, GRAPH, { p: [0, 0.74, 0], s: [0.835, 0.02, 0.575] })
      thruster(0.47, 0.3)
    }
    front = Math.min(fz, 0.33) // the barrel is deepest at the belly, not at the chest
    torso.add(rr(0.5, 0.46, 0.12, 0.22, 0.04), mix(a, K, 0.2), { p: [0, dy - 0.06, -fz - 0.08], s: [sx * 1.9, 1, 1] }).add(rr(0.3, 0.2, 0.05, 0.05), a, { p: [0, dy - 0.12, -fz - 0.2], s: [sx * 1.9, 1, 1] })
    for (const s of [-1, 1]) torso.add(sph, PLATE, { p: [s * (sx - 0.07), 1.07, 0], s: [0.15, 0.1, 0.22] }).add(cyl, a, { p: [s * (sx - 0.07), 1.07, 0], r: [0, 0, H], s: [0.104, 0.045, 0.226] }) // shoulder plates with the accent stripe
      .add(bolt, GREY, { p: [s * (sx - 0.07), 1.06, 0.215], r: [H, 0, 0], s: [0.028, 0.02, 0.028] })
  }
  torso.add(cyl, GRAPH, { p: [0, 1.2, 0], s: [0.12, 0.14, 0.12] })
  // The look (lib/figures.ts) is drawn on the head only; the chest carries no jewelry or tie. Shoulders a little narrower (fem) or wider (masc).
  const fem = f.look === 'fem', masc = f.look === 'masc', grand = fem && f.vary === 2
  if (f.look === 'neutral' && f.vary === 2) torso.add(cyl, PLATE, { p: [0, 1.16, 0], s: [0.18, 0.04, 0.18] }) // a plain neck gasket
  const body = torso.mesh(), wide = fem ? 0.94 : masc ? 1.04 : 1
  body.scale.x = wide; sx *= wide

  const skin = faceOf(f).seed % 3 ? FACE : TAN, sk = skull(f.head, c, skin), head = sk.g, top = sk.top
  // On the head: fem a swept helmet shell in the dark body colour, as a bob to the jaw (vary 0) or swept up into a bun; masc a short
  // cropped crest over the visor. Nothing below the face (anything there reads as a beard). Neutral: at most a plain sensor stud.
  const hz = sk.rc ? sk.ez : 0.3, by = sk.ey + 0.3 * sk.fs
  if (fem) {
    head.add(sphHi, dk, { p: [0, top * 0.55, -hz * 0.35], s: [sk.hw + 0.05, top * 0.48, hz * 0.85] })
    if (f.vary && f.hat !== 'mortar') head.add(sphHi, dk, { p: [0, top - 0.06, -hz * 0.7], s: [0.2, 0.15, 0.2] }).add(tor(0.15, 0.02), grand ? GOLD : a, { p: [0, top - 0.13, -hz * 0.7], r: [H, 0, 0] }) // a plate cap sits where the bun would
    else for (const s of [-1, 1]) head.add(rr(0.16, 0.44, 0.07, 0.3), dk, { p: [s * (Math.min(sk.hw, 0.52) + 0.02), 0.24, -0.1], r: [0, 0, s * 0.1] })
  }
  if (masc && sk.bz) for (const i of [-2, -1, 0, 1, 2]) { const w = (sk.es + 0.1) * 0.4, o = onFace(i * w, 0, sk.rc * sk.bz / sk.ez); head.add(box, dk, { p: [o.p[0], by, sk.bz + o.p[2]], r: o.r, s: [w * 1.1, 0.07, 0.08] }) }
  if (f.look === 'neutral' && f.vary === 1 && sk.bz) head.add(cyl, GREY, { p: [0, by, sk.bz], r: [H, 0, 0], s: [0.045, 0.05, 0.045] })
  if (f.hat !== 'headphones' && f.head !== 'saucer') for (const s of [-1, 1]) head.add(cyl, GRAPH, { p: [s * (sk.hw - 0.02), 0.34, 0], r: [0, 0, H], s: [0.11, 0.07, 0.11] }).add(bolt, GREY, { p: [s * (sk.hw + 0.02), 0.34, 0], r: [0, 0, H], s: [0.05, 0.03, 0.05] }).add(box, a, { p: [s * (sk.hw + 0.045), 0.44, -0.02], s: [0.03, 0.24, 0.12] })
  const glasses = f.shape === 'faculty'
  const rig = faceRig(sk.es, sk.rc, faceOf(f), { look: f.look, iris: mix(a, c, 0.5), lid: mix(skin, c, 0.4), tint: mix(a, W, 0.75), vh: f.head === 'saucer' ? 0.2 : f.head === 'drum' ? 0.215 : 0.27, cap: glasses ? 0.1 : undefined }), face = piv(rig.face, [0, sk.ey, sk.ez])
  face.scale.setScalar(sk.fs)
  if (glasses) face.add(piv(pair(N(), tor(Math.min(0.125, sk.es - 0.012), 0.018), GRAPH, sk.es, sk.rc, 1).stroke(GRAPH, -0.04, 0.01, 0.04, 0.01, 0, 0.02, 0.02), [0, 0.04, 0.03])) // the professor's glasses, as frames on the visor
  const hd = piv(G(head, face), [0, 1.2, 0]), cap = f.head === 'drop' && f.hat === 'fin' ? null : hat(f.hat, a, dk, top, sk.hw) // a pointed head is its own fin
  const hs = f.shape === 'faculty' ? 1.16 : 1.12 // a head a little too large for its body: the face reads on a small tile
  hd.scale.setScalar(hs)
  let aerial: THREE.Group | undefined // light head gear sways after the head; a cap sits still
  if (f.shape === 'office' && f.hat === 'none') hd.add(N().add(dome, led, { p: [0, top, 0], s: [0.1, 0.07, 0.1] }).mesh(GLOW))
  if (cap) hd.add(['fin', 'ring', 'disc'].includes(f.hat) ? aerial = hinge(cap, [0, top - 0.04, 0]) : cap.mesh())
  const arm = (x: number) => { // the forearm turns at the elbow (only while an instrument is played)
    const up = piv(N().add(sph, GRAPH, { s: 0.12 }).add(bolt, GREY, { p: [0, 0, 0.115], r: [H, 0, 0], s: [0.04, 0.02, 0.04] }).add(cyl, PLATE, { p: [0, -0.16, 0], s: [0.08, 0.2, 0.08] }).add(sph, GRAPH, { p: [0, -0.28, 0], s: 0.085 }), [x, 1, 0])
    const fore = piv(N().add(cyl, c, { p: [0, -0.1, 0], s: [0.09, 0.16, 0.09] }).add(cyl, a, { p: [0, -0.16, 0], s: [0.097, 0.035, 0.097] }).add(sph, PLATE, { p: [0, -0.23, 0], s: 0.115 }), [0, -A1, 0]) // the accent as a cuff
    up.add(fore)
    return [up, fore]
  }
  const [left, lf] = arm(-sx), [right, rf] = arm(sx)
  // The instruments (see perform): plain parts, nothing on them glows; each is built once and hidden unless it is played.
  const mic = N().add(cyl, GRAPH, { p: [0, 0.07, 0], s: [0.035, 0.3, 0.035] }).add(cyl, a, { p: [0, 0.215, 0], s: [0.05, 0.035, 0.05] }).add(sphHi, GREY, { p: [0, 0.3, 0], s: 0.085 }).add(cyl, K, { p: [0, 0.3, 0], s: [0.088, 0.02, 0.088] })
  const tamb = N().add(tor(0.2, 0.03), a, { p: [0, 0.2, 0] })
  for (let i = 0; i < 6; i++) disc(tamb, GREY, 0.045, Math.sin(i * TAU / 6 + 0.5) * 0.2, 0.2 + Math.cos(i * TAU / 6 + 0.5) * 0.2, 0, 0.07)
  const keytar = N().add(rr(0.46, 0.22, 0.06, 0.06), a, { p: [0.2, -0.01, 0] }).add(box, GREY, { p: [-0.22, 0.02, 0], s: [0.5, 0.06, 0.04] }).add(rr(0.12, 0.11, 0.03, 0.05), a, { p: [-0.5, 0.02, 0] })
  const keys = N().add(rr(0.72, 0.2, 0.04, 0.05), GRAPH, { r: [-H, 0, 0] }).add(box, a, { p: [0, 0.03, -0.075], s: [0.66, 0.015, 0.025] }).add(cyl, dk, { p: [0, -0.05, 0], s: [0.12, 0.04, 0.07] })
  for (let i = 0; i < 8; i++) { keytar.add(box, W, { p: [0.04 + i * 0.045, 0.02, 0.035], s: [0.038, 0.11, 0.02] }); if (i % 7 % 3 !== 2) keytar.add(box, K, { p: [0.0625 + i * 0.045, 0.045, 0.045], s: [0.022, 0.06, 0.02] }) }
  for (let i = 0; i < 10; i++) { keys.add(box, W, { p: [-0.27 + i * 0.06, 0.03, 0.02], s: [0.052, 0.02, 0.11] }); if (i % 7 % 3 !== 2 && i < 9) keys.add(box, K, { p: [-0.24 + i * 0.06, 0.045, -0.01], s: [0.03, 0.02, 0.06] }) }
  const tools = [piv(mic, [0, 0, 0], [0.7, 0, -0.49]), G(tamb), piv(keytar, [0, 0.95, front + 0.03], [0, 0, -0.23]), piv(keys, [0, 0.86, front + 0.08], [0.45, 0, 0])]
  tools.forEach(o => { o.visible = false })
  const bot = piv(G(body, lights.mesh(GLOW), hd, left, right, ...tools), [-0.34, 0, 0]), size = { general: 1.05, faculty: 1, programme: 0.92, office: 0.95 }[f.shape]
  bot.scale.setScalar(size)

  const { prop, base, lit, glow } = stage(f, a, on)

  if (f.shape === 'general') { // the general bot is two: Iska in front, Iskou beside her, their chat bubble above
    const duo = [mascot(0), mascot(1)]
    dropFigure(bot) // shortcut: the robot built above is not drawn for the pair, its shapes are given back; build it only for the others once this function is split
    duo[0].bot.position.set(-0.42, 0, 0.1); duo[1].bot.position.set(0.84, 0, -0.25)
    duo.forEach(m => m.bot.scale.setScalar(0.85))
    base.position.x = lit.position.x = 0.15; base.scale.x *= 1.3; lit.scale.x = 1.3
    prop.scale.setScalar(0.55)
    const spinPair = spinner()
    return {
      root: G(base, glow, duo[0].bot, duo[1].bot, prop), bots: duo.map(m => m.bot), rest: [base, glow, prop], glow, fy: 1.58, tools: [], rig: duo[0].rig,
      tick(u0, e, m) {
        const sh = show(u0, f.no, calmOf(e, m), m?.[4]), u = sh.T, who = sh.p & 1
        let hop = sh.w * Math.sin(PI * seg(sh.t, 0.24, 0.66))
        const dn = Math.max(m?.[4] ?? 0, sh.p > 5 ? sh.w : 0)
        duo[0].tick(u, e, m, u0, dn); duo[1].tick(u + 1.9, e, m, u0 + 1.9, dn)
        duo[0].bot.rotation.y = 0.25 + Math.sin(u * 0.7) * 0.15; duo[1].bot.rotation.y = -0.2 + Math.sin(u * 0.6 + 1) * 0.15
        duo[0].bot.position.x = -0.42 + 0.02 * Math.sin(u * 1.1); duo[1].bot.position.x = 0.84 + 0.02 * Math.sin(u * 1.1 + 1) // shifting their weight
        if (sh.p > 5) { // a dance: the two in step, turning as mirror images, the speech bubble bouncing along
          if (sh.w > 0) dance((sh.p - 6) % 6, sh.t, sh.d); /* shortcut: the pair has no instruments, it dances through a performance; give the mascots elbows to change that */ else mv.ry = mv.rz = mv.bx = mv.up = mv.dip = mv.la = mv.turn = 0
          hop = 0.3 * sh.w * mv.dip
          const spin = spinPair(u0, sh, mv.turn)
          for (const m of duo) {
            m.bot.rotation.y -= m.side * (sh.w * mv.ry + spin); m.bot.rotation.z += sh.w * mv.rz
            m.bot.position.x += sh.w * mv.bx; m.bot.position.y += sh.w * mv.up; m.bot.scale.y = 1 - 0.09 * sh.w * mv.dip
            m.arm.rotation.z += m.side * sh.w * mv.la
          }
        } else {
          // a pose: one of the two crouches, leaps into a pirouette and lands; the other leans back to watch, the speech bubble jumps
          duo[who].bot.rotation.y += spinPair(u0, sh, seg(sh.t, 0.24, 0.66)) - sh.w * 0.5 * (seg(sh.t, 0.05, 0.22) - seg(sh.t, 0.24, 0.4))
          duo[who].bot.position.y += hop * 0.22; duo[1 - who].bot.rotation.z += (who ? 1 : -1) * hop * 0.1
          duo[who].bot.scale.y = 1 - 0.09 * sh.w * (seg(sh.t, 0.05, 0.2) - seg(sh.t, 0.22, 0.3) + seg(sh.t, 0.66, 0.72) - seg(sh.t, 0.74, 0.86)); duo[1 - who].bot.scale.y = 1
        }
        prop.position.set(0.22, 2.02 + Math.sin(u * 1.7) * 0.03 + hop * 0.12, 0)
        for (const t of ticks) t(u, e)
      },
    }
  }
  const spinBody = spinner(), spinProp = spinner()
  let az = 0, azAt = 0 // the aerial's turn, and when it was last set
  return {
    root: G(base, glow, bot, prop), bots: [bot], rest: [base, glow, prop], glow, fy: 1.22 + top * hs / 2, tools, rig,
    tick(u0, e, m) {
      const [ty, th, ha, mi] = m ?? [0, 0, 0, 0], sh = show(u0, f.no, calmOf(e, m), m?.[4]), u = sh.T, { t, w } = sh
      // A hop has weight: it squashes as it lands and stretches in the air; the head sinks a moment later, the aerial whips after it.
      const x = Math.min(1.2, e + ha), hop = Math.abs(Math.sin(u * 5.5)), land = x * (1 - hop) ** 3
      bot.position.y = (0.5 + 0.5 * Math.sin(u * 1.6)) * 0.04 + x * hop * 0.15
      bot.scale.set(size * (1 + 0.07 * land), size * (1 - 0.1 * land + 0.012 * Math.sin(u * 1.6 - 1)), size * (1 + 0.07 * land))
      bot.rotation.y = 0.3 + Math.sin(u * 0.7) * 0.2 * (1 - ty) + 0.45 * mi // at a loss it turns to the search panels
      bot.rotation.z = Math.sin(u * 1.1) * 0.03
      hd.position.y = 1.2 - 0.05 * x * (1 - Math.abs(Math.sin(u * 5.5 - 0.5))) ** 3
      hd.rotation.z = Math.sin(u * 1.3) * 0.08 + 0.22 * th - 0.18 * mi
      hd.rotation.x = Math.sin(u * 0.9) * 0.05 + 0.28 * ty + 0.2 * ha * Math.sin(u * 5.5) ** 2 // looks down at the message box; nods, in time with the hop
      if (aerial) aerial.rotation.z = -Math.sin(u * 1.3 - 0.8) * 0.1 - 0.16 * th + x * Math.sin(u * 11 - 1) * 0.14
      rig.act(u0, e, ty, th, ha, mi, Math.max(m?.[4] ?? 0, sh.p > 5 ? w : 0), !!m)
      left.rotation.z = -0.22 + Math.sin(u * 2.2) * 0.12 - 0.5 * mi - e * (2.05 + Math.sin(u * 10) * 0.55) // a shrug; a wave of the free hand
      left.rotation.x = Math.sin(u * 2.2) * 0.25 * (1 - e)
      const xe = Math.min(1, e) // as above: mixed, never a speed that depends on e
      right.rotation.z = 2.05 + ((1 - xe) * Math.sin(u * 2.6) + xe * Math.sin(u * 8.6)) * (0.12 + e * 0.2)
      prop.position.y = 1.44 + Math.sin(u * 1.7) * 0.05 + e * 0.06
      prop.rotation.y = Math.sin(u * 0.8) * 0.4
      const tune = Math.max(0, Math.sin(u * 0.3)) * (1 - ty) * (1 - Math.min(1, e)) * (1 - w), tap = Math.abs(Math.sin(u * 3.1)) // hums a tune now and then: nods and taps along, lightly
      bot.position.x = -0.34 + 0.025 * Math.sin(u * 1.1); bot.position.y += 0.012 * tune * tap
      hd.rotation.x += 0.05 * tune * tap; left.rotation.x += 0.1 * tune * tap
      for (const k of ticks) k(u, e)
      // The show. Every pose starts with a crouch (the wind-up) and ends settling back into the idle stance.
      let ry = 0, rx = 0, up = 0, la = 0, lx = 0, ra = 0, py = 0, hx = 0, hz = 0, turn = 0, flip = 0, rz = 0, bx = 0, hy = 0, dip = seg(t, 0.04, 0.18) - seg(t, 0.2, 0.3)
      const tool = w > 0 && sh.p > 11 ? tools[sh.p - 12] : undefined
      if (w > 0 && sh.p > 5) { if (tool) perform(sh.p - 12, t, sh.d); else dance(sh.p - 6, t, sh.d); ({ ry, rz, bx, up, dip, hy, hx, hz, la, lx, ra, py, turn } = mv) }
      else if (w > 0) switch (sh.p) {
        case 0: { const h = seg(t, 0.2, 0.32); ry = -0.2 * h; rx = -0.06 * h; la = -0.55 * h; ra = 0.3 * h; py = 0.1 * h; hx = -0.2 * h; hz = -0.1 * h; break } // the poster: chest out, chin up, the prop held high
        case 1: { const h = Math.sin(PI * seg(t, 0.22, 0.78)); flip = seg(t, 0.26, 0.74); py = 0.2 * h; ra = 0.3 * h; hx = -0.3 * h; la = -0.3 * h; break } // the prop is thrown up, turns in the air and is caught
        case 2: { const h = Math.sin(PI * seg(t, 0.22, 0.7)); turn = seg(t, 0.24, 0.66); ry = -0.5 * dip; up = 0.1 * h; la = -0.9 * h; py = 0.24 * h; dip += seg(t, 0.66, 0.72) - seg(t, 0.74, 0.86); break } // a pirouette under the tossed prop, landing with a squash
        case 3: { const h = seg(t, 0.12, 0.24) - seg(t, 0.5, 0.6), b = seg(t, 0.6, 0.72) - seg(t, 0.84, 0.96); ry = -0.2; la = -0.35 * h; hz = 0.12 * h; rx = 0.22 * b; hx = 0.4 * b; dip = 0; break } // a nod to the visitor, then a bow (no raised straight arm: it can read as a fascist salute)
        case 4: { const h = seg(t, 0.22, 0.42) - seg(t, 0.8, 0.94); up = 0.2 * h + 0.02 * h * Math.sin(t * 30); py = up; la = -0.45 * h; ry = 0.35 * Math.sin(PI * seg(t, 0.22, 0.94)); hx = -0.15 * h; dip += seg(t, 0.94, 0.97) - seg(t, 0.97, 1); break } // powers up: lifts off and hovers
        default: { const h = seg(t, 0.2, 0.28) - seg(t, 0.8, 0.92); ry = -0.2; lx = 0.5 * dip; la = -0.4 * h; rx = 0.07 * h; hz = -0.12 * h; hx = 0.13 * h * Math.sin(t * TAU * 5); break } // leans in with a nod: "your turn" (no arm held out straight at the visitor)
      }
      bot.rotation.y += w * ry + spinBody(u0, sh, turn); bot.rotation.x = w * rx; bot.rotation.z += w * rz; bot.position.x += w * bx; bot.position.y += w * up; bot.scale.y *= 1 - 0.09 * w * dip
      hd.rotation.x += w * hx; hd.rotation.z += w * hz; hd.rotation.y = w * hy
      left.rotation.z += w * la; left.rotation.x += w * lx; right.rotation.z += w * ra
      prop.position.y += w * py; prop.rotation.y += spinProp(u0, sh, flip)
      prop.position.x = 0.7 + w * (bx - 1.2 * rz) // the prop goes where the hand under it goes
      // An instrument: it grows into the hand that reaches for it; the hands follow it. With two hands busy the topic's prop is put away.
      const out = tool ? w * mv.h : 0, both = sh.p > 13 ? out : 0
      for (const o of tools) o.visible = o === tool && out > 0.01
      lf.rotation.x = rf.rotation.x = 0; prop.scale.setScalar(1 - both); rig.sing(w * mv.sing * (tool ? 1 : 0))
      if (tool) {
        tool.scale.setScalar(out * (sh.p > 13 ? sx / 0.44 : 1))
        if (sh.p < 14) { tool.position.set(mv.gx - sx, 1 + mv.gy, front + mv.gz); if (sh.p === 13) tool.rotation.z = mv.tz }
        reach(left, lf, mv.gx, mv.gy, front + mv.gz, -1, out)
        if (both) reach(right, rf, -mv.qx, mv.qy, front + mv.gz, 1, out)
      }
      if (aerial) { const to = aerial.rotation.z + w * (0.3 * dip - 0.25 * Math.sin(t * 13) * Math.sin(PI * turn)); az += (to - az) * (1 - Math.exp(-Math.min(0.1, Math.abs(u0 - azAt)) * 9)); azAt = u0; aerial.rotation.z = az } // whips while the body turns, swelling and fading with the turn; it trails what moves it (a light part on a springy stalk), so a quick beat does not rattle it
    },
  }
}
export { build as buildFigure, show, petAct, pm, mv, beast, ik } // for scripts and tests that measure the motion

