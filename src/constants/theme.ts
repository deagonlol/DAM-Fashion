/**
 * Light-only palette built from the product spec's colors: sandstone backgrounds,
 * UT dark blue-grey text, and burnt orange for primary actions.
 */
export const Colors = {
  text: '#333F48',
  textSecondary: '#5F6B74',
  background: '#FBF9F5',
  backgroundElement: '#F2EEE6',
  backgroundSelected: '#E8E2D4',
  border: '#E1DACB',
  accent: '#BF5700',
  onAccent: '#FFFFFF',
  danger: '#B3261E',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * Font family names as loaded in the root layout. Custom fonts need one family per weight
 * (fontWeight doesn't pick a file on Android), so use these instead of fontWeight.
 */
export const Fonts = {
  heading: 'PlayfairDisplay_600SemiBold',
  body: 'Lora_400Regular',
  bodyMedium: 'Lora_500Medium',
  bodySemiBold: 'Lora_600SemiBold',
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
