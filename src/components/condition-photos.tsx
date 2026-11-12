import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePrivatePhotoUrls } from '@/hooks/use-private-photos';
import { useTheme } from '@/hooks/use-theme';
import {
  addConditionPhotos,
  canAddConditionPhotos,
  getRentalPhotosSnapshot,
  photosLeft,
  subscribeToRentalPhotos,
  type PhotoStage,
} from '@/lib/data/rental-photos';
import type { Rental } from '@/lib/data/types';

const STAGES: { stage: PhotoStage; label: string }[] = [
  { stage: 'pickup', label: 'At pickup' },
  { stage: 'return', label: 'At return' },
];

/**
 * Before-and-after photos of the item, from both people. Optional, but they settle damage
 * disputes: the moderation team sees them alongside any report.
 */
export function ConditionPhotos({
  rental,
  userId = '',
  readOnly = false,
}: {
  rental: Rental;
  userId?: string;
  /** For the moderation team: show the photos, no adding. */
  readOnly?: boolean;
}) {
  const theme = useTheme();
  const all = useSyncExternalStore(subscribeToRentalPhotos, getRentalPhotosSnapshot, getRentalPhotosSnapshot);
  const photos = useMemo(
    () => all.filter((photo) => photo.rentalId === rental.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [all, rental.id]
  );
  const urls = usePrivatePhotoUrls(
    'rental-photos',
    photos.map((photo) => photo.path)
  );
  const [busy, setBusy] = useState<PhotoStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleStages = STAGES.filter(
    ({ stage }) => (!readOnly && canAddConditionPhotos(rental, stage)) || photos.some((photo) => photo.stage === stage)
  );
  if (visibleStages.length === 0) return null;

  async function add(stage: PhotoStage) {
    const left = photosLeft(all, rental.id, userId, stage);
    if (left === 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: left,
      quality: 0.7,
    });
    if (result.canceled) return;
    setError(null);
    setBusy(stage);
    try {
      await addConditionPhotos(
        rental,
        userId,
        stage,
        result.assets.slice(0, left).map((asset) => asset.uri)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add those photos.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View>
        <ThemedText type="smallBold">Condition photos</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Optional. Snap the item at each handoff so any damage question has proof.
        </ThemedText>
      </View>
      {visibleStages.map(({ stage, label }) => {
        const stagePhotos = photos
          .map((photo, index) => ({ photo, url: urls[index] }))
          .filter(({ photo }) => photo.stage === stage);
        const left = photosLeft(all, rental.id, userId, stage);
        const canAdd = !readOnly && canAddConditionPhotos(rental, stage) && left > 0;
        return (
          <View key={stage} style={styles.stage}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {stagePhotos.map(({ photo, url }) => (
                <View key={photo.id}>
                  <Image
                    source={url ?? undefined}
                    style={[styles.thumb, { backgroundColor: theme.background }]}
                    contentFit="cover"
                    transition={150}
                    accessibilityLabel={`${label} photo by ${photo.uploaderId === userId ? 'you' : 'them'}`}
                  />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.by}>
                    {photo.uploaderId === userId
                      ? 'You'
                      : rental.borrowerId === photo.uploaderId
                        ? 'Borrower'
                        : 'Lender'}
                  </ThemedText>
                </View>
              ))}
              {canAdd ? (
                <Pressable
                  onPress={() => add(stage)}
                  disabled={busy !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${label.toLowerCase()} photos`}
                  style={({ pressed }) => [
                    styles.thumb,
                    styles.add,
                    { borderColor: theme.textSecondary },
                    (pressed || busy === stage) && styles.pressed,
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {busy === stage ? 'Adding…' : '+ Add'}
                  </ThemedText>
                </Pressable>
              ) : null}
              {stagePhotos.length === 0 && !canAdd ? (
                <ThemedText type="small" themeColor="textSecondary">
                  None
                </ThemedText>
              ) : null}
            </ScrollView>
          </View>
        );
      })}
      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  stage: {
    gap: Spacing.one,
  },
  row: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
  },
  add: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  by: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
