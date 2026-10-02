// Video son işleme.
//
// Her video için üç sürüm olabilir (public/videos/):
//   <jobId>.base.mp4    müziksiz temel video (baştaki selfie karesi kesilmiş, süre sınırlı)
//   <jobId>.mp4         temel video + sahne müziği (varsayılan)
//   <jobId>.custom.mp4  temel video + kullanıcının kendi videosundan ayrılmış ses
// Higgsfield çıktıları en az 7 gün saklanıyor; kendi kopyamız Videolarım'ın kalıcı olmasını sağlar.

import { execFile, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const VIDEOS_DIR = path.join(SERVER_DIR, "public", "videos");
export const MUSIC_DIR = path.join(SERVER_DIR, "music");

const FADE_IN = 0.6;
const FADE_OUT = 1.2;

const file = (jobId, variant) => path.join(VIDEOS_DIR, variant ? `${jobId}.${variant}.mp4` : `${jobId}.mp4`);
const publicPath = (jobId, variant) => `/static/videos/${variant ? `${jobId}.${variant}` : jobId}.mp4`;

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(`ffmpeg hata verdi: ${String(stderr).slice(-400)}`));
      else resolve();
    });
  });
}

function probe(filePath) {
  return spawnSync(ffmpegPath, ["-hide_banner", "-i", filePath], { encoding: "utf8" }).stderr ?? "";
}

export function durationOf(filePath) {
  const m = probe(filePath).match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

export function hasAudio(filePath) {
  return /Stream #\d+:\d+.*Audio:/.test(probe(filePath));
}

// Bir ses kaynağının en canlı (en yüksek ortalama ses seviyeli) `window` saniyesinin başlangıcı.
export function loudestOffset(filePath, { window = 8, searchLimit = 90 } = {}) {
  const out = spawnSync(
    ffmpegPath,
    [
      "-i", filePath,
      "-t", String(searchLimit + window),
      "-vn",
      "-af", "aresample=48000,asetnsamples=n=48000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
      "-f", "null", "-",
    ],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
  ).stderr;
  const levels = [...out.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -90 : Number(m[1])));
  const size = Math.min(window, levels.length);
  let best = 0;
  let bestScore = -Infinity;
  for (let start = 0; start + size <= levels.length; start++) {
    const mean = levels.slice(start, start + size).reduce((a, b) => a + b, 0) / size;
    const score = mean - start * 0.01; // aynı canlılıkta erken olan seçilsin
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }
  return best;
}

// music/offsets.json: { "osmanli.mp3": 66, ... } — her istekte okunur ki yeni hesap anında geçerli olsun.
function musicOffset(fileName) {
  try {
    return JSON.parse(readFileSync(path.join(MUSIC_DIR, "offsets.json"), "utf8"))[fileName] ?? 0;
  } catch {
    return 0;
  }
}

// Temel videoya ses ekler (görüntü yeniden kodlanmaz, hızlıdır). Ses kısa kalırsa başa sarar.
async function mixAudio({ jobId, variant, audioPath, offset }) {
  const base = file(jobId, "base");
  const duration = durationOf(base);
  const fadeOutStart = Math.max(0, duration - FADE_OUT);
  await run([
    "-y",
    "-i", base,
    "-ss", String(offset), "-stream_loop", "-1", "-i", audioPath,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy",
    "-af", `afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${fadeOutStart}:d=${FADE_OUT},volume=0.9`,
    "-c:a", "aac", "-b:a", "160k",
    "-t", String(duration),
    "-movflags", "+faststart",
    file(jobId, variant),
  ]);
}

/**
 * Higgsfield videosunu indirir, temel (müziksiz) sürümü ve sahne müzikli sürümü üretir.
 * @returns {Promise<string>} sahne müzikli sürümün herkese açık yolu
 */
export async function processVideo({ jobId, sourceUrl, trimStart = 0, maxDuration, music }) {
  mkdirSync(VIDEOS_DIR, { recursive: true });
  const input = file(jobId, "source");

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Video indirilemedi (${res.status}).`);
  await writeFile(input, Buffer.from(await res.arrayBuffer()));

  try {
    const fadeOutStart = Math.max(0, maxDuration - FADE_OUT);
    await run([
      "-y",
      "-ss", String(trimStart), "-t", String(maxDuration), "-i", input,
      // Kısa açılış/kapanış kararması, telefon uyumlu H.264, ses yok.
      "-vf", `fade=t=in:st=0:d=0.3,fade=t=out:st=${fadeOutStart + 0.6}:d=0.6,format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
      "-an",
      "-movflags", "+faststart",
      file(jobId, "base"),
    ]);

    const musicPath = music ? path.join(MUSIC_DIR, music) : null;
    if (musicPath && existsSync(musicPath)) {
      await mixAudio({ jobId, variant: null, audioPath: musicPath, offset: musicOffset(music) });
    } else {
      copyFileSync(file(jobId, "base"), file(jobId, null));
    }
    return publicPath(jobId, null);
  } finally {
    await unlink(input).catch(() => {});
  }
}

// Bu özellikten önce üretilmiş videolarda temel sürüm yoktur: müzikli videonun sesi çıkarılarak oluşturulur.
export async function ensureBase(jobId) {
  if (existsSync(file(jobId, "base"))) return true;
  if (!existsSync(file(jobId, null))) return false;
  await run(["-y", "-i", file(jobId, null), "-c:v", "copy", "-an", "-movflags", "+faststart", file(jobId, "base")]);
  return true;
}

// Uygulamaya gösterilecek ses seçenekleri: sahne müziği, müziksiz, kendi sesim (varsa).
export function versionPaths(jobId) {
  if (!existsSync(file(jobId, null))) return null;
  return {
    scene: publicPath(jobId, null),
    silent: existsSync(file(jobId, "base")) ? publicPath(jobId, "base") : null,
    custom: existsSync(file(jobId, "custom")) ? publicPath(jobId, "custom") : null,
  };
}

export class NoAudioError extends Error {}

// Kullanıcının yüklediği videodan sesi ayırır, en canlı bölümünü temel videoya ekler.
export async function applyCustomAudio({ jobId, uploadPath }) {
  try {
    if (!hasAudio(uploadPath)) throw new NoAudioError("Bu videoda ses bulunamadı.");
    if (!(await ensureBase(jobId))) throw new Error("Temel video bulunamadı.");
    const offset = loudestOffset(uploadPath, { window: Math.ceil(durationOf(file(jobId, "base"))) });
    await mixAudio({ jobId, variant: "custom", audioPath: uploadPath, offset });
    return publicPath(jobId, "custom");
  } finally {
    await unlink(uploadPath).catch(() => {});
  }
}
