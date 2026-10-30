/**
 * Dark lime palette from the Wireframes file:
 * Lime #9BA215, Black Primary #0F0F0F, Grey Secondary #292929,
 * Light Grey #6F6F6F, White Secondary #D9D9D9.
 */
export const Colors = {
  text: '#D9D9D9',
  textSecondary: '#6F6F6F',
  background: '#0F0F0F',
  backgroundElement: '#292929',
  backgroundSelected: '#3A3A3A',
  border: '#292929',
  accent: '#9BA215',
  onAccent: '#0F0F0F',
  danger: '#E85D5D',
  card: '#FFFFFF',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * Font family names as loaded in the root layout. Custom fonts need one family per weight
 * (fontWeight doesn't pick a file on Android), so use these instead of fontWeight.
 * Outfit is the display face; Noto Sans Tamil is the UI/body face.
 */
export const Fonts = {
  heading: 'Outfit_700Bold',
  body: 'NotoSansTamil_400Regular',
  bodyMedium: 'NotoSansTamil_500Medium',
  bodySemiBold: 'NotoSansTamil_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
