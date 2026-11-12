import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PickupSpot } from '@/lib/data/types';
import { requestLocation, useLocationState } from '@/lib/location';
import { mapsUrl, walkingLabel } from '@/lib/pickup-spots';

/** One pickup spot: its name, how far a walk it is (once location is shared), and Open in Maps. */
export function PickupSpotRow({ spot }: { spot: PickupSpot }) {
  const theme = useTheme();
  const location = useLocationState();
  const walk = location.status === 'ready' ? walkingLabel(location.coords, spot) : null;

  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{spot}</ThemedText>
        {walk ? (
          <ThemedText type="small" themeColor="textSecondary">
            {walk}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        onPress={() => void Linking.openURL(mapsUrl(spot))}
        accessibilityRole="link"
        accessibilityLabel={`Open ${spot} in Maps`}
        hitSlop={8}>
        <ThemedText type="smallBold" themeColor="accent">
          Open in Maps
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** "Show walking times": asks for location only when tapped. Says so if it's turned off. */
export function WalkingTimesPrompt() {
  const location = useLocationState();
  if (location.status === 'ready') return null;
  if (location.status === 'denied' || location.status === 'unavailable') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {location.status === 'denied'
          ? 'Location is off, so walking times aren’t shown. You can turn it on in Settings.'
          : 'Couldn’t get your location right now.'}
      </ThemedText>
    );
  }
  return (
    <Pressable
      onPress={() => void requestLocation()}
      disabled={location.status === 'loading'}
      accessibilityRole="button"
      hitSlop={8}>
      <ThemedText type="small" themeColor="accent">
        {location.status === 'loading' ? 'Finding you…' : 'Show walking times'}
      </ThemedText>
    </Pressable>
  );
}

/** A list of pickup spots with maps links and an optional walking-time prompt. */
export function PickupSpotList({ spots }: { spots: readonly PickupSpot[] }) {
  return (
    <View style={styles.list}>
      {spots.map((spot) => (
        <PickupSpotRow key={spot} spot={spot} />
      ))}
      <WalkingTimesPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
});
