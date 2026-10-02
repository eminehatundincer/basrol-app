import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from './components';
import { colors, radius } from './theme';

export function ResultVideo({
  videoUrl,
  onReset,
  resetLabel = 'Yeni video yap',
}: {
  videoUrl: string;
  onReset: () => void;
  resetLabel?: string;
}) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });
  const [sharing, setSharing] = useState(false);

  // Videoyu önce telefona indirip paylaşım menüsünü açıyoruz (WhatsApp, Instagram, Galeri…).
  async function share() {
    setSharing(true);
    try {
      const destination = new File(Paths.cache, `basrol-${Date.now()}.mp4`);
      const file = await File.downloadFileAsync(videoUrl, destination);
      await Sharing.shareAsync(file.uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
    } catch (err) {
      Alert.alert('Paylaşılamadı', err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
      </View>
      <GoldButton
        label="Kaydet / Paylaş"
        onPress={share}
        loading={sharing}
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
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.muted, fontSize: 16 },
});
