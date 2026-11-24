// Generates the map of Achrona once, from a fixed seed:
//   src/assets/achrona-map.svg   static terrain (themable through CSS variables, parchment fallbacks)
//   src/lib/map-geometry.json    districts (Voronoi cells, capitals, label + marker positions)
// Run with: npm run map:generate   (output is committed; the browser computes nothing)
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { Delaunay } from 'd3-delaunay'
import { curveCatmullRom, curveCatmullRomClosed, line } from 'd3-shape'
import { createNoise2D } from 'simplex-noise'
import { DISTRICTS, DISTRICT_LABELS, type District } from '../lib/district.ts'

const SEED = 20261124
const W = 1600
const H = 1000
const G = 6 // grid step (map units) for the height field
const NX = Math.ceil(W / G)
const NY = Math.ceil(H / G)

type Pt = [number, number]

// ---------- deterministic randomness ----------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const noise = createNoise2D(mulberry32(SEED + 1))
const noise2 = createNoise2D(mulberry32(SEED + 2))

const fbm = (x: number, y: number, octaves: number, n = noise) => {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let o = 0; o < octaves; o++) {
    sum += amp * n(x * freq, y * freq)
    amp *= 0.5
    freq *= 2.03
  }
  return sum
}
const gauss = (x: number, y: number, cx: number, cy: number, r: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r))

// ---------- layout: capitals (normalised 0–1) ----------
const CAPITALS: Record<District, Pt> = {
  clocktower: [0.29, 0.3],
  archives: [0.56, 0.23],
  'old-market': [0.46, 0.5],
  harbor: [0.75, 0.47],
  'ember-fields': [0.26, 0.66],
  skyforge: [0.61, 0.74],
}
const capital = (d: District): Pt => [CAPITALS[d][0] * W, CAPITALS[d][1] * H]

// Skyforge ridge: a polyline the mountains follow.
const RIDGE: Pt[] = [[0.5, 0.83], [0.58, 0.77], [0.66, 0.72], [0.73, 0.66]]
function distToRidge(nx: number, ny: number): number {
  let best = Infinity
  for (let i = 0; i < RIDGE.length - 1; i++) {
    const [ax, ay] = RIDGE[i]
    const [bx, by] = RIDGE[i + 1]
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((nx - ax) * dx + (ny - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(nx - (ax + t * dx), (ny - (ay + t * dy)) * 0.62))
  }
  return best
}

// ---------- height field ----------
function height(nx: number, ny: number): number {
  const ex = (nx - 0.5) / 0.42
  const ey = (ny - 0.5) / 0.38
  const falloff = 1 - Math.pow(ex * ex + ey * ey, 1.2)
  let h = 0.52 * falloff + 0.5 * fbm(nx * 3.1, ny * 3.1, 6) - 0.14
  // Mountain ridge (Skyforge) with ridged noise for jagged peaks.
  const ridge = Math.exp(-((distToRidge(nx, ny) / 0.06) ** 2))
  h += ridge * (0.55 + 0.35 * (1 - Math.abs(noise2(nx * 9, ny * 9))))
  // Gentle hills in the north.
  h += 0.12 * gauss(nx, ny, 0.45, 0.2, 0.12)
  // Crystal Harbor: a sheltered bay from the east coast and an inland lake.
  h -= 0.75 * gauss(nx, ny * 1.4, 0.86, 0.47 * 1.4, 0.07)
  h -= 0.45 * gauss(nx, ny, 0.8, 0.465, 0.03)
  h -= 0.8 * gauss(nx, ny * 1.3, 0.705, 0.53 * 1.3, 0.032) // Crystal Lake, just inland of the harbour
  // Every capital stands on land.
  for (const d of DISTRICTS) h += 0.12 * gauss(nx, ny, CAPITALS[d][0], CAPITALS[d][1], 0.05)
  // Small islands.
  for (const [ix, iy, r] of [[0.1, 0.24, 0.028], [0.9, 0.78, 0.022], [0.83, 0.14, 0.022], [0.2, 0.88, 0.02]] as const) {
    h += 1.15 * gauss(nx, ny * 1.3, ix, iy * 1.3, r) * (0.8 + 0.4 * noise(nx * 20, ny * 20))
  }
  return h
}

const grid: number[][] = []
for (let j = 0; j <= NY; j++) {
  const row: number[] = []
  for (let i = 0; i <= NX; i++) {
    const border = i === 0 || j === 0 || i === NX || j === NY
    row.push(border ? -1 : height((i * G) / W, (j * G) / H))
  }
  grid.push(row)
}
const hAt = (x: number, y: number) => {
  const i = Math.max(0, Math.min(NX, Math.round(x / G)))
  const j = Math.max(0, Math.min(NY, Math.round(y / G)))
  return grid[j][i]
}

// ---------- marching squares ----------
function contourRings(level: number): Pt[][] {
  const pointOf = (key: string): Pt => {
    const [kind, rest] = [key[0], key.slice(1)]
    const [i, j] = rest.split(',').map(Number)
    if (kind === 'h') {
      const v0 = grid[j][i]
      const v1 = grid[j][i + 1]
      const t = (level - v0) / (v1 - v0)
      return [(i + t) * G, j * G]
    }
    const v0 = grid[j][i]
    const v1 = grid[j + 1][i]
    const t = (level - v0) / (v1 - v0)
    return [i * G, (j + t) * G]
  }
  const adjacency = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b])
    adjacency.set(b, [...(adjacency.get(b) ?? []), a])
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = grid[j][i] > level
      const b = grid[j][i + 1] > level
      const c = grid[j + 1][i + 1] > level
      const d = grid[j + 1][i] > level
      const idx = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0)
      if (idx === 0 || idx === 15) continue
      const top = `h${i},${j}`
      const right = `v${i + 1},${j}`
      const bottom = `h${i},${j + 1}`
      const left = `v${i},${j}`
      const center = (grid[j][i] + grid[j][i + 1] + grid[j + 1][i + 1] + grid[j + 1][i]) / 4 > level
      switch (idx) {
        case 1: case 14: link(left, bottom); break
        case 2: case 13: link(bottom, right); break
        case 3: case 12: link(left, right); break
        case 4: case 11: link(top, right); break
        case 6: case 9: link(top, bottom); break
        case 7: case 8: link(left, top); break
        case 5:
          if (center) { link(left, top); link(bottom, right) } else { link(top, right); link(left, bottom) }
          break
        case 10:
          if (center) { link(top, right); link(left, bottom) } else { link(left, top); link(bottom, right) }
          break
      }
    }
  }
  const visited = new Set<string>()
  const rings: Pt[][] = []
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue
    const ring: Pt[] = []
    let prev: string | null = null
    let current: string | null = start
    while (current && !visited.has(current)) {
      visited.add(current)
      ring.push(pointOf(current))
      const next: string | undefined = (adjacency.get(current) ?? []).find((n) => n !== prev && !visited.has(n))
      prev = current
      current = next ?? null
    }
    if (ring.length > 3) rings.push(ring)
  }
  return rings
}

// ---------- geometry helpers ----------
const area = (ring: Pt[]) => {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s / 2)
}

function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let maxD = 0
    let index = -1
    const [x1, y1] = points[s]
    const [x2, y2] = points[e]
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    for (let i = s + 1; i < e; i++) {
      const [x, y] = points[i]
      const d = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / len
      if (d > maxD) { maxD = d; index = i }
    }
    if (maxD > tolerance && index > 0) {
      keep[index] = 1
      stack.push([s, index], [index, e])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Ramer–Douglas–Peucker for a closed ring: split at the point farthest from the start. */
function simplifyRing(ring: Pt[], tolerance: number): Pt[] {
  let far = 0
  let farD = -1
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
    if (d > farD) { farD = d; far = i }
  }
  const a = simplify(ring.slice(0, far + 1), tolerance)
  const b = simplify([...ring.slice(far), ring[0]], tolerance)
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

const closedPath = line<Pt>().curve(curveCatmullRomClosed.alpha(0.5)).digits(1)
const openPath = line<Pt>().curve(curveCatmullRom.alpha(0.5)).digits(1)
const polyPath = (ring: Pt[]) => `M${ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`
const r1 = (n: number) => Math.round(n * 10) / 10

function ringsPath(level: number, minArea: number, tolerance: number, smooth: boolean): string {
  return contourRings(level)
    .filter((r) => area(r) >= minArea)
    .map((r) => simplifyRing(r, tolerance))
    .filter((r) => r.length >= 4)
    .map((r) => (smooth ? closedPath(r)! : polyPath(r)))
    .join('')
}

// ---------- hill-shading as an embedded PNG (gray + alpha) ----------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function hillshadePng(): string {
  const w = NX + 1
  const h = NY + 1
  const light = [-0.6, -0.7, 0.9]
  const ll = Math.hypot(...light)
  // Shade from a smoothed copy of the terrain, so it reads as soft relief, not noise.
  let smooth = grid.map((row) => [...row])
  for (let pass = 0; pass < 3; pass++) {
    smooth = smooth.map((row, j) =>
      row.map((_, i) => {
        let sum = 0
        let n = 0
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const r = smooth[j + dj]
            if (r && r[i + di] !== undefined) { sum += r[i + di]; n++ }
          }
        return sum / n
      }),
    )
  }
  const shade: number[][] = smooth.map((row, j) =>
    row.map((_, i) => {
      if (grid[j][i] <= 0) return 0
      const dx = (smooth[j][Math.min(NX, i + 1)] - smooth[j][Math.max(0, i - 1)]) * 24
      const dy = (smooth[Math.min(NY, j + 1)][i] - smooth[Math.max(0, j - 1)][i]) * 24
      const nl = Math.hypot(dx, dy, 1)
      const lambert = (-dx * light[0] - dy * light[1] + light[2]) / (nl * ll)
      return Math.max(0, Math.min(1, (0.93 - lambert) * 1.6))
    }),
  )
  const raw = Buffer.alloc((w * 2 + 1) * h)
  for (let j = 0; j < h; j++) {
    raw[j * (w * 2 + 1)] = 0 // filter: none
    for (let i = 0; i < w; i++) {
      const offset = j * (w * 2 + 1) + 1 + i * 2
      raw[offset] = 30
      raw[offset + 1] = Math.round(shade[j][i] * 120)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 4 // gray + alpha
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

// ---------- districts (Voronoi) ----------
const capitalPts = DISTRICTS.map(capital)
const delaunay = Delaunay.from(capitalPts)
const voronoi = delaunay.voronoi([0, 0, W, H])
const districtOf = (x: number, y: number): District => DISTRICTS[delaunay.find(x, y)]

// ---------- features ----------
function jitteredGrid(step: number, jitter = 0.8): Pt[] {
  const out: Pt[] = []
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      out.push([x + (rand() - 0.5) * step * jitter, y + (rand() - 0.5) * step * jitter])
    }
  }
  return out
}

// Mountains (glyphs), back to front.
const mountains = jitteredGrid(30)
  .filter(([x, y]) => hAt(x, y) > 0.62 && rand() < 0.8)
  .sort((a, b) => a[1] - b[1])
const mountainSvg = mountains
  .map(([x, y]) => {
    const h = hAt(x, y)
    const s = 9 + (h - 0.6) * 22
    const snow = h > 0.82
    const body = `M${r1(x - s)},${r1(y + s * 0.55)}L${r1(x - s * 0.15)},${r1(y - s * 0.85)}L${r1(x + s * 0.2)},${r1(y - s * 0.45)}L${r1(x + s * 0.45)},${r1(y - s * 0.7)}L${r1(x + s)},${r1(y + s * 0.55)}Z`
    const shade = `M${r1(x - s * 0.15)},${r1(y - s * 0.85)}L${r1(x + s * 0.05)},${r1(y + s * 0.55)}L${r1(x + s)},${r1(y + s * 0.55)}L${r1(x + s * 0.45)},${r1(y - s * 0.7)}L${r1(x + s * 0.2)},${r1(y - s * 0.45)}Z`
    const cap = snow
      ? `<path class="m-snowcap" d="M${r1(x - s * 0.42)},${r1(y - s * 0.28)}L${r1(x - s * 0.15)},${r1(y - s * 0.85)}L${r1(x + s * 0.2)},${r1(y - s * 0.45)}L${r1(x + s * 0.05)},${r1(y - s * 0.2)}L${r1(x - s * 0.18)},${r1(y - s * 0.38)}Z"/>`
      : ''
    return `<path class="m-mountain" d="${body}"/><path class="m-mountain-shade" d="${shade}"/>${cap}`
  })
  .join('')

// Rivers: from high ground, follow the steepest descent to the sea (or a lake).
function traceRiver(start: Pt): Pt[] {
  let i = Math.round(start[0] / G)
  let j = Math.round(start[1] / G)
  const seen = new Set<string>()
  const pts: Pt[] = []
  for (let step = 0; step < 900; step++) {
    seen.add(`${i},${j}`)
    pts.push([i * G, j * G])
    if (grid[j][i] < 0) break
    let best: [number, number] | null = null
    let bestH = Infinity
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni > NX || nj > NY || seen.has(`${ni},${nj}`)) continue
        const v = grid[nj][ni] + (di && dj ? 0.0004 : 0)
        if (v < bestH) { bestH = v; best = [ni, nj] }
      }
    }
    if (!best) break
    ;[i, j] = best
  }
  return grid[j][i] < 0 ? pts : []
}
const riverSources = jitteredGrid(50)
  .filter(([x, y]) => hAt(x, y) > 0.38 && hAt(x, y) < 0.85)
  .sort(() => rand() - 0.5)
const rivers: Pt[][] = []
for (const source of riverSources) {
  if (rivers.length >= 5) break
  if (rivers.some((r) => r.some(([x, y]) => Math.hypot(x - source[0], y - source[1]) < 120))) continue
  const river = traceRiver(source)
  // Long enough, and not merging into an earlier river.
  if (river.length > 22 && !rivers.some((r) => r.some(([x, y]) => river.some(([a, b]) => Math.hypot(x - a, y - b) < 10)))) rivers.push(river)
}
const riverSvg = rivers
  .map((pts) => {
    const meander = pts.map(([x, y], k): Pt => [x + noise(x / 40, y / 40) * 4, y + noise2(x / 40, y / 40) * 4 + (k ? 0 : 0)])
    const smooth = simplify(meander, 1.2)
    const parts = 4
    const size = Math.ceil(smooth.length / parts)
    return Array.from({ length: parts }, (_, k) => smooth.slice(k * size, Math.min(smooth.length, (k + 1) * size + 1)))
      .filter((seg) => seg.length > 1)
      .map((seg, k) => `<path class="m-river" stroke-width="${(0.9 + k * 0.75).toFixed(2)}" d="${openPath(seg)}"/>`)
      .join('')
  })
  .join('')

// Forests: dense in Ember Fields, a few groves elsewhere.
const trees = jitteredGrid(13, 1)
  .filter(([x, y]) => {
    const h = hAt(x, y)
    if (h < 0.06 || h > 0.5) return false
    const clump = noise(x / 90, y / 90)
    return districtOf(x, y) === 'ember-fields' ? clump > -0.35 && rand() < 0.85 : clump > 0.55 && rand() < 0.35
  })
  .filter(([x, y]) => DISTRICTS.every((d) => Math.hypot(x - capital(d)[0], y - capital(d)[1]) > 34))
  .sort((a, b) => a[1] - b[1])
const treeSvg = trees.map(([x, y]) => `<use href="#m-tree${rand() < 0.65 ? 'a' : 'b'}" x="${r1(x)}" y="${r1(y)}"/>`).join('')

// Waves in deeper water.
const waveSvg = jitteredGrid(64)
  .filter(([x, y]) => hAt(x, y) < -0.14 && x > 30 && x < W - 40 && y > 30 && y < H - 30 && rand() < 0.6)
  .map(([x, y]) => `<path class="m-wave" d="M${r1(x)},${r1(y)}q5,-4 10,0t10,0"/>`)
  .join('')

// Roads between capitals: the market is the hub, plus a ring road. Slightly curved.
const ROADS: [District, District][] = [
  ['old-market', 'clocktower'], ['old-market', 'archives'], ['old-market', 'harbor'],
  ['old-market', 'ember-fields'], ['old-market', 'skyforge'], ['clocktower', 'archives'],
  ['clocktower', 'ember-fields'], ['archives', 'harbor'],
]
const roadSvg = ROADS.map(([a, b], k) => {
  const [x1, y1] = capital(a)
  const [x2, y2] = capital(b)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const len = Math.hypot(x2 - x1, y2 - y1)
  const bend = (noise(k * 3.7, 1.3) * 0.25 + 0.08) * len
  const cx = mx + (-(y2 - y1) / len) * bend
  const cy = my + ((x2 - x1) / len) * bend
  return `<path class="m-road" d="M${r1(x1)},${r1(y1)}Q${r1(cx)},${r1(cy)} ${r1(x2)},${r1(y2)}"/>`
}).join('')

// ---------- per-district data for the app ----------
function markerSlots(d: District): Pt[] {
  const [cx, cy] = capital(d)
  const candidates = jitteredGrid(16)
    .filter(([x, y]) => districtOf(x, y) === d && hAt(x, y) > 0.05 && Math.hypot(x - cx, y - cy) > 26 && Math.hypot(x - cx, y - cy) < 170)
  // Farthest-point sampling around the capital: well spread, but starting close by.
  const chosen: Pt[] = []
  candidates.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))
  if (candidates[0]) chosen.push(candidates[0])
  while (chosen.length < 24 && chosen.length < candidates.length) {
    let best: Pt | null = null
    let bestScore = -Infinity
    for (const c of candidates) {
      const near = Math.min(...chosen.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])))
      if (near < 18) continue
      const score = near - 0.35 * Math.hypot(c[0] - cx, c[1] - cy)
      if (score > bestScore) { bestScore = score; best = c }
    }
    if (!best) break
    chosen.push(best)
  }
  return chosen.map(([x, y]) => [r1(x), r1(y)])
}

const geometry = {
  width: W,
  height: H,
  seed: SEED,
  districts: Object.fromEntries(
    DISTRICTS.map((d, k) => {
      const [x, y] = capital(d)
      const polygon = (voronoi.cellPolygon(k) ?? []).map(([px, py]) => [r1(px), r1(py)])
      return [d, { name: DISTRICT_LABELS[d], capital: [r1(x), r1(y)], label: [r1(x), r1(y - 34)], polygon, markers: markerSlots(d) }]
    }),
  ),
}

// ---------- capital icons ----------
const ICONS: Record<District, string> = {
  clocktower: '<path d="M-5,9V-6L0,-14L5,-6V9Z"/><circle cx="0" cy="-2" r="3.2" class="m-icon-face"/><path d="M0,-2V-4.2M0,-2H1.8" class="m-icon-line"/><path d="M-8,9H8"/>',
  archives: '<path d="M-10,-4L0,-11L10,-4Z"/><path d="M-9,-4H9V8H-9Z"/><path d="M-6,-3V7M-2,-3V7M2,-3V7M6,-3V7" class="m-icon-line"/><path d="M-11,9H11"/>',
  'old-market': '<path d="M-10,-6L-7,-11H7L10,-6Z"/><path d="M-7,-11L-5,-6M-3,-11L-2,-6M1,-11L2,-6M5,-11L6,-6" class="m-icon-line"/><path d="M-8,-6V8M8,-6V8M-9,2H9"/>',
  harbor: '<path d="M0,-13L7,-3L0,10L-7,-3Z"/><path d="M-7,-3H7M0,-13L-3,-3L0,10L3,-3Z" class="m-icon-line"/>',
  'ember-fields': '<path d="M0,-13C6,-6 8,-2 6,4C5,8 2,10 0,10C-3,10 -7,7 -7,2C-7,-3 -3,-5 -2,-9C0,-6 1,-4 0,-13Z"/><path d="M0,9C-3,8 -3,4 -1,1C0,4 2,5 2,7C2,8 1,9 0,9Z" class="m-icon-face"/>',
  skyforge: '<path d="M-11,-5H9C9,-1 5,0 3,0V4H6V8H-6V4H-3V0C-7,0 -10,-2 -11,-5Z"/><path d="M-2,-9L0,-13L2,-9M4,-10L7,-13" class="m-icon-line"/>',
}

const capitalsSvg = DISTRICTS.map((d) => {
  const [x, y] = capital(d)
  return `<g class="m-capital" transform="translate(${r1(x)},${r1(y)})"><circle r="15" class="m-capital-ring"/><g class="m-icon">${ICONS[d]}</g></g>`
}).join('')

// ---------- decoration ----------
const compass = (() => {
  const cx = 1490
  const cy = 860
  const long = Array.from({ length: 4 }, (_, k) => {
    const a = (k * Math.PI) / 2 - Math.PI / 2
    const tip: Pt = [cx + Math.cos(a) * 62, cy + Math.sin(a) * 62]
    const l: Pt = [cx + Math.cos(a - Math.PI / 2) * 9, cy + Math.sin(a - Math.PI / 2) * 9]
    const r: Pt = [cx + Math.cos(a + Math.PI / 2) * 9, cy + Math.sin(a + Math.PI / 2) * 9]
    return `<path class="m-compass-dark" d="M${r1(cx)},${r1(cy)}L${r1(tip[0])},${r1(tip[1])}L${r1(l[0])},${r1(l[1])}Z"/><path class="m-compass-light" d="M${r1(cx)},${r1(cy)}L${r1(tip[0])},${r1(tip[1])}L${r1(r[0])},${r1(r[1])}Z"/>`
  }).join('')
  const short = Array.from({ length: 4 }, (_, k) => {
    const a = (k * Math.PI) / 2 - Math.PI / 4
    const tip: Pt = [cx + Math.cos(a) * 36, cy + Math.sin(a) * 36]
    const l: Pt = [cx + Math.cos(a - Math.PI / 2) * 6, cy + Math.sin(a - Math.PI / 2) * 6]
    const r: Pt = [cx + Math.cos(a + Math.PI / 2) * 6, cy + Math.sin(a + Math.PI / 2) * 6]
    return `<path class="m-compass-light" d="M${r1(l[0])},${r1(l[1])}L${r1(tip[0])},${r1(tip[1])}L${r1(r[0])},${r1(r[1])}Z"/>`
  }).join('')
  return `<g class="m-deco m-compass"><circle cx="${cx}" cy="${cy}" r="46" class="m-compass-ring"/><circle cx="${cx}" cy="${cy}" r="40" class="m-compass-ring"/>${short}${long}<text x="${cx}" y="${cy - 70}" class="m-compass-n">N</text></g>`
})()

const scaleBar = (() => {
  const x = 70
  const y = 930
  const seg = 40
  const blocks = Array.from({ length: 4 }, (_, k) => `<rect x="${x + k * seg}" y="${y}" width="${seg}" height="7" class="${k % 2 ? 'm-scale-light' : 'm-scale-dark'}"/>`).join('')
  return `<g class="m-deco">${blocks}<rect x="${x}" y="${y}" width="${seg * 4}" height="7" class="m-scale-frame"/><text x="${x}" y="${y - 8}" class="m-scale-text">0</text><text x="${x + seg * 4}" y="${y - 8}" class="m-scale-text" text-anchor="end">1 league</text></g>`
})()

const cartouche = `<g class="m-deco m-cartouche" transform="translate(60,42)">
<path class="m-cartouche-bg" d="M14,0H286C300,0 300,18 292,24C300,30 300,48 286,48H14C0,48 0,30 8,24C0,18 0,0 14,0Z" transform="scale(1.1,1.55)"/>
<text x="165" y="44" class="m-title">ACHRONA</text>
<text x="165" y="64" class="m-subtitle">Realm of the Grid</text></g>`

const seaLabels = `<g class="m-label m-sea-labels">
<text x="490" y="905" class="m-sea-label" transform="rotate(-4 490 905)">Sea of Echoes</text>
<text x="1560" y="600" class="m-sea-label" transform="rotate(90 1560 600)">Desync Strait</text>
<text x="1000" y="965" class="m-sea-label">The Quiet Deep</text></g>`

// ---------- assemble ----------
const coast = ringsPath(0, 150, 1.1, true)
const shallowEdge = coast // same rings, stroked wide underneath for shallow water
const contours = [0.14, 0.26, 0.38, 0.5, 0.62, 0.74].map((lv) => `<path class="m-contour${lv >= 0.5 ? ' m-contour-high' : ''}" d="${ringsPath(lv, 260, 2.2, false)}"/>`).join('')
// Snow sits on the mountain glyphs (m-snowcap), not as a separate area.
const borders = DISTRICTS.map((_, k) => `<path d="${polyPath(voronoi.cellPolygon(k)!.slice(0, -1) as Pt[])}"/>`).join('')

// Fallback colours = parchment; the app overrides them with CSS variables per theme.
const style = `
.m-sea{fill:var(--mp-sea,#d6d2b4)}
.m-grid{stroke:var(--mp-grid,transparent);stroke-width:.6}
.m-wave{fill:none;stroke:var(--mp-wave,#8f8a68);stroke-width:1.2;stroke-linecap:round;opacity:.7}
.m-shallow{fill:none;stroke:var(--mp-shallow,#e6e3c9);stroke-width:30;stroke-linejoin:round}
.m-shallow2{fill:none;stroke:var(--mp-shallow2,#efeccf);stroke-width:13;stroke-linejoin:round}
.m-land{fill:var(--mp-land,#f4e8c8);fill-rule:evenodd}
.m-coast{fill:none;stroke:var(--mp-coast,#5b4630);stroke-width:1.8;stroke-linejoin:round}
.m-hillshade{opacity:var(--mp-hillshade-opacity,.55);mix-blend-mode:var(--mp-hillshade-blend,multiply);filter:var(--mp-hillshade-filter,none)}
.m-contour{fill:none;stroke:var(--mp-contour,#b59c72);stroke-width:.7;opacity:.75}
.m-contour-high{stroke-width:.9}
.m-snow{fill:var(--mp-snow,#fbf8ee);opacity:.9}
.m-mountain{fill:var(--mp-mountain,#eadab0);stroke:var(--mp-ink,#5b4630);stroke-width:1;stroke-linejoin:round}
.m-mountain-shade{fill:var(--mp-mountain-shade,#c9b07e);opacity:.8}
.m-snowcap{fill:var(--mp-snow,#fbf8ee);stroke:var(--mp-ink,#5b4630);stroke-width:.6}
.m-river{fill:none;stroke:var(--mp-river,#6f8fa6);stroke-linecap:round;stroke-linejoin:round}
.m-tree{fill:var(--mp-forest,#6f7d45);stroke:var(--mp-ink,#5b4630);stroke-width:.5}
.m-trunk{stroke:var(--mp-ink,#5b4630);stroke-width:1}
.m-borders path{fill:none;stroke:var(--mp-border,#7d5f3f);stroke-width:1.4;stroke-dasharray:1 5;stroke-linecap:round}
.m-road{fill:none;stroke:var(--mp-road,#8a6c4a);stroke-width:1.6;stroke-dasharray:7 5;stroke-linecap:round}
.m-capital-ring{fill:var(--mp-icon-bg,#f8efd6);stroke:var(--mp-ink,#5b4630);stroke-width:1.4}
.m-icon path,.m-icon circle{fill:var(--mp-icon,#c9a46a);stroke:var(--mp-ink,#5b4630);stroke-width:1.1;stroke-linejoin:round}
.m-icon .m-icon-line{fill:none}
.m-icon .m-icon-face{fill:var(--mp-icon-bg,#f8efd6)}
.m-compass-ring{fill:none;stroke:var(--mp-ink,#5b4630);stroke-width:1}
.m-compass-dark{fill:var(--mp-ink,#5b4630)}
.m-compass-light{fill:var(--mp-icon-bg,#f8efd6);stroke:var(--mp-ink,#5b4630);stroke-width:.8}
.m-compass-n,.m-title,.m-subtitle,.m-scale-text,.m-sea-label{font-family:Cinzel,Georgia,serif;fill:var(--mp-ink,#5b4630);text-anchor:middle}
.m-compass-n{font-size:22px;font-weight:700}
.m-scale-dark{fill:var(--mp-ink,#5b4630)}
.m-scale-light{fill:var(--mp-icon-bg,#f8efd6)}
.m-scale-frame{fill:none;stroke:var(--mp-ink,#5b4630);stroke-width:1}
.m-scale-text{font-size:13px;text-anchor:start}
.m-cartouche-bg{fill:var(--mp-icon-bg,#f8efd6);stroke:var(--mp-ink,#5b4630);stroke-width:1.5}
.m-title{font-size:34px;font-weight:700;letter-spacing:.32em}
.m-subtitle{font-size:12px;letter-spacing:.3em;opacity:.8}
.m-sea-label{font-size:20px;font-style:italic;letter-spacing:.3em;opacity:.55}
.m-frame{fill:none;stroke:var(--mp-ink,#5b4630)}
`.replace(/\n/g, '')

const gridLines = [
  ...Array.from({ length: Math.floor(W / 50) + 1 }, (_, k) => `M${k * 50},0V${H}`),
  ...Array.from({ length: Math.floor(H / 50) + 1 }, (_, k) => `M0,${k * 50}H${W}`),
].join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="achrona-terrain" aria-hidden="true">
<style>${style}</style>
<defs>
<clipPath id="m-land-clip"><path clip-rule="evenodd" d="${coast}"/></clipPath>
<symbol id="m-treea" overflow="visible"><path class="m-tree" d="M0,-8L4.5,0H1.8L5.5,5H-5.5L-1.8,0H-4.5Z"/><path class="m-trunk" d="M0,5V8"/></symbol>
<symbol id="m-treeb" overflow="visible"><circle class="m-tree" cy="-2" r="4.6"/><path class="m-trunk" d="M0,2.5V7"/></symbol>
</defs>
<rect class="m-sea" width="${W}" height="${H}"/>
<path class="m-grid" d="${gridLines}"/>
<g class="m-waves">${waveSvg}</g>
<path class="m-shallow" d="${shallowEdge}"/>
<path class="m-shallow2" d="${shallowEdge}"/>
<path class="m-land" d="${coast}"/>
<image class="m-hillshade" href="${hillshadePng()}" width="${W}" height="${H}" preserveAspectRatio="none" clip-path="url(#m-land-clip)"/>
<g class="m-contours" clip-path="url(#m-land-clip)">${contours}</g>

<g class="m-rivers">${riverSvg}</g>
<g class="m-forest">${treeSvg}</g>
<g class="m-borders" clip-path="url(#m-land-clip)">${borders}</g>
<path class="m-coast" d="${coast}"/>
<g class="m-roads">${roadSvg}</g>
<g class="m-mountains">${mountainSvg}</g>
<g class="m-capitals">${capitalsSvg}</g>
${seaLabels}
${compass}
${scaleBar}
${cartouche}
<rect class="m-frame" x="8" y="8" width="${W - 16}" height="${H - 16}" stroke-width="3"/>
<rect class="m-frame" x="16" y="16" width="${W - 32}" height="${H - 32}" stroke-width="1"/>
</svg>
`

const root = path.resolve(import.meta.dirname, '../..')
mkdirSync(path.join(root, 'src/assets'), { recursive: true })
writeFileSync(path.join(root, 'src/assets/achrona-map.svg'), svg)
writeFileSync(path.join(root, 'src/lib/map-geometry.json'), JSON.stringify(geometry))
console.log(
  `Map generated (seed ${SEED}): svg ${(svg.length / 1024).toFixed(0)} KB, ${rivers.length} rivers, ${trees.length} trees, ${mountains.length} mountains.`,
)
for (const d of DISTRICTS) console.log(`  ${d}: ${geometry.districts[d].markers.length} marker slots, capital height ${hAt(...capital(d)).toFixed(2)}`)
