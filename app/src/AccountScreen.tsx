import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, User } from './api';
import { GoldButton } from './components';
import { colors, fonts, radius } from './theme';

type Props = {
  user: User;
  onOpenStore: () => void;
  onOpenPremium: () => void;
  onUserChange: (user: User) => void;
  onLogout: () => void;
};

export function AccountScreen({ user, onOpenStore, onOpenPremium, onUserChange, onLogout }: Props) {
  const [switching, setSwitching] = useState(false);

  async function toggleNormalUser(normal: boolean) {
    setSwitching(true);
    try {
      onUserChange((await api.devSetTestMode(!normal)).user);
    } catch (err) {
      Alert.alert('Değiştirilemedi', err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching(false);
    }
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr-TR');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hesabım</Text>

      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
        {user.role === 'admin' && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminText}>YÖNETİCİ</Text>
          </View>
        )}
      </View>

      {user.unlimited ? (
        <View style={[styles.card, styles.unlimited]}>
          <Ionicons name="infinite" size={30} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statTitle}>Sınırsız kredi</Text>
            <Text style={styles.statLabel}>Test hesabı: video üretimi ücretsiz.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={[styles.card, styles.stat]}>
            <Text style={styles.statValue}>🎁 {user.freeVideosLeft}</Text>
            <Text style={styles.statLabel}>Ücretsiz video</Text>
          </View>
          <View style={[styles.card, styles.stat]}>
            <Text style={styles.statValue}>💎 {user.credits}</Text>
            <Text style={styles.statLabel}>Kredi</Text>
          </View>
        </View>
      )}

      {user.isTestAccount && (
        <View style={[styles.card, styles.testCard]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statTitle}>Normal kullanıcı gibi dene</Text>
            <Text style={styles.statLabel}>
              Açınca hesap sıfırlanır: 3 ücretsiz hak, Premium yok. Ücretsiz hak → Premium deneme
              akışını baştan görürsün. Kapatınca sınırsız moda döner.
            </Text>
          </View>
          <Switch
            value={!user.unlimited}
            onValueChange={toggleNormalUser}
            disabled={switching}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      )}

      <Pressable style={[styles.card, styles.premiumCard]} onPress={onOpenPremium}>
        <Ionicons name="diamond" size={26} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.statTitle}>
            {user.premium.status === 'active'
              ? "Premium'dasın"
              : user.premium.status === 'trial'
                ? 'Premium deneme'
                : 'Başrol Premium'}
          </Text>
          <Text style={styles.statLabel}>
            {user.premium.status !== 'none'
              ? `Bu dönem ${user.premium.credits} kredin kaldı`
              : user.premium.trialAvailable
                ? 'İlk ay ücretsiz · sonra ₺199,99/ay'
                : 'Her ay 10 kredi · ₺199,99/ay'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <GoldButton
        label="Kredi Yükle"
        onPress={onOpenStore}
        icon={<Ionicons name="diamond" size={18} color={colors.onAccent} />}
        style={{ marginTop: 8 }}
      />

      <Pressable
        style={styles.logout}
        onPress={() =>
          Alert.alert('Çıkış yap', 'Hesabından çıkmak istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Çıkış yap', style: 'destructive', onPress: onLogout },
          ])
        }
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Çıkış yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingHorizontal: 16, paddingBottom: 32 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30, marginTop: 4, marginBottom: 4 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onAccent, fontFamily: fonts.display, fontSize: 22 },
  name: { color: colors.text, fontFamily: fonts.title, fontSize: 20 },
  email: { color: colors.muted, fontSize: 14, marginTop: 2 },
  adminBadge: { borderRadius: 6, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2 },
  adminText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unlimited: { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: colors.accentDeep },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: colors.accent },
  testCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderStyle: 'dashed' },
  statTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
  row: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 13, marginTop: 4 },
  logout: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
