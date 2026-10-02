import { ReactNode, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { assetUrl, Style } from './api';
import { BADGE_COLORS, colors, fonts, radius } from './theme';

// Kapak görseli yavaşça yakınlaşıp kayar ("Ken Burns"); ekran durağan durmaz.
export function KenBurns({
  uri,
  style,
  duration = 9000,
  children,
}: {
  uri?: string;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  children?: ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);

  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.16] });
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.card }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }, { translateX }] }]}>
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      </Animated.View>
      {children}
    </View>
  );
}

function PreviewVideo({ uri, style, children }: { uri: string; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.card }, style]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {children}
    </View>
  );
}

// Tarzın önizleme videosu varsa onu, yoksa hareketli kapağı gösterir.
export function StyleMedia({
  style: s,
  containerStyle,
  children,
}: {
  style: Style;
  containerStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const preview = assetUrl(s.preview);
  if (preview) {
    return (
      <PreviewVideo uri={preview} style={containerStyle}>
        {children}
      </PreviewVideo>
    );
  }
  return (
    <KenBurns uri={assetUrl(s.cover)} style={containerStyle}>
      {children}
    </KenBurns>
  );
}

export function Badge({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, { backgroundColor: BADGE_COLORS[label] ?? colors.accentDeep }, style]}>
      <Text style={styles.badgeText}>{label.toLocaleUpperCase('tr-TR')}</Text>
    </View>
  );
}

// Altta okunabilirlik için karartma.
export function BottomFade({ height = '60%', to = 'rgba(14,11,10,0.95)' }: { height?: `${number}%` | number; to?: string }) {
  return (
    <LinearGradient
      colors={['transparent', to]}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
      pointerEvents="none"
    />
  );
}

export function PosterCard({
  style: s,
  width = 132,
  onPress,
}: {
  style: Style;
  width?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      <View style={[styles.poster, { height: width * (4 / 3) }]}>
        <Image
          source={assetUrl(s.cover)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
        />
        <BottomFade height="55%" />
        {s.badge && <Badge label={s.badge} style={styles.posterBadge} />}
        <View style={styles.posterCost}>
          <Text style={styles.posterCostText}>💎 {s.cost}</Text>
        </View>
        <Text style={styles.posterTitle} numberOfLines={2}>
          {s.name}
        </Text>
      </View>
    </Pressable>
  );
}

export function GoldButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      <LinearGradient
        colors={['#F6D27A', colors.accent, colors.accentDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.goldButton}
      >
        {loading ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <>
            {icon}
            <Text style={styles.goldButtonText}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  poster: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  posterBadge: { position: 'absolute', top: 8, left: 8 },
  posterCost: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  posterCostText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  posterTitle: {
    color: colors.text,
    fontFamily: fonts.title,
    fontSize: 16,
    lineHeight: 19,
    padding: 10,
  },
  goldButton: {
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goldButtonText: { color: colors.onAccent, fontSize: 17, fontWeight: '800' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { color: colors.text, fontFamily: fonts.title, fontSize: 21 },
});
