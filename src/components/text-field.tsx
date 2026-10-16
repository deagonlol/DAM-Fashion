import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
};

export function TextField({ label, style, multiline, ...rest }: TextFieldProps) {
  const theme = useTheme();

  const input = (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      multiline={multiline}
      style={[
        styles.input,
        { borderColor: theme.border, color: theme.text },
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
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
