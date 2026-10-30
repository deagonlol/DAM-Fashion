import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useCurrentUser } from '@/hooks/use-session';

/** Header photo that opens your profile. */
export function ProfileButton() {
  const user = useCurrentUser();

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="link"
      accessibilityLabel="Open your profile"
      hitSlop={8}
      style={({ pressed }) => pressed && styles.pressed}>
      <Avatar name={user.name} uri={user.avatarUrl} size={36} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
});
