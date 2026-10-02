import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { api, assetUrl, JobSummary, Style } from './api';
import { BottomFade, GoldButton } from './components';
import { ResultVideo } from './ResultVideo';
import { colors, fonts, radius } from './theme';

const STATUS: Record<JobSummary['status'], { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  queued: { label: 'Sırada', icon: 'time-outline', color: colors.muted },
  processing: { label: 'Çekiliyor', icon: 'videocam-outline', color: colors.accent },
  done: { label: 'Hazır', icon: 'play-circle', color: colors.success },
  failed: { label: 'İade edildi', icon: 'refresh-circle-outline', color: colors.danger },
};

export function HistoryScreen({
  styles: styleList,
  onExplore,
}: {
  styles: Style[];
  onExplore: () => void;
}) {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setJobs((await api.jobs()).jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const styleById = (id: string) => styleList.find((s) => s.id === id);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <Text style={styles.title}>Videolarım</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={jobs ?? []}
        keyExtractor={(j) => j.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 32, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          jobs ? (
            <View style={styles.empty}>
              <Ionicons name="film-outline" size={56} color={colors.accentDeep} />
              <Text style={styles.emptyTitle}>Henüz bir sahnen yok</Text>
              <Text style={styles.emptyText}>İlk başrolünü oynamak için bir sahne seç.</Text>
              <GoldButton label="Sahneleri keşfet" onPress={onExplore} style={{ marginTop: 8 }} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const style = styleById(item.style_id);
          const status = STATUS[item.status];
          const playable = item.status === 'done' && item.video_url;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && playable && { opacity: 0.8 }]}
              disabled={!playable}
              onPress={() => setPlaying(item.video_url)}
            >
              <Image
                source={assetUrl(style?.cover)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
              <BottomFade height="60%" />
              {playable && (
                <View style={styles.playIcon}>
                  <Ionicons name="play" size={22} color={colors.onAccent} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {style?.name ?? item.style_id}
                </Text>
                <View style={styles.statusRow}>
                  <Ionicons name={status.icon} size={13} color={status.color} />
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  <Text style={styles.date}>· {formatDate(item.created_at)}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={playing !== null}
        animationType="slide"
        onRequestClose={() => setPlaying(null)}
        statusBarTranslucent
      >
        <View style={styles.player}>
          {playing && <ResultVideo videoUrl={playing} onReset={() => setPlaying(null)} resetLabel="Kapat" />}
        </View>
      </Modal>
    </View>
  );
}

// Sunucu tarihleri UTC olarak "YYYY-MM-DD HH:MM:SS" biçiminde gönderiyor.
function formatDate(value: string) {
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return date.toLocaleString('tr-TR', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30, marginBottom: 14, marginTop: 4 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 60 },
  emptyTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 22 },
  emptyText: { color: colors.muted, textAlign: 'center' },
  card: {
    flex: 1,
    maxWidth: '48.5%', // tek kalan kart tüm satırı kaplamasın
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  playIcon: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  cardBody: { padding: 10 },
  cardTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  date: { color: colors.muted, fontSize: 12 },
  player: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
    paddingTop: Constants.statusBarHeight + 16,
  },
});
