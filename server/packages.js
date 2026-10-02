// Kredi paketleri. Google Play'de dijital ürün satışı Google Play Billing ile yapılır;
// productId, Play Console'da oluşturacağın uygulama içi ürün kimliğiyle birebir aynı olmalı.
// Fiyatlar Play Console'da belirlenir; priceLabel sadece gösterim içindir.
//
// Maliyet hesabı (1 Ekim 2026):
//   Standart video (Kling 2.5 Turbo, 5 sn) = 0,21 $ ≈ ₺10 (kur 47,54)
//   Satıştan elde kalan ≈ fiyat / 1,20 (KDV) × 0,85 (Google %15) ≈ fiyatın %71'i
//   1 kredi = 1 standart video. Pro sahneler 2 kredi (Pro maliyeti ≈ 2× varsayıldı, doğrulanmalı).
// Kur veya Higgsfield fiyatı değişirse bu tabloyu yeniden hesapla.

export const CREDIT_PACKAGES = [
  {
    id: "credits_4",
    productId: "credits_4",
    credits: 4,
    priceLabel: "₺119,99",
    perVideo: "₺30,00",
    badge: "Deneme",
  },
  {
    id: "credits_12",
    productId: "credits_12",
    credits: 12,
    priceLabel: "₺299,99",
    perVideo: "₺25,00",
    badge: "En popüler",
  },
  {
    id: "credits_30",
    productId: "credits_30",
    credits: 30,
    priceLabel: "₺649,99",
    perVideo: "₺21,67",
    badge: "En avantajlı",
  },
];

// Premium abonelik (Google Play aboneliği; Play Console'da productId ile oluşturulacak).
// Ücretli dönem: 10 kredi/ay. Kota tamamen kullanılsa bile elde kalan ≈ ₺141,6 / maliyet ≤ ₺100.
// Deneme: 30 gün, 5 kredi, videolar standart modelle (deneme başlatan başına en fazla ~₺50).
// Google Play'de deneme için kart gerekir; deneme bitince abonelik otomatik ücretli devam eder.
export const PREMIUM = {
  productId: "premium_monthly",
  name: "Başrol Premium",
  priceLabel: "₺199,99",
  period: "ay",
  periodDays: 30,
  monthlyCredits: 10,
  perVideo: "₺20,00",
  trialDays: 30,
  trialCredits: 5,
};

// Yeni kullanıcının ödeme istenmeden üretebileceği video sayısı (tarzın kredi fiyatından bağımsız).
// Ücretsiz video maliyeti ≈ 0,42 $ (≈ ₺20) → kullanıcı başı en fazla ~₺60.
export const FREE_VIDEOS = 3;
// Video süresi (sn). Ücretli/Premium videolar 8 sn. Ücretsiz ve deneme videolarında ortamı
// değiştiren (referans) sahneler maliyet için 5 sn; fotoğrafı canlandıran sahneler zaten 10 sn
// üretilip 8 sn'ye kesildiği için onlarda fark yok.
export const VIDEO_SECONDS = 8;
export const FREE_REFERENCE_SECONDS = 5;
