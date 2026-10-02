import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AdminJob, AdminStats, AdminUser, api, Style } from './api';
import { colors } from './theme';

type Section = 'stats' | 'users' | 'jobs';

export function AdminScreen({ styleList }: { styleList: Style[] }) {
  const [section, setSection] = useState<Section>('stats');

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.segments}>
        {(
          [
            ['stats', 'Özet'],
            ['users', 'Kullanıcılar'],
            ['jobs', 'Videolar'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.segment, section === key && styles.segmentActive]}
            onPress={() => setSection(key)}
          >
            <Text style={[styles.segmentText, section === key && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {section === 'stats' && <Stats />}
      {section === 'users' && <Users />}
      {section === 'jobs' && <Jobs styleList={styleList} />}
    </View>
  );
}

function Stats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await api.admin.stats());
    } catch (err) {
      Alert.alert('Yüklenemedi', err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!stats) return <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />;

  const tiles: [string, number | string][] = [
    ['Kullanıcı', stats.users],
    ['Bugün kayıt', stats.usersToday],
    ['Üretilen video', stats.videos],
    ['Bugün video', stats.videosToday],
    ['Ücretsiz video', stats.freeVideos],
    ['Başarısız video', stats.failedVideos],
    ['Satılan kredi', stats.creditsPurchased],
    ['Ödeme yapan', stats.payingUsers],
    ['Premium abone', stats.premiumActive],
    ['Denemede', stats.premiumTrials],
    ['Başlayan deneme', stats.trialsStarted],
    ['Denemeden aboneye', stats.trialConversions],
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.grid}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.text}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {tiles.map(([label, value]) => (
        <View key={label} style={styles.tile}>
          <Text style={styles.tileValue}>{value}</Text>
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
      ))}
      <Text style={styles.footnote}>
        Dönüşüm: kullanıcıların{' '}
        {stats.users ? Math.round((stats.payingUsers / stats.users) * 100) : 0}%'i ödeme yaptı.
      </Text>
    </ScrollView>
  );
}

function Users() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q: string) => {
    try {
      setUsers((await api.admin.users(q)).users);
    } catch (err) {
      Alert.alert('Yüklenemedi', err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  async function addCredits() {
    if (!editing) return;
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) return Alert.alert('Geçerli bir sayı yaz');
    setSaving(true);
    try {
      await api.admin.addCredits(editing.id, n);
      setEditing(null);
      setAmount('');
      load(query);
    } catch (err) {
      Alert.alert('Yüklenemedi', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        style={styles.search}
        placeholder="E-posta veya isim ara"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        ListEmptyComponent={users ? <Text style={styles.empty}>Kullanıcı yok.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>
                {item.name}
                {item.role === 'admin' ? ' · Yönetici' : ''}
              </Text>
              <Text style={styles.itemSub}>{item.email}</Text>
              <Text style={styles.itemSub}>
                {item.premium_status !== 'none' ? `👑 ${item.premium_credits} · ` : ''}💎 {item.credits} · 🎁{' '}
                {item.free_videos_left} · {item.videos} video ·{' '}
                {formatDate(item.created_at)}
              </Text>
            </View>
            <Pressable style={styles.smallButton} onPress={() => setEditing(item)}>
              <Text style={styles.smallButtonText}>+ Kredi</Text>
            </Pressable>
          </View>
        )}
      />

      <Modal visible={editing !== null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Kredi yükle</Text>
            <Text style={styles.itemSub}>{editing?.email}</Text>
            <TextInput
              style={styles.search}
              placeholder="Miktar"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <Pressable
                style={styles.dialogCancel}
                onPress={() => {
                  setEditing(null);
                  setAmount('');
                }}
              >
                <Text style={styles.itemSub}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.smallButton} onPress={addCredits} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.smallButtonText}>Yükle</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const STATUS_LABEL: Record<AdminJob['status'], string> = {
  queued: '⏳ Sırada',
  processing: '⚙️ Hazırlanıyor',
  done: '✅ Hazır',
  failed: '❌ Başarısız',
};

function Jobs({ styleList }: { styleList: Style[] }) {
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs((await api.admin.jobs()).jobs);
    } catch (err) {
      Alert.alert('Yüklenemedi', err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FlatList
      data={jobs ?? []}
      keyExtractor={(j) => j.id}
      contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.text}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={jobs ? <Text style={styles.empty}>Henüz video yok.</Text> : null}
      renderItem={({ item }) => {
        const style = styleList.find((s) => s.id === item.style_id);
        return (
          <View style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>
                {style ? `${style.emoji} ${style.name}` : item.style_id} · {STATUS_LABEL[item.status]}
              </Text>
              <Text style={styles.itemSub}>{item.email}</Text>
              <Text style={styles.itemSub}>
                {item.is_free ? 'Ücretsiz hak' : `💎 ${item.cost}`} · {formatDate(item.created_at)}
              </Text>
              {item.error && <Text style={styles.errorText}>{item.error}</Text>}
            </View>
          </View>
        );
      }}
    />
  );
}

function formatDate(value: string) {
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: colors.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
  },
  tileValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  tileLabel: { color: colors.muted, fontSize: 13, marginTop: 4 },
  footnote: { color: colors.muted, fontSize: 13, width: '100%', marginTop: 4 },
  search: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
  },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  itemSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 2 },
  smallButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  smallButtonText: { color: colors.bg, fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: { backgroundColor: colors.card, borderRadius: 16, padding: 18, gap: 8 },
  dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  dialogCancel: { padding: 8 },
});
