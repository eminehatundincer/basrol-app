// Her müzik parçasının en canlı (en yüksek ortalama ses seviyeli) 8 saniyelik bölümünü bulur
// ve music/offsets.json dosyasına yazar. Sunucu müziği bu noktadan başlatır.
// Çalıştır:  npm run music-offsets   (yeni parça ekleyince tekrar çalıştır)

import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const MUSIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "music");
const WINDOW = 8; // video süresi
const SEARCH_LIMIT = 90; // parçanın ilk 90 sn'si içinde ara (sonlardaki kapanışlardan kaçın)

function secondLevels(file) {
  // Her saniyenin RMS ses seviyesi (dB).
  const out = spawnSync(
    ffmpegPath,
    [
      "-i", file,
      "-t", String(SEARCH_LIMIT + WINDOW),
      "-af", "aresample=48000,asetnsamples=n=48000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
      "-f", "null", "-",
    ],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
  ).stderr;
  return [...out.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -90 : Number(m[1])));
}

const offsets = {};
for (const name of readdirSync(MUSIC_DIR).filter((f) => f.endsWith(".mp3"))) {
  const levels = secondLevels(path.join(MUSIC_DIR, name));
  let best = 0;
  let bestScore = -Infinity;
  for (let start = 0; start + WINDOW <= levels.length; start++) {
    const win = levels.slice(start, start + WINDOW);
    const mean = win.reduce((a, b) => a + b, 0) / WINDOW;
    // Hafif tercih: girişe yakın bölümler (aynı canlılıkta erken olan seçilsin).
    const score = mean - start * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  offsets[name] = best;
  console.log(`${name.padEnd(14)} başlangıç: ${String(best).padStart(3)} sn  ortalama seviye: ${bestScore.toFixed(1)} dB`);
}

writeFileSync(path.join(MUSIC_DIR, "offsets.json"), JSON.stringify(offsets, null, 2) + "\n");
console.log("music/offsets.json yazıldı.");
