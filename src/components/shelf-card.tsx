import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ShelfWithListings } from '@/hooks/use-shelves';
import { useTheme } from '@/hooks/use-theme';

/** A shelf as a collage of its three newest pieces, with its name and size. */
export function ShelfCard({ shelf, href }: { shelf: ShelfWithListings; href?: Href }) {
  const theme = useTheme();
  const [first, second, third] = shelf.listings.map((listing) => listing.imageUris[0]);
  const count = shelf.listings.length;

  function tile(uri: string | undefined, style: object) {
    return (
      <Image
        source={uri}
        style={[style, { backgroundColor: uri ? theme.card : theme.backgroundElement }]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <Pressable
      onPress={() => router.push(href ?? `/shelf/${shelf.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${shelf.name}, ${count} ${count === 1 ? 'piece' : 'pieces'}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.collage}>
        {tile(first, styles.large)}
        <View style={styles.row}>
          {tile(second, styles.small)}
          {tile(third, styles.small)}
        </View>
      </View>
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {shelf.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {count} {count === 1 ? 'piece' : 'pieces'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const GAP = 3;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  collage: {
    borderRadius: 24,
    overflow: 'hidden',
    gap: GAP,
  },
  large: {
    width: '100%',
    aspectRatio: 3 / 2,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  small: {
    flex: 1,
    aspectRatio: 1,
  },
  info: {
    paddingHorizontal: Spacing.one,
  },
});
