import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Full-width, swipeable photos with page dots. Each photo is shown whole, never cropped.
 * A single photo shows without dots.
 */
export function PhotoCarousel({ uris, label }: { uris: string[]; label: string }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  // Measured from the layout, not the window: on web the app sits in a narrow column,
  // so the window is much wider than the space the photos actually have.
  const [width, setWidth] = useState(0);
  const height = Math.round((width * 4) / 3);

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={styles.frame} onLayout={handleLayout}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          style={{ width, height }}
          accessibilityLabel={`${label}, photo ${index + 1} of ${uris.length}`}>
          {uris.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={uri}
              style={{ width, height, backgroundColor: theme.backgroundElement }}
              contentFit="contain"
            />
          ))}
        </ScrollView>
      ) : null}
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
  frame: {
    width: '100%',
    // Holds the photo's space while the width is measured, so the page doesn't jump.
    aspectRatio: 3 / 4,
    overflow: 'hidden',
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
