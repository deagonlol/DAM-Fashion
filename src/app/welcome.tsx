import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const POINTS = [
  { icon: '🏈', text: 'Borrow fits for game day, formals, and career fairs' },
  { icon: '💸', text: 'Earn from the clothes sitting in your closet' },
  { icon: '🤘', text: 'Only verified UT students, with reviews on everyone' },
];

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <View style={styles.hero}>
          <ThemedText themeColor="accent" style={styles.name}>
            Lendr
          </ThemedText>
          <ThemedText style={styles.headline}>
            Your campus <ThemedText style={styles.headline} themeColor="accent">closet.</ThemedText>
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Borrow and lend clothes with other UT students.
          </ThemedText>
          <View style={styles.points}>
            {POINTS.map((point) => (
              <View key={point.text} style={[styles.point, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.pointIcon}>{point.icon}</ThemedText>
                <ThemedText type="small" style={styles.pointText}>
                  {point.text}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.actions}>
          <Button title="Sign up" onPress={() => router.push('/sign-up')} />
          <Button title="I already have an account" variant="secondary" onPress={() => router.push('/sign-in')} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  name: {
    fontFamily: Fonts.heading,
    fontSize: 56,
    lineHeight: 64,
  },
  headline: {
    fontFamily: Fonts.heading,
    fontSize: 32,
    lineHeight: 38,
  },
  tagline: {
    marginBottom: Spacing.two,
  },
  points: {
    gap: Spacing.two,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  pointIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  pointText: {
    flex: 1,
  },
  actions: {
    gap: Spacing.three,
  },
});
