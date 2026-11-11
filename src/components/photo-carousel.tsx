import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Full-width photos with arrows and page dots. Swipe or tap an arrow to move.
 * A single photo shows without arrows or dots.
 *
 * Sized from its own width, not the window's, so it fits the 480px web frame.
 */
export function PhotoCarousel({ uris, label }: { uris: string[]; label: string }) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const many = uris.length > 1;

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  // onScroll rather than onMomentumScrollEnd, which doesn't fire on web.
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(Math.max(0, Math.min(uris.length - 1, next)));
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(uris.length - 1, next));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setIndex(clamped);
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          accessibilityLabel={`${label}, photo ${index + 1} of ${uris.length}`}>
          {uris.map((uri, i) => (
            <Image
              key={`${uri}-${i}`}
              source={uri}
              style={[styles.photo, { width, backgroundColor: theme.backgroundElement }]}
              contentFit="contain"
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.photo, { backgroundColor: theme.backgroundElement }]} />
      )}
      {many && width ? (
        <>
          {index > 0 ? (
            <Arrow side="left" onPress={() => goTo(index - 1)} />
          ) : null}
          {index < uris.length - 1 ? (
            <Arrow side="right" onPress={() => goTo(index + 1)} />
          ) : null}
          <View style={styles.dots} pointerEvents="none">
            {uris.map((uri, i) => (
              <View
                key={`${uri}-${i}`}
                style={[styles.dot, { backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.5)' }]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function Arrow({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  const left = side === 'left';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={left ? 'Previous photo' : 'Next photo'}
      style={({ pressed }) => [
        styles.arrow,
        left ? styles.arrowLeft : styles.arrowRight,
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <SymbolView
        name={
          left
            ? { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }
        }
        tintColor="#fff"
        size={20}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  arrowLeft: {
    left: Spacing.three,
  },
  arrowRight: {
    right: Spacing.three,
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
