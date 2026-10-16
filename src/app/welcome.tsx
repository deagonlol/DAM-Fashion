import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <View style={styles.hero}>
          <ThemedText type="subtitle">DAM Fashion</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Borrow and lend clothes with other UT students.
          </ThemedText>
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
    alignItems: 'center',
    gap: Spacing.two,
  },
  tagline: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
  },
});
