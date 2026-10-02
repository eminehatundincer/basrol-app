import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Style, User } from './api';
import { Badge, BottomFade, GoldButton, PosterCard, SectionTitle, StyleMedia } from './components';
import { colors, fonts, radius } from './theme';

const HERO_INTERVAL_MS = 5000;
const H_PAD = 16;

type Props = {
  user: User;
  categories: string[];
  styleList: Style[];
  demo: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  onOpenStyle: (style: Style) => void;
  onOpenPremium: () => void;
};

export function HomeScreen({
  user,
  categories,
  styleList,
  demo,
  loadError,
  onRetryLoad,
  onOpenStyle,
  onOpenPremium,
}: Props) {
  if (loadError) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.muted} />
        <Text style={styles.errorText}>{loadError}</Text>
        <GoldButton label="Tekrar dene" onPress={onRetryLoad} />
      </View>
    );
  }
  if (styleList.length === 0) {
    return <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />;
  }

  const featured = styleList.filter((s) => s.badge);
  const firstName = user.name.split(' ')[0];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={styles.greeting}>
        <Text style={styles.hello}>Merhaba {firstName} 👋</Text>
        <Text style={styles.headline}>
          Bugün hangi sahnenin <Text style={styles.headlineGold}>başrolündesin?</Text>
        </Text>
      </View>

      {demo && (
        <View style={styles.demo}>
          <Ionicons name="flask-outline" size={16} color={colors.accent} />
          <Text style={styles.demoText}>Demo modu: üretilen videolar örnek videodur.</Text>
        </View>
      )}

      <Hero styles={featured.length ? featured : styleList.slice(0, 4)} onOpenStyle={onOpenStyle} />

      {user.premium.status === 'none' && (
        <Pressable onPress={onOpenPremium} style={({ pressed }) => [styles.promo, pressed && { opacity: 0.85 }]}>
          <View style={styles.promoIcon}>
            <Ionicons name="diamond" size={20} color={colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>
              {user.premium.trialAvailable ? 'Premium 1 ay ücretsiz' : 'Başrol Premium'}
            </Text>
            <Text style={styles.promoText}>Her ay 10 kredi · ilk ay 5 video ücretsiz</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.accent} />
        </Pressable>
      )}

      {categories.map((category) => {
        const items = styleList.filter((s) => s.category === category);
        if (!items.length) return null;
        return (
          <View key={category} style={styles.category}>
            <View style={{ paddingHorizontal: H_PAD }}>
              <SectionTitle right={<Text style={styles.count}>{items.length} sahne</Text>}>
                {category}
              </SectionTitle>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: H_PAD }}
            >
              {items.map((s) => (
                <PosterCard key={s.id} style={s} onPress={() => onOpenStyle(s)} />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Hero({ styles: items, onOpenStyle }: { styles: Style[]; onOpenStyle: (s: Style) => void }) {
  const { width } = useWindowDimensions();
  const slideWidth = width - H_PAD * 2;
  const listRef = useRef<FlatList<Style>>(null);
  const [index, setIndex] = useState(0);
  const touching = useRef(false);

  // Kullanıcı dokunmuyorsa vitrin kendiliğinden döner.
  useEffect(() => {
    const t = setInterval(() => {
      if (touching.current || items.length < 2) return;
      const next = (index + 1) % items.length;
      listRef.current?.scrollToOffset({ offset: next * (slideWidth + 12), animated: true });
      setIndex(next);
    }, HERO_INTERVAL_MS);
    return () => clearInterval(t);
  }, [index, items.length, slideWidth]);

  return (
    <View style={{ marginBottom: 24 }}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(s) => s.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 12 }}
        onScrollBeginDrag={() => (touching.current = true)}
        onScrollEndDrag={() => (touching.current = false)}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / (slideWidth + 12)))
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpenStyle(item)}>
            <StyleMedia style={item} containerStyle={[styles.heroCard, { width: slideWidth }]}>
              <BottomFade height="70%" />
              <View style={styles.heroContent}>
                {item.badge && <Badge label={item.badge} />}
                <Text style={styles.heroTitle}>{item.name}</Text>
                <Text style={styles.heroTagline}>{item.tagline}</Text>
                <GoldButton
                  label="Çekime Başla"
                  onPress={() => onOpenStyle(item)}
                  icon={<Ionicons name="videocam" size={18} color={colors.onAccent} />}
                  style={{ marginTop: 12, alignSelf: 'flex-start' }}
                />
              </View>
            </StyleMedia>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {items.map((s, i) => (
          <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  errorText: { color: colors.muted, textAlign: 'center', fontSize: 15 },
  greeting: { paddingHorizontal: H_PAD, marginBottom: 16, marginTop: 4 },
  hello: { color: colors.muted, fontSize: 15, marginBottom: 4 },
  headline: { color: colors.text, fontFamily: fonts.display, fontSize: 30, lineHeight: 36 },
  headlineGold: { color: colors.accent, fontFamily: fonts.italic },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: H_PAD,
    marginBottom: 14,
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  demoText: { color: colors.muted, fontSize: 13, flex: 1 },
  heroCard: { height: 440, borderRadius: radius.xl, justifyContent: 'flex-end' },
  heroContent: { padding: 20, gap: 6 },
  heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  heroTagline: { color: '#E9DFD2', fontFamily: fonts.italic, fontSize: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.accent },
  category: { marginBottom: 26 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: H_PAD,
    marginBottom: 26,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.cardRaised,
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
  promoText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  count: { color: colors.muted, fontSize: 13 },
});
