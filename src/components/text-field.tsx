import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  /** "search" is a dark pill; "contrast" is a light bar on dark screens (sign-in). */
  variant?: 'field' | 'search' | 'contrast';
};

export function TextField({ label, style, multiline, variant = 'field', ...rest }: TextFieldProps) {
  const theme = useTheme();
  const search = variant === 'search';
  const contrast = variant === 'contrast';

  const input = (
    <TextInput
      placeholderTextColor={contrast ? theme.background : theme.textSecondary}
      multiline={multiline}
      style={[
        styles.input,
        search && styles.search,
        {
          backgroundColor: contrast ? theme.text : theme.backgroundElement,
          color: contrast ? theme.background : theme.text,
          borderColor: theme.border,
        },
        multiline && styles.multiline,
        style,
      ]}
      {...rest}
    />
  );

  if (!label) return input;

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {input}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  search: {
    borderRadius: 999,
    paddingVertical: Spacing.two,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
