import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup, MultiChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CATEGORIES,
  EVENTS,
  MAX_LISTING_PHOTOS,
  SIZES,
  type Category,
  type EventTag,
  type NewListing,
  type Size,
} from '@/lib/data/types';

type ListingFormProps = {
  /** Pre-filled values when editing. */
  initial?: NewListing;
  heading?: string;
  submitLabel: string;
  onSubmit: (values: NewListing) => Promise<void>;
  /** Clear the form after a successful submit (for creating several listings in a row). */
  resetOnSubmit?: boolean;
  /** Pad for the status bar; true on a tab screen, false under a navigation header. */
  safeAreaTop?: boolean;
  /** Shown under the heading, e.g. an account restriction notice. */
  banner?: ReactNode;
};

/** Photos, details, and price for a listing. Used to create and to edit. */
export function ListingForm({
  initial,
  heading,
  submitLabel,
  onSubmit,
  resetOnSubmit = false,
  safeAreaTop = false,
  banner,
}: ListingFormProps) {
  const theme = useTheme();
  const [imageUris, setImageUris] = useState<string[]>(initial?.imageUris ?? []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null);
  const [events, setEvents] = useState<EventTag[]>(initial?.events ?? []);
  const [size, setSize] = useState<Size | null>(initial?.size ?? null);
  const [price, setPrice] = useState(initial ? String(initial.pricePerDay) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricePerDay = Number(price);
  const isValid =
    imageUris.length > 0 &&
    title.trim().length > 0 &&
    category !== null &&
    size !== null &&
    Number.isFinite(pricePerDay) &&
    pricePerDay > 0;

  const photosLeft = MAX_LISTING_PHOTOS - imageUris.length;

  async function addPhotos() {
    // Cropping isn't available with multiple selection, so photos are used as picked.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: photosLeft,
      orderedSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const picked = result.assets.map((asset) => asset.uri);
      setImageUris((current) => [...current, ...picked].slice(0, MAX_LISTING_PHOTOS));
    }
  }

  function removePhoto(index: number) {
    setImageUris((current) => current.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    setImageUris((current) => [current[index], ...current.filter((_, i) => i !== index)]);
  }

  function resetForm() {
    setImageUris([]);
    setTitle('');
    setDescription('');
    setCategory(null);
    setEvents([]);
    setSize(null);
    setPrice('');
  }

  async function handleSubmit() {
    if (!isValid || !category || !size || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        imageUris,
        title: title.trim(),
        description: description.trim(),
        category,
        events,
        size,
        pricePerDay,
      });
      if (resetOnSubmit) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={safeAreaTop ? ['top'] : []}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic">
            {heading ? <ThemedText type="subtitle">{heading}</ThemedText> : null}
            {banner}

            <Field label={`Photos (${imageUris.length}/${MAX_LISTING_PHOTOS})`}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                {imageUris.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.photo}>
                    <Pressable
                      onPress={() => makeCover(index)}
                      accessibilityRole="button"
                      accessibilityLabel={index === 0 ? 'Cover photo' : `Photo ${index + 1}, make cover`}
                      style={StyleSheet.absoluteFill}>
                      <Image
                        source={uri}
                        style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundElement }]}
                        contentFit="cover"
                      />
                    </Pressable>
                    {index === 0 ? (
                      <View style={[styles.coverTag, { backgroundColor: theme.accent }]}>
                        <ThemedText type="smallBold" style={[styles.tagText, { color: theme.onAccent }]}>
                          Cover
                        </ThemedText>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => removePhoto(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      hitSlop={8}
                      style={[styles.removeButton, { backgroundColor: theme.text }]}>
                      <ThemedText type="smallBold" style={[styles.tagText, { color: theme.background }]}>
                        ✕
                      </ThemedText>
                    </Pressable>
                  </View>
                ))}
                {photosLeft > 0 ? (
                  <Pressable
                    onPress={addPhotos}
                    accessibilityRole="button"
                    accessibilityLabel="Add photos"
                    style={[styles.photo, styles.addPhoto, { borderColor: theme.border }]}>
                    <ThemedText themeColor="textSecondary">+ Add</ThemedText>
                  </Pressable>
                ) : null}
              </ScrollView>
              <ThemedText type="small" themeColor="textSecondary">
                Show the front, back, and any details. Tap a photo to make it the cover.
              </ThemedText>
            </Field>

            <TextField
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Burnt orange gameday polo"
            />

            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Condition, fit, good occasions…"
              multiline
            />

            <Field label="Type">
              <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} />
            </Field>

            <Field label="Good for (optional)">
              <MultiChipGroup options={EVENTS} values={events} onChange={setEvents} />
            </Field>

            <Field label="Size">
              <ChipGroup options={SIZES} value={size} onChange={setSize} />
            </Field>

            <TextField
              label="Price per day ($)"
              value={price}
              onChangeText={setPrice}
              placeholder="5"
              keyboardType="decimal-pad"
            />

            {error ? (
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}

            <Button title={submitLabel} onPress={handleSubmit} disabled={!isValid || submitting} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  photos: {
    gap: Spacing.two,
  },
  photo: {
    width: 96,
    aspectRatio: 3 / 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  addPhoto: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTag: {
    position: 'absolute',
    left: Spacing.one,
    bottom: Spacing.one,
    borderRadius: 6,
    paddingHorizontal: Spacing.one + Spacing.half,
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 11,
    lineHeight: 16,
  },
  field: {
    gap: Spacing.two,
  },
});
