// Tarz kapaklarını ve uygulama ikonlarını üretir.
// Çalıştır:  npm run covers
// Çıktı:     server/public/covers/<stil-id>.webp  (600x800, dizi afişi oranı)
//            app/assets/icon.png, adaptive-icon.png, splash-icon.png
//
// Her kapak aynı görsel dili paylaşır: koyu sinema zemini, ortada "başrol" silueti,
// film greni + vinyet. Yazılar görsele gömülmez; uygulama üstüne kendi yazar.

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(ROOT, "..", "public", "covers");
const APP_ASSETS = path.join(ROOT, "..", "..", "app", "assets");
const W = 600;
const H = 800;
const GOLD = "#E8B44C";

const f = (n) => Math.round(n * 10) / 10;

// Tohumlu rastgele sayı: her çalıştırmada aynı görsel çıksın.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------------ Ortak parçalar

function defs(extra = "") {
  return `
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <filter id="blur4"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="blur12"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="blur30"><feGaussianBlur stdDeviation="30"/></filter>
    <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.75"/>
    </radialGradient>
    ${extra}
  </defs>`;
}

function finish(grain = 0.09) {
  return `
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="${grain}"/>`;
}

function svg(body, extraDefs = "", grain) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(extraDefs)}
  ${body}
  ${finish(grain)}
</svg>`;
}

function linear(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
    ${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}
  </linearGradient>`;
}

function radial(id, stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">
    ${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}
  </radialGradient>`;
}

// "Başrol" silueti: ayakları (x, y) noktasında, boyu h.
function person({ x, y, h, fill = "#0b0706", rim, flare = 0, crown, armUp, longHair, opacity = 1 }) {
  const p = (dx, dy) => `${f(x + dx * h)},${f(y + dy * h)}`;
  // Boyun → belirgin omuz → bele doğru daralma → (elbise/palto için) etekte açılma.
  const body = `M ${p(-0.032, -0.84)} L ${p(-0.036, -0.8)}
    C ${p(-0.1, -0.795)} ${p(-0.185, -0.785)} ${p(-0.2, -0.71)}
    L ${p(-0.165, -0.47)} L ${p(-0.12, -0.42)} L ${p(-0.13 - flare, 0)}
    L ${p(0.13 + flare, 0)} L ${p(0.12, -0.42)} L ${p(0.165, -0.47)} L ${p(0.2, -0.71)}
    C ${p(0.185, -0.785)} ${p(0.1, -0.795)} ${p(0.036, -0.8)} L ${p(0.032, -0.84)} Z`;
  const headR = f(h * 0.068);
  const head = `<circle cx="${f(x)}" cy="${f(y - h * 0.905)}" r="${headR}"/>`;
  const hair = longHair
    ? `<path d="M ${p(-0.075, -0.95)} Q ${p(-0.12, -0.8)} ${p(-0.1, -0.66)} L ${p(-0.03, -0.7)} L ${p(0.03, -0.7)} L ${p(0.1, -0.66)} Q ${p(0.12, -0.8)} ${p(0.075, -0.95)} Z"/>`
    : "";
  const arm = armUp
    ? `<path d="M ${p(0.17, -0.73)} L ${p(0.26, -0.9)} L ${p(0.235, -1.06)}" fill="none" stroke="${fill}" stroke-width="${f(h * 0.045)}" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="${f(x + 0.235 * h)}" cy="${f(y - 1.075 * h)}" r="${f(h * 0.03)}"/>`
    : "";
  const crownPath = crown
    ? `<path d="M ${p(-0.07, -0.97)} L ${p(-0.07, -1.05)} L ${p(-0.035, -1.0)} L ${p(0, -1.08)} L ${p(0.035, -1.0)} L ${p(0.07, -1.05)} L ${p(0.07, -0.97)} Z" fill="${crown}"/>`
    : "";
  const rimLayer = rim
    ? `<g fill="none" stroke="${rim}" stroke-width="3" opacity="0.7" filter="url(#blur4)">
         <path d="${body}"/><circle cx="${f(x)}" cy="${f(y - h * 0.905)}" r="${headR}"/></g>`
    : "";
  return `<g opacity="${opacity}">${rimLayer}<g fill="${fill}">${hair}${arm}<path d="${body}"/>${head}</g>${crownPath}</g>`;
}

function particles(r, n, { x0 = 0, x1 = W, y0 = 0, y1 = H, size = [1, 3], colors = ["#fff"], opacity = [0.3, 0.9], blur }) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const c = colors[Math.floor(r() * colors.length)];
    out += `<circle cx="${f(x0 + r() * (x1 - x0))}" cy="${f(y0 + r() * (y1 - y0))}" r="${f(size[0] + r() * (size[1] - size[0]))}" fill="${c}" opacity="${f(opacity[0] + r() * (opacity[1] - opacity[0]))}"/>`;
  }
  return blur ? `<g filter="url(#${blur})">${out}</g>` : out;
}

function confetti(r, n, colors) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H * 0.85;
    out += `<rect x="${f(x)}" y="${f(y)}" width="${f(4 + r() * 6)}" height="${f(8 + r() * 10)}" rx="1" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${f(0.6 + r() * 0.4)}" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`;
  }
  return out;
}

function sparkle(x, y, s, color = "#fff", opacity = 1) {
  return `<path d="M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z" fill="${color}" opacity="${opacity}"/>`;
}

function leaf(x, y, s, rot, color) {
  return `<path d="M 0 ${-s} C ${s * 0.7} ${-s * 0.6} ${s * 0.7} ${s * 0.5} 0 ${s} C ${-s * 0.7} ${s * 0.5} ${-s * 0.7} ${-s * 0.6} 0 ${-s} Z M 0 ${-s} L 0 ${s}" fill="${color}" stroke="#00000033" stroke-width="1" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"/>`;
}

function blossom(x, y, s, color = "#ffd1e3") {
  let petals = "";
  for (let i = 0; i < 5; i++) {
    petals += `<ellipse cx="0" cy="${-s * 0.55}" rx="${s * 0.38}" ry="${s * 0.55}" transform="rotate(${i * 72})"/>`;
  }
  return `<g transform="translate(${f(x)} ${f(y)})" fill="${color}">${petals}<circle r="${s * 0.22}" fill="#ff7aa8"/></g>`;
}

// ------------------------------------------------------------------ Sahneler

const scenes = {
  palace() {
    const r = rng(11);
    // Çini deseni: sekiz köşeli yıldızlar
    let tiles = "";
    for (let yy = 30; yy < H; yy += 70) {
      for (let xx = (yy / 70) % 2 ? 35 : 0; xx < W + 40; xx += 70) {
        tiles += `<g transform="translate(${xx} ${yy})" fill="none" stroke="${GOLD}" stroke-width="1.2" opacity="0.18">
          <rect x="-14" y="-14" width="28" height="28"/><rect x="-14" y="-14" width="28" height="28" transform="rotate(45)"/></g>`;
      }
    }
    let lamps = "";
    for (const [lx, ly] of [[110, 210], [300, 150], [490, 210]]) {
      lamps += `<line x1="${lx}" y1="0" x2="${lx}" y2="${ly - 30}" stroke="${GOLD}" stroke-width="2" opacity="0.6"/>
        <circle cx="${lx}" cy="${ly}" r="42" fill="#ffb347" opacity="0.35" filter="url(#blur12)"/>
        <path d="M ${lx - 16} ${ly - 30} L ${lx + 16} ${ly - 30} L ${lx + 22} ${ly} L ${lx} ${ly + 28} L ${lx - 22} ${ly} Z" fill="${GOLD}" opacity="0.9"/>
        <path d="M ${lx - 10} ${ly - 22} L ${lx + 10} ${ly - 22} L ${lx + 13} ${ly} L ${lx} ${ly + 16} L ${lx - 13} ${ly} Z" fill="#fff3c4"/>`;
    }
    let petals = "";
    for (let i = 0; i < 26; i++) {
      petals += `<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="${f(4 + r() * 4)}" ry="${f(2 + r() * 3)}" fill="#e0475b" opacity="${f(0.5 + r() * 0.5)}" transform="rotate(${f(r() * 180)})"/>`;
    }
    const arch = `M 130 800 L 130 420 Q 130 300 300 230 Q 470 300 470 420 L 470 800`;
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${tiles}
       <path d="${arch} Z" fill="#1a0303" opacity="0.55"/>
       <circle cx="300" cy="470" r="200" fill="url(#glow)"/>
       <path d="${arch}" fill="none" stroke="${GOLD}" stroke-width="10"/>
       <path d="${arch}" fill="none" stroke="#fff1c1" stroke-width="2" transform="translate(0 -14) scale(1 1)" opacity="0.6"/>
       ${lamps}
       ${person({ x: 300, y: 760, h: 430, rim: GOLD, flare: 0.08, crown: GOLD })}
       ${petals}`,
      linear("bg", [[0, "#2a0505"], [0.5, "#7a1f12"], [1, "#2a0505"]]) +
        radial("glow", [[0, "#ffcf70", 0.85], [0.6, "#ff8c2a", 0.25], [1, "#ff8c2a", 0]]),
    );
  },

  revenge() {
    const r = rng(23);
    let rain = "";
    for (let i = 0; i < 140; i++) {
      const x = r() * W;
      const y = r() * H;
      rain += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x - 8)}" y2="${f(y + 28)}" stroke="#9ec9ff" stroke-width="1" opacity="${f(0.15 + r() * 0.35)}"/>`;
    }
    // Boğaz köprüsü
    const deckY = 520;
    const bridge = `
      <rect x="150" y="380" width="10" height="160" fill="#0a1424"/><rect x="450" y="380" width="10" height="160" fill="#0a1424"/>
      <path d="M -20 ${deckY - 70} Q 70 ${deckY - 10} 155 385 Q 305 ${deckY + 20} 455 385 Q 540 ${deckY - 10} 620 ${deckY - 70}" fill="none" stroke="#0a1424" stroke-width="3"/>
      <rect x="0" y="${deckY}" width="${W}" height="8" fill="#0a1424"/>
      ${Array.from({ length: 30 }, (_, i) => `<circle cx="${10 + i * 20}" cy="${deckY + 3}" r="2" fill="#ffd27a" opacity="0.9"/>`).join("")}`;
    const skyline = `<path d="M 0 ${deckY} L 0 470 L 30 470 L 30 455 Q 55 420 80 455 L 80 470 L 95 470 L 97 400 L 100 395 L 103 400 L 105 470 L 130 470 L 130 ${deckY} Z" fill="#081220"/>`;
    let reflections = "";
    for (let i = 0; i < 40; i++) {
      reflections += `<rect x="${f(r() * W)}" y="${f(deckY + 20 + r() * 260)}" width="${f(10 + r() * 40)}" height="2" fill="#ffd27a" opacity="${f(0.1 + r() * 0.4)}"/>`;
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <circle cx="470" cy="140" r="90" fill="#cfe3ff" opacity="0.25" filter="url(#blur30)"/>
       <circle cx="470" cy="140" r="46" fill="#e8f1ff"/>
       ${skyline}${bridge}
       <rect y="${deckY + 8}" width="${W}" height="${H - deckY}" fill="url(#water)"/>
       ${reflections}
       ${person({ x: 380, y: 800, h: 520, fill: "#03070f", rim: "#7fb2ff" })}
       ${rain}`,
      linear("bg", [[0, "#02050d"], [0.6, "#0f2238"], [1, "#0f2238"]]) +
        linear("water", [[0, "#0d1d30"], [1, "#02050d"]]),
      0.12,
    );
  },

  mansion() {
    const r = rng(37);
    let leaves = "";
    for (let i = 0; i < 30; i++) {
      leaves += leaf(r() * W, r() * H, 8 + r() * 10, r() * 360, ["#e2622b", "#c9381e", "#f2a33a", "#8f2a12"][i % 4]);
    }
    const win = `
      <rect x="150" y="120" width="300" height="520" rx="8" fill="url(#outside)"/>
      <g stroke="#2b1607" stroke-width="12" fill="none">
        <rect x="150" y="120" width="300" height="520" rx="8"/>
        <line x1="300" y1="120" x2="300" y2="640"/><line x1="150" y1="300" x2="450" y2="300"/><line x1="150" y1="470" x2="450" y2="470"/>
      </g>`;
    const curtains = `
      <path d="M 120 100 Q 170 380 130 680 L 60 680 L 60 100 Z" fill="#f5e6c8" opacity="0.35"/>
      <path d="M 480 100 Q 430 380 470 680 L 540 680 L 540 100 Z" fill="#f5e6c8" opacity="0.35"/>`;
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <circle cx="300" cy="360" r="260" fill="#ffb54d" opacity="0.35" filter="url(#blur30)"/>
       ${win}${curtains}
       <rect y="680" width="${W}" height="120" fill="#1a0c03"/>
       ${person({ x: 300, y: 780, h: 470, fill: "#140902", rim: "#ffc36b", flare: 0.06, longHair: true })}
       ${leaves}`,
      linear("bg", [[0, "#2b1607"], [1, "#5c300c"]]) +
        linear("outside", [[0, "#ffd88a"], [0.6, "#f29a3c"], [1, "#b8541a"]]),
    );
  },

  underworld() {
    const walls = `
      <path d="M 0 0 L 230 330 L 230 560 L 0 800 Z" fill="#14110f"/>
      <path d="M 600 0 L 370 330 L 370 560 L 600 800 Z" fill="#100e0c"/>
      <path d="M 0 800 L 230 560 L 370 560 L 600 800 Z" fill="#1d1916"/>`;
    let windows = "";
    for (let i = 0; i < 6; i++) {
      windows += `<rect x="${40 + i * 25}" y="${120 + i * 40}" width="18" height="30" fill="#ffcf7a" opacity="${0.15 + (i % 3) * 0.15}" transform="skewY(${35 - i * 2})"/>`;
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="#0a0a0a"/>
       <circle cx="300" cy="440" r="170" fill="#ffd9a0" opacity="0.55" filter="url(#blur30)"/>
       ${walls}${windows}
       <ellipse cx="300" cy="600" rx="320" ry="60" fill="#ffffff" opacity="0.08" filter="url(#blur30)"/>
       <ellipse cx="300" cy="700" rx="360" ry="80" fill="#ffffff" opacity="0.06" filter="url(#blur30)"/>
       ${person({ x: 190, y: 700, h: 300, fill: "#050403", rim: "#ffd59a" })}
       ${person({ x: 410, y: 700, h: 300, fill: "#050403", rim: "#ffd59a" })}
       ${person({ x: 300, y: 790, h: 470, fill: "#030202", rim: "#ffe2b5" })}`,
      "",
      0.13,
    );
  },

  blacksea() {
    const r = rng(53);
    const mountain = (y, amp, color, seed) => {
      const rr = rng(seed);
      let d = `M 0 ${H} L 0 ${y}`;
      for (let x = 0; x <= W; x += 40) d += ` L ${x} ${f(y - rr() * amp)}`;
      return `<path d="${d} L ${W} ${H} Z" fill="${color}"/>`;
    };
    let houses = "";
    for (let i = 0; i < 9; i++) {
      const x = 60 + r() * 480;
      const y = 470 + r() * 40;
      houses += `<rect x="${f(x)}" y="${f(y)}" width="18" height="14" fill="#f4efe6" opacity="0.85"/><path d="M ${f(x - 3)} ${f(y)} L ${f(x + 9)} ${f(y - 9)} L ${f(x + 21)} ${f(y)} Z" fill="#a33b2a"/>`;
    }
    let waves = "";
    for (let i = 0; i < 9; i++) {
      const y = 580 + i * 26;
      waves += `<path d="M -20 ${y} Q 40 ${y - 14} 100 ${y} T 220 ${y} T 340 ${y} T 460 ${y} T 580 ${y} T 700 ${y}" fill="none" stroke="#e6fffa" stroke-width="${2 + i * 0.3}" opacity="${0.15 + i * 0.05}"/>`;
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       ${mountain(330, 120, "#3c6b5e", 1)}${mountain(420, 110, "#24493f", 2)}
       <rect y="380" width="${W}" height="60" fill="#dfeee8" opacity="0.25" filter="url(#blur12)"/>
       ${mountain(510, 70, "#163a30", 3)}${houses}
       <rect y="560" width="${W}" height="240" fill="url(#sea)"/>${waves}
       <path d="M 170 800 Q 200 700 300 690 Q 400 700 440 800 Z" fill="#0b1513"/>
       ${person({ x: 300, y: 700, h: 340, fill: "#08110f", rim: "#cfeee4", longHair: true })}`,
      linear("bg", [[0, "#5f7f78"], [0.5, "#8fb1a8"], [1, "#4f7a72"]]) +
        linear("sea", [[0, "#0f4a48"], [1, "#05201f"]]),
    );
  },

  dramatic_zoom() {
    let rays = "";
    for (let i = 0; i < 36; i++) {
      const a1 = (i / 36) * Math.PI * 2;
      const a2 = a1 + Math.PI / 36;
      rays += `<path d="M 300 380 L ${f(300 + Math.cos(a1) * 900)} ${f(380 + Math.sin(a1) * 900)} L ${f(300 + Math.cos(a2) * 900)} ${f(380 + Math.sin(a2) * 900)} Z" fill="#000" opacity="${i % 2 ? 0.35 : 0}"/>`;
    }
    let rings = "";
    for (let i = 1; i <= 6; i++) {
      rings += `<circle cx="300" cy="380" r="${i * 70}" fill="none" stroke="#fff" stroke-width="${7 - i}" opacity="${0.35 - i * 0.04}"/>`;
    }
    const bolt = `<path d="M 470 40 L 410 230 L 460 230 L 380 420 L 520 190 L 465 190 L 520 40 Z" fill="#fff6a8"/>`;
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${rays}${rings}
       <g filter="url(#blur12)" opacity="0.8">${bolt}</g>${bolt}
       ${person({ x: 300, y: 860, h: 640, fill: "#140000", rim: "#ff8a8a" })}
       <ellipse cx="282" cy="${860 - 640 * 0.905}" rx="11" ry="15" fill="#fff"/><ellipse cx="318" cy="${860 - 640 * 0.905}" rx="11" ry="15" fill="#fff"/>
       <circle cx="282" cy="${860 - 640 * 0.905}" r="4" fill="#000"/><circle cx="318" cy="${860 - 640 * 0.905}" r="4" fill="#000"/>`,
      radial("bg", [[0, "#ff4d4d"], [0.5, "#b91c1c"], [1, "#2a0000"]], { cy: 0.47, r: 0.7 }),
    );
  },

  girl_group() {
    const r = rng(71);
    let beams = "";
    for (const [x, c] of [[90, "#ff5fd2"], [220, "#7af0ff"], [380, "#ff5fd2"], [510, "#b48cff"]]) {
      beams += `<path d="M ${x} -10 L ${x - 90} 700 L ${x + 90} 700 Z" fill="${c}" opacity="0.18"/>`;
    }
    let lasers = "";
    for (let i = 0; i < 10; i++) {
      lasers += `<line x1="${f(r() * W)}" y1="0" x2="${f(r() * W)}" y2="620" stroke="${i % 2 ? "#7af0ff" : "#ff5fd2"}" stroke-width="2" opacity="0.6"/>`;
    }
    let floor = "";
    for (let i = 0; i <= 12; i++) {
      floor += `<line x1="${300 + (i - 6) * 20}" y1="600" x2="${300 + (i - 6) * 110}" y2="800" stroke="#ff5fd2" stroke-width="1.5" opacity="0.4"/>`;
    }
    for (let i = 0; i < 5; i++) floor += `<line x1="0" y1="${620 + i * i * 9}" x2="${W}" y2="${620 + i * i * 9}" stroke="#ff5fd2" stroke-width="1.5" opacity="0.35"/>`;
    const members = [
      { x: 90, y: 680, h: 300 }, { x: 510, y: 680, h: 300 }, { x: 180, y: 720, h: 360 }, { x: 420, y: 720, h: 360 },
    ]
      .map((m) => person({ ...m, fill: "#14031f", rim: "#ff9be6", flare: 0.06, longHair: true }))
      .join("");
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${beams}${lasers}
       <rect y="600" width="${W}" height="200" fill="#0b0014"/>${floor}
       <ellipse cx="300" cy="700" rx="200" ry="40" fill="#ff5fd2" opacity="0.4" filter="url(#blur12)"/>
       ${members}
       ${person({ x: 300, y: 780, h: 460, fill: "#0e0118", rim: "#ffffff", flare: 0.07, longHair: true, armUp: true })}
       ${confetti(r, 90, ["#ff5fd2", "#7af0ff", GOLD, "#ffffff", "#b48cff"])}`,
      linear("bg", [[0, "#12002a"], [1, "#3d0a4f"]]),
    );
  },

  music_video() {
    const r = rng(83);
    let sparkles = "";
    for (let i = 0; i < 16; i++) sparkles += sparkle(f(r() * W), f(r() * H * 0.8), f(6 + r() * 14), "#ffffff", f(0.6 + r() * 0.4));
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <circle cx="300" cy="360" r="210" fill="none" stroke="#ff4fd8" stroke-width="16" opacity="0.5" filter="url(#blur12)"/>
       <circle cx="300" cy="360" r="210" fill="none" stroke="#ffd6f6" stroke-width="5"/>
       <path d="M 80 190 L 160 60 L 240 190 Z" fill="none" stroke="#5ff4ff" stroke-width="5"/>
       <rect x="430" y="520" width="110" height="110" rx="20" fill="none" stroke="#fff27a" stroke-width="5" transform="rotate(18 485 575)"/>
       <ellipse cx="300" cy="420" rx="260" ry="170" fill="url(#holo)" opacity="0.55" filter="url(#blur30)"/>
       ${person({ x: 300, y: 800, h: 560, fill: "#2b0f4d", rim: "#ffffff", longHair: true })}
       ${sparkles}`,
      linear("bg", [[0, "#ffb3d9"], [0.5, "#b8a9ff"], [1, "#6fd3f5"]], { x2: 1, y2: 1 }) +
        linear("holo", [[0, "#ff7ad9"], [0.5, "#7afcff"], [1, "#fff57a"]], { x2: 1, y2: 0 }),
      0.06,
    );
  },

  dance_trend() {
    const r = rng(97);
    let hearts = "";
    for (let i = 0; i < 9; i++) {
      const x = 40 + r() * 520;
      const y = 80 + r() * 600;
      const s = 0.8 + r() * 1.2;
      hearts += `<path d="M 0 6 C -12 -6 -24 6 0 22 C 24 6 12 -6 0 6 Z" fill="#fff" opacity="${f(0.5 + r() * 0.5)}" transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"/>`;
    }
    let motion = "";
    for (let i = 0; i < 4; i++) motion += `<path d="M ${110 + i * 12} ${300 + i * 30} Q 60 ${420 + i * 20} ${130 + i * 10} ${540 + i * 20}" fill="none" stroke="#fff" stroke-width="4" opacity="${0.5 - i * 0.1}" stroke-linecap="round"/>`;
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <circle cx="300" cy="340" r="230" fill="none" stroke="#fff" stroke-width="30" opacity="0.35" filter="url(#blur12)"/>
       <circle cx="300" cy="340" r="230" fill="none" stroke="#fffaf0" stroke-width="12"/>
       <rect x="150" y="60" width="300" height="690" rx="44" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.6"/>
       ${motion}
       ${person({ x: 300, y: 790, h: 520, fill: "#3b0a1c", rim: "#fff", armUp: true, longHair: true, flare: 0.04 })}
       ${hearts}`,
      linear("bg", [[0, "#ff9a3c"], [0.5, "#ff5a5f"], [1, "#ff2d87"]], { x2: 1, y2: 1 }),
    );
  },

  halay() {
    let lights = "";
    for (const [y0, sag] of [[90, 70], [170, 60]]) {
      lights += `<path d="M -10 ${y0} Q 300 ${y0 + sag * 2} 610 ${y0}" fill="none" stroke="#2c1838" stroke-width="2"/>`;
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = -10 + t * 620;
        const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
        lights += `<circle cx="${f(x)}" cy="${f(y + 6)}" r="14" fill="#ffcf6b" opacity="0.35" filter="url(#blur4)"/><circle cx="${f(x)}" cy="${f(y + 6)}" r="5" fill="#fff1c4"/>`;
      }
    }
    const xs = [110, 210, 300, 390, 490];
    let line = "";
    xs.forEach((x, i) => {
      const lead = i === 2;
      line += person({ x, y: lead ? 790 : 760, h: lead ? 420 : 340, fill: "#160a1f", rim: lead ? GOLD : "#ff9fe0", flare: 0.05, armUp: i === 0 });
    });
    const hands = `<path d="M 130 520 L 190 515 M 230 515 L 275 505 M 325 505 L 370 515 M 410 515 L 470 520" stroke="#160a1f" stroke-width="18" stroke-linecap="round"/>`;
    const mendil = `<path d="M ${110 + 0.27 * 340} ${760 - 1.1 * 340} l 30 -18 l 8 34 z" fill="#e8243c"/>`;
    const davul = `<g transform="translate(520 690)"><ellipse rx="56" ry="20" fill="#d9a86b"/><rect x="-56" y="0" width="112" height="70" fill="#8a2d1b"/><ellipse cy="70" rx="56" ry="20" fill="#5d1d10"/><ellipse rx="56" ry="20" fill="none" stroke="${GOLD}" stroke-width="3"/></g>`;
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>${lights}
       <ellipse cx="300" cy="760" rx="320" ry="60" fill="#ff9fe0" opacity="0.25" filter="url(#blur30)"/>
       ${line}${hands}${mendil}${davul}`,
      linear("bg", [[0, "#140726"], [1, "#4a1a4f"]]),
    );
  },

  cinematic() {
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <circle cx="380" cy="300" r="160" fill="#ffb36b" opacity="0.4" filter="url(#blur30)"/>
       <rect x="-50" y="296" width="700" height="8" fill="#9fd8ff" opacity="0.9" filter="url(#blur4)"/>
       <rect x="-50" y="298" width="700" height="3" fill="#ffffff"/>
       <circle cx="380" cy="300" r="20" fill="#fff"/>
       <circle cx="250" cy="300" r="26" fill="none" stroke="#9fd8ff" stroke-width="2" opacity="0.6"/>
       <circle cx="180" cy="300" r="12" fill="#9fd8ff" opacity="0.4"/>
       ${person({ x: 260, y: 800, h: 560, fill: "#061b20", rim: "#ffbe7a" })}
       <rect width="${W}" height="90" fill="#000"/><rect y="${H - 90}" width="${W}" height="90" fill="#000"/>`,
      linear("bg", [[0, "#0b3b47"], [0.55, "#3d6c6b"], [1, "#d97a2b"]], { x2: 1, y2: 1 }),
    );
  },

  anime() {
    const r = rng(113);
    let blossoms = "";
    for (let i = 0; i < 22; i++) blossoms += blossom(f(r() * 330), f(r() * 260), f(10 + r() * 10));
    let petals = "";
    for (let i = 0; i < 40; i++) {
      petals += `<ellipse cx="${f(r() * W)}" cy="${f(r() * H)}" rx="6" ry="3.5" fill="#ffd1e3" opacity="${f(0.5 + r() * 0.5)}" transform="rotate(${f(r() * 180)} ${f(r() * W)} ${f(r() * H)})"/>`;
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <circle cx="380" cy="430" r="190" fill="#fff4d6" opacity="0.95"/>
       <circle cx="380" cy="430" r="240" fill="#fff0c7" opacity="0.4" filter="url(#blur30)"/>
       <path d="M 0 40 Q 160 90 320 60 M 120 70 Q 200 160 260 230 M 40 50 Q 60 160 140 200" stroke="#5a2c3d" stroke-width="9" fill="none" stroke-linecap="round"/>
       ${blossoms}
       <path d="M 0 640 Q 300 560 600 640 L 600 800 L 0 800 Z" fill="#4b2a6b"/>
       ${person({ x: 330, y: 800, h: 500, fill: "#2a1440", rim: "#ffd1e3", longHair: true })}
       ${petals}`,
      linear("bg", [[0, "#ffd1e8"], [0.5, "#ff9ec7"], [1, "#7b5cff"]]),
      0.05,
    );
  },

  vintage() {
    const r = rng(131);
    let holes = "";
    for (let y = 20; y < H; y += 56) {
      holes += `<rect x="12" y="${y}" width="26" height="34" rx="5" fill="#f3e3c3"/><rect x="${W - 38}" y="${y}" width="26" height="34" rx="5" fill="#f3e3c3"/>`;
    }
    let scratches = "";
    for (let i = 0; i < 8; i++) {
      const x = 60 + r() * 480;
      scratches += `<line x1="${f(x)}" y1="0" x2="${f(x + r() * 6)}" y2="${H}" stroke="#fff6e0" stroke-width="${f(0.6 + r())}" opacity="${f(0.15 + r() * 0.3)}"/>`;
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="#120b05"/>
       <rect x="50" y="0" width="500" height="${H}" fill="url(#bg)"/>
       <circle cx="520" cy="80" r="220" fill="#ff5a1f" opacity="0.5" filter="url(#blur30)"/>
       <circle cx="80" cy="760" r="160" fill="#ffb03a" opacity="0.35" filter="url(#blur30)"/>
       ${person({ x: 300, y: 800, h: 560, fill: "#2b1a0c", rim: "#ffe0a8", longHair: true, opacity: 0.92 })}
       ${scratches}${holes}`,
      linear("bg", [[0, "#a87a4a"], [1, "#4a3018"]]),
      0.2,
    );
  },

  dreamy() {
    const r = rng(151);
    const cloud = (x, y, s) =>
      `<g fill="#ffffff" opacity="0.55" filter="url(#blur12)"><circle cx="${x}" cy="${y}" r="${50 * s}"/><circle cx="${x + 55 * s}" cy="${y + 10 * s}" r="${40 * s}"/><circle cx="${x - 55 * s}" cy="${y + 12 * s}" r="${38 * s}"/><ellipse cx="${x}" cy="${y + 35 * s}" rx="${110 * s}" ry="${25 * s}"/></g>`;
    let stars = "";
    for (let i = 0; i < 14; i++) stars += sparkle(f(r() * W), f(r() * 420), f(4 + r() * 9), "#fff7d6", f(0.6 + r() * 0.4));
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       ${stars}
       <path d="M 470 120 a 50 50 0 1 0 40 80 a 40 40 0 1 1 -40 -80 z" fill="#fff7d6"/>
       ${cloud(130, 560, 1.3)}${cloud(470, 620, 1.1)}${cloud(300, 720, 1.6)}
       <circle cx="300" cy="420" r="170" fill="#ffd6f5" opacity="0.5" filter="url(#blur30)"/>
       ${person({ x: 300, y: 650, h: 430, fill: "#3a2470", rim: "#ffffff", longHair: true, flare: 0.08, opacity: 0.95 })}
       ${particles(r, 70, { size: [1.5, 4], colors: ["#fff7d6", "#ffd6f5", "#c7f0ff"], blur: "blur4" })}
       ${particles(r, 40, { size: [1, 2.5], colors: ["#ffffff"] })}`,
      linear("bg", [[0, "#2a1b5e"], [0.55, "#9b7bff"], [1, "#ffd6f5"]]),
      0.05,
    );
  },

  action() {
    const r = rng(173);
    let burst = "M 300 330";
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rad = i % 2 ? 140 : 260 + r() * 60;
      burst += ` L ${f(300 + Math.cos(a) * rad)} ${f(330 + Math.sin(a) * rad * 0.8)}`;
    }
    let debris = "";
    for (let i = 0; i < 30; i++) {
      const x = r() * W;
      const y = r() * 600;
      debris += `<path d="M 0 0 L ${f(8 + r() * 10)} ${f(r() * 6)} L ${f(r() * 6)} ${f(8 + r() * 10)} Z" fill="#1a0800" transform="translate(${f(x)} ${f(y)}) rotate(${f(r() * 360)})"/>`;
    }
    let sparks = "";
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2;
      const d1 = 120 + r() * 120;
      const d2 = d1 + 20 + r() * 40;
      sparks += `<line x1="${f(300 + Math.cos(a) * d1)}" y1="${f(330 + Math.sin(a) * d1)}" x2="${f(300 + Math.cos(a) * d2)}" y2="${f(330 + Math.sin(a) * d2)}" stroke="#ffe08a" stroke-width="2" opacity="0.8"/>`;
    }
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <path d="${burst} Z" fill="#ff8a1f" filter="url(#blur12)"/>
       <circle cx="300" cy="330" r="220" fill="url(#fire)"/>
       ${sparks}${debris}
       <rect y="640" width="${W}" height="160" fill="#140600"/>
       ${person({ x: 300, y: 800, h: 560, fill: "#0d0400", rim: "#ffb04a" })}`,
      linear("bg", [[0, "#1a0800"], [0.6, "#7a2400"], [1, "#2a0c00"]]) +
        radial("fire", [[0, "#fff6c2"], [0.3, "#ffc23a"], [0.7, "#ff5a00", 0.6], [1, "#ff5a00", 0]]),
    );
  },

  alive() {
    const r = rng(191);
    let sparkles = "";
    for (let i = 0; i < 12; i++) sparkles += sparkle(f(r() * W), f(r() * H), f(5 + r() * 12), "#fff7d6", f(0.6 + r() * 0.4));
    return svg(
      `<rect width="${W}" height="${H}" fill="url(#bg)"/>
       <g transform="rotate(-6 300 400)">
         <rect x="110" y="150" width="380" height="470" rx="6" fill="#f7f2e8"/>
         <rect x="135" y="175" width="330" height="340" fill="url(#photo)"/>
         <circle cx="380" cy="250" r="40" fill="#ffe6a0"/>
         <path d="M 135 515 L 135 430 Q 250 370 330 430 Q 400 470 465 420 L 465 515 Z" fill="#2f6b52"/>
         ${person({ x: 270, y: 515, h: 230, fill: "#163028" })}
       </g>
       <path d="M 500 150 Q 560 230 520 320" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
       <path d="M 90 520 Q 40 600 90 680" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
       ${sparkles}`,
      linear("bg", [[0, "#0f766e"], [1, "#0b2f2c"]]) + linear("photo", [[0, "#9fd6ff"], [1, "#ffd9b0"]]),
    );
  },
};

// ------------------------------------------------------------------ Uygulama ikonu ("Başrol")

function iconSvg(size, { background = true, padding = 0 } = {}) {
  const s = size;
  const inner = s - padding * 2;
  const k = inner / 1024;
  const o = padding;
  const star = (cx, cy, R, r) => {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 ? r : R;
      d += `${i ? "L" : "M"} ${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)} `;
    }
    return d + "Z";
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    ${radial("ibg", [[0, "#3a1a0c"], [1, "#0e0b0a"]], { r: 0.75 })}
    ${linear("igold", [[0, "#ffe29a"], [0.5, GOLD], [1, "#b7802a"]])}
    <filter id="iglow"><feGaussianBlur stdDeviation="${f(30 * k)}"/></filter>
  </defs>
  ${background ? `<rect width="${s}" height="${s}" fill="url(#ibg)"/>` : ""}
  <g transform="translate(${o} ${o}) scale(${k})">
    <circle cx="512" cy="540" r="300" fill="${GOLD}" opacity="0.25" filter="url(#iglow)"/>
    <!-- klaket -->
    <g transform="rotate(-12 512 300)">
      <rect x="232" y="250" width="560" height="110" rx="18" fill="url(#igold)"/>
      ${[0, 1, 2, 3].map((i) => `<path d="M ${292 + i * 130} 250 L ${352 + i * 130} 250 L ${302 + i * 130} 360 L ${242 + i * 130} 360 Z" fill="#0e0b0a"/>`).join("")}
    </g>
    <rect x="232" y="380" width="560" height="430" rx="36" fill="url(#igold)"/>
    <path d="${star(512, 595, 150, 62)}" fill="#0e0b0a"/>
  </g>
</svg>`;
}

// ------------------------------------------------------------------ Çıktı

mkdirSync(COVERS_DIR, { recursive: true });
for (const [id, build] of Object.entries(scenes)) {
  await sharp(Buffer.from(build())).webp({ quality: 86 }).toFile(path.join(COVERS_DIR, `${id}.webp`));
  console.log(`kapak: ${id}.webp`);
}

await sharp(Buffer.from(iconSvg(1024))).png().toFile(path.join(APP_ASSETS, "icon.png"));
// Android uyarlanabilir ikon: ön plan şeffaf ve güvenli alan için kenar boşluklu.
await sharp(Buffer.from(iconSvg(1024, { background: false, padding: 230 })))
  .png()
  .toFile(path.join(APP_ASSETS, "android-icon-foreground.png"));
await sharp(Buffer.from(iconSvg(1024, { background: false, padding: 140 })))
  .png()
  .toFile(path.join(APP_ASSETS, "splash-icon.png"));
console.log("ikonlar: icon.png, android-icon-foreground.png, splash-icon.png");
