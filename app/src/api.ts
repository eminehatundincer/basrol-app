import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  credits: number;
  freeVideosLeft: number;
  unlimited: boolean;
  isTestAccount: boolean;
  premium: {
    status: 'none' | 'trial' | 'active';
    until: string | null;
    credits: number; // bu dönemin kalan Premium kredisi
    trialAvailable: boolean;
  };
};

export type PremiumPlan = {
  productId: string;
  name: string;
  priceLabel: string;
  period: string;
  periodDays: number;
  monthlyCredits: number;
  perVideo: string;
  trialDays: number;
  trialCredits: number;
};

// Kullanıcının bu sahne için harcayabileceği bir hakkı var mı (sunucudaki harcama sırasıyla aynı).
export function canAfford(user: User, cost: number) {
  return (
    user.unlimited ||
    user.freeVideosLeft > 0 ||
    (user.premium.status === 'trial' && user.premium.credits >= 1) ||
    (user.premium.status === 'active' && user.premium.credits >= cost) ||
    user.credits >= cost
  );
}

export type Style = {
  id: string;
  category: string;
  name: string;
  description: string;
  tagline: string;
  badge?: string;
  emoji: string;
  color: string;
  cost: number;
  cover: string | null; // sunucuya göre yol, assetUrl() ile tam adrese çevrilir
  preview: string | null; // varsa kapak yerine oynatılan kısa video
};

export type CreditPackage = {
  id: string;
  productId: string;
  credits: number;
  priceLabel: string;
  perVideo: string;
  badge?: string;
};

export type JobStatus = {
  status: 'queued' | 'processing' | 'done' | 'failed';
  videoUrl?: string;
  error?: string;
  user: User;
};

export type JobSummary = {
  id: string;
  style_id: string;
  status: JobStatus['status'];
  video_url: string | null;
  created_at: string;
};

export type AdminStats = {
  users: number;
  usersToday: number;
  videos: number;
  videosToday: number;
  freeVideos: number;
  failedVideos: number;
  creditsPurchased: number;
  payingUsers: number;
  premiumActive: number;
  premiumTrials: number;
  trialsStarted: number;
  trialConversions: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  credits: number;
  free_videos_left: number;
  premium_status: User['premium']['status'];
  premium_credits: number;
  videos: number;
  created_at: string;
};

export type AdminJob = {
  id: string;
  style_id: string;
  status: JobStatus['status'];
  is_free: number;
  cost: number;
  error: string | null;
  created_at: string;
  email: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}

// Geliştirme sırasında sunucu, Expo'yu çalıştıran bilgisayarda 3000 portunda çalışıyor.
// Telefon bilgisayarın yerel IP'sini Expo'dan öğreniyor. Yayına çıkınca EXPO_PUBLIC_API_URL ile değiştir.
function apiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

export const API_URL = apiBaseUrl();

export function assetUrl(path: string | null | undefined) {
  return path ? `${API_URL}${path}` : undefined;
}
const TOKEN_KEY = 'auth_token';

let token: string | null = null;
let onUnauthorized: () => void = () => {};

// Oturum süresi dolarsa (401) uygulama giriş ekranına döner.
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Güvenli depo telefonda Anahtar Zinciri/Keystore'dur; tarayıcı önizlemesinde yoksa
// token sadece bellekte tutulur.
export async function loadSavedToken() {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

async function saveToken(value: string | null) {
  token = value;
  try {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Önizleme ortamı: kalıcı depo yok.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.', 'network');
  }

  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    await saveToken(null);
    onUnauthorized();
  }
  if (!res.ok) throw new ApiError(body.error ?? `Sunucu hatası (${res.status})`, body.code, res.status);
  return body as T;
}

function post<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined });
}

type AuthResponse = { token: string; user: User };

export const api = {
  config: () => request<{ devAutoLogin: boolean; freeVideos: number }>('/api/config'),
  async devLogin() {
    const res = await post<AuthResponse>('/api/auth/dev');
    await saveToken(res.token);
    return res.user;
  },
  async login(email: string, password: string) {
    const res = await post<AuthResponse>('/api/auth/login', { email, password });
    await saveToken(res.token);
    return res.user;
  },
  async register(name: string, email: string, password: string) {
    const res = await post<AuthResponse>('/api/auth/register', { name, email, password });
    await saveToken(res.token);
    return res.user;
  },
  async logout() {
    await post('/api/auth/logout').catch(() => {});
    await saveToken(null);
  },
  me: () => request<{ user: User }>('/api/me'),

  styles: () => request<{ categories: string[]; styles: Style[]; demo: boolean }>('/api/styles'),
  packages: () => request<{ packages: CreditPackage[]; devPurchases: boolean }>('/api/packages'),
  devPurchase: (packageId: string) => post<{ user: User }>('/api/purchases/dev', { packageId }),
  premium: () => request<{ plan: PremiumPlan; devPurchases: boolean }>('/api/premium'),
  devStartTrial: () => post<{ user: User }>('/api/premium/dev/trial'),
  devSubscribe: () => post<{ user: User }>('/api/premium/dev/subscribe'),
  devSetTestMode: (unlimited: boolean) => post<{ user: User }>('/api/dev/test-mode', { unlimited }),

  createJob: (styleId: string, imageBase64: string, mimeType: string) =>
    post<{ jobId: string; user: User }>('/api/jobs', { styleId, imageBase64, mimeType }),
  job: (jobId: string) => request<JobStatus>(`/api/jobs/${encodeURIComponent(jobId)}`),
  jobs: () => request<{ jobs: JobSummary[] }>('/api/jobs'),

  admin: {
    stats: () => request<AdminStats>('/api/admin/stats'),
    users: (q: string) => request<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`),
    addCredits: (userId: string, amount: number) =>
      post<{ user: User }>(`/api/admin/users/${userId}/credits`, { amount }),
    jobs: () => request<{ jobs: AdminJob[] }>('/api/admin/jobs'),
  },
};
