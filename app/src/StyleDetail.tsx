import { useEffect, useRef, useState } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { api, ApiError, assetUrl, canAfford, Style, User } from './api';
import { Badge, BottomFade, GoldButton, StyleMedia } from './components';
import { ResultVideo } from './ResultVideo';
import { colors, fonts, radius } from './theme';

const POLL_INTERVAL_MS = 4000;
const EXPECTED_SECONDS = 150; // ilerleme çubuğu için tahmini süre (üretim + müzik ekleme)

type Photo = { uri: string; base64: string; mimeType: string };
type Phase =
  | { name: 'pick' }
  | { name: 'generating'; jobId: string; startedAt: number }
  | { name: 'done'; videoUrl: string };

type Props = {
  style: Style | null;
  user: User;
  onClose: () => void;
  onUserChange: (user: User) => void;
  onNeedCredits: (reason: string) => void;
};

export function StyleDetail({ style, user, onClose, onUserChange, onNeedCredits }: Props) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'pick' });
  const [submitting, setSubmitting] = useState(false);

  // Yeni tarz açıldığında baştan başla (fotoğraf korunur: aynı yüzle başka tarz denemek kolay olsun).
  useEffect(() => {
    if (style) setPhase({ name: 'pick' });
  }, [style?.id]);

  if (!style) return null;

  async function pickPhoto(source: 'library' | 'camera') {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    };
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Kamera izni gerekli');
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    Haptics.selectionAsync();
    setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  }

  async function start() {
    if (!photo || !style) return;
    if (!canAfford(user, style.cost)) {
      return onNeedCredits(
        user.premium.status === 'none'
          ? "Ücretsiz hakların bitti. Premium'u 1 ay ücretsiz dene, çekime devam et!"
          : `"${style.name}" ${style.cost} kredi. Bu ayki Premium kredin yetmiyor, ek kredi alabilirsin.`,
      );
    }
    setSubmitting(true);
    try {
      const res = await api.createJob(style.id, photo.base64, photo.mimeType);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onUserChange(res.user);
      setPhase({ name: 'generating', jobId: res.jobId, startedAt: Date.now() });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'insufficient_credits') {
        onNeedCredits('Bu sahne için yeterli kredin yok.');
      } else {
        Alert.alert('Çekim başlatılamadı', err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const priceLabel = user.unlimited
    ? '∞  Test hesabı · ücretsiz'
    : user.freeVideosLeft > 0
      ? `🎁  Ücretsiz hakkınla (${user.freeVideosLeft} kaldı)`
      : user.premium.status === 'trial' && user.premium.credits >= 1
        ? `👑  Deneme hakkınla (${user.premium.credits} video kaldı)`
        : user.premium.status === 'active' && user.premium.credits >= style.cost
          ? `👑  ${style.cost} Premium kredi (${user.premium.credits} kaldı)`
          : `💎  ${style.cost} kredi`;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        {phase.name === 'pick' && (
          <>
            <ScrollView contentContainerStyle={{ paddingBottom: 140 }} bounces={false}>
              <StyleMedia style={style} containerStyle={styles.media}>
                <BottomFade height="55%" to={colors.bg} />
              </StyleMedia>

              <View style={styles.body}>
                <View style={styles.metaRow}>
                  <Text style={styles.category}>{style.category.toLocaleUpperCase('tr-TR')}</Text>
                  {style.badge && <Badge label={style.badge} />}
                </View>
                <Text style={styles.title}>{style.name}</Text>
                <Text style={styles.tagline}>{style.tagline}</Text>
                <Text style={styles.description}>{style.description}</Text>
                <View style={styles.pricePill}>
                  <Text style={styles.priceText}>{priceLabel}</Text>
                </View>

                <Text style={styles.stepTitle}>Başrol oyuncusu</Text>
                {photo ? (
                  <View style={styles.castRow}>
                    <Image source={photo.uri} style={styles.castPhoto} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castName}>Başrolde: Sen ⭐</Text>
                      <Pressable onPress={() => pickPhoto('library')} hitSlop={8}>
                        <Text style={styles.link}>Fotoğrafı değiştir</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.pickRow}>
                    <PickButton icon="images-outline" label="Galeriden seç" onPress={() => pickPhoto('library')} />
                    <PickButton icon="camera-outline" label="Selfie çek" onPress={() => pickPhoto('camera')} />
                  </View>
                )}
                <View style={styles.tip}>
                  <Ionicons name="bulb-outline" size={16} color={colors.accent} />
                  <Text style={styles.tipText}>
                    En iyi sonuç için yüzünün net göründüğü, tek kişilik ve iyi ışıklı bir fotoğraf seç.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <GoldButton
                label={photo ? 'Çekimi Başlat' : 'Önce fotoğrafını seç'}
                onPress={start}
                disabled={!photo}
                loading={submitting}
                icon={<Ionicons name="videocam" size={20} color={colors.onAccent} />}
              />
            </View>
          </>
        )}

        {phase.name === 'generating' && (
          <Shooting
            style={style}
            jobId={phase.jobId}
            startedAt={phase.startedAt}
            onUserChange={onUserChange}
            onDone={(videoUrl) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setPhase({ name: 'done', videoUrl });
            }}
            onFail={(message) => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Çekim tamamlanamadı', message);
              setPhase({ name: 'pick' });
            }}
          />
        )}

        {phase.name === 'done' && (
          <View style={styles.resultWrap}>
            <Text style={styles.premiere}>🎉 Prömiyer zamanı!</Text>
            <Text style={styles.premiereSub}>{style.name} sahnen hazır.</Text>
            <ResultVideo videoUrl={phase.videoUrl} onReset={onClose} resetLabel="Başka sahne dene" />
          </View>
        )}

        <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

function PickButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pickButton, pressed && { borderColor: colors.accent }]}
    >
      <Ionicons name={icon} size={28} color={colors.accent} />
      <Text style={styles.pickText}>{label}</Text>
    </Pressable>
  );
}

const SHOOTING_LINES = [
  'Işıklar hazırlanıyor…',
  'Makyöz son rötuşları yapıyor…',
  'Kostümün ütüleniyor…',
  'Yönetmen "Motor!" dedi 🎬',
  'Kamera kayıtta…',
  'Figüranlar yerini aldı…',
  'Sahne kurgulanıyor…',
  'Müzik ekleniyor 🎵',
  'Son kurgu yapılıyor…',
];

function Shooting({
  style,
  jobId,
  startedAt,
  onUserChange,
  onDone,
  onFail,
}: {
  style: Style;
  jobId: string;
  startedAt: number;
  onUserChange: (user: User) => void;
  onDone: (videoUrl: string) => void;
  onFail: (message: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const clap = useRef(new Animated.Value(0)).current;

  // Klaket açılıp kapanır.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(clap, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(clap, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      loop.stop();
      clearInterval(tick);
    };
  }, [clap]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    async function poll() {
      try {
        const job = await api.job(jobId);
        if (cancelled) return;
        failures = 0;
        onUserChange(job.user);
        if (job.status === 'done' && job.videoUrl) return onDone(job.videoUrl);
        if (job.status === 'failed') return onFail(job.error ?? 'Bilinmeyen hata');
      } catch {
        // Kısa bağlantı kopmalarında hemen pes etme. İş sunucuda sürüyor; Videolarım'da görünür.
        if (++failures >= 5) {
          return onFail('Sunucuya ulaşılamıyor. Videon hazır olunca "Videolarım"da görünecek.');
        }
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const seconds = Math.floor((now - startedAt) / 1000);
  const progress = Math.min(0.95, seconds / EXPECTED_SECONDS);
  const line = SHOOTING_LINES[Math.floor(seconds / 4) % SHOOTING_LINES.length];
  const rotate = clap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={assetUrl(style.cover)} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,11,10,0.72)' }]} />
      <View style={styles.shootCenter}>
        <View style={styles.clapper}>
          <Animated.View style={[styles.clapTop, { transform: [{ translateX: -60 }, { rotate }, { translateX: 60 }] }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.clapStripe} />
            ))}
          </Animated.View>
          <View style={styles.clapBody}>
            <Text style={styles.clapText} numberOfLines={1}>
              {style.name.toLocaleUpperCase('tr-TR')}
            </Text>
            <Text style={styles.clapSub}>SAHNE 1 · ÇEKİM 1</Text>
          </View>
        </View>

        <Text style={styles.shootLine}>{line}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.shootTime}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · genelde 2-3 dakika sürer
        </Text>
        <Text style={styles.shootHint}>
          Bu ekranı kapatabilirsin; videon hazır olunca "Videolarım"da seni bekliyor olacak.
        </Text>
      </View>
    </View>
  );
}

const TOP = Constants.statusBarHeight;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  media: { height: 480, justifyContent: 'flex-end' },
  body: { paddingHorizontal: 20, marginTop: -40, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  category: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 38, lineHeight: 44 },
  tagline: { color: '#E9DFD2', fontFamily: fonts.italic, fontSize: 18 },
  description: { color: colors.muted, fontSize: 15, marginTop: 2 },
  pricePill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentDeep,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priceText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  stepTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 21, marginTop: 22, marginBottom: 6 },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickButton: {
    flex: 1,
    height: 110,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickText: { color: colors.text, fontWeight: '600' },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  castPhoto: { width: 64, height: 84, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.accent },
  castName: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
  link: { color: colors.accent, marginTop: 4, fontWeight: '600' },
  tip: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-start' },
  tipText: { color: colors.muted, fontSize: 13, flex: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: 'rgba(14,11,10,0.94)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  close: {
    position: 'absolute',
    top: TOP + 10,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shootCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  clapper: { width: 220, marginBottom: 18 },
  clapTop: {
    height: 34,
    backgroundColor: colors.accent,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  clapStripe: { width: 22, height: 50, backgroundColor: colors.bg, transform: [{ rotate: '30deg' }], marginTop: -8 },
  clapBody: {
    height: 120,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  clapText: { color: colors.onAccent, fontFamily: fonts.display, fontSize: 22 },
  clapSub: { color: colors.onAccent, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 6 },
  shootLine: { color: colors.text, fontFamily: fonts.title, fontSize: 22, textAlign: 'center' },
  progressTrack: { width: '80%', height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  shootTime: { color: colors.muted, fontSize: 13 },
  shootHint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 12 },
  resultWrap: { flex: 1, paddingTop: TOP + 60, paddingHorizontal: 16, paddingBottom: 24 },
  premiere: { color: colors.text, fontFamily: fonts.display, fontSize: 30, textAlign: 'center' },
  premiereSub: { color: colors.muted, textAlign: 'center', marginBottom: 14, marginTop: 4 },
});
