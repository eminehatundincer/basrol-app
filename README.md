# Başrol

> Başrolde sen. Fotoğrafını yükle, sahneni seç; dizilerin, kliplerin, düğünlerin başrolünde ol.

Türkçe Android uygulaması (geliştirirken iPhone'da da Expo Go ile çalışır). Kullanıcı bir sahne
(tarz) seçer, fotoğrafını yükler; sunucu o sahnenin gizli promptu, hareket şablonu ve referans
görselleriyle Higgsfield'a istek atar, video uygulamaya döner.

## Konsept ve tasarım dili

- **Metafor:** Her tarz bir *dizi/film afişi*, kullanıcı *başrol oyuncusu*. Video üretimi
  "çekim", sonuç "prömiyer". Klaket animasyonu, "Motor!" mesajları.
- **Renkler:** gece sineması zemini `#0E0B0A`, tek vurgu altın `#E8B44C`, yeni/canlı için kırmızı.
- **Yazı:** başlıklar Playfair Display (afiş fontu), gövde sistem fontu.
- **Görseller:** her sahnenin 3:4 afiş kapağı; hepsi aynı kalıpta (ortada başrol silueti,
  sahneye özgü ışık, film greni + vinyet). Kapaklar yavaşça yakınlaşıp kayar (Ken Burns).
- **Hareket:** otomatik dönen vitrin, kart basma animasyonu, titreşim geri bildirimi.

## Klasörler

```
app/                  Expo (React Native) uygulaması
  App.tsx             oturum açma, üst bar, alt sekme çubuğu
  src/HomeScreen      Keşfet: vitrin + kategori sıraları
  src/StyleDetail     sahne detayı → fotoğraf → çekim (klaket) → prömiyer
  src/HistoryScreen   Videolarım (kapaklı ızgara)
  src/AccountScreen   Hesabım
  src/AdminScreen     Yönetim (sadece admin)
  src/StoreModal      kredi paketleri
  src/components      KenBurns, afiş kartı, rozet, altın buton…
  src/theme           renkler, fontlar
server/
  index.js            API uçları
  db.js               SQLite (data.sqlite)
  styles.js           sahneler, gizli promptlar, kredi fiyatları, rozet/slogan
  packages.js         kredi paketleri, ücretsiz video hakkı (3)
  providers/          mock (demo) / higgsfield
  tools/covers.mjs    kapakları ve uygulama ikonunu üretir:  npm run covers
  public/covers/      üretilen kapaklar (<sahne-id>.webp)
  public/previews/    (isteğe bağlı) <sahne-id>.mp4 koyarsan kapak yerine video oynar
```

## Çalıştırma

**İlk kurulum (depoyu yeni indirdiysen):**

- `server` ve `app` klasörlerinde `npm install` çalıştır.
- `server/.env.example` dosyasını `server/.env` olarak kopyala ve kendi değerlerini gir. Bu dosya depoda yok, çünkü API anahtarı içeriyor.
- Müzik dosyaları da depoda yok, çünkü Pixabay lisansı ham dosyaların dağıtılmasına izin vermiyor. `server/music/LISANS.md` dosyasındaki linklerden indirip tablodaki adlarla `server/music/` klasörüne koy, sonra `npm run music-offsets` çalıştır.

Windows'ta en kolayı kökteki `Baslat.bat` dosyasına çift tıklamak. Elle başlatmak için:

1. Sunucu: `cd server` → `npm start`
2. Uygulama: `cd app` → `npx expo start`, telefonda Expo Go ile QR kodu okut
   (aynı Wi-Fi). Tarayıcıda önizleme: `npm run web`.

`server/.env` içindeki önemli ayarlar:

| Ayar | Şu an | Anlamı |
|---|---|---|
| `DEV_AUTO_LOGIN` | `true` | Giriş ekranı yok; uygulama sınırsız kredili admin test hesabıyla açılır |
| `VIDEO_PROVIDER` | `mock` | Örnek video döner; Higgsfield bağlanınca `higgsfield` |
| `ALLOW_DEV_PURCHASES` | `true` | Mağaza ödeme almadan kredi yükler |

Canlıya çıkmadan önce üçünü de kapat.

## Fiyatlandırma

Harcama sırası: **ücretsiz hak → Premium kredisi → satın alınmış kredi.**

- **Ücretsiz:** yeni kullanıcıya 3 video (kart istemez), her zaman standart modelle.
- **Başrol Premium:** ₺199,99/ay, her ay 10 kredi (devretmez). Pro sahneler Pro modelle.
  - **1 ay ücretsiz deneme:** 5 video, standart modelle; hesap başına bir kez.
  - Google Play denemede kart ister; deneme bitince abonelik otomatik ücretli devam eder.
- **Ek kredi paketleri:** 4 kredi ₺119,99 · 12 kredi ₺299,99 · 30 kredi ₺649,99.
- 1 kredi = 1 standart video (maliyet 0,21 $ ≈ ₺10). Pro sahneler 2 kredi.
  Hesap ayrıntısı: `server/packages.js`.

Ödeme ve abonelik şu an **test modunda** (`ALLOW_DEV_PURCHASES=true`): para alınmaz.
Google Play Billing bağlanınca satın alma, deneme ve yenileme bilgisi Google'dan gelecek.

**Test hesabı:** Hesabım → "Normal kullanıcı gibi dene" anahtarı hesabı sıfırlar
(3 ücretsiz hak, Premium yok); ücretsiz hak → Premium deneme akışını baştan denemek için.
