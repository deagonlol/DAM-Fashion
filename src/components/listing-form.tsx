import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup, MultiChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListings } from '@/hooks/use-listings';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { findSimilarListings, preparePhoto, rankByMatches, warmUpImageSearch } from '@/lib/data/image-search';
import { suggestedDailyPrice, suggestedSalePrice, suggestFromLookalikes } from '@/lib/data/search';
import { deleteListingDraft, loadListingDraft, newDraftId, saveListingDraft } from '@/lib/drafts';
import { formatPrice } from '@/lib/format';
import {
  CATEGORIES,
  EVENTS,
  MAX_FIT_DETAIL_LENGTH,
  MAX_LISTING_PHOTOS,
  PICKUP_SPOTS,
  SIZES,
  type Category,
  type EventTag,
  type NewListing,
  type PickupSpot,
  type Size,
} from '@/lib/data/types';

/** Rent only, rent or buy, or sell only. */
const OFFERS = ['Rent', 'Rent or buy', 'Buy only'] as const;
type Offer = (typeof OFFERS)[number];

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
  /** Listing being edited, so its own price is not used as a comparison. */
  excludeId?: string;
  /** A saved draft to pick back up. Without one, a new listing starts blank as a new draft. */
  draftId?: string;
  /** Extra sections under the details, before the save button (availability when editing). */
  children?: ReactNode;
  /** Shown under the save button, e.g. a red delete. */
  footer?: ReactNode;
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
  excludeId,
  draftId: resumeId,
  children,
  footer,
}: ListingFormProps) {
  const theme = useTheme();
  const listings = useListings();
  const [imageUris, setImageUris] = useState<string[]>(initial?.imageUris ?? []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null);
  const [events, setEvents] = useState<EventTag[]>(initial?.events ?? []);
  const [size, setSize] = useState<Size | null>(initial?.size ?? null);
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [measurements, setMeasurements] = useState(initial?.measurements ?? '');
  const [fitNote, setFitNote] = useState(initial?.fitNote ?? '');
  const [pickupSpots, setPickupSpots] = useState<PickupSpot[]>(initial?.pickupSpots ?? []);
  const [price, setPrice] = useState(initial ? String(initial.pricePerDay) : '');
  const [salePrice, setSalePrice] = useState(initial?.salePrice != null ? String(initial.salePrice) : '');
  const [offer, setOffer] = useState<Offer>(
    initial?.rentable === false ? 'Buy only' : initial?.salePrice != null ? 'Rent or buy' : 'Rent'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New listings keep a draft on the device, so leaving the form doesn't lose it. Each new form is
  // its own draft; tapping a draft in the closet opens the form with that one.
  const user = useCurrentUser();
  const draftsOn = !initial;
  const [draftId, setDraftId] = useState(() => resumeId ?? newDraftId());
  const [draftReady, setDraftReady] = useState(!draftsOn || !resumeId);
  const [restoredDraft, setRestoredDraft] = useState(false);

  useEffect(() => {
    if (!draftsOn || !resumeId) return;
    let cancelled = false;
    void loadListingDraft(user.id, resumeId).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setImageUris(draft.imageUris);
        setTitle(draft.title);
        setDescription(draft.description);
        setCategory(CATEGORIES.find((option) => option === draft.category) ?? null);
        setEvents(EVENTS.filter((option) => draft.events.includes(option)));
        setSize(SIZES.find((option) => option === draft.size) ?? null);
        setBrand(draft.brand);
        setMeasurements(draft.measurements);
        setFitNote(draft.fitNote);
        setPickupSpots(PICKUP_SPOTS.filter((option) => draft.pickupSpots.includes(option)));
        setPrice(draft.price);
        setSalePrice(draft.salePrice);
        setOffer(OFFERS.find((option) => option === draft.offer) ?? 'Rent');
        setRestoredDraft(true);
      }
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftsOn, resumeId, user.id]);

  useEffect(() => {
    if (!draftsOn || !draftReady) return;
    const timer = setTimeout(() => {
      void saveListingDraft(user.id, draftId, {
        imageUris,
        title,
        description,
        category,
        events,
        size,
        brand,
        measurements,
        fitNote,
        pickupSpots,
        price,
        salePrice,
        offer,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    draftsOn,
    draftReady,
    user.id,
    draftId,
    imageUris,
    title,
    description,
    category,
    events,
    size,
    brand,
    measurements,
    fitNote,
    pickupSpots,
    price,
    salePrice,
    offer,
  ]);

  const suggestion =
    category && size && events.length > 0 ? suggestedDailyPrice(listings, { category, events, size, excludeId }) : null;
  const saleSuggestion =
    category && size && events.length > 0 ? suggestedSalePrice(listings, { category, events, size, excludeId }) : null;

  // From the cover photo, find the listings that look most like it (TinyCLIP, on our own free
  // server) and suggest a type and events from them. Only for new listings, and never overwrites.
  const coverPhoto = imageUris[0];
  const [lookalikeHint, setLookalikeHint] = useState<{
    photo: string;
    category: Category;
    events: EventTag[];
    count: number;
  } | null>(null);
  const [dismissedHintFor, setDismissedHintFor] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    warmUpImageSearch();
  }, [initial]);

  useEffect(() => {
    if (initial || !coverPhoto || /^https?:\/\//.test(coverPhoto)) return;
    let cancelled = false;
    (async () => {
      try {
        const matches = await findSimilarListings(await preparePhoto(coverPhoto), 10);
        const lookalikes = rankByMatches(listings, matches).slice(0, 5);
        const hint = suggestFromLookalikes(lookalikes);
        if (!cancelled && hint) setLookalikeHint({ photo: coverPhoto, ...hint, count: lookalikes.length });
      } catch {
        // Suggestions are a bonus; if photo search is asleep or offline, the form works as usual.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only the cover photo matters; the listings list changing shouldn't re-run the lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverPhoto, initial]);

  const showLookalikeHint =
    lookalikeHint !== null &&
    lookalikeHint.photo === coverPhoto &&
    dismissedHintFor !== coverPhoto &&
    (category !== lookalikeHint.category || lookalikeHint.events.some((event) => !events.includes(event)));

  function applyLookalikeHint() {
    if (!lookalikeHint) return;
    setCategory(lookalikeHint.category);
    setEvents((current) => [...new Set([...current, ...lookalikeHint.events])]);
    setDismissedHintFor(lookalikeHint.photo);
  }
  const rents = offer !== 'Buy only';
  const sells = offer !== 'Rent';
  // Sell-only listings store a daily price of 0; it's never shown.
  const pricePerDay = rents ? Number(price) : 0;
  const saleText = salePrice.trim();
  const saleAmount = saleText === '' ? null : Number(saleText);
  const priceOk = !rents || (Number.isFinite(pricePerDay) && pricePerDay > 0);
  const saleOk = !sells || (saleAmount !== null && Number.isFinite(saleAmount) && saleAmount > pricePerDay);
  const isValid =
    imageUris.length > 0 && title.trim().length > 0 && category !== null && size !== null && priceOk && saleOk;

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

  async function takePhoto() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Allow camera access in Settings to take photos here.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setImageUris((current) => [...current, uri].slice(0, MAX_LISTING_PHOTOS));
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
    setBrand('');
    setMeasurements('');
    setFitNote('');
    setPickupSpots([]);
    setPrice('');
    setSalePrice('');
    setOffer('Rent');
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
        brand: brand.trim(),
        measurements: measurements.trim(),
        fitNote: fitNote.trim(),
        pickupSpots,
        pricePerDay,
        salePrice: sells ? (saleAmount ?? undefined) : undefined,
        rentable: rents,
      });
      if (draftsOn) {
        void deleteListingDraft(user.id, draftId);
        setRestoredDraft(false);
      }
      if (resetOnSubmit) {
        resetForm();
        setDraftId(newDraftId());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={safeAreaTop ? ['top'] : []}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic">
            {heading ? <ThemedText type="subtitle">{heading}</ThemedText> : null}
            {banner}
            {restoredDraft ? (
              <View style={[styles.draftNotice, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" style={styles.flex}>
                  Draft · saves on this phone as you go.
                </ThemedText>
                <Pressable
                  onPress={() => {
                    void deleteListingDraft(user.id, draftId);
                    resetForm();
                    setRestoredDraft(false);
                    setDraftId(newDraftId());
                  }}
                  accessibilityRole="button"
                  accessibilityHint="Deletes this draft for good"
                  hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="danger">
                    Delete draft
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

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
                  <>
                    <Pressable
                      onPress={takePhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Take a photo"
                      style={[styles.photo, styles.addPhoto, { borderColor: theme.border }]}>
                      <SymbolView
                        name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                        tintColor={theme.accent}
                        size={24}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        Camera
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={addPhotos}
                      accessibilityRole="button"
                      accessibilityLabel="Choose photos from library"
                      style={[styles.photo, styles.addPhoto, { borderColor: theme.border }]}>
                      <SymbolView
                        name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
                        tintColor={theme.accent}
                        size={24}
                      />
                      <ThemedText type="small" themeColor="textSecondary">
                        Library
                      </ThemedText>
                    </Pressable>
                  </>
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

            {showLookalikeHint && lookalikeHint ? (
              <View style={[styles.hint, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}>
                <ThemedText type="small" style={styles.flex}>
                  Looks like{' '}
                  <ThemedText type="smallBold">
                    {[lookalikeHint.category, ...lookalikeHint.events].join(' · ')}
                  </ThemedText>{' '}
                  (from {lookalikeHint.count} similar listings)
                </ThemedText>
                <Pressable onPress={applyLookalikeHint} accessibilityRole="button" hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="accent">
                    Use these
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setDismissedHintFor(lookalikeHint.photo)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss suggestion"
                  hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    ✕
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

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
              label="Brand (optional)"
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Levi's"
              maxLength={40}
            />

            <TextField
              label="Measurements (optional)"
              value={measurements}
              onChangeText={setMeasurements}
              placeholder="e.g. Waist 28 in, length 40 in"
              maxLength={MAX_FIT_DETAIL_LENGTH}
            />
            <TextField
              label="How it fits (optional)"
              value={fitNote}
              onChangeText={setFitNote}
              placeholder="e.g. Runs small, fits like an XS"
              maxLength={MAX_FIT_DETAIL_LENGTH}
            />

            <Field label="Pickup spots (optional)">
              <MultiChipGroup options={PICKUP_SPOTS} values={pickupSpots} onChange={setPickupSpots} />
              <ThemedText type="small" themeColor="textSecondary">
                Pick where you’re happy to meet. Leave blank and borrowers can choose any of these.
              </ThemedText>
            </Field>

            <Field label="How can people get it?">
              <ChipGroup variant="segment" options={OFFERS} value={offer} onChange={(next) => next && setOffer(next)} />
            </Field>

            {rents ? (
              <TextField
                label="Price per day ($)"
                value={price}
                onChangeText={setPrice}
                placeholder="5"
                keyboardType="decimal-pad"
              />
            ) : null}
            {rents && suggestion !== null ? (
              <Pressable onPress={() => setPrice(String(suggestion))} accessibilityRole="button" hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  Similar listings are about {formatPrice(suggestion)}/day. Tap to use it.
                </ThemedText>
              </Pressable>
            ) : null}

            {sells ? (
              <>
                <TextField
                  label="Sale price ($)"
                  value={salePrice}
                  onChangeText={setSalePrice}
                  placeholder="40"
                  keyboardType="decimal-pad"
                />
                <ThemedText type="small" themeColor={saleText !== '' && !saleOk ? 'danger' : 'textSecondary'}>
                  {rents
                    ? 'What someone pays to keep it. Has to be higher than the daily rate.'
                    : 'What someone pays to keep it. It won’t be offered for rent.'}
                </ThemedText>
                {saleSuggestion !== null ? (
                  <Pressable
                    onPress={() => setSalePrice(String(saleSuggestion))}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Similar items sell for about {formatPrice(saleSuggestion)}. Tap to use it.
                    </ThemedText>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {error ? (
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}

            {children}
            <Button title={submitLabel} onPress={handleSubmit} disabled={!isValid || submitting} />
            {footer}
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
  flex: {
    flex: 1,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  draftNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
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
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  addPhoto: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
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
