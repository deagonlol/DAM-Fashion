import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Full-width, swipeable photos with page dots. A single photo shows without dots. */
export function PhotoCarousel({ uris, label }: { uris: string[]; label: string }) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        accessibilityLabel={`${label}, photo ${index + 1} of ${uris.length}`}>
        {uris.map((uri, i) => (
          <Image
            key={`${uri}-${i}`}
            source={uri}
            style={[styles.photo, { width, backgroundColor: theme.backgroundElement }]}
            contentFit="cover"
          />
        ))}
      </ScrollView>
      {uris.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {uris.map((uri, i) => (
            <View
              key={`${uri}-${i}`}
              style={[styles.dot, { backgroundColor: i === index ? theme.onAccent : 'rgba(255,255,255,0.5)' }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    aspectRatio: 3 / 4,
  },
  dots: {
    position: 'absolute',
    bottom: Spacing.three,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
