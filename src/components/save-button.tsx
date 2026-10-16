import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSaveState } from '@/hooks/use-saves';
import { useTheme } from '@/hooks/use-theme';
import { toggleSave } from '@/lib/data/saves';

type SaveButtonProps = {
  listingId: string;
  /** "overlay" sits on a photo; "inline" sits in text content. */
  variant?: 'overlay' | 'inline';
};

/** Heart that saves a listing, with the number of people who saved it. */
export function SaveButton({ listingId, variant = 'overlay' }: SaveButtonProps) {
  const theme = useTheme();
  const { isSaved, count } = useSaveState(listingId);

  return (
    <Pressable
      onPress={() => toggleSave(listingId)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSaved }}
      accessibilityLabel={isSaved ? 'Unsave' : 'Save'}
      accessibilityHint={`${count} ${count === 1 ? 'person has' : 'people have'} saved this`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        variant === 'overlay' && [styles.overlay, { backgroundColor: theme.background }],
        variant === 'inline' && [styles.inline, { borderColor: theme.border }],
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: isSaved ? theme.accent : theme.text }}>
        {isSaved ? '♥' : '♡'}
        {count > 0 ? ` ${count}` : ''}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    opacity: 0.92,
  },
  inline: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
