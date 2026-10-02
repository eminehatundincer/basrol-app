// "Başrol" tasarım dili: gece sineması + kırmızı halı + altın yaldız.
// Koyu, sıcak bir zemin; tek vurgu rengi altın. Başlıklar afiş fontu (Playfair Display).

export const colors = {
  bg: '#0E0B0A',
  card: '#1A1512',
  cardRaised: '#241D18',
  border: '#2E2620',
  text: '#F5EFE6',
  muted: '#A39A90',
  accent: '#E8B44C', // altın
  accentDeep: '#B7802A',
  onAccent: '#1A1206',
  red: '#D64545', // "Yeni", canlı etiketleri
  danger: '#F87171',
  success: '#4ADE80',
};

export const fonts = {
  display: 'PlayfairDisplay_900Black',
  title: 'PlayfairDisplay_700Bold',
  italic: 'PlayfairDisplay_700Bold_Italic',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 };

export const BADGE_COLORS: Record<string, string> = {
  Yeni: colors.red,
  Trend: '#7C3AED',
  Popüler: colors.accentDeep,
};
