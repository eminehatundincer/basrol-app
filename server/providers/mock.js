// Demo sağlayıcı: API anahtarı olmadan uygulama akışını denemek için. Ücret çıkmaz.
const VIDEO_URL =
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4";
const DURATION_MS = 8000;

export const mockProvider = {
  name: "mock",

  async submit() {
    return String(Date.now());
  },

  async check(providerJobId) {
    const elapsed = Date.now() - Number(providerJobId);
    if (elapsed < 2000) return { status: "queued" };
    if (elapsed < DURATION_MS) return { status: "processing" };
    return { status: "done", videoUrl: VIDEO_URL };
  },
};
