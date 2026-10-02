import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { api, assetUrl, PremiumPlan, Style, User } from './api';
import { GoldButton } from './components';
import { colors, fonts, radius } from './theme';

type Props = {
  visible: boolean;
  user: User;
  styleList: Style[];
  reason?: string;
  onClose: () => void;
  onUserChange: (user: User) => void;
  onOpenStore: () => void;
};

export function PremiumModal({ visible, user, styleList, reason, onClose, onUserChange, onOpenStore }: Props) {
  const [plan, setPlan] = useState<PremiumPlan | null>(null);
  const [devPurchases, setDevPurchases] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    api
      .premium()
      .then((res) => {
        setPlan(res.plan);
        setDevPurchases(res.devPurchases);
      })
      .catch((err) => Alert.alert('Premium bilgisi alınamadı', err.message));
  }, [visible]);

  const isPremium = user.premium.status !== 'none';
  const trial = user.premium.trialAvailable;

  async function start() {
    // TODO: Google Play Billing bağlanınca burada abonelik satın alma akışı açılacak
    // (deneme dönemi Play Console'da tanımlanır, Google kart ister ve sonra otomatik yeniler).
    if (!devPurchases) return Alert.alert('Yakında', 'Abonelik henüz aktif değil.');
    setBusy(true);
    try {
      const { user: updated } = trial ? await api.devStartTrial() : await api.devSubscribe();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUserChange(updated);
      Alert.alert(
        trial ? 'Denemen başladı 👑' : "Premium'dasın 👑",
        trial
          ? `${plan?.trialDays} gün boyunca ${plan?.trialCredits} video senin. İyi çekimler!`
          : `Bu ay ${plan?.monthlyCredits} kredin hazır.`,
      );
      onClose();
    } catch (err) {
      Alert.alert('Başlatılamadı', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
          <CoverCollage styleList={styleList} />

          <View style={styles.body}>
            <View style={styles.crown}>
              <Ionicons name="diamond" size={28} color={colors.onAccent} />
            </View>
            <Text style={styles.title}>Başrol Premium</Text>
            {reason && <Text style={styles.reason}>{reason}</Text>}

            {!plan ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : isPremium ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusTitle}>
                  {user.premium.status === 'trial' ? 'Ücretsiz denemedesin' : "Premium'dasın"} 👑
                </Text>
                <Text style={styles.statusText}>
                  Bu dönem {user.premium.credits} kredin kaldı · {formatUntil(user.premium.until)}{' '}
                  {user.premium.status === 'trial' ? 'tarihinde deneme bitiyor' : 'tarihinde yenilenir'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Her ay yeni sahnelerde başrol oyna. Kredi paketlerinden daha avantajlı.
                </Text>

                <View style={styles.benefits}>
                  <Benefit icon="film" text={`Her ay ${plan.monthlyCredits} kredi`} sub={`Kredi başı ${plan.perVideo}, paketlerden ucuz · sahneler 2–3 kredi`} />
                  <Benefit icon="sparkles" text="Tüm sahneler tam kalitede" sub="Pro sahneler Pro modelle üretilir" />
                  <Benefit icon="refresh" text="İstediğin zaman iptal et" sub="Google Play hesabından tek dokunuşla" />
                </View>

                {trial && (
                  <View style={styles.trialBox}>
                    <Text style={styles.trialTitle}>İlk {plan.trialDays} gün ücretsiz</Text>
                    <Text style={styles.trialText}>
                      Deneme ayında {plan.trialCredits} video üretebilirsin. Sonra {plan.priceLabel}/{plan.period}.
                      Deneme bitmeden iptal edersen ücret alınmaz.
                    </Text>
                  </View>
                )}

                <GoldButton
                  label={trial ? '1 Ay Ücretsiz Başla' : `Premium'a Geç · ${plan.priceLabel}/${plan.period}`}
                  onPress={start}
                  loading={busy}
                  icon={<Ionicons name="diamond" size={18} color={colors.onAccent} />}
                  style={{ marginTop: 18 }}
                />
                {devPurchases && (
                  <Text style={styles.devNote}>Test modu: ödeme alınmaz, kart istenmez.</Text>
                )}
              </>
            )}

            <Pressable
              onPress={() => {
                onClose();
                onOpenStore();
              }}
              style={styles.storeLink}
              hitSlop={8}
            >
              <Text style={styles.storeLinkText}>
                {isPremium ? 'Ek kredi paketi al' : 'Abonelik istemiyorum, sadece kredi al'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

function Benefit({ icon, text, sub }: { icon: keyof typeof Ionicons.glyphMap; text: string; sub: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitText}>{text}</Text>
        <Text style={styles.benefitSub}>{sub}</Text>
      </View>
    </View>
  );
}

// Üç sütun sahne kapağı, sütunlar zıt yönlerde yavaşça kayar.
function CoverCollage({ styleList }: { styleList: Style[] }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const covers = styleList.filter((s) => s.cover);
  const columns = [0, 1, 2].map((c) => covers.filter((_, i) => i % 3 === c).slice(0, 4));
  const up = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const down = drift.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] });

  return (
    <View style={styles.collage}>
      <View style={styles.collageRow}>
        {columns.map((col, c) => (
          <Animated.View
            key={c}
            style={[styles.collageCol, { transform: [{ translateY: c === 1 ? down : up }], marginTop: c === 1 ? -40 : 0 }]}
          >
            {col.map((s) => (
              <Image key={s.id} source={assetUrl(s.cover)} style={styles.collageImg} contentFit="cover" />
            ))}
          </Animated.View>
        ))}
      </View>
      {/* Alt kısım tamamen zemin rengine kapanır; kolajın kenarı görünmez. */}
      <LinearGradient
        colors={['transparent', colors.bg, colors.bg]}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }}
        pointerEvents="none"
      />
    </View>
  );
}

function formatUntil(until: string | null) {
  if (!until) return '';
  return new Date(until.replace(' ', 'T') + 'Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  collage: { height: 330, overflow: 'hidden' },
  collageRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, transform: [{ rotate: '-6deg' }, { scale: 1.15 }] },
  collageCol: { flex: 1, gap: 8 },
  collageImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
  // Düz zemin kolajın alt kenarını (döndürülmüş kartların kesik çizgisini) örter.
  body: { paddingHorizontal: 22, marginTop: -70, alignItems: 'center', backgroundColor: colors.bg },
  crown: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, textAlign: 'center' },
  reason: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 10,
    textAlign: 'center',
    overflow: 'hidden',
    fontWeight: '600',
  },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 8 },
  benefits: { alignSelf: 'stretch', gap: 14, marginTop: 22 },
  benefit: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  benefitSub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  trialBox: {
    alignSelf: 'stretch',
    marginTop: 22,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.card,
    padding: 16,
  },
  trialTitle: { color: colors.accent, fontFamily: fonts.title, fontSize: 22 },
  trialText: { color: colors.text, fontSize: 14, marginTop: 4, lineHeight: 20 },
  devNote: { color: colors.muted, fontSize: 12, marginTop: 10, textAlign: 'center' },
  statusCard: {
    alignSelf: 'stretch',
    marginTop: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentDeep,
    backgroundColor: colors.card,
    padding: 16,
    alignItems: 'center',
  },
  statusTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 22 },
  statusText: { color: colors.muted, textAlign: 'center', marginTop: 6 },
  storeLink: { marginTop: 18, padding: 8 },
  storeLinkText: { color: colors.muted, fontSize: 14, textDecorationLine: 'underline' },
  close: {
    position: 'absolute',
    top: Constants.statusBarHeight + 10,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
