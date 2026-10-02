import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, CreditPackage, User } from './api';
import { colors, fonts, radius } from './theme';

type Props = {
  visible: boolean;
  credits: number;
  reason?: string;
  onClose: () => void;
  onUserChange: (user: User) => void;
  isPremium: boolean;
  onOpenPremium: () => void;
};

export function StoreModal({
  visible,
  credits,
  reason,
  onClose,
  onUserChange,
  isPremium,
  onOpenPremium,
}: Props) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [devPurchases, setDevPurchases] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    api
      .packages()
      .then((res) => {
        setPackages(res.packages);
        setDevPurchases(res.devPurchases);
      })
      .catch((err) => Alert.alert('Paketler yüklenemedi', err.message));
  }, [visible]);

  async function buy(pkg: CreditPackage) {
    // TODO: Google Play Billing bağlanınca burası gerçek satın alma akışını başlatacak.
    if (!devPurchases) {
      return Alert.alert('Yakında', 'Satın alma henüz aktif değil.');
    }
    setBuying(pkg.id);
    try {
      const { user } = await api.devPurchase(pkg.id);
      onUserChange(user);
      Alert.alert('Krediler yüklendi', `${pkg.credits} kredi hesabına eklendi.`);
      onClose();
    } catch (err) {
      Alert.alert('Satın alınamadı', err instanceof Error ? err.message : String(err));
    } finally {
      setBuying(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Kredi Yükle</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Kapat</Text>
          </Pressable>
        </View>

        {reason && <Text style={styles.reason}>{reason}</Text>}
        {!isPremium && (
          <Pressable
            style={styles.premiumBanner}
            onPress={() => {
              onClose();
              onOpenPremium();
            }}
          >
            <Text style={styles.premiumTitle}>👑 Premium ile kredi başı ₺20</Text>
            <Text style={styles.premiumText}>Her ay 10 kredi · ilk ay ücretsiz dene →</Text>
          </Pressable>
        )}
        <Text style={styles.balance}>Mevcut bakiyen: 💎 {credits} kredi · sahneler 2–3 kredi</Text>

        {packages.length === 0 ? (
          <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />
        ) : (
          packages.map((pkg) => (
            <Pressable
              key={pkg.id}
              style={[styles.package, pkg.badge && styles.packageHighlighted]}
              onPress={() => buy(pkg)}
              disabled={buying !== null}
            >
              <View style={{ flex: 1 }}>
                {pkg.badge && <Text style={styles.badge}>{pkg.badge}</Text>}
                <Text style={styles.packageCredits}>💎 {pkg.credits} kredi</Text>
                <Text style={styles.packageHint}>Kredi başı {pkg.perVideo}</Text>
              </View>
              {buying === pkg.id ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.price}>{pkg.priceLabel}</Text>
              )}
            </Pressable>
          ))
        )}

        {devPurchases && (
          <Text style={styles.devNote}>
            Test modu: ödeme alınmaz, krediler ücretsiz yüklenir.
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  close: { color: colors.muted, fontSize: 16 },
  reason: {
    color: colors.bg,
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 12,
    overflow: 'hidden',
  },
  premiumBanner: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.cardRaised,
    padding: 16,
  },
  premiumTitle: { color: colors.accent, fontFamily: fonts.title, fontSize: 19 },
  premiumText: { color: colors.text, marginTop: 4 },
  balance: { color: colors.muted, fontSize: 15, marginBottom: 8 },
  package: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.border,
  },
  packageHighlighted: { borderColor: colors.accent },
  badge: { color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  packageCredits: { color: colors.text, fontFamily: fonts.title, fontSize: 22 },
  packageHint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  price: { color: colors.accent, fontSize: 19, fontWeight: '800' },
  devNote: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
