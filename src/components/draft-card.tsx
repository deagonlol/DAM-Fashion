import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteListingDraft, useListingDrafts, type SavedDraft } from '@/lib/drafts';

/**
 * Half-filled listings saved on this device. One shows as its own card; several fold into a single
 * "Drafts" card that opens them all, so they don't push your rack down the page.
 */
export function DraftList() {
  const user = useCurrentUser();
  const theme = useTheme();
  const drafts = useListingDrafts(user.id);
  if (drafts.length === 0) return null;
  if (drafts.length === 1) return <DraftCard draft={drafts[0]} />;
  const covers = drafts.map((draft) => draft.imageUris[0]).slice(0, 3);
  return (
    <Pressable
      onPress={() => router.push('/drafts')}
      accessibilityRole="link"
      accessibilityLabel={`${drafts.length} listings in progress. Open drafts`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.stack}>
        {covers.map((uri, index) =>
          uri ? (
            <Image
              key={index}
              source={{ uri }}
              style={[styles.stacked, { left: index * 10, borderColor: theme.backgroundElement }]}
              contentFit="cover"
            />
          ) : (
            <View
              key={index}
              style={[
                styles.stacked,
                { left: index * 10, backgroundColor: theme.border, borderColor: theme.backgroundElement },
              ]}
            />
          )
        )}
      </View>
      <View style={styles.flex}>
        <ThemedText type="smallBold">Drafts</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {drafts.length} listings in progress
        </ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor="accent">
        Open ›
      </ThemedText>
    </Pressable>
  );
}

/** One draft with Continue, and a red Delete that needs a second tap. */
export function DraftCard({ draft }: { draft: SavedDraft }) {
  const user = useCurrentUser();
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  const photos = draft.imageUris.length;
  const detail = [
    draft.title.trim() || 'No title yet',
    photos ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/list', params: { draft: draft.id } })}
        accessibilityRole="link"
        accessibilityLabel={`Continue your draft listing: ${detail}`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        {draft.imageUris[0] ? (
          <Image source={{ uri: draft.imageUris[0] }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.border }]} />
        )}
        <View style={styles.flex}>
          <ThemedText type="smallBold">In progress</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" themeColor="accent">
          Continue ›
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          void deleteListingDraft(user.id, draft.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={confirming ? 'Tap again to delete this draft for good' : 'Delete draft'}
        hitSlop={8}>
        <ThemedText type="smallBold" themeColor="danger">
          {confirming ? 'Sure?' : 'Delete'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: 68,
    height: 48,
  },
  stacked: {
    position: 'absolute',
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
