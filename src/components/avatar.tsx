import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  name: string;
  /** Profile photo. Falls back to initials when missing. */
  uri?: string;
  size?: number;
};

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={uri}
        style={[shape, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        accessibilityLabel={`${name}'s profile photo`}
      />
    );
  }

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.initials, shape, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
