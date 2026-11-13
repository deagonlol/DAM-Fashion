import { SymbolView } from 'expo-symbols';
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
        variant === 'overlay' && styles.overlay,
        variant === 'inline' && [styles.inline, { borderColor: theme.border }],
        pressed && styles.pressed,
      ]}>
      <SymbolView
        name={
          isSaved
            ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
            : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
        }
        tintColor={isSaved ? theme.accent : variant === 'overlay' ? '#fff' : theme.text}
        size={variant === 'overlay' ? 18 : 16}
      />
      {/* Photos get a fixed-size heart so tapping it never changes its size; the count shows on the listing page. */}
      {variant === 'inline' && count > 0 ? (
        <ThemedText type="smallBold" style={{ color: theme.text }}>
          {count}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  overlay: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    // A dark pill so the white outline heart reads on any photo.
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
