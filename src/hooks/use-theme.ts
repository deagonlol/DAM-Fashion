import { Colors } from '@/constants/theme';

/** The app is light-only for now, so this always returns the one palette. */
export function useTheme() {
  return Colors;
}
