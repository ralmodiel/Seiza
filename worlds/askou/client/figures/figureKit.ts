// Geometry kit of the bot figures (lazy chunk, see figures3d.ts): unit primitives are created once and never uploaded;
// a Geo bakes transformed, vertex-coloured copies of them into ONE BufferGeometry, so a whole body part is one draw call
// and every mesh of every figure shares ONE material.
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type V3 = [number, number, number]
/** matrix = T(p) · R(r, XYZ) · T(o) · S(s): `o` is the part's offset from its pivot, in the rotated frame. */
export interface Tx { p?: V3; r?: V3; s?: number | V3; o?: V3 }

/** ONE material for every lit mesh, written for a software renderer (the price of three's physical material was 4x):
 *  three studio lights fixed to the camera, and ONE look-up into a painted studio (`studio`, a sphere map, no mip levels: sampling them cost 1.7x). The finish of a surface (roughness, metalness, own light) rides on its vertices like its
 *  colour (`finish`), so enamel, brushed metal, rubber and glass share a draw call. */
export const MAT = new THREE.ShaderMaterial({
  vertexColors: true, uniforms: { env: { value: null }, lum: { value: 1 } },
  vertexShader: `attribute vec4 fin; varying vec3 vN, vP, vC; varying vec4 vF;
void main() { vec4 p = modelViewMatrix * vec4(position, 1.); vP = p.xyz; vN = normalMatrix * normal; vC = color; vF = fin; gl_Position = projectionMatrix * p; }`,
  fragmentShader: `uniform sampler2D env; uniform float lum; varying vec3 vN, vP, vC; varying vec4 vF;
void main() {
  vec3 N = normalize(vN), V = normalize(-vP);
  float nv = max(dot(N, V), 0.), rough = vF.x, coat = vF.w, fres = pow(1. - nv, 4.);
  vec3 F0 = mix(vec3(.04), vC, vF.y), dif = vC * (1. - vF.y);
  // key (warm, from the upper right), fill (cool, from the left), rim (from behind), sky above and floor bounce below
  vec3 light = vec3(1.05, 1., .92) * max(dot(N, vec3(.35, .6, .72)), 0.) + vec3(.22, .25, .32) * max(dot(N, vec3(-.82, .15, .55)), 0.)
    + vec3(.75) * max(dot(N, vec3(-.55, .45, -.7)), 0.) + mix(vec3(.27, .24, .25), vec3(.5, .52, .56), N.y * .5 + .5);
  vec3 R = reflect(-V, N);
  vec3 e = texture2D(env, R.xy / (2. * sqrt(R.x * R.x + R.y * R.y + (R.z + 1.) * (R.z + 1.)) + 1e-4) + .5).rgb;
  float gloss = 1. - rough;
  vec3 F = F0 + (max(vec3(gloss), F0) - F0) * fres;
  // what is lit + what is mirrored + the studio's lamps themselves (far brighter than the picture of them) + own light
  vec3 col = dif * light * (1. - .3 * fres) + e * F * 1.6 + smoothstep(.7, 1., e.g) * gloss * gloss * .5 + vC * vF.z;
  // car paint (coat > 0): metal flakes under a clear coat. The flakes throw a broad lobe of the paint's own colour round the
  // key light, drifting to a neighbouring hue at its centre (pearl), and go deep where the surface turns away; the lacquer
  // on top mirrors the studio uncoloured, more at the edges, and carries the key light's small sharp highlight.
  float kh = max(dot(N, normalize(vec3(.35, .6, .72) + V)), 0.), k4 = kh * kh * kh * kh, k16 = k4 * k4 * k4 * k4;
  col = col * (1. - coat * .3 * (1. - nv) * (1. - nv))
    + coat * ((vC * 2. + .25 * vC.gbr + .03) * (k4 * k4 * .8 + .1 * nv * nv) + e * (.06 + .45 * fres) + k16 * k16 * k16 * k16);
  // lum = how bright the day is (the world dims it at night). Askou draws its figures with the neutral curve, whatever the world uses.
  gl_FragColor = vec4(col * lum, 1.);
  #ifdef TONE_MAPPING
  gl_FragColor.rgb = NeutralToneMapping(gl_FragColor.rgb);
  #endif
  #include <colorspace_fragment>
}`,
})
let room: THREE.CanvasTexture | undefined
/** The studio the shells reflect, painted once on a canvas (no file), as a car is photographed: a long soft box overhead,
 *  a strip light on either side, a bright horizon line over a dark floor; its border is what a surface shows at a grazing
 *  angle, i.e. the rim of every silhouette. */
function studio() {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const x = c.getContext('2d')!; x.scale(4, 4) // drawn in 128 units, 4x the pixels: crisp highlights on the heads
  const bg = x.createLinearGradient(0, 0, 0, 128)
  bg.addColorStop(0, '#dfe2ea'); bg.addColorStop(0.46, '#8f93a0'); bg.addColorStop(0.555, '#a9aebb'); bg.addColorStop(0.575, '#f2f4f8') // the horizon
  bg.addColorStop(0.6, '#3a3640'); bg.addColorStop(0.75, '#4b4650'); bg.addColorStop(1, '#6b5f62')
  x.fillStyle = bg; x.fillRect(0, 0, 128, 128)
  x.filter = 'blur(8px)' // ignored where unsupported: the lights are then crisp
  x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(46, 13, 62, 20, 6); x.fill() // soft box
  x.fillStyle = '#eef3ff'; x.beginPath(); x.roundRect(19, 28, 8, 46, 4); x.fill() // strip light, left
  x.fillStyle = '#fff3e2'; x.beginPath(); x.roundRect(103, 42, 5, 26, 2.5); x.fill() // and a thinner, warmer one on the right
  x.filter = 'none'
  const rim = x.createRadialGradient(64, 64, 44, 64, 64, 64)
  rim.addColorStop(0, 'rgba(112,122,144,0)'); rim.addColorStop(1, 'rgba(112,122,144,1)')
  x.fillStyle = rim; x.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter
  return t
}
/** Call before the first frame: paints the studio. */
export function initKit() { MAT.uniforms.env.value = room ??= studio() }
const FIN = new Map<string, number[]>(), SATIN = [0.5, 0, 0, 0]
/** Declares how the colour `hex` is finished wherever it is used: roughness, metalness, own light (0..1 of its colour),
 *  and `coat` = 1 for car paint (metal flakes under clear lacquer, see MAT). */
export const finish = (hex: string, rough: number, metal = 0, lit = 0, coat = 0) => { FIN.set(hex, [rough, metal, lit, coat]); return hex }
/** GLOW = unlit, for what is drawn on a screen or shines by itself (eyes and smile, chest light, hover ring). */
export const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })
/** The shadow on the floor: see-through, so it works on any tile background. */
let blur: THREE.CanvasTexture | undefined
export const SHADE = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
const SPOT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
/** A soft contact shadow w wide and d deep on the floor: one quad with a radial falloff painted on a canvas. */
export function shade(w: number, d: number) {
  if (!blur) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const pen = c.getContext('2d')!, g = pen.createRadialGradient(64, 64, 0, 64, 64, 64)
    // a dark core under the figure and a long soft penumbra
    g.addColorStop(0, 'rgba(26,16,32,.5)'); g.addColorStop(0.25, 'rgba(26,16,32,.36)'); g.addColorStop(0.5, 'rgba(26,16,32,.17)'); g.addColorStop(0.75, 'rgba(26,16,32,.05)'); g.addColorStop(1, 'rgba(26,16,32,0)')
    pen.fillStyle = g; pen.fillRect(0, 0, 128, 128)
    SHADE.map = blur = new THREE.CanvasTexture(c)
  }
  const m = new THREE.Mesh(SPOT, SHADE)
  m.scale.set(w, 1, d)
  return m
}
const made = new Set<THREE.BufferGeometry>()
/** Frees one figure (a world that shows only the bots near the visitor): every geometry under `root` that was baked here. */
export function dropFigure(root: THREE.Object3D) { root.traverse(o => { const g = (o as THREE.Mesh).geometry; if (g && made.delete(g)) g.dispose() }) }
/** Frees what the figures uploaded to the GPU (the cached primitives are CPU-only). */
export function disposeKit() { made.forEach(g => g.dispose()); made.clear(); MAT.dispose(); GLOW.dispose(); SHADE.dispose(); SPOT.dispose(); blur?.dispose(); blur = undefined; SHADE.map = null; room?.dispose(); room = undefined }

const cache = new Map<string, THREE.BufferGeometry>()
/** `open` = the shape has no back (a bowl, a pie sector): it gets an inside, since back faces are not drawn. */
function memo(key: string, make: () => THREE.BufferGeometry, open = false) {
  let g = cache.get(key)
  if (!g) {
    const raw = make()
    g = raw.index ? raw.toNonIndexed() : raw
    g.deleteAttribute('uv')
    if (open) {
      const p = g.getAttribute('position').array, n = g.getAttribute('normal').array, P2 = new Float32Array(p.length * 2), N2 = new Float32Array(p.length * 2)
      P2.set(p); N2.set(n)
      for (let i = 0; i < p.length; i += 9) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) { // each triangle again, wound the other way
        const from = i + [0, 2, 1][v] * 3 + k, to = p.length + i + v * 3 + k
        P2[to] = p[from]; N2[to] = -n[from]
      }
      g.setAttribute('position', new THREE.BufferAttribute(P2, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N2, 3))
    }
    cache.set(key, g)
  }
  return g
}
const TAU = Math.PI * 2
export const sph = memo('s', () => new THREE.SphereGeometry(1, 12, 8))
export const sphHi = memo('S', () => new THREE.SphereGeometry(1, 32, 20))
export const box = memo('b', () => new THREE.BoxGeometry(1, 1, 1))
export const cyl = memo('c', () => new THREE.CylinderGeometry(1, 1, 1, 28))
export const cone = memo('k', () => new THREE.ConeGeometry(1, 1, 16))
export const pyr = memo('p', () => new THREE.ConeGeometry(1, 1, 4))
/** Upper half of a unit sphere, open below. */
export const dome = memo('d', () => new THREE.SphereGeometry(1, 32, 10, 0, TAU, 0, Math.PI / 2), true)
/** A six-sided bolt head. */
export const bolt = memo('h', () => new THREE.CylinderGeometry(1, 1, 1, 6))
export const tor = (R: number, r: number, arc = TAU) => memo(`t${R},${r},${arc}`, () => new THREE.TorusGeometry(R, r, 10, Math.max(8, Math.round(40 * arc / TAU)), arc))
/** Cylinder of height 1 with top radius `rt` and bottom radius `rb`. */
export const frus = (rt: number, rb: number) => memo(`f${rt},${rb}`, () => new THREE.CylinderGeometry(rt, rb, 1, 28))
/** Pie sector of a unit cylinder; theta 0 is +z, growing towards +x. */
export const wedge = (start: number, len: number) => memo(`w${start},${len}`, () => new THREE.CylinderGeometry(1, 1, 1, 32, 1, false, start, len), true)
export const lathe = (key: string, pts: [number, number][]) => memo(`l${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28), true)
/** A 2D shape extruded along z, centred on z = 0; `bevel` rounds its edges inside the outline and the depth. Curved sides are smooth. */
export const ext = (key: string, shape: () => THREE.Shape, depth: number, bevel = 0) => memo(`e${key},${depth},${bevel}`, () => {
  const g = new THREE.ExtrudeGeometry(shape(), { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 4, curveSegments: 12 })
  g.translate(0, 0, bevel - depth / 2)
  return toCreasedNormals(g, 0.75)
})

export const poly = (pts: [number, number][]) => {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}
function rrShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
  return s
}
/** Rounded rectangle w×h (corner r), d deep. */
export const rr = (w: number, h: number, r: number, d: number, bevel = 0) => ext(`rr${w},${h},${r}`, () => rrShape(w, h, r), d, bevel)
export const heartShape = () => {
  const s = new THREE.Shape()
  s.moveTo(0, -0.42)
  s.bezierCurveTo(-0.55, -0.05, -0.5, 0.42, -0.22, 0.42); s.bezierCurveTo(-0.08, 0.42, 0, 0.32, 0, 0.22)
  s.bezierCurveTo(0, 0.32, 0.08, 0.42, 0.22, 0.42); s.bezierCurveTo(0.5, 0.42, 0.55, -0.05, 0, -0.42)
  return s
}
export const starShape = (n: number, R: number, r: number) => () =>
  poly(Array.from({ length: n * 2 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; return [Math.cos(a) * q, Math.sin(a) * q] as [number, number] }))
export const gearShape = (teeth: number, R: number, r: number, hole: number) => () => {
  const w = Math.PI / teeth, pts: [number, number][] = []
  for (let i = 0; i < teeth; i++) {
    const a = i * 2 * w
    for (const [q, d] of [[r, -0.55], [R, -0.32], [R, 0.32], [r, 0.55]]) pts.push([Math.cos(a + d * w) * q, Math.sin(a + d * w) * q])
  }
  const s = poly(pts)
  s.holes.push(new THREE.Path().absarc(0, 0, hole, 0, TAU, true))
  return s
}
export const leafShape = () => {
  const s = new THREE.Shape()
  s.moveTo(0, -0.45); s.bezierCurveTo(0.45, -0.25, 0.35, 0.3, 0, 0.5); s.bezierCurveTo(-0.35, 0.3, -0.45, -0.25, 0, -0.45)
  return s
}
export const shieldShape = () => {
  const s = new THREE.Shape()
  s.moveTo(-0.4, 0.45); s.lineTo(0.4, 0.45); s.lineTo(0.4, 0.02); s.quadraticCurveTo(0.38, -0.36, 0, -0.52); s.quadraticCurveTo(-0.38, -0.36, -0.4, 0.02)
  s.closePath()
  return s
}

const colors = new Map<string, THREE.Color>()
const color = (hex: string) => { let c = colors.get(hex); if (!c) colors.set(hex, c = new THREE.Color(hex)); return c }
/** `k` of the way from colour a to colour b, as #rrggbb. */
export const mix = (a: string, b: string, k: number) => `#${color(a).clone().lerp(color(b), k).getHexString()}`

const M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), NM = new THREE.Matrix3(), V = new THREE.Vector3()
const P = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1)

export class Geo {
  private pos: number[] = []; private nor: number[] = []; private col: number[] = []; private fin: number[] = []
  add(g: THREE.BufferGeometry, hex: string, tx: Tx = {}): this {
    const s = tx.s ?? 1, p = tx.p ?? [0, 0, 0], r = tx.r ?? [0, 0, 0]
    M.compose(P.set(p[0], p[1], p[2]), Q.setFromEuler(E.set(r[0], r[1], r[2])), ONE)
    if (tx.o) M.multiply(M2.makeTranslation(tx.o[0], tx.o[1], tx.o[2]))
    M.scale(typeof s === 'number' ? S.set(s, s, s) : S.set(s[0], s[1], s[2]))
    NM.getNormalMatrix(M)
    const pa = g.getAttribute('position'), na = g.getAttribute('normal'), c = color(hex), f = FIN.get(hex) ?? SATIN
    for (let i = 0; i < pa.count; i++) {
      V.fromBufferAttribute(pa, i).applyMatrix4(M); this.pos.push(V.x, V.y, V.z)
      V.fromBufferAttribute(na, i).applyMatrix3(NM).normalize(); this.nor.push(V.x, V.y, V.z)
      this.col.push(c.r, c.g, c.b); this.fin.push(f[0], f[1], f[2], f[3])
    }
    return this
  }
  /** A straight bar from (x1,y1) to (x2,y2) in the plane z. */
  stroke(hex: string, x1: number, y1: number, x2: number, y2: number, z = 0, w = 0.05, d = 0.03): this {
    return this.add(box, hex, { p: [(x1 + x2) / 2, (y1 + y2) / 2, z], r: [0, 0, Math.atan2(y2 - y1, x2 - x1)], s: [Math.hypot(x2 - x1, y2 - y1) + w * 0.6, w, d] })
  }
  mesh(mat: THREE.Material = MAT): THREE.Mesh {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    if (mat === MAT) g.setAttribute('fin', new THREE.Float32BufferAttribute(this.fin, 4))
    made.add(g)
    return new THREE.Mesh(g, mat)
  }
}

/** A group of finished parts. */
export function G(...parts: (Geo | THREE.Object3D)[]) {
  const g = new THREE.Group()
  for (const p of parts) g.add(p instanceof Geo ? p.mesh() : p)
  return g
}
/** A moving part whose geometry is authored around its pivot `p`. */
export function piv(part: Geo | THREE.Object3D, p: V3, r: V3 = [0, 0, 0]) {
  const g = G(part)
  g.position.set(p[0], p[1], p[2]); g.rotation.set(r[0], r[1], r[2])
  return g
}
/** A moving part authored in its parent's coordinates that turns about the point `p`. */
export function hinge(part: Geo, p: V3) {
  const m = part.mesh(), g = new THREE.Group()
  m.position.set(-p[0], -p[1], -p[2]); g.position.set(p[0], p[1], p[2]); g.add(m)
  return g
}
export const ease = (k: number) => k * k * (3 - 2 * k)
export function each<T extends unknown[]>(rows: T[], f: (...row: T) => void) { rows.forEach(r => f(...r)) }
