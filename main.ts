const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const W = 1024;
const H = 1024;
const pixels = Buffer.alloc(W * H * 4);
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

function blend(x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H || alpha <= 0) return;
  const i = (y * W + x) * 4;
  const a = Math.min(1, alpha);
  pixels[i] = clamp(pixels[i] * (1 - a) + color[0] * a);
  pixels[i + 1] = clamp(pixels[i + 1] * (1 - a) + color[1] * a);
  pixels[i + 2] = clamp(pixels[i + 2] * (1 - a) + color[2] * a);
  pixels[i + 3] = 255;
}

function polygon(points, color, alpha = 1) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0]))));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(...points.map((p) => p[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) blend(x, y, color, alpha);
    }
  }
}

function disc(cx, cy, radius, color, alpha = 1) {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, Math.ceil(cx + radius)); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= radius) blend(x, y, color, alpha * Math.min(1, radius - d + 0.7));
    }
  }
}

function line(x0, y0, x1, y1, color, width = 2, alpha = 1) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(length * 1.35));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color, alpha);
  }
}

function ellipse(cx, cy, rx, ry, color, width = 2, alpha = 1, start = 0, end = Math.PI * 2) {
  const steps = Math.ceil(Math.max(rx, ry) * (end - start) / 7);
  let px = cx + Math.cos(start) * rx;
  let py = cy + Math.sin(start) * ry;
  for (let i = 1; i <= steps; i++) {
    const a = start + (end - start) * i / steps;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    line(px, py, x, y, color, width, alpha);
    px = x;
    py = y;
  }
}

function feather(root, tip, bend, width, color, alpha = 1) {
  const mid = [(root[0] + tip[0]) / 2 + bend[0], (root[1] + tip[1]) / 2 + bend[1]];
  const side = [-(tip[1] - root[1]), tip[0] - root[0]];
  const mag = Math.hypot(side[0], side[1]) || 1;
  const ox = side[0] / mag * width;
  const oy = side[1] / mag * width;
  polygon([root, [mid[0] + ox, mid[1] + oy], tip, [mid[0] - ox, mid[1] - oy]], color, alpha);
  line(root[0], root[1], tip[0], tip[1], [255, 244, 207], 1.4, alpha * 0.4);
}

function makeBackground() {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - 512) / 620;
      const dy = (y - 438) / 590;
      const core = Math.exp(-(dx * dx + dy * dy) * 2.8);
      const left = Math.exp(-(((x - 250) / 300) ** 2 + ((y - 420) / 380) ** 2) * 1.7);
      const right = Math.exp(-(((x - 800) / 320) ** 2 + ((y - 440) / 380) ** 2) * 1.7);
      const horizon = Math.exp(-(((y - 800) / 145) ** 2)) * 0.45;
      const grain = ((x * 73 + y * 151 + x * y * 19) % 23) / 23;
      const i = (y * W + x) * 4;
      pixels[i] = clamp(4 + core * 22 + left * 5 + right * 24 + horizon * 13 + grain * 2);
      pixels[i + 1] = clamp(8 + core * 22 + left * 29 + right * 11 + horizon * 12 + grain * 2);
      pixels[i + 2] = clamp(20 + core * 34 + left * 39 + right * 20 + horizon * 21 + grain * 4);
      pixels[i + 3] = 255;
    }
  }
}

makeBackground();

// A turbulent crown of light funnels the eye into the split sun.
for (let i = 0; i < 34; i++) {
  const a = -Math.PI + i * Math.PI * 2 / 34;
  const inner = 142 + (i % 4) * 8;
  const outer = 320 + ((i * 37) % 190);
  const spread = 0.018 + (i % 3) * 0.009;
  const p = [512 + Math.cos(a) * inner, 438 + Math.sin(a) * inner];
  polygon([
    p,
    [512 + Math.cos(a - spread) * outer, 438 + Math.sin(a - spread) * outer],
    [512 + Math.cos(a + spread) * outer, 438 + Math.sin(a + spread) * outer],
  ], i % 2 ? [36, 189, 220] : [255, 105, 52], 0.11 + (i % 3) * 0.025);
}

// Orbital arcs mark a portal that is visibly coming apart.
ellipse(512, 438, 290, 172, [44, 210, 225], 3, 0.72, Math.PI * 1.08, Math.PI * 1.92);
ellipse(512, 438, 324, 205, [255, 128, 61], 2.5, 0.62, -0.12, Math.PI * 0.82);
ellipse(512, 438, 249, 137, [255, 218, 157], 1.5, 0.38, Math.PI * 0.08, Math.PI * 0.92);

// The broken halo's flying plates.
const shards = [
  [[220, 202], [256, 248], [227, 285], [190, 258]],
  [[797, 186], [832, 220], [795, 274], [771, 236]],
  [[137, 438], [186, 420], [201, 451], [164, 477]],
  [[883, 409], [933, 434], [900, 468], [865, 452]],
  [[292, 683], [325, 652], [362, 688], [334, 724]],
  [[745, 689], [773, 648], [809, 666], [795, 713]],
  [[380, 144], [404, 176], [388, 211], [361, 182]],
  [[639, 127], [674, 154], [661, 192], [631, 172]],
];
for (let i = 0; i < shards.length; i++) {
  polygon(shards[i], i % 2 ? [21, 147, 177] : [228, 83, 50], 0.78);
  line(...shards[i][0], ...shards[i][2], [255, 229, 168], 1.4, 0.6);
}

// The central star is layered like a cut gemstone, gold on one side and cyan on the other.
disc(512, 438, 138, [8, 21, 40], 0.9);
disc(512, 438, 128, [238, 109, 42], 0.94);
disc(506, 434, 106, [255, 185, 82], 0.96);
disc(500, 428, 76, [255, 237, 185], 0.98);
disc(495, 423, 42, [255, 255, 236], 1);
ellipse(512, 438, 136, 136, [255, 234, 177], 3, 0.9, -Math.PI * 0.5, Math.PI * 0.52);
ellipse(512, 438, 136, 136, [63, 235, 242], 3, 0.94, Math.PI * 0.52, Math.PI * 1.5);

// Eight long pinions unfold from a dark silhouette into translucent colored blades.
const leftTips = [[414, 329], [348, 275], [267, 229], [190, 214], [132, 263], [103, 342], [145, 422], [233, 480]];
const leftRoots = [[484, 405], [467, 421], [453, 441], [444, 463], [443, 486], [451, 510], [466, 531], [482, 548]];
const feathers = [];
for (let i = 0; i < leftTips.length; i++) {
  const tip = leftTips[i];
  const root = leftRoots[i];
  const bend = [-(i - 3.5) * 2.1, (i < 4 ? 13 : -8)];
  feathers.push({ root, tip, bend, width: 18 + (i % 3) * 4, color: [12 + i * 2, 95 + i * 8, 135 + i * 9] });
  const mirror = (p) => [1024 - p[0], p[1] + (i % 2 ? -8 : 6)];
  feathers.push({ root: mirror(root), tip: mirror(tip), bend: [-bend[0], bend[1]], width: 18 + (i % 3) * 4, color: [238 - i * 2, 75 + i * 6, 45 + i * 3] });
}
for (const f of feathers) feather(f.root, f.tip, f.bend, f.width, f.color, 0.9);

// Fine feather ribs and the bird's bright, arrow-shaped body.
for (const f of feathers) {
  const mid = [(f.root[0] + f.tip[0]) * 0.52 + f.bend[0] * 0.48, (f.root[1] + f.tip[1]) * 0.52 + f.bend[1] * 0.48];
  line(f.root[0], f.root[1], mid[0], mid[1], [255, 236, 177], 1.2, 0.52);
}
polygon([[512, 345], [546, 363], [535, 427], [556, 488], [527, 471], [512, 594], [497, 471], [468, 488], [490, 427], [478, 379]], [255, 246, 211], 0.98);
polygon([[512, 361], [529, 398], [512, 437], [495, 398]], [255, 255, 249], 1);
// A sharp profile and swept crest turn the rising flare into a recognizable phoenix.
disc(527, 333, 29, [255, 248, 218], 1);
polygon([[539, 326], [589, 338], [544, 349]], [255, 156, 44], 1);
disc(536, 329, 3.3, [8, 28, 46], 1);
disc(537, 328, 1.1, [100, 245, 244], 1);
polygon([[510, 316], [471, 265], [520, 296]], [255, 231, 169], 0.97);
polygon([[516, 312], [501, 250], [533, 295]], [255, 202, 106], 0.97);
polygon([[522, 311], [538, 257], [544, 305]], [255, 244, 210], 0.97);

// Sparks and streaks give the escape its direction and scale.
for (let i = 0; i < 46; i++) {
  const seed = i * 7919 + 41;
  const x = 80 + (seed * 47) % 864;
  const y = 90 + (seed * 83) % 720;
  const dx = x - 512;
  const dy = y - 438;
  if (Math.hypot(dx, dy) < 175) continue;
  const color = i % 2 ? [66, 224, 241] : [255, 197, 106];
  disc(x, y, i % 7 === 0 ? 3 : 1.7, color, 0.82);
  if (i % 6 === 0) line(x - dx * 0.045, y - dy * 0.045, x + dx * 0.09, y + dy * 0.09, color, 1.2, 0.5);
}

// A quiet dark horizon makes the luminous subject read at thumbnail size.
for (let x = 0; x < W; x += 2) {
  const y = 817 + Math.sin(x * 0.012) * 13 + Math.sin(x * 0.031) * 6;
  line(x, y, x + 1, y + 20, [11, 25, 43], 1.2, 0.84);
}
ellipse(512, 820, 490, 90, [73, 167, 186], 1.5, 0.2, Math.PI * 1.05, Math.PI * 1.95);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return out;
}

const scanlines = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  const row = y * (W * 4 + 1);
  scanlines[row] = 0;
  pixels.copy(scanlines, row + 1, y * W * 4, (y + 1) * W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'entry.png'), png);
