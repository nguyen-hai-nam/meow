#!/usr/bin/env node
/**
 * Generates the PWA icon set with no external dependencies.
 *
 * The artwork is drawn in code (brand gradient + a white cat face) so the
 * repository does not need a rasteriser, an emoji font, or check-in-only
 * binaries. Run `npm run icons` after changing the design.
 *
 * Output (public/icons):
 *   icon.svg                 512x512, rounded corners (favicon / any)
 *   icon-192.png             192x192, rounded corners
 *   icon-512.png             512x512, rounded corners
 *   icon-maskable-512.png    512x512, full bleed, artwork inside the 80% safe zone
 *   apple-touch-icon.png     180x180, full bleed (iOS applies its own mask)
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'icons');

/* ------------------------------------------------------------------ colours */

const PINK = [0xff, 0x6b, 0x9d];
const PURPLE = [0xc4, 0x4d, 0xff];
const ORANGE = [0xff, 0x8c, 0x42];
const WHITE = [0xff, 0xff, 0xff];
const INK = [0x3b, 0x2a, 0x46];
const INNER_EAR = [0xff, 0xc2, 0xd6];

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function gradientAt(t) {
  return t < 0.5
    ? mix(PINK, PURPLE, t / 0.5)
    : mix(PURPLE, ORANGE, (t - 0.5) / 0.5);
}

/* ------------------------------------------------------------------- shapes */

// All coordinates are normalised to the 0..1 square.
const HEAD = { x: 0.5, y: 0.575, r: 0.252 };
const EYE_L = { x: 0.41, y: 0.552, r: 0.031 };
const EYE_R = { x: 0.59, y: 0.552, r: 0.031 };

const EAR_L = [
  [0.255, 0.475],
  [0.305, 0.205],
  [0.47, 0.35],
];
const EAR_R = [
  [0.745, 0.475],
  [0.695, 0.205],
  [0.53, 0.35],
];
const INNER_L = [
  [0.31, 0.415],
  [0.338, 0.27],
  [0.432, 0.35],
];
const INNER_R = [
  [0.69, 0.415],
  [0.662, 0.27],
  [0.568, 0.35],
];
const NOSE = [
  [0.472, 0.633],
  [0.528, 0.633],
  [0.5, 0.668],
];

const CORNER_RADIUS = 0.21;

const inCircle = (x, y, c) => {
  const dx = x - c.x;
  const dy = y - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
};

function inTriangle(px, py, [a, b, c]) {
  const edge = (p, q) =>
    (px - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (py - q[1]);
  const d1 = edge(a, b);
  const d2 = edge(b, c);
  const d3 = edge(c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Colour of the artwork at a normalised point, or null when transparent. */
function sample(x, y, { rounded, catScale }) {
  if (rounded && !inRoundedSquare(x, y, CORNER_RADIUS)) return null;

  // Shrink the cat around the centre for the maskable variant.
  const cx = (x - 0.5) / catScale + 0.5;
  const cy = (y - 0.5) / catScale + 0.5;

  if (inTriangle(cx, cy, NOSE)) return PINK;
  if (inCircle(cx, cy, EYE_L) || inCircle(cx, cy, EYE_R)) return INK;
  if (inCircle(cx, cy, HEAD)) return WHITE;
  if (inTriangle(cx, cy, INNER_L) || inTriangle(cx, cy, INNER_R)) {
    return INNER_EAR;
  }
  if (inTriangle(cx, cy, EAR_L) || inTriangle(cx, cy, EAR_R)) return WHITE;

  const t = Math.min(1, Math.max(0, (x + y) / 2));
  return gradientAt(t);
}

/* ---------------------------------------------------------------- PNG output */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Renders at `size` with 6x6 supersampling for smooth edges. */
function renderPng(size, options) {
  const samples = 6;
  const total = samples * samples;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let hits = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          const color = sample(x, y, options);
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            hits += 1;
          }
        }
      }

      const i = (py * size + px) * 4;
      if (hits > 0) {
        pixels[i] = Math.round(r / hits);
        pixels[i + 1] = Math.round(g / hits);
        pixels[i + 2] = Math.round(b / hits);
      }
      pixels[i + 3] = Math.round((hits / total) * 255);
    }
  }

  return encodePng(size, pixels);
}

/* ---------------------------------------------------------------- SVG output */

const round = (n) => Number(n.toFixed(4));
const points = (shape) =>
  shape.map(([x, y]) => `${round(x * 512)},${round(y * 512)}`).join(' ');
const circle = (c) =>
  `<circle cx="${round(c.x * 512)}" cy="${round(c.y * 512)}" r="${round(
    c.r * 512,
  )}" fill="#fff"/>`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Meow Moments">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FF6B9D"/>
      <stop offset=".5" stop-color="#C44DFF"/>
      <stop offset="1" stop-color="#FF8C42"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${round(CORNER_RADIUS * 512)}" fill="url(#g)"/>
  <polygon points="${points(EAR_L)}" fill="#fff"/>
  <polygon points="${points(EAR_R)}" fill="#fff"/>
  <polygon points="${points(INNER_L)}" fill="#FFC2D6"/>
  <polygon points="${points(INNER_R)}" fill="#FFC2D6"/>
  ${circle(HEAD)}
  ${circle(EYE_L).replace('#fff', '#3B2A46')}
  ${circle(EYE_R).replace('#fff', '#3B2A46')}
  <polygon points="${points(NOSE)}" fill="#FF6B9D"/>
</svg>
`;

/* --------------------------------------------------------------------- main */

const targets = [
  ['icon-192.png', 192, { rounded: true, catScale: 1 }],
  ['icon-512.png', 512, { rounded: true, catScale: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, catScale: 0.86 }],
  ['apple-touch-icon.png', 180, { rounded: false, catScale: 1 }],
];

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, size, options] of targets) {
  writeFileSync(join(OUT_DIR, name), renderPng(size, options));
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}

writeFileSync(join(OUT_DIR, 'icon.svg'), SVG);
console.log('wrote public/icons/icon.svg (512x512)');
