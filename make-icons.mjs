// Generate POS UMKM app icons (teal bg + white storefront/basket motif) as PNG.
// Run: node make-icons.mjs
// Output: assets/icon.png (1024), android-icon-foreground.png (1024, icon-only centered),
//         splash-icon.png (512), favicon.png (128)
import { PNG } from 'pngjs'
import fs from 'node:fs'

const TEAL = [120, 149, 178]   // #7895B2 — steel blue (primary app)
const TEAL_DARK = [15, 36, 64]   // #0F2440 — navy splash
const WHITE = [255, 255, 255]
const YELLOW = [255, 255, 255]   // putih solid biar kontras di navy

function makeIcon(size, { foregroundOnly = false, withRounded = true } = {}) {
  const png = new PNG({ width: size, height: size })
  const cx = size / 2, cy = size / 2
  const u = size / 20 // unit grid (24x24 design space)

  const setPx = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (size * (y | 0) + (x | 0)) << 2
    png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255
  }
  // filled circle (anti-aliased-ish via distance)
  const circle = (cx0, cy0, r, c) => {
    for (let y = Math.floor(cy0 - r - 1); y <= cy0 + r + 1; y++)
      for (let x = Math.floor(cx0 - r - 1); x <= cx0 + r + 1; x++) {
        const d = Math.hypot(x - cx0, y - cy0)
        if (d <= r) setPx(x, y, c)
      }
  }
  // rounded rect fill
  const roundRect = (x0, y0, w, h, r, c) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const dx = Math.max(x0 + r - x, x - (x0 + w - 1 - r), 0)
        const dy = Math.max(y0 + r - y, y - (y0 + h - 1 - r), 0)
        if (Math.hypot(dx, dy) <= r) setPx(x, y, c)
      }
  }

  if (!foregroundOnly) {
    // Background: teal rounded square (or full bleed for adaptive background layer)
    if (withRounded) roundRect(0, 0, size, size, size * 0.18, TEAL)
    else for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) setPx(x, y, TEAL)
    // subtle darker bottom wave accent
    for (let y = Math.floor(size * 0.78); y < size; y++) {
      const t = (y - size * 0.78) / (size * 0.22)
      for (let x = 0; x < size; x++) {
        const i = (size * y + x) << 2
        if (png.data[i + 3] === 255 && !foregroundOnly) {
          png.data[i] = Math.round(TEAL[0] + (TEAL_DARK[0] - TEAL[0]) * t * 0.5)
          png.data[i + 1] = Math.round(TEAL[1] + (TEAL_DARK[1] - TEAL[1]) * t * 0.5)
          png.data[i + 2] = Math.round(TEAL[2] + (TEAL_DARK[2] - TEAL[2]) * t * 0.5)
        }
      }
    }
  }

  // ===== Storefront / warung motif =====
  const s = foregroundOnly ? 1 : 0.86 // scale down when bg present (safe zone)
  const awningY = cy - 4.6 * u * s
  const awningH = 1.9 * u * s
  // Awning: scalloped stripes
  for (let stripe = 0; stripe < 5; stripe++) {
    const sw = 4.4 * u * s / 5
    const x0 = cx - 2.2 * u * s + stripe * sw
    const col = stripe % 2 === 0 ? WHITE : YELLOW
    roundRect(x0 + sw * 0.06, awningY, sw * 0.88, awningH, sw * 0.3, col)
    // scallop bottom
    circle(x0 + sw / 2, awningY + awningH, sw * 0.44, col)
  }
  // Shop body outline
  const bodyW = 7.2 * u * s, bodyH = 5.4 * u * s
  const bx = cx - bodyW / 2, by = awningY + awningH + 1.1 * u * s
  const bt = 0.55 * u * s // border thickness
  // draw body as rounded rect then punch interior (draw interior in bg color)
  roundRect(bx, by, bodyW, bodyH, 0.8 * u * s, WHITE)
  roundRect(bx + bt, by + bt, bodyW - 2 * bt, bodyH - 2 * bt, 0.45 * u * s, foregroundOnly ? [0, 0, 0] : TEAL)
  if (!foregroundOnly) {
    // repaint interior with the local bg gradient approximation (flat teal is fine here)
    roundRect(bx + bt, by + bt, bodyW - 2 * bt, bodyH - 2 * bt, 0.45 * u * s, TEAL)
  } else {
    // transparent interior: clear pixels inside
    for (let y = by + bt; y < by + bodyH - bt; y++)
      for (let x = bx + bt; x < bx + bodyW - bt; x++) {
        const dx = Math.max(bx + bt + 0.45 * u * s - x, x - (bx + bodyW - bt - 0.45 * u * s), 0)
        const dy = Math.max(by + bt + 0.45 * u * s - y, y - (by + bodyH - bt - 0.45 * u * s), 0)
        if (Math.hypot(dx, dy) <= 0.45 * u * s) {
          const i = (size * (y | 0) + (x | 0)) << 2
          png.data[i + 3] = 0
        }
      }
  }
  // Door
  const dw = 1.9 * u * s, dh = 3.1 * u * s
  const dxc = cx - 1.15 * u * s
  roundRect(dxc, by + bodyH - dh - bt, dw, dh, 0.35 * u * s, WHITE)
  // Window with yellow glow
  const wx = cx + 0.35 * u * s, ww = 2.2 * u * s, wh = 1.7 * u * s
  roundRect(wx, by + 1.1 * u * s, ww, wh, 0.3 * u * s, YELLOW)

  return png
}

fs.writeFileSync('assets/icon.png', PNG.sync.write(makeIcon(1024)))
fs.writeFileSync('assets/android-icon-foreground.png', PNG.sync.write(makeIcon(1024, { foregroundOnly: true, withRounded: false })))
fs.writeFileSync('assets/splash-icon.png', PNG.sync.write(makeIcon(512)))
fs.writeFileSync('assets/favicon.png', PNG.sync.write(makeIcon(128)))
console.log('Icons written: icon.png, android-icon-foreground.png, splash-icon.png, favicon.png')
