import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useShelves } from '@/hooks/use-shelves';
import { useTheme } from '@/hooks/use-theme';
import { addToShelf, removeFromShelf } from '@/lib/data/shelves';

/** Puts a listing on, or takes it off, any of your shelves. */
export default function AddToShelfScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const shelves = useShelves();
  const theme = useTheme();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(shelfId: string, onShelf: boolean) {
    setError(null);
    setBusyId(shelfId);
    try {
      await (onShelf ? removeFromShelf(shelfId, listingId) : addToShelf(shelfId, listingId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={shelves}
        keyExtractor={(shelf) => shelf.id}
        renderItem={({ item }) => {
          const onShelf = item.listingIds.includes(listingId);
          return (
            <Pressable
              onPress={() => toggle(item.id, onShelf)}
              disabled={busyId === item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: onShelf, disabled: busyId === item.id }}
              accessibilityLabel={item.name}
              style={({ pressed }) => [
                styles.shelf,
                { backgroundColor: theme.backgroundElement },
                (pressed || busyId === item.id) && styles.pressed,
              ]}>
              <Image
                source={item.listings[0]?.imageUris[0]}
                style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}
                contentFit="contain"
              />
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.listings.length} {item.listings.length === 1 ? 'piece' : 'pieces'}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.check,
                  { borderColor: onShelf ? theme.accent : theme.textSecondary },
                  onShelf && { backgroundColor: theme.accent },
                ]}>
                {onShelf ? (
                  <ThemedText type="smallBold" themeColor="onAccent">
                    ✓
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : undefined
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            You don’t have any shelves yet.
          </ThemedText>
        }
        contentContainerStyle={styles.list}
      />
      <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
        <Button
          title="+ New shelf with this piece"
          variant="outline"
          onPress={() => router.push({ pathname: '/shelf/name', params: { listingId } })}
        />
        <Button title="Done" onPress={() => router.back()} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  shelf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  flex: {
    flex: 1,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
  footer: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
