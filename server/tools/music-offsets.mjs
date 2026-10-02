// Her müzik parçasının en canlı (en yüksek ortalama ses seviyeli) 8 saniyelik bölümünü bulur
// ve music/offsets.json dosyasına yazar. Sunucu müziği bu noktadan başlatır.
// Çalıştır:  npm run music-offsets   (yeni parça ekleyince tekrar çalıştır)

import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loudestOffset, MUSIC_DIR } from "../media.js";

const offsets = {};
for (const name of readdirSync(MUSIC_DIR).filter((f) => f.endsWith(".mp3"))) {
  offsets[name] = loudestOffset(path.join(MUSIC_DIR, name), { window: 8, searchLimit: 90 });
  console.log(`${name.padEnd(14)} başlangıç: ${String(offsets[name]).padStart(3)} sn`);
}

writeFileSync(path.join(MUSIC_DIR, "offsets.json"), JSON.stringify(offsets, null, 2) + "\n");
console.log("music/offsets.json yazıldı.");
