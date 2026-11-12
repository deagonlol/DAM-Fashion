import { router, Stack } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { markTourSeen } from '@/lib/tour';

const SLIDES: { icon: SymbolViewProps['name']; title: string; body: string }[] = [
  {
    icon: { ios: 'tshirt.fill', android: 'checkroom', web: 'checkroom' },
    title: 'Borrow, lend, or buy',
    body: 'Find outfits from other UT students for game days, formals and interviews. Request the dates you need, or list your own pieces and earn from your closet.',
  },
  {
    icon: { ios: 'lock.fill', android: 'lock', web: 'lock' },
    title: 'Codes confirm every handoff',
    body: 'Meet at a campus spot. At pickup, the borrower enters the code on the lender’s screen; at return, it’s the other way around. Snap condition photos at each handoff if you like.',
  },
  {
    icon: { ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' },
    title: 'Be someone people trust',
    body: 'Show up, return on time, and take care of things. Reviews and badges build your reputation. No-shows and late returns are strikes: the first is a warning, the second a 7-day limit, the third a ban.',
  },
];

/** A three-screen intro, shown once after signing in and from "How Lendr works" on the profile. */
export default function TourScreen() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  function finish() {
    void markTourSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function goTo(next: number) {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.top}>
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Skip
            </ThemedText>
          </Pressable>
        </View>
        <View
          style={styles.container}
          onLayout={(event: LayoutChangeEvent) =>
            setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
          }>
          {width > 0 ? (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}>
              {SLIDES.map((slide) => (
                <View key={slide.title} style={[styles.slide, { width, height }]}>
                  <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                    <SymbolView name={slide.icon} tintColor={theme.accent} size={44} />
                  </View>
                  <ThemedText style={styles.title} themeColor="accent" accessibilityRole="header">
                    {slide.title}
                  </ThemedText>
                  <ThemedText style={styles.body} themeColor="textSecondary">
                    {slide.body}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((slide, i) => (
              <View
                key={slide.title}
                style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.backgroundSelected }]}
              />
            ))}
          </View>
          <Button title={last ? 'Get started' : 'Next'} onPress={() => (last ? finish() : goTo(index + 1))} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  top: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.four,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  bottom: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
