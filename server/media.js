// Video son işleme: Higgsfield'dan gelen videoyu indirir, gerekirse baştaki selfie karesini keser,
// süresini sınırlar, sahnenin müziğini ekler ve kendi sunucumuza kaydeder.
// (Higgsfield çıktıları en az 7 gün saklanıyor; kendi kopyamız Videolarım'ın kalıcı olmasını sağlar.)

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const VIDEOS_DIR = path.join(SERVER_DIR, "public", "videos");
export const MUSIC_DIR = path.join(SERVER_DIR, "music");

// music/offsets.json: { "osmanli.mp3": 66, ... } — her istekte okunur ki yeni hesap anında geçerli olsun.
function musicOffset(fileName) {
  try {
    return JSON.parse(readFileSync(path.join(MUSIC_DIR, "offsets.json"), "utf8"))[fileName] ?? 0;
  } catch {
    return 0;
  }
}

const FADE_IN = 0.6;
const FADE_OUT = 1.2;

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(`ffmpeg hata verdi: ${String(stderr).slice(-400)}`));
      else resolve();
    });
  });
}

/**
 * @param {object} o
 * @param {string} o.jobId
 * @param {string} o.sourceUrl   Higgsfield video adresi
 * @param {number} o.trimStart   baştan kesilecek saniye (fotoğraftan başlayan modellerde selfie karesi)
 * @param {number} o.maxDuration çıktının en uzun süresi (sn)
 * @param {string|null} o.music  server/music/ altındaki dosya adı; yoksa sessiz kalır
 * @returns {Promise<string>} herkese açık yol, ör. "/static/videos/<jobId>.mp4"
 */
export async function processVideo({ jobId, sourceUrl, trimStart = 0, maxDuration, music }) {
  mkdirSync(VIDEOS_DIR, { recursive: true });
  const input = path.join(VIDEOS_DIR, `${jobId}.source.mp4`);
  const output = path.join(VIDEOS_DIR, `${jobId}.mp4`);

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Video indirilemedi (${res.status}).`);
  await writeFile(input, Buffer.from(await res.arrayBuffer()));

  try {
    const musicPath = music ? path.join(MUSIC_DIR, music) : null;
    const hasMusic = musicPath && existsSync(musicPath);
    const fadeOutStart = Math.max(0, maxDuration - FADE_OUT);

    const args = ["-y", "-ss", String(trimStart), "-t", String(maxDuration), "-i", input];
    // Müzik, parçanın en canlı bölümünden başlar (tools/music-offsets.mjs hesaplar).
    if (hasMusic) args.push("-ss", String(musicOffset(music)), "-stream_loop", "-1", "-i", musicPath);
    args.push(
      // Görüntü: kısa açılış/kapanış kararması, telefon uyumlu H.264.
      "-vf",
      `fade=t=in:st=0:d=0.3,fade=t=out:st=${fadeOutStart + 0.6}:d=0.6,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
    );
    if (hasMusic) {
      args.push(
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-af",
        `afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fadeOutStart}:d=${FADE_OUT},volume=0.9`,
        "-c:a",
        "aac",
        "-b:a",
        "160k",
      );
    } else {
      args.push("-an");
    }
    args.push("-t", String(maxDuration), "-movflags", "+faststart", output);

    await run(args);
    return `/static/videos/${jobId}.mp4`;
  } finally {
    await unlink(input).catch(() => {});
  }
}
