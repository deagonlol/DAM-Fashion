import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STARS = [1, 2, 3, 4, 5];

/** Read-only stars for a whole-number rating. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const theme = useTheme();
  return (
    <ThemedText
      accessibilityLabel={`${rating} out of 5 stars`}
      style={{ fontSize: size, lineHeight: size * 1.4, color: theme.accent }}>
      {STARS.map((star) => (star <= rating ? '★' : '☆')).join('')}
    </ThemedText>
  );
}

/** Tappable stars for choosing a rating. */
export function StarInput({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Rating">
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === star }}
          accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          hitSlop={4}>
          <ThemedText style={[styles.star, { color: theme.accent }]}>{star <= value ? '★' : '☆'}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  star: {
    fontSize: 36,
    lineHeight: 44,
  },
});
