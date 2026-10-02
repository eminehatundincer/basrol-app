import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB_PATH =
  process.env.DB_PATH ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "data.sqlite");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                 TEXT PRIMARY KEY,
    email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name               TEXT NOT NULL,
    password_hash      TEXT NOT NULL,
    role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    credits            INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    free_videos_left   INTEGER NOT NULL DEFAULT 0 CHECK (free_videos_left >= 0),
    unlimited          INTEGER NOT NULL DEFAULT 0,   -- test hesabı: kredi düşülmez
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Her kredi hareketi burada: satın alma, video harcaması, iade, admin yüklemesi.
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL,
    reason      TEXT NOT NULL CHECK (reason IN ('purchase', 'video', 'refund', 'admin')),
    ref         TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    style_id         TEXT NOT NULL,
    provider         TEXT NOT NULL,
    provider_job_id  TEXT,
    status           TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'failed')),
    is_free          INTEGER NOT NULL DEFAULT 0,   -- ücretsiz hakla mı üretildi
    cost             INTEGER NOT NULL,             -- düşülen kredi (ücretsizse 0)
    video_url        TEXT,
    error            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS jobs_user ON jobs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS jobs_created ON jobs(created_at DESC);

  -- Abonelik olayları: deneme başlangıcı, abonelik, yenileme, bitiş (rapor ve takip için).
  CREATE TABLE IF NOT EXISTS premium_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('trial_start', 'subscribe', 'renew', 'expire')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Var olan veritabanına sonradan eklenen sütunlar (veri silinmeden).
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
// premium_status: none | trial | active.  premium_credits: bu dönemin kalan Premium kredisi (devretmez).
addColumn("users", "premium_status", "TEXT NOT NULL DEFAULT 'none'");
addColumn("users", "premium_until", "TEXT");
addColumn("users", "premium_credits", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "trial_used", "INTEGER NOT NULL DEFAULT 0");
// source: videonun neyle ödendiği → iade doğru yere yapılsın, ucuz model gerekip gerekmediği bilinsin.
// free | trial | premium | credits | unlimited
addColumn("jobs", "source", "TEXT NOT NULL DEFAULT 'credits'");

function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ------------------------------------------------------------------ Şifre ve oturum

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

const USER_FIELDS =
  "id, email, name, role, credits, free_videos_left, unlimited, premium_status, premium_until, premium_credits, trial_used";

export function createUser({ email, name, password, role = "user", freeVideos = 0 }) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, role, free_videos_left) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, email.trim(), name.trim(), hashPassword(password), role, freeVideos);
  return getUser(id);
}

export function emailExists(email) {
  return !!db.prepare("SELECT 1 FROM users WHERE email = ?").get(email.trim());
}

export function checkLogin(email, password) {
  const row = db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email.trim());
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return getUser(row.id);
}

// Admin hesabı .env'deki bilgilerle her açılışta oluşturulur/güncellenir.
export function upsertAdmin({ email, password, name = "Yönetici" }) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(
      hashPassword(password),
      existing.id,
    );
  } else {
    createUser({ email, name, password, role: "admin" });
  }
}

// Test modu: onboarding olmadan açılan, sınırsız kredili (ve admin yetkili) hesap.
export const TEST_USER_EMAIL = "test@basrol.app";

export function getOrCreateTestUser() {
  let row = db.prepare("SELECT id FROM users WHERE email = ?").get(TEST_USER_EMAIL);
  if (!row) {
    row = createUser({
      email: TEST_USER_EMAIL,
      name: "Test Kullanıcısı",
      password: randomBytes(24).toString("hex"),
      role: "admin",
    });
    db.prepare("UPDATE users SET unlimited = 1 WHERE id = ?").run(row.id);
  }
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(row.id);
  return getUser(row.id);
}

// Test hesabını sınırsız moda alır ya da "yeni kullanıcı" gibi sıfırlar
// (ücretsiz hak, Premium ve deneme akışını baştan denemek için).
export function setTestUserMode(userId, { unlimited, freeVideos }) {
  if (unlimited) {
    db.prepare("UPDATE users SET unlimited = 1 WHERE id = ?").run(userId);
  } else {
    db.prepare(
      `UPDATE users SET unlimited = 0, free_videos_left = ?, credits = 0, premium_status = 'none',
         premium_credits = 0, premium_until = NULL, trial_used = 0
       WHERE id = ?`,
    ).run(freeVideos, userId);
  }
  return getUser(userId);
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function findUserByToken(token) {
  const session = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token);
  if (!session) return undefined;
  expirePremiumIfNeeded(session.user_id);
  return getUser(session.user_id);
}

// ------------------------------------------------------------------ Premium abonelik
//
// Gerçek ödeme (Google Play Billing) bağlanınca deneme/abonelik/yenileme bilgisi Google'dan gelecek
// (gerçek zamanlı geliştirici bildirimleri). O zamana kadar bu fonksiyonlar test uçlarından çağrılır.

// Dönemi biten abonelik kapanır; kullanılmamış Premium kredisi silinir (devretmez).
export function expirePremiumIfNeeded(userId) {
  const expired = db
    .prepare(
      `UPDATE users SET premium_status = 'none', premium_credits = 0
       WHERE id = ? AND premium_status != 'none' AND premium_until <= datetime('now')`,
    )
    .run(userId).changes;
  if (expired) db.prepare("INSERT INTO premium_events (user_id, type) VALUES (?, 'expire')").run(userId);
}

// Hesap başına bir kez. Başarılıysa true.
export function startTrial(userId, { days, credits }) {
  return transaction(() => {
    const started = db
      .prepare(
        `UPDATE users SET premium_status = 'trial', trial_used = 1, premium_credits = ?,
           premium_until = datetime('now', ?)
         WHERE id = ? AND trial_used = 0 AND premium_status = 'none'`,
      )
      .run(credits, `+${days} days`, userId).changes;
    if (started) db.prepare("INSERT INTO premium_events (user_id, type) VALUES (?, 'trial_start')").run(userId);
    return !!started;
  });
}

// Ücretli dönem başlar ya da yenilenir: kota sıfırlanıp yeniden dolar.
export function activatePremium(userId, { days, credits }) {
  transaction(() => {
    const { premium_status } = db.prepare("SELECT premium_status FROM users WHERE id = ?").get(userId);
    db.prepare(
      `UPDATE users SET premium_status = 'active', premium_credits = ?, trial_used = 1,
         premium_until = datetime('now', ?)
       WHERE id = ?`,
    ).run(credits, `+${days} days`, userId);
    db.prepare("INSERT INTO premium_events (user_id, type) VALUES (?, ?)").run(
      userId,
      premium_status === "active" ? "renew" : "subscribe",
    );
  });
}

export function getUser(userId) {
  return db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(userId);
}

// ------------------------------------------------------------------ Kredi

export function addCredits(userId, amount, reason, ref = null) {
  transaction(() => {
    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(amount, userId);
    db.prepare(
      "INSERT INTO credit_transactions (user_id, amount, reason, ref) VALUES (?, ?, ?, ?)",
    ).run(userId, amount, reason, ref);
  });
}

// Harcama sırası: ücretsiz hak → Premium/deneme kredisi → satın alınmış kredi. Yetersizse null.
// source alanı videonun neyle ödendiğini tutar (iade ve model seçimi buna göre yapılır).
export function startJob({ userId, styleId, provider, cost }) {
  return transaction(() => {
    const id = randomUUID();
    expirePremiumIfNeeded(userId);
    const user = db.prepare("SELECT unlimited, premium_status FROM users WHERE id = ?").get(userId);

    let source;
    let premiumCost;
    if (user.unlimited) {
      source = "unlimited";
    } else if (
      db
        .prepare("UPDATE users SET free_videos_left = free_videos_left - 1 WHERE id = ? AND free_videos_left > 0")
        .run(userId).changes
    ) {
      source = "free";
    } else if (
      // Denemede her video 1 hak düşer ("deneme ayında 5 video"); ücretli Premium'da sahnenin kredisi.
      ((premiumCost = user.premium_status === "trial" ? 1 : cost),
      db
        .prepare(
          `UPDATE users SET premium_credits = premium_credits - ?
           WHERE id = ? AND premium_status != 'none' AND premium_credits >= ?`,
        )
        .run(premiumCost, userId, premiumCost).changes)
    ) {
      source = user.premium_status === "trial" ? "trial" : "premium";
      cost = premiumCost;
    } else if (
      db.prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?").run(cost, userId, cost)
        .changes
    ) {
      source = "credits";
      db.prepare(
        "INSERT INTO credit_transactions (user_id, amount, reason, ref) VALUES (?, ?, 'video', ?)",
      ).run(userId, -cost, id);
    } else {
      return null;
    }

    // Ücretsiz hak ve deneme videoları ucuz modelle üretilir (is_free = 1).
    const isFree = source === "free" || source === "trial" ? 1 : 0;
    const charged = source === "free" || source === "unlimited" ? 0 : cost;
    db.prepare(
      "INSERT INTO jobs (id, user_id, style_id, provider, status, is_free, cost, source) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)",
    ).run(id, userId, styleId, provider, isFree, charged, source);
    return id;
  });
}

// ------------------------------------------------------------------ Video işleri

export function getJob(jobId, userId) {
  return db.prepare("SELECT * FROM jobs WHERE id = ? AND user_id = ?").get(jobId, userId);
}

export function listJobs(userId) {
  return db
    .prepare(
      "SELECT id, style_id, status, video_url, error, created_at FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    )
    .all(userId);
}

// Arka planda takip edilecek işler (uygulama açık olmasa da ilerlesin diye).
export function listPendingJobs() {
  return db
    .prepare("SELECT * FROM jobs WHERE status IN ('queued', 'processing') AND provider_job_id IS NOT NULL")
    .all();
}

// Sağlayıcıya hiç ulaşamamış (ör. gönderim sırasında sunucu kapanmış) eski işler.
export function listStuckJobs(minutes) {
  return db
    .prepare(
      `SELECT id FROM jobs WHERE status = 'queued' AND provider_job_id IS NULL
       AND created_at <= datetime('now', ?)`,
    )
    .all(`-${minutes} minutes`);
}

export function setProviderJobId(jobId, providerJobId) {
  db.prepare("UPDATE jobs SET provider_job_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    providerJobId,
    jobId,
  );
}

export function markProcessing(jobId) {
  db.prepare(
    "UPDATE jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ? AND status = 'queued'",
  ).run(jobId);
}

export function markDone(jobId, videoUrl) {
  db.prepare(
    "UPDATE jobs SET status = 'done', video_url = ?, updated_at = datetime('now') WHERE id = ? AND status IN ('queued', 'processing')",
  ).run(videoUrl, jobId);
}

// İş başarısız olursa harcanan hak/kredi geldiği yere bir kez iade edilir
// (status kontrolü çift iadeyi engeller).
export function markFailedAndRefund(jobId, error) {
  transaction(() => {
    const job = db
      .prepare("SELECT user_id, cost, source FROM jobs WHERE id = ? AND status IN ('queued', 'processing')")
      .get(jobId);
    if (!job) return;
    db.prepare(
      "UPDATE jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(error, jobId);

    if (job.source === "free") {
      db.prepare("UPDATE users SET free_videos_left = free_videos_left + 1 WHERE id = ?").run(job.user_id);
    } else if (job.source === "trial" || job.source === "premium") {
      // Abonelik bu arada bittiyse iade edilecek dönem kalmamıştır.
      db.prepare(
        "UPDATE users SET premium_credits = premium_credits + ? WHERE id = ? AND premium_status != 'none'",
      ).run(job.cost, job.user_id);
    } else if (job.source === "credits" && job.cost > 0) {
      db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(job.cost, job.user_id);
      db.prepare(
        "INSERT INTO credit_transactions (user_id, amount, reason, ref) VALUES (?, ?, 'refund', ?)",
      ).run(job.user_id, job.cost, jobId);
    }
  });
}

// ------------------------------------------------------------------ Yönetim (admin)

export function adminStats() {
  const one = (sql) => Object.values(db.prepare(sql).get())[0] ?? 0;
  return {
    users: one("SELECT COUNT(*) FROM users WHERE role = 'user'"),
    usersToday: one("SELECT COUNT(*) FROM users WHERE role = 'user' AND created_at >= date('now')"),
    videos: one("SELECT COUNT(*) FROM jobs WHERE status = 'done'"),
    videosToday: one("SELECT COUNT(*) FROM jobs WHERE status = 'done' AND created_at >= date('now')"),
    freeVideos: one("SELECT COUNT(*) FROM jobs WHERE status = 'done' AND is_free = 1"),
    failedVideos: one("SELECT COUNT(*) FROM jobs WHERE status = 'failed'"),
    creditsPurchased: one(
      "SELECT COALESCE(SUM(amount), 0) FROM credit_transactions WHERE reason = 'purchase'",
    ),
    payingUsers: one(
      "SELECT COUNT(DISTINCT user_id) FROM credit_transactions WHERE reason = 'purchase'",
    ),
    premiumActive: one("SELECT COUNT(*) FROM users WHERE premium_status = 'active' AND unlimited = 0"),
    premiumTrials: one("SELECT COUNT(*) FROM users WHERE premium_status = 'trial' AND unlimited = 0"),
    trialsStarted: one("SELECT COUNT(*) FROM premium_events WHERE type = 'trial_start'"),
    trialConversions: one(
      `SELECT COUNT(DISTINCT e.user_id) FROM premium_events e
       WHERE e.type = 'subscribe' AND EXISTS (
         SELECT 1 FROM premium_events t WHERE t.user_id = e.user_id AND t.type = 'trial_start')`,
    ),
  };
}

export function adminListUsers(search = "") {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.credits, u.free_videos_left, u.premium_status, u.premium_credits, u.created_at,
              (SELECT COUNT(*) FROM jobs j WHERE j.user_id = u.id AND j.status = 'done') AS videos
       FROM users u
       WHERE u.email LIKE ? OR u.name LIKE ?
       ORDER BY u.created_at DESC LIMIT 200`,
    )
    .all(`%${search}%`, `%${search}%`);
}

export function adminRecentJobs() {
  return db
    .prepare(
      `SELECT j.id, j.style_id, j.status, j.is_free, j.cost, j.error, j.created_at, u.email
       FROM jobs j JOIN users u ON u.id = j.user_id
       ORDER BY j.created_at DESC LIMIT 100`,
    )
    .all();
}
