import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { LEGAL_UPDATED, PRIVACY, TERMS } from '@/constants/legal';

/** Terms of Service (`/legal/terms`) or Privacy Policy (`/legal/privacy`). Readable signed in or out. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = doc === 'privacy' ? PRIVACY : TERMS;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: content.title }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <ThemedText type="small" themeColor="textSecondary">
          Last updated {LEGAL_UPDATED}
        </ThemedText>
        <ThemedText>{content.intro}</ThemedText>
        {content.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <ThemedText type="smallBold" accessibilityRole="header">
              {section.heading}
            </ThemedText>
            {section.body.map((paragraph) => (
              <ThemedText key={paragraph} type="small">
                {paragraph}
              </ThemedText>
            ))}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
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
  section: {
    gap: Spacing.two,
  },
});
