import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { User } from '@/lib/data/types';

/** A slim row of people whose names match the search, above the item results. */
export function PeopleStrip({ people }: { people: User[] }) {
  if (people.length === 0) return null;
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        PEOPLE
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {people.map((person) => (
          <Pressable
            key={person.id}
            onPress={() => router.push(`/user/${person.id}`)}
            accessibilityRole="link"
            accessibilityLabel={`Open ${person.name}'s profile`}
            style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
            <Avatar name={person.name} uri={person.avatarUrl} size={52} />
            <ThemedText type="small" numberOfLines={1} style={styles.name}>
              {person.name.split(' ')[0]}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  row: {
    gap: Spacing.three,
  },
  person: {
    width: 60,
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
