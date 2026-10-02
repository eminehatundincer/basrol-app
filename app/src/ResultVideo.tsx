import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api, VideoVersions } from './api';
import { GoldButton } from './components';
import { colors, radius } from './theme';

type AudioMode = 'scene' | 'silent' | 'custom';

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const MODES: { key: AudioMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'scene', label: 'Sahne müziği', icon: 'musical-notes' },
  { key: 'silent', label: 'Müziksiz', icon: 'volume-mute' },
  { key: 'custom', label: 'Kendi sesim', icon: 'mic' },
];

export function ResultVideo({
  videoUrl,
  jobId,
  onReset,
  resetLabel = 'Yeni video yap',
}: {
  videoUrl: string;
  jobId?: string;
  onReset: () => void;
  resetLabel?: string;
}) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });
  const [versions, setVersions] = useState<VideoVersions | null>(null);
  const [mode, setMode] = useState<AudioMode>('scene');
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shownUrl = useRef(videoUrl);

  // Ses seçenekleri sunucudan alınır (eski veya işlenememiş videolarda olmayabilir).
  useEffect(() => {
    if (!jobId) return;
    api
      .job(jobId)
      .then((job) => job.versions && setVersions(job.versions))
      .catch(() => {});
  }, [jobId]);

  const currentUrl =
    (mode === 'scene' ? versions?.scene : mode === 'silent' ? versions?.silent : versions?.custom) ??
    videoUrl;

  useEffect(() => {
    if (currentUrl === shownUrl.current) return;
    shownUrl.current = currentUrl;
    player.replaceAsync(currentUrl).then(() => player.play());
  }, [currentUrl, player]);

  async function pickOwnAudio() {
    if (!jobId) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
      return Alert.alert('Video çok büyük', 'En fazla 200 MB boyutunda bir video seç.');
    }
    setUploading(true);
    try {
      const { url } = await api.uploadCustomAudio(jobId, {
        uri: asset.uri,
        name: asset.fileName ?? 'ses.mp4',
        type: asset.mimeType ?? 'video/mp4',
      });
      // Aynı dosya adı yeniden yazıldığı için önbelleği aşmak üzere adres değiştirilir.
      setVersions((v) => (v ? { ...v, custom: `${url}?v=${Date.now()}` } : v));
      setMode('custom');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Ses eklenemedi', err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  function selectMode(next: AudioMode) {
    Haptics.selectionAsync();
    if (next === 'custom' && !versions?.custom) return pickOwnAudio();
    setMode(next);
  }

  // Videoyu önce telefona indirip paylaşım menüsünü açıyoruz (WhatsApp, Instagram, TikTok, Galeri…).
  async function share() {
    setSharing(true);
    try {
      const destination = new File(Paths.cache, `basrol-${Date.now()}.mp4`);
      const file = await File.downloadFileAsync(currentUrl, destination);
      await Sharing.shareAsync(file.uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
    } catch (err) {
      Alert.alert('Paylaşılamadı', err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  }

  const hint =
    mode === 'silent'
      ? "TikTok veya Instagram'da paylaşırken oradan istediğin trend şarkıyı ekleyebilirsin."
      : mode === 'custom'
        ? 'Sesin en canlı kısmı videoya eklendi. Yalnızca hakkına sahip olduğun sesleri kullan; telifli müzikler paylaşımda sessize alınabilir.'
        : null;

  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
        {uploading && (
          <View style={styles.uploading}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.uploadingText}>Ses ayıklanıyor…</Text>
          </View>
        )}
      </View>

      {versions && (
        <View>
          <View style={styles.modes}>
            {MODES.map(({ key, label, icon }) => {
              const active = mode === key;
              const disabled = uploading || (key === 'silent' && !versions.silent);
              return (
                <Pressable
                  key={key}
                  onPress={() => selectMode(key)}
                  disabled={disabled}
                  style={[styles.mode, active && styles.modeActive, disabled && { opacity: 0.4 }]}
                >
                  <Ionicons name={icon} size={16} color={active ? colors.onAccent : colors.text} />
                  <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {mode === 'custom' && versions.custom && (
            <Pressable onPress={pickOwnAudio} disabled={uploading} hitSlop={8}>
              <Text style={styles.change}>Başka bir videonun sesini kullan</Text>
            </Pressable>
          )}
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      )}

      <GoldButton
        label="Kaydet / Paylaş"
        onPress={share}
        loading={sharing}
        disabled={uploading}
        icon={<Ionicons name="share-social" size={20} color={colors.onAccent} />}
      />
      <Pressable style={styles.secondary} onPress={onReset}>
        <Text style={styles.secondaryText}>{resetLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  frame: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.accentDeep,
    backgroundColor: '#000',
  },
  video: { flex: 1 },
  uploading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(14,11,10,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadingText: { color: colors.text, fontWeight: '600' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  modeActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: colors.onAccent },
  change: { color: colors.accent, fontSize: 13, textAlign: 'center', marginTop: 8 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.muted, fontSize: 16 },
});
