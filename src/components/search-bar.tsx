import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SearchBarProps = TextInputProps & {
  /** Icon buttons on the right side of the bar (see SearchBarButton). */
  actions?: ReactNode;
};

/** The pill search bar from the Wireframes file: magnifier on the left, icon buttons on the right. */
export function SearchBar({ actions, style, ...rest }: SearchBarProps) {
  const theme = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
      <SymbolView
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        tintColor={theme.textSecondary}
        size={20}
      />
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }, style]}
        {...rest}
      />
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

type SearchBarButtonProps = {
  icon: SymbolViewProps['name'];
  accessibilityLabel: string;
  onPress: () => void;
  /** Highlights the button, e.g. while its panel is open or its filters are on. */
  active?: boolean;
  busy?: boolean;
};

/** An accent icon button inside the search bar. */
export function SearchBarButton({ icon, accessibilityLabel, onPress, active = false, busy = false }: SearchBarButtonProps) {
  const theme = useTheme();
  const tint = active ? theme.onAccent : theme.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: active, busy }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        active && { backgroundColor: theme.accent },
        pressed && styles.pressed,
      ]}>
      {busy ? <ActivityIndicator size="small" color={theme.accent} /> : <SymbolView name={icon} tintColor={tint} size={22} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.two,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
