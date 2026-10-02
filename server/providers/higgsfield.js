// Higgsfield video sağlayıcısı.
// Doküman: https://docs.higgsfield.ai  (model sayfaları: https://docs.higgsfield.ai/docs/models.md)
//
// Akış: fotoğraf (ve varsa sahnenin referans görselleri) Higgsfield deposuna yüklenir
// -> model uç noktasına istek -> durum sorgulanır.
// Kimlik: .env'de HIGGSFIELD_API_KEY = "anahtar_kimliği:gizli_anahtar"
// (ya da kimlik HIGGSFIELD_API_KEY'de, gizli anahtar HIGGSFIELD_API_SECRET'ta).
//
// İki model ailesi var:
//  - image-to-video (standard, pro, hailuo): fotoğraf İLK KARE olur ve canlanır. Yüz iyi korunur
//    ama sahne fotoğraftaki ortamdan çok uzaklaşamaz. "Fotoğrafı canlandır" tarzları için.
//  - reference (ref): fotoğraf REFERANS olur, kişi baştan yeni sahnede üretilir.
//    Saray, konak, sahne gibi ortamı tamamen değiştiren tarzlar için; yüzü korumak için tasarlanmış.
//    Kullanıcının fotoğrafı her zaman ilk referanstır (@Image1), sahnenin referansları sonra gelir.

const BASE_URL = "https://api.higgsfield.ai";

const DEFAULT_NEGATIVE =
  "blur, distortion, warped face, deformed hands, extra limbs, low quality, text, watermark";

// Referans modellerinde kimliği koruma talimatı promptun başına, çekim kuralları sonuna eklenir.
// Kling (O3/Omni) referans görsellere promptta <<<image_1>>>, <<<image_2>>> … diye atıf yapılmasını bekler;
// "@Image1" Seedance'e özgüdür ve Kling'de kişi referansı tutmaz (yüz başka birine dönüşür).
const IDENTITY_SHOT_RULES =
  " Shot rules for identity: the main character is the only person in sharp focus; their face stays " +
  "clearly visible, well lit and mostly facing the camera in a medium or close-up shot. Any other people " +
  "stay in the blurred background and never look like the main character. Use smooth, gentle camera " +
  "movement; no fast spins, whip pans or face-hiding motion.";

function referencePrompt(style, refCount) {
  const extra =
    refCount > 1
      ? ` Use the other reference images (<<<image_2>>> and after) only for the scene's setting, costume ` +
        `and mood, never for the person's face.`
      : "";
  return (
    `The main character is exactly the person in <<<image_1>>>: same face, facial features, skin tone, ` +
    `age, gender presentation, glasses, hair or head covering. They must be instantly recognizable as the ` +
    `person in <<<image_1>>> throughout the whole video.${extra} ` +
    style.prompt +
    IDENTITY_SHOT_RULES
  );
}

// Fotoğraftan video modelleri. Fiyatlar (Higgsfield tahmini × ~1,18 gerçek fatura farkı):
//   standard 10 sn ≈ 0,42 $   pro 10 sn ≈ 0,70 $   ref 5 sn ≈ 0,42 $   ref 8 sn ≈ 0,67 $
// trimStart: fotoğraftan başlayan modellerde baştaki selfie karesi bu kadar saniye kesilir.
export const MODELS = {
  // Kling 2.5 Turbo: fotoğraf ilk kare olur. Sadece 5 veya 10 sn üretir; 10 sn üretip başını kesiyoruz.
  standard: {
    path: "/kling-video/v2.5-turbo/standard/image-to-video",
    durations: [10],
    trimStart: 1.5,
    input: (style, photoUrl, _refUrls, duration) => ({
      image_url: photoUrl,
      prompt: style.prompt,
      negative_prompt: style.negativePrompt ?? DEFAULT_NEGATIVE,
      duration,
    }),
  },
  pro: {
    path: "/kling-video/v2.5-turbo/pro/image-to-video",
    durations: [10],
    trimStart: 1.5,
    input: (style, photoUrl, _refUrls, duration) => ({
      image_url: photoUrl,
      prompt: style.prompt,
      negative_prompt: style.negativePrompt ?? DEFAULT_NEGATIVE,
      duration,
    }),
  },
  // Kling O3 görsel referans (std): kişi baştan yeni sahnede üretilir, yüz korunur, selfie ile başlamaz.
  // (Seedance 2.0 referans daha güçlü ama dikey 720p 8 sn ≈ 2,4 $; bu yüzden kullanılmıyor.)
  ref: {
    reference: true,
    path: "/kling-video/o3/image-reference",
    trimStart: 0,
    input: (style, photoUrl, refUrls, duration) => ({
      image_urls: [photoUrl, ...refUrls].slice(0, 4),
      prompt: referencePrompt(style, 1 + refUrls.length).slice(0, 2500),
      mode: "std",
      duration,
      aspect_ratio: "9:16",
      multi_shots: false,
      sound: "off",
    }),
  },
};

function authHeader() {
  const key = process.env.HIGGSFIELD_API_KEY ?? "";
  const secret = process.env.HIGGSFIELD_API_SECRET ?? "";
  if (!key) throw new Error("HIGGSFIELD_API_KEY tanımlı değil (.env).");
  const credentials = key.includes(":") ? key : `${key}:${secret}`;
  return `Key ${credentials}`;
}

// Hata mesajlarına asla kimlik bilgisi yazılmaz; sadece durum kodu ve sunucunun mesajı.
async function hf(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const detail = data.detail ?? data.error ?? data.message ?? data.raw ?? "";
    const err = new Error(`Higgsfield ${method} ${path} -> ${res.status}: ${JSON.stringify(detail).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function uploadImage({ buffer, mimeType }) {
  const { upload_url, public_url, upload_headers } = await hf("/files/generate-upload-url", {
    method: "POST",
    body: { content_type: mimeType },
  });
  // Ön imzalı depolama adresine Higgsfield kimlik bilgisi GÖNDERİLMEZ.
  const put = await fetch(upload_url, {
    method: "PUT",
    headers: upload_headers ?? { "Content-Type": mimeType },
    body: buffer,
  });
  if (!put.ok) throw new Error(`Fotoğraf yüklenemedi (${put.status}).`);
  return public_url;
}

// Sahne referans görselleri her istekte yeniden yüklenmesin diye adresleri saklanır.
// Higgsfield yüklenen dosyaları süreli tuttuğu için 12 saatte bir yenilenir.
const REF_TTL_MS = 12 * 60 * 60 * 1000;
const referenceCache = new Map();

async function uploadReferences(references = []) {
  const urls = [];
  for (const ref of references) {
    const cached = referenceCache.get(ref.fileName);
    if (cached && Date.now() - cached.at < REF_TTL_MS) {
      urls.push(cached.url);
      continue;
    }
    const url = await uploadImage(ref);
    referenceCache.set(ref.fileName, { url, at: Date.now() });
    urls.push(url);
  }
  return urls;
}

export const higgsfieldProvider = {
  name: "higgsfield",

  // plan: { model, duration } — index.js içindeki renderPlan() belirler.
  async submit({ style, plan, photo, references }) {
    const model = MODELS[plan.model];
    if (!model) throw new Error(`Bilinmeyen Higgsfield modeli: ${plan.model}`);
    const photoUrl = await uploadImage(photo);
    const refUrls = model.reference ? await uploadReferences(references) : [];
    const { request_id } = await hf(model.path, {
      method: "POST",
      body: model.input(style, photoUrl, refUrls, plan.duration),
    });
    if (!request_id) throw new Error("Higgsfield istek kimliği döndürmedi.");
    return request_id;
  },

  async check(requestId) {
    const r = await hf(`/requests/${encodeURIComponent(requestId)}/status`);
    switch (r.status) {
      case "queued":
        return { status: "queued" };
      case "in_progress":
        return { status: "processing" };
      case "completed":
        return r.video?.url
          ? { status: "done", videoUrl: r.video.url }
          : { status: "failed", error: "Video üretildi ama adresi alınamadı." };
      case "nsfw":
        return {
          status: "failed",
          error: "Fotoğraf veya sonuç güvenlik filtresine takıldı. Başka bir fotoğraf dene.",
        };
      case "canceled":
        return { status: "failed", error: "Çekim iptal edildi." };
      default:
        console.error("Higgsfield üretim hatası:", r.status, r.error);
        return { status: "failed", error: "Video üretilemedi." };
    }
  },
};
