import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  /** `danger` is for anything permanent (delete); `dangerFilled` is its second, confirming tap. */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'dangerFilled';
  style?: StyleProp<ViewStyle>;
};

/** Neutral button. Restyle here once the design system is final. */
export function Button({ title, disabled, variant = 'primary', style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const outline = variant === 'outline';
  const danger = variant === 'danger';
  const dangerFilled = variant === 'dangerFilled';
  const labelColor =
    primary || dangerFilled ? theme.onAccent : outline ? theme.accent : danger ? theme.danger : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : dangerFilled
            ? { backgroundColor: theme.danger }
            : danger
              ? [styles.outline, { borderColor: theme.danger }]
              : outline
                ? [styles.outline, { borderColor: theme.accent }]
                : { backgroundColor: theme.backgroundElement },
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
      {...rest}>
      <ThemedText style={[styles.label, { color: labelColor }]}>{title}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    alignItems: 'center',
  },
  outline: {
    borderWidth: 1.5,
  },
  dimmed: {
    opacity: 0.4,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
  },
});
