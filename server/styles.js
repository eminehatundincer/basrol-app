// Tarz tanımları. Bu dosya SADECE sunucuda durur; uygulamaya yalnızca
// id, category, name, description, emoji, color ve cost gönderilir. Promptlar ve referanslar gizli kalır.
//
// tagline:    detay ekranındaki kısa slogan.
// badge:      kartın köşesindeki etiket ("Yeni", "Trend", "Popüler").
// Kapak:      public/covers/<id>.webp  (npm run covers ile üretilir)
// Önizleme:   public/previews/<id>.mp4 varsa uygulama kapağın yerine bu videoyu oynatır.
// category:   uygulamada tarzların gruplandığı başlık (CATEGORIES sırasıyla gösterilir).
// cost:       bir videonun kaç kredi tuttuğu (ref sahne 8 sn ≈ ₺32 → 3, canlandırma ≈ ₺20 → 2).
// music:      server/music/ altındaki telifsiz parça; video hazır olunca eklenir. Yoksa video sessiz kalır.
// model:      Higgsfield modeli (bkz. providers/higgsfield.js):
//               "ref"      Seedance 2.0 referanstan video — ortamı değiştiren tarzlar, yüzü korur
//               "standard" / "pro"  Kling 2.5 Turbo — fotoğrafı ilk kare yapıp canlandırır
//               "hailuo"   MiniMax Hailuo 2.3
// references: server/references/ altındaki dosya adları. Sadece "ref" modellerinde kullanılır:
//             kullanıcının fotoğrafı @Image1, bunlar @Image2… (sahne, kostüm, atmosfer örneği).
//             Dosya yoksa atlanır. Telifli dizi kareleri değil, kendi/lisanslı görseller kullan.
//
// ÖNEMLİ: Dizi/film/grup tarzları o yapımların ATMOSFERİNDEN esinlenir. İsimlerde ve promptlarda
// dizi adı, oyuncu, şarkıcı ya da gerçek kişi adı KULLANILMAZ: hem telif/marka (App Store 5.2)
// hem kişilik hakları açısından. Başrolde her zaman fotoğraftaki kullanıcı olur.
// Referans görsel olarak dizilerden ekran görüntüsü değil, kendi ürettiğin/lisanslı görseller kullan.

export const CATEGORIES = ["Dizi & Film", "Müzik & Dans", "Klasik"];

// Her prompta eklenir: yüzün korunması ve gerçek kişi benzerliğinin önlenmesi için.
const IDENTITY =
  " Keep the person's face, identity and body exactly as in the photo; they are the main character. " +
  "Do not depict any real celebrity, actor or singer.";

export const STYLES = [
  // ---------------------------------------------------------------- Dizi & Film
  {
    id: "palace",
    tagline: "Sarayın en güçlü sultanı sen ol.",
    badge: "Popüler",
    category: "Dizi & Film",
    name: "Osmanlı Sarayı",
    description: "Kaftan, taç ve saray entrikası",
    emoji: "👑",
    color: "#92400e",
    cost: 3,
    model: "ref",
    music: "osmanli.mp3",
    references: ["palace-1.jpg"],
    prompt:
      "Grand 16th-century Ottoman imperial palace drama. The person wears a richly embroidered silk " +
      "kaftan with gold details and a jeweled crown or headdress fitting their look, standing in an " +
      "opulent palace hall with Iznik tiles, carved marble arches, silk curtains and golden candlelight. " +
      "They slowly turn toward the camera with a proud, mysterious gaze as the camera dollies in; " +
      "rose petals drift, warm amber cinematic lighting, lavish period-drama production quality." +
      IDENTITY,
  },
  {
    id: "revenge",
    tagline: "Bir gece, bir yemin, bir intikam.",
    category: "Dizi & Film",
    name: "İntikam Dizisi",
    description: "Karanlık, şiirsel bir intikam hikâyesi",
    emoji: "🌑",
    color: "#111827",
    cost: 3,
    model: "ref",
    music: "gerilim.mp3",
    prompt:
      "Dark, poetic Turkish revenge-drama atmosphere. The person in a long black coat stands on an " +
      "Istanbul waterfront at night, Bosphorus lights and a ferry behind them, light rain falling. " +
      "They look into the distance with cold, wounded determination, then slowly turn to the camera. " +
      "Moody low-key lighting, desaturated blue-green grade, slow push-in, melancholic noir feel." +
      IDENTITY,
  },
  {
    id: "mansion",
    tagline: "Konakta yaprak dökümü başladı.",
    category: "Dizi & Film",
    name: "Konak Draması",
    description: "Eski İstanbul konağı, sonbahar, gözyaşı",
    emoji: "🍂",
    color: "#b45309",
    cost: 3,
    model: "ref",
    music: "duygusal.mp3",
    prompt:
      "Classic Turkish family drama in an elegant old Istanbul mansion by the Bosphorus. The person, in " +
      "refined classic clothing, stands by a tall window as autumn leaves fall in the garden outside. " +
      "Their eyes fill with emotion, a single tear rolls down as they look out the window, then turn " +
      "toward the camera. Soft warm golden-hour light through lace curtains, nostalgic, emotional, " +
      "slow cinematic camera movement." +
      IDENTITY,
  },
  {
    id: "underworld",
    tagline: "Sokaklar senin adını fısıldıyor.",
    category: "Dizi & Film",
    name: "Mafya Ağırlığı",
    description: "Takım elbise, ağır çekim yürüyüş",
    emoji: "🕶️",
    color: "#1c1917",
    cost: 3,
    model: "ref",
    music: "gerilim.mp3",
    prompt:
      "Turkish crime-drama boss scene. The person in a sharp dark suit and sunglasses walks in slow " +
      "motion down a narrow old Istanbul street at dusk, flanked by a silent crew in black, wind moving " +
      "their coat. Low-angle tracking shot, dramatic backlight, smoky atmosphere, intense confident " +
      "expression, high-contrast cinematic grade." +
      IDENTITY,
  },
  {
    id: "blacksea",
    tagline: "Fırtına koptu, sevda dinmedi.",
    badge: "Trend",
    category: "Dizi & Film",
    name: "Karadeniz Sevdası",
    description: "Fırtınalı deniz, yeşil yaylalar",
    emoji: "🌊",
    color: "#065f46",
    cost: 3,
    model: "ref",
    music: "karadeniz.mp3",
    prompt:
      "Black Sea coast drama atmosphere in Turkey. The person stands on rocks by a stormy sea with " +
      "misty green mountains and a small fishing village behind them, wearing a knitted vest or a " +
      "traditional patterned headscarf fitting their look. Wind blows their hair, waves crash, they look " +
      "toward the horizon with longing, then at the camera. Overcast moody light, sweeping aerial-style " +
      "camera arc, epic and emotional." +
      IDENTITY,
  },
  {
    id: "dramatic_zoom",
    tagline: "Şok! Kamera sana zoom yaptı.",
    badge: "Trend",
    category: "Dizi & Film",
    name: "Dramatik Zoom",
    description: "Meşhur dizi sahnesi şoku",
    emoji: "⚡",
    color: "#7f1d1d",
    cost: 2,
    model: "standard",
    music: "sok.mp3",
    prompt:
      "Iconic over-the-top soap opera shock moment. The person freezes with a stunned expression, eyes " +
      "widening, as the camera performs several sudden fast dramatic zoom-ins on their face; lightning " +
      "flashes, wind gusts, the lighting turns dramatic red and blue. Comedic, exaggerated, melodramatic " +
      "TV-series cliffhanger feeling." +
      IDENTITY,
  },

  // ---------------------------------------------------------------- Müzik & Dans
  {
    id: "girl_group",
    tagline: "Sahne ışıkları senin için yandı.",
    badge: "Yeni",
    category: "Müzik & Dans",
    name: "Kız Grubu Sahnesi",
    description: "Pop idol sahnesi, ışıklar, konfeti",
    emoji: "🎤",
    color: "#be185d",
    cost: 3,
    model: "ref",
    music: "pop.mp3",
    references: ["stage-1.jpg"],
    prompt:
      "Pop idol girl-group stage performance inspired by K-pop, with a modern Turkish twist. The person " +
      "is the center member on a huge concert stage, wearing a coordinated stylish stage outfit with " +
      "bold accessories and subtle Anatolian embroidery details, a headset microphone, performing " +
      "sharp synchronized choreography with backup dancers in matching outfits. Colorful LED screens, " +
      "laser lights, confetti falling, energetic camera sweeps and a final close-up wink to the camera." +
      IDENTITY,
  },
  {
    id: "music_video",
    tagline: "Klibin çekiliyor, hazır mısın?",
    category: "Müzik & Dans",
    name: "Klip Çekimi",
    description: "Renkli, şık bir müzik klibi",
    emoji: "📀",
    color: "#6d28d9",
    cost: 3,
    model: "ref",
    music: "pop.mp3",
    prompt:
      "High-budget pop music video. The person poses and lip-syncs confidently in a vibrant pastel " +
      "set with neon signs, holographic outfits and glossy makeup fitting their look. Fast stylish cuts " +
      "between angles, slow-motion hair flip, flash photography effects, Y2K pop aesthetic." +
      IDENTITY,
  },
  {
    id: "dance_trend",
    tagline: "Akımın yeni yıldızı sen ol.",
    category: "Müzik & Dans",
    name: "Dans Akımı",
    description: "Sosyal medyada viral dans",
    emoji: "💃",
    color: "#c2410c",
    cost: 2,
    model: "standard",
    music: "pop.mp3",
    prompt:
      "Viral social media dance trend video, vertical format. The person performs a catchy, energetic " +
      "short choreography with confident moves and a big smile in a bright, trendy room with ring-light " +
      "lighting. Static phone-camera framing, fun, upbeat, natural body movement." +
      IDENTITY,
  },
  {
    id: "halay",
    tagline: "Halayın başı sende.",
    badge: "Yeni",
    category: "Müzik & Dans",
    name: "Düğün Halayı",
    description: "Davul zurna, mendil sallama",
    emoji: "🥁",
    color: "#a21caf",
    cost: 3,
    model: "ref",
    music: "halay.mp3",
    prompt:
      "Joyful Turkish wedding celebration at night. The person leads a halay folk dance at the front " +
      "of the line, waving a colorful handkerchief, with guests holding pinkies dancing behind them, " +
      "string lights, a davul drum player nearby. Festive, warm, energetic, handheld camera following " +
      "the dance." +
      IDENTITY,
  },

  // ---------------------------------------------------------------- Klasik
  {
    id: "cinematic",
    tagline: "Hollywood seni arıyor.",
    category: "Klasik",
    name: "Sinematik",
    description: "Hollywood filmi havası",
    emoji: "🎬",
    color: "#1f2937",
    cost: 2,
    model: "standard",
    music: "epik.mp3",
    prompt:
      "Cinematic shot of the subject, slow dolly-in camera movement, shallow depth of field, " +
      "anamorphic lens flares, teal and orange color grading, soft volumetric light, subtle natural " +
      "motion of hair and clothing, the subject blinks and gently turns their head, 24fps film look." +
      IDENTITY,
  },
  {
    id: "anime",
    tagline: "Kendi animenin kahramanı ol.",
    category: "Klasik",
    name: "Anime",
    description: "Japon animesi stili",
    emoji: "🌸",
    color: "#db2777",
    cost: 3,
    model: "ref",
    music: "ruya.mp3",
    references: ["anime-1.jpg", "anime-2.jpg"],
    prompt:
      "Transform the person into a high quality Japanese anime character, keeping their face, hairstyle " +
      "and outfit recognizable. Clean cel-shaded line work, vibrant anime color palette. " +
      "Cherry blossom petals drift through the air, wind moves the hair, the camera slowly orbits around " +
      "the character, soft sunset light, studio-quality 2D animation.",
  },
  {
    id: "vintage",
    tagline: "70'lerden kalma bir hatıra.",
    category: "Klasik",
    name: "Eski Film",
    description: "1970'ler Super 8 kaydı",
    emoji: "📼",
    color: "#a16207",
    cost: 2,
    model: "standard",
    music: "nostalji.mp3",
    prompt:
      "Vintage 1970s Super 8 home movie of the subject, warm faded colors, heavy film grain, light leaks, " +
      "gentle handheld camera shake, the subject smiles and looks toward the camera, nostalgic summer afternoon." +
      IDENTITY,
  },
  {
    id: "dreamy",
    tagline: "Rüyalarının içinde süzül.",
    category: "Klasik",
    name: "Rüya",
    description: "Masalsı, büyülü atmosfer",
    emoji: "✨",
    color: "#7c3aed",
    cost: 3,
    model: "ref",
    music: "ruya.mp3",
    references: ["dreamy-1.jpg"],
    prompt:
      "The person in a dreamy, magical scene with soft pastel colors and ethereal lighting. Glowing " +
      "particles float around them, pastel clouds, soft bloom light, slow motion hair movement, the camera " +
      "gently rises." +
      IDENTITY,
  },
  {
    id: "action",
    tagline: "Arkana bakmadan yürü.",
    category: "Klasik",
    name: "Aksiyon",
    description: "Patlamalı aksiyon sahnesi",
    emoji: "💥",
    color: "#dc2626",
    cost: 3,
    model: "ref",
    music: "epik.mp3",
    prompt:
      "Epic action movie shot, the subject walks confidently toward the camera while a huge explosion " +
      "erupts behind them, sparks and debris flying, dramatic low angle, fast camera push-in, high contrast " +
      "blockbuster color grade." +
      IDENTITY,
  },
  {
    id: "alive",
    tagline: "Fotoğrafın nefes alsın.",
    category: "Klasik",
    name: "Canlanan Fotoğraf",
    description: "Fotoğraf hafifçe canlanır",
    emoji: "🖼️",
    color: "#0f766e",
    cost: 2,
    model: "standard",
    music: "duygusal.mp3",
    prompt:
      "Bring this photo to life with subtle, realistic motion: the subject breathes, blinks and smiles softly, " +
      "gentle breeze in the hair, background slightly moves, static camera, natural lighting, photorealistic." +
      IDENTITY,
  },
];

export function publicStyle({ id, category, name, description, tagline, badge, emoji, color, cost }) {
  return { id, category, name, description, tagline, badge, emoji, color, cost };
}
