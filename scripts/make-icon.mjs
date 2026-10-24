/**
 * Generates build/icon.png (512x512) and build/icon.ico — the OpenNotes app icon.
 * Pure Node: hand-rolled PNG encoder and shape rasteriser, no dependencies.
 *
 *   node scripts/make-icon.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 512
const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '..', 'build', 'icon.png')

/* ------------------------------ helpers ------------------------------ */

function crc32(buf) {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

/** Distance from a point to a line segment. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Rounded rectangle hit test. */
function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false
  const left = x + r
  const right = x + w - r
  const top = y + r
  const bottom = y + h - r
  if (px < left && py < top) return Math.hypot(px - left, py - top) <= r
  if (px > right && py < top) return Math.hypot(px - right, py - top) <= r
  if (px < left && py > bottom) return Math.hypot(px - left, py - bottom) <= r
  if (px > right && py > bottom) return Math.hypot(px - right, py - bottom) <= r
  return true
}

/* ------------------------------- artwork ----------------------------- */

const scale = SIZE / 24
const P = (x, y) => [x * scale, y * scale]

// The mark: three round strokes forming a soft "N" (same shape as the SVG logo).
const STROKES = [
  [P(6.6, 5.2), P(6.6, 18.8)],
  [P(6.6, 6.4), P(17.4, 18.4)],
  [P(17.4, 5.2), P(17.4, 18.8)],
]
const STROKE_WIDTH = 3.1 * scale
const STROKE_RADIUS = STROKE_WIDTH / 2

const TILE_TOP = hex('#5B9BFF')
const TILE_BOTTOM = hex('#7C5CFF')
const MARK = hex('#ffffff')

function colorAt(px, py) {
  // The rounded tile.
  if (!inRoundedRect(px, py, 0, 0, SIZE, SIZE, SIZE * 0.235)) return [0, 0, 0, 0]
  const t = (px / SIZE) * 0.35 + (py / SIZE) * 0.65
  let color = mix(TILE_TOP, TILE_BOTTOM, Math.min(1, Math.max(0, t)))

  // A soft highlight in the upper left corner.
  const glow = Math.max(0, 1 - Math.hypot(px - SIZE * 0.28, py - SIZE * 0.2) / (SIZE * 0.62))
  color = mix(color, [255, 255, 255], glow * 0.22)

  // The mark.
  for (const [[ax, ay], [bx, by]] of STROKES) {
    if (distanceToSegment(px, py, ax, ay, bx, by) <= STROKE_RADIUS) {
      color = MARK
      break
    }
  }
  return [color[0], color[1], color[2], 255]
}

const rgba = Buffer.alloc(SIZE * SIZE * 4)
const samples = [
  [-0.33, -0.33],
  [0, -0.33],
  [0.33, -0.33],
  [-0.33, 0],
  [0, 0],
  [0.33, 0],
  [-0.33, 0.33],
  [0, 0.33],
  [0.33, 0.33],
]

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (const [ox, oy] of samples) {
      const [cr, cg, cb, ca] = colorAt(x + 0.5 + ox, y + 0.5 + oy)
      r += cr * ca
      g += cg * ca
      b += cb * ca
      a += ca
    }
    const i = (y * SIZE + x) * 4
    if (a === 0) {
      rgba[i] = 0
      rgba[i + 1] = 0
      rgba[i + 2] = 0
      rgba[i + 3] = 0
    } else {
      rgba[i] = Math.round(r / a)
      rgba[i + 1] = Math.round(g / a)
      rgba[i + 2] = Math.round(b / a)
      rgba[i + 3] = Math.round(a / samples.length)
    }
  }
}

mkdirSync(dirname(out), { recursive: true })
const png = encodePng(SIZE, SIZE, rgba)
writeFileSync(out, png)
console.log('wrote', out)

// A Windows .ico that simply embeds the PNG (supported since Vista).
const icoPath = resolve(dirname(out), 'icon.ico')
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
const entry = Buffer.alloc(16)
entry[0] = 0 // width  (0 = 256)
entry[1] = 0 // height (0 = 256)
entry[2] = 0 // palette
entry[3] = 0 // reserved
entry.writeUInt16LE(1, 4) // colour planes
entry.writeUInt16LE(32, 6) // bits per pixel
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(header.length + entry.length, 12)
writeFileSync(icoPath, Buffer.concat([header, entry, png]))
console.log('wrote', icoPath)
