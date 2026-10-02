import "dotenv/config";
import express from "express";
import { readFile, unlink } from "node:fs/promises";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as db from "./db.js";
import { CATEGORIES, STYLES, publicStyle } from "./styles.js";
import { CREDIT_PACKAGES, FREE_REFERENCE_SECONDS, FREE_VIDEOS, PREMIUM, VIDEO_SECONDS } from "./packages.js";
import os from "node:os";
import multer from "multer";
import { applyCustomAudio, ensureBase, NoAudioError, processVideo, versionPaths } from "./media.js";
import { mockProvider } from "./providers/mock.js";
import { higgsfieldProvider, MODELS as HF_MODELS } from "./providers/higgsfield.js";

const PORT = Number(process.env.PORT) || 3000;
const PROVIDERS = { mock: mockProvider, higgsfield: higgsfieldProvider };
const ACTIVE_PROVIDER = PROVIDERS[process.env.VIDEO_PROVIDER ?? "mock"];
if (!ACTIVE_PROVIDER) throw new Error(`Bilinmeyen VIDEO_PROVIDER: ${process.env.VIDEO_PROVIDER}`);
// Gerçek ödeme (Google Play Billing) bağlanana kadar test için ücretsiz kredi yüklemeye izin verir.
const ALLOW_DEV_PURCHASES = process.env.ALLOW_DEV_PURCHASES === "true";
// Test modu: uygulama giriş ekranı göstermeden sınırsız kredili test hesabıyla açılır.
const DEV_AUTO_LOGIN = process.env.DEV_AUTO_LOGIN === "true";

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  db.upsertAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
}

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REFERENCES_DIR = path.join(SERVER_DIR, "references");
const PUBLIC_DIR = path.join(SERVER_DIR, "public");

// Beklenmedik hatalar logs/errors.log dosyasına da yazılır (sunucu penceresi kapansa bile görülebilsin).
// Kimlik bilgisi yazılmaz: sadece hata mesajı ve yığın izi.
const LOG_DIR = path.join(SERVER_DIR, "logs");
function logError(where, err) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(
      path.join(LOG_DIR, "errors.log"),
      `[${new Date().toISOString()}] ${where}: ${err?.stack ?? err}\n`,
    );
  } catch {
    // Kayıt yazılamazsa sunucuyu ayrıca düşürmeyelim.
  }
}
process.on("uncaughtException", (err) => {
  logError("uncaughtException", err);
  console.error(err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => logError("unhandledRejection", err));
process.on("exit", (code) => {
  if (code !== 0) logError("exit", `Sunucu ${code} koduyla kapandı.`);
});

const app = express();
app.use(express.json({ limit: "25mb" }));
// Tarayıcı önizlemesi (expo web) farklı porttan istek atar. Kimlik çerezle değil
// Authorization başlığıyla taşındığı için tüm kaynaklara izin vermek güvenli.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Kapaklar ve önizleme videoları. Uygulama tarafında önbelleğe alınır.
app.use("/static", express.static(PUBLIC_DIR, { maxAge: "1h" }));

function bearerToken(req) {
  return req.get("Authorization")?.replace(/^Bearer /, "");
}

function requireUser(req, res, next) {
  const token = bearerToken(req);
  const user = token && db.findUserByToken(token);
  if (!user) return res.status(401).json({ error: "Oturumun sona erdi, lütfen tekrar giriş yap." });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Yetkin yok." });
    next();
  });
}

function toPublicUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    credits: u.credits,
    freeVideosLeft: u.free_videos_left,
    unlimited: !!u.unlimited,
    isTestAccount: DEV_AUTO_LOGIN && u.email === db.TEST_USER_EMAIL,
    premium: {
      status: u.premium_status, // none | trial | active
      until: u.premium_until,
      credits: u.premium_credits,
      trialAvailable: !u.trial_used,
    },
  };
}

app.get("/api/config", (_req, res) => {
  res.json({ devAutoLogin: DEV_AUTO_LOGIN, freeVideos: FREE_VIDEOS });
});

app.post("/api/auth/dev", (_req, res) => {
  if (!DEV_AUTO_LOGIN) return res.status(403).json({ error: "Test modu kapalı." });
  const user = db.getOrCreateTestUser();
  res.json({ token: db.createSession(user.id), user: toPublicUser(user) });
});

// Sadece test hesabı: sınırsız mod ↔ "yeni kullanıcı gibi" (3 ücretsiz hak, Premium yok).
app.post("/api/dev/test-mode", requireUser, (req, res) => {
  if (!DEV_AUTO_LOGIN || req.user.email !== db.TEST_USER_EMAIL) {
    return res.status(403).json({ error: "Sadece test hesabında kullanılabilir." });
  }
  const user = db.setTestUserMode(req.user.id, { unlimited: !!req.body?.unlimited, freeVideos: FREE_VIDEOS });
  res.json({ user: toPublicUser(user) });
});

// ------------------------------------------------------------------ Giriş / kayıt

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/register", (req, res) => {
  const { email = "", name = "", password = "" } = req.body ?? {};
  if (!name.trim()) return res.status(400).json({ error: "Adını yaz." });
  if (!EMAIL_RE.test(email.trim())) return res.status(400).json({ error: "Geçerli bir e-posta yaz." });
  if (password.length < 6) return res.status(400).json({ error: "Şifre en az 6 karakter olmalı." });
  if (db.emailExists(email)) {
    return res.status(409).json({ error: "Bu e-posta ile zaten bir hesap var. Giriş yap." });
  }
  const user = db.createUser({ email, name, password, freeVideos: FREE_VIDEOS });
  res.json({ token: db.createSession(user.id), user: toPublicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email = "", password = "" } = req.body ?? {};
  const user = db.checkLogin(email, password);
  if (!user) return res.status(401).json({ error: "E-posta veya şifre hatalı." });
  res.json({ token: db.createSession(user.id), user: toPublicUser(user) });
});

app.post("/api/auth/logout", requireUser, (req, res) => {
  db.deleteSession(bearerToken(req));
  res.json({ ok: true });
});

app.get("/api/me", requireUser, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

// ------------------------------------------------------------------ Tarzlar ve paketler

app.get("/api/styles", (_req, res) => {
  res.json({
    categories: CATEGORIES,
    styles: STYLES.map((s) => ({
      ...publicStyle(s),
      cover: existsSync(path.join(PUBLIC_DIR, "covers", `${s.id}.webp`))
        ? `/static/covers/${s.id}.webp`
        : null,
      preview: existsSync(path.join(PUBLIC_DIR, "previews", `${s.id}.mp4`))
        ? `/static/previews/${s.id}.mp4`
        : null,
    })),
    demo: ACTIVE_PROVIDER === mockProvider,
  });
});

app.get("/api/packages", (_req, res) => {
  res.json({ packages: CREDIT_PACKAGES, devPurchases: ALLOW_DEV_PURCHASES });
});

// ------------------------------------------------------------------ Premium abonelik

app.get("/api/premium", (_req, res) => {
  res.json({ plan: PREMIUM, devPurchases: ALLOW_DEV_PURCHASES });
});

// Google Play Billing bağlanana kadar deneme ve abonelik bu test uçlarıyla simüle edilir.
app.post("/api/premium/dev/trial", requireUser, (req, res) => {
  if (!ALLOW_DEV_PURCHASES) return res.status(403).json({ error: "Test satın alma kapalı." });
  const ok = db.startTrial(req.user.id, { days: PREMIUM.trialDays, credits: PREMIUM.trialCredits });
  if (!ok) return res.status(409).json({ error: "Ücretsiz deneme bu hesapta daha önce kullanıldı." });
  res.json({ user: toPublicUser(db.getUser(req.user.id)) });
});

app.post("/api/premium/dev/subscribe", requireUser, (req, res) => {
  if (!ALLOW_DEV_PURCHASES) return res.status(403).json({ error: "Test satın alma kapalı." });
  db.activatePremium(req.user.id, { days: PREMIUM.periodDays, credits: PREMIUM.monthlyCredits });
  res.json({ user: toPublicUser(db.getUser(req.user.id)) });
});

app.post("/api/purchases/dev", requireUser, (req, res) => {
  if (!ALLOW_DEV_PURCHASES) return res.status(403).json({ error: "Test satın alma kapalı." });
  const pkg = CREDIT_PACKAGES.find((p) => p.id === req.body?.packageId);
  if (!pkg) return res.status(400).json({ error: "Geçersiz paket." });
  db.addCredits(req.user.id, pkg.credits, "purchase", `dev:${pkg.id}`);
  res.json({ user: toPublicUser(db.getUser(req.user.id)) });
});

// ------------------------------------------------------------------ Video işleri

async function loadReferences(fileNames = []) {
  const refs = [];
  for (const fileName of fileNames) {
    const filePath = path.join(REFERENCES_DIR, fileName);
    if (!existsSync(filePath)) continue;
    refs.push({ fileName, buffer: await readFile(filePath), mimeType: mimeFromName(fileName) });
  }
  return refs;
}

function mimeFromName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

// Bir videonun nasıl üretileceği: model, istenen süre, baştan kesilecek kısım, çıktı süresi.
// Ortamı değiştiren sahneler referans modeliyle (selfie ile başlamaz); diğerleri fotoğraftan
// başlayan modelle 10 sn üretilir, baştaki selfie anı kesilip 8 sn'ye indirilir.
function renderPlan(style, isFree) {
  if (HF_MODELS[style.model]?.reference) {
    const seconds = isFree ? FREE_REFERENCE_SECONDS : VIDEO_SECONDS;
    return { model: "ref", duration: seconds, trimStart: 0, maxDuration: seconds };
  }
  return { model: "standard", duration: 10, trimStart: HF_MODELS.standard.trimStart, maxDuration: VIDEO_SECONDS };
}

// Sunucudaki dosyalar göreli yol olarak saklanır; telefona tam adres verilir.
function absoluteUrl(req, url) {
  return url?.startsWith("/") ? `${req.protocol}://${req.get("host")}${url}` : url;
}

// Video Higgsfield'da hazır olunca müzik eklenip kendi sunucumuza kaydedilir.
// Aynı iş için tek bir işlem çalışsın diye takip edilir.
const postProcessing = new Map();

function startPostProcess(job, sourceUrl) {
  if (postProcessing.has(job.id)) return;
  const style = STYLES.find((s) => s.id === job.style_id);
  const plan = renderPlan(style ?? {}, !!job.is_free);
  const task = processVideo({
    jobId: job.id,
    sourceUrl,
    trimStart: plan.trimStart,
    maxDuration: plan.maxDuration,
    music: style?.music ?? null,
  })
    .then((localUrl) => db.markDone(job.id, localUrl))
    .catch((err) => {
      // Müzik/işleme başarısız olursa video yine de (müziksiz, orijinal haliyle) teslim edilir.
      logError(`postProcess ${job.id}`, err);
      db.markDone(job.id, sourceUrl);
    })
    .finally(() => postProcessing.delete(job.id));
  postProcessing.set(job.id, task);
}

// Yeni video işi. Gövde: { styleId, imageBase64, mimeType }
app.post("/api/jobs", requireUser, async (req, res) => {
  const { styleId, imageBase64, mimeType = "image/jpeg" } = req.body ?? {};
  const style = STYLES.find((s) => s.id === styleId);
  if (!style) return res.status(400).json({ error: "Geçersiz tarz." });
  if (!imageBase64) return res.status(400).json({ error: "Fotoğraf eksik." });

  const jobId = db.startJob({
    userId: req.user.id,
    styleId: style.id,
    provider: ACTIVE_PROVIDER.name,
    cost: style.cost,
  });
  if (!jobId) {
    return res.status(402).json({ error: "Yetersiz kredi.", code: "insufficient_credits" });
  }

  // Ücretsiz/deneme videoları referans sahnelerde daha kısa üretilir (maliyet).
  const isFree = !!db.getJob(jobId, req.user.id).is_free;

  try {
    const providerJobId = await ACTIVE_PROVIDER.submit({
      style,
      plan: renderPlan(style, isFree),
      photo: { buffer: Buffer.from(imageBase64, "base64"), mimeType },
      references: await loadReferences(style.references),
    });
    db.setProviderJobId(jobId, providerJobId);
    res.json({ jobId, user: toPublicUser(db.getUser(req.user.id)) });
  } catch (err) {
    console.error("İş başlatılamadı:", err);
    // Teknik ayrıntı (kimlik bilgisi içermez) Yönetim > Videolar'da görünsün diye kaydedilir.
    db.markFailedAndRefund(jobId, `Video üretimi başlatılamadı. [${String(err.message).slice(0, 300)}]`);
    res.status(502).json({ error: "Video üretimi başlatılamadı. Hakkın iade edildi." });
  }
});

app.get("/api/jobs", requireUser, (req, res) => {
  res.json({
    jobs: db.listJobs(req.user.id).map((j) => ({ ...j, video_url: absoluteUrl(req, j.video_url) })),
  });
});

// İşin güncel durumu. Bitmemişse sağlayıcıya sorup veritabanını günceller.
// Bitmemiş bir işin durumunu sağlayıcıya sorar, veritabanını günceller; bitince son işlemeyi başlatır.
async function refreshJob(job) {
  if (!job.provider_job_id) return; // gönderim henüz sürüyor
  const result = await PROVIDERS[job.provider].check(job.provider_job_id);
  if (result.status === "processing") db.markProcessing(job.id);
  if (result.status === "done") {
    db.markProcessing(job.id);
    startPostProcess(job, result.videoUrl);
  }
  if (result.status === "failed") db.markFailedAndRefund(job.id, result.error ?? "Video üretilemedi.");
}

// Kullanıcı çekim ekranını kapatsa da işler ilerlesin: bekleyen işler arka planda takip edilir.
const BACKGROUND_REFRESH_MS = 15_000;
let backgroundBusy = false;
setInterval(async () => {
  if (backgroundBusy) return;
  backgroundBusy = true;
  try {
    for (const job of db.listPendingJobs()) {
      await refreshJob(job).catch((err) => console.error("Arka plan durum hatası:", err.message));
    }
    for (const { id } of db.listStuckJobs(15)) {
      db.markFailedAndRefund(id, "Video üretimi başlatılamadı.");
    }
  } finally {
    backgroundBusy = false;
  }
}, BACKGROUND_REFRESH_MS).unref();

app.get("/api/jobs/:jobId", requireUser, async (req, res) => {
  let job = db.getJob(req.params.jobId, req.user.id);
  if (!job) return res.status(404).json({ error: "İş bulunamadı." });

  if (job.status === "queued" || job.status === "processing") {
    try {
      await refreshJob(job);
      job = db.getJob(job.id, req.user.id);
    } catch (err) {
      // Geçici hata: iş durumunu değiştirme, uygulama tekrar soracak.
      console.error("Durum alınamadı:", err);
    }
  }

  // Bu özellikten önceki videolarda müziksiz sürüm yoksa oluşturulur (hızlı, görüntü kopyalanır).
  if (job.status === "done") await ensureBase(job.id).catch((err) => logError(`ensureBase ${job.id}`, err));
  const versions = job.status === "done" ? versionPaths(job.id) : null;

  res.json({
    status: job.status,
    videoUrl: absoluteUrl(req, job.video_url) ?? undefined,
    versions: versions
      ? Object.fromEntries(Object.entries(versions).map(([k, v]) => [k, v && absoluteUrl(req, v)]))
      : undefined,
    error: job.status === "failed" ? `${job.error} Hakkın iade edildi.` : undefined,
    user: toPublicUser(db.getUser(req.user.id)),
  });
});

// Kullanıcının kendi videosundan ses: yüklenen videonun sesi ayrılıp üretilen videoya eklenir.
// Görüntü kullanılmaz, yüklenen dosya işlemden sonra silinir.
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
});

app.post("/api/jobs/:jobId/custom-audio", requireUser, upload.single("media"), async (req, res) => {
  const job = db.getJob(req.params.jobId, req.user.id);
  if (!job || job.status !== "done") {
    if (req.file) await unlink(req.file.path).catch(() => {});
    return res.status(404).json({ error: "Video bulunamadı." });
  }
  if (!req.file) return res.status(400).json({ error: "Ses alınacak video seçilmedi." });
  try {
    const url = await applyCustomAudio({ jobId: job.id, uploadPath: req.file.path });
    res.json({ url: absoluteUrl(req, url) });
  } catch (err) {
    if (err instanceof NoAudioError) return res.status(400).json({ error: err.message });
    logError(`custom-audio ${job.id}`, err);
    res.status(500).json({ error: "Ses eklenemedi, başka bir video dene." });
  }
});

// ------------------------------------------------------------------ Yönetim (sadece admin)

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  res.json(db.adminStats());
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  res.json({ users: db.adminListUsers(String(req.query.q ?? "")) });
});

app.post("/api/admin/users/:userId/credits", requireAdmin, (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) {
    return res.status(400).json({ error: "Geçerli bir kredi miktarı yaz." });
  }
  if (!db.getUser(req.params.userId)) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
  db.addCredits(req.params.userId, amount, "admin", `admin:${req.user.id}`);
  res.json({ user: toPublicUser(db.getUser(req.params.userId)) });
});

app.get("/api/admin/jobs", requireAdmin, (_req, res) => {
  res.json({ jobs: db.adminRecentJobs() });
});

// Uç noktalarda yakalanmayan hatalar: kaydet, kullanıcıya genel bir mesaj dön.
app.use((err, req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Video çok büyük (en fazla 200 MB)." });
  logError(`${req.method} ${req.path}`, err);
  console.error(err);
  res.status(500).json({ error: "Beklenmedik bir hata oluştu." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`Video sağlayıcı: ${ACTIVE_PROVIDER.name}`);
  if (ACTIVE_PROVIDER === mockProvider) console.log("DEMO MODU: gerçek video yerine örnek video döner.");
  if (ALLOW_DEV_PURCHASES) console.log("Test satın alma AÇIK (canlıya çıkmadan kapat).");
  if (DEV_AUTO_LOGIN) console.log("Test modu AÇIK: uygulama sınırsız kredili test hesabıyla açılır.");
  if (!process.env.ADMIN_EMAIL) console.log("Uyarı: .env'de ADMIN_EMAIL/ADMIN_PASSWORD yok, admin hesabı yok.");
});
