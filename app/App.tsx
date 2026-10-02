import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_900Black,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { api, API_URL, loadSavedToken, setUnauthorizedHandler, Style, User } from './src/api';
import { AccountScreen } from './src/AccountScreen';
import { AdminScreen } from './src/AdminScreen';
import { AuthScreen } from './src/AuthScreen';
import { HistoryScreen } from './src/HistoryScreen';
import { HomeScreen } from './src/HomeScreen';
import { PremiumModal } from './src/PremiumModal';
import { StoreModal } from './src/StoreModal';
import { StyleDetail } from './src/StyleDetail';
import { colors, fonts } from './src/theme';

type Tab = 'home' | 'history' | 'account' | 'admin';

// Sunucuda test modu açıksa (DEV_AUTO_LOGIN) giriş ekranı atlanır, sınırsız kredili test hesabı açılır.
async function restoreSession(): Promise<User | null> {
  if (await loadSavedToken()) {
    try {
      return (await api.me()).user;
    } catch {
      // Token geçersiz: aşağıda test modu kontrol edilir.
    }
  }
  const config = await api.config();
  return config.devAutoLogin ? api.devLogin() : null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    PlayfairDisplay_900Black,
  });
  // undefined = oturum kontrol ediliyor, null = giriş yapılmamış
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [bootError, setBootError] = useState<string | null>(null);

  function boot() {
    setBootError(null);
    restoreSession()
      .then(setUser)
      .catch(() => setBootError(`Sunucuya bağlanılamadı (${API_URL}).`));
  }

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    boot();
  }, []);

  if (!fontsLoaded || (user === undefined && !bootError)) {
    return (
      <View style={[styles.screen, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (bootError) {
    return (
      <View style={[styles.screen, styles.center, { padding: 24, gap: 16 }]}>
        <StatusBar style="light" />
        <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
        <Text style={styles.bootError}>{bootError}</Text>
        <Text style={styles.bootHint}>Sunucunun açık ve telefonla aynı Wi-Fi'da olduğundan emin ol.</Text>
        <Pressable onPress={boot} style={styles.retry}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {user ? (
        <SignedInApp
          user={user}
          onUserChange={setUser}
          onLogout={async () => {
            await api.logout();
            setUser(null);
          }}
        />
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <AuthScreen onSignedIn={setUser} />
        </View>
      )}
    </View>
  );
}

function SignedInApp({
  user,
  onUserChange,
  onLogout,
}: {
  user: User;
  onUserChange: (user: User) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('home');
  const [categories, setCategories] = useState<string[]>([]);
  const [styleList, setStyleList] = useState<Style[]>([]);
  const [demo, setDemo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openStyle, setOpenStyle] = useState<Style | null>(null);
  const [store, setStore] = useState<{ open: boolean; reason?: string }>({ open: false });
  const [premium, setPremium] = useState<{ open: boolean; reason?: string }>({ open: false });

  // Hak bitince: Premium değilse önce Premium (deneme) teklif edilir, Premium'daysa ek kredi mağazası.
  function needCredits(reason: string) {
    if (user.premium.status === 'none') setPremium({ open: true, reason });
    else setStore({ open: true, reason });
  }

  function load() {
    setLoadError(null);
    api
      .styles()
      .then((res) => {
        setCategories(res.categories);
        setStyleList(res.styles);
        setDemo(res.demo);
      })
      .catch(() => setLoadError(`Sunucuya bağlanılamadı (${API_URL}).`));
  }

  useEffect(load, []);

  const tabs: [Tab, string, keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap][] = [
    ['home', 'Keşfet', 'sparkles', 'sparkles-outline'],
    ['history', 'Videolarım', 'film', 'film-outline'],
    ['account', 'Hesabım', 'person-circle', 'person-circle-outline'],
  ];
  if (user.role === 'admin') tabs.push(['admin', 'Yönetim', 'stats-chart', 'stats-chart-outline']);

  const creditLabel = user.unlimited
    ? '∞'
    : user.freeVideosLeft > 0
      ? `🎁 ${user.freeVideosLeft}`
      : user.premium.status !== 'none'
        ? `👑 ${user.premium.credits}${user.credits ? ` · 💎 ${user.credits}` : ''}`
        : `💎 ${user.credits}`;

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Başrol<Text style={styles.logoDot}>.</Text>
        </Text>
        <Pressable
          style={styles.creditChip}
          onPress={() =>
            user.premium.status === 'none' && !user.unlimited
              ? setPremium({ open: true })
              : setStore({ open: true })
          }
        >
          <Text style={styles.creditText}>{creditLabel}</Text>
          <Ionicons name="add-circle" size={18} color={colors.accent} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {tab === 'home' && (
          <HomeScreen
            user={user}
            categories={categories}
            styleList={styleList}
            demo={demo}
            loadError={loadError}
            onRetryLoad={load}
            onOpenStyle={setOpenStyle}
            onOpenPremium={() => setPremium({ open: true })}
          />
        )}
        {tab === 'history' && <HistoryScreen styles={styleList} onExplore={() => setTab('home')} />}
        {tab === 'account' && (
          <AccountScreen
            user={user}
            onOpenStore={() => setStore({ open: true })}
            onOpenPremium={() => setPremium({ open: true })}
            onUserChange={onUserChange}
            onLogout={onLogout}
          />
        )}
        {tab === 'admin' && user.role === 'admin' && (
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <Text style={styles.screenTitle}>Yönetim</Text>
            <AdminScreen styleList={styleList} />
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        {tabs.map(([key, label, iconActive, icon]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              style={styles.tab}
              onPress={() => {
                if (!active) Haptics.selectionAsync();
                setTab(key);
              }}
            >
              <Ionicons name={active ? iconActive : icon} size={23} color={active ? colors.accent : colors.muted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <StyleDetail
        style={openStyle}
        user={user}
        onClose={() => setOpenStyle(null)}
        onUserChange={onUserChange}
        onNeedCredits={needCredits}
      />

      <PremiumModal
        visible={premium.open}
        reason={premium.reason}
        user={user}
        styleList={styleList}
        onClose={() => setPremium({ open: false })}
        onUserChange={onUserChange}
        onOpenStore={() => setStore({ open: true })}
      />

      <StoreModal
        visible={store.open}
        reason={store.reason}
        credits={user.credits}
        onClose={() => setStore({ open: false })}
        onUserChange={onUserChange}
        isPremium={user.premium.status !== 'none'}
        onOpenPremium={() => setPremium({ open: true })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: Constants.statusBarHeight },
  center: { alignItems: 'center', justifyContent: 'center' },
  bootError: { color: colors.text, fontSize: 16, textAlign: 'center' },
  bootHint: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: colors.accent, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logo: { color: colors.accent, fontFamily: fonts.display, fontSize: 28 },
  logoDot: { color: colors.red },
  creditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 10,
  },
  creditText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  body: { flex: 1 },
  screenTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 30, marginTop: 4, marginBottom: 12 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: 8,
    paddingBottom: 22,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: colors.accent },
});
