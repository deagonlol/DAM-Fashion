import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipGroupProps<T extends string> = {
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the selected chip clears the selection. */
  allowDeselect?: boolean;
};

/** Single-select row of chips. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  allowDeselect = false,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Chip
            key={option}
            label={option}
            selected={selected}
            onPress={() => onChange(selected && allowDeselect ? null : option)}
          />
        );
      })}
    </View>
  );
}

type MultiChipGroupProps<T extends string> = {
  options: readonly T[];
  values: T[];
  onChange: (values: T[]) => void;
};

/** Multi-select row of chips. Tapping a chip toggles it. */
export function MultiChipGroup<T extends string>({ options, values, onChange }: MultiChipGroupProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <Chip
            key={option}
            label={option}
            selected={selected}
            accessibilityRole="checkbox"
            onPress={() =>
              onChange(selected ? values.filter((value) => value !== option) : [...values, option])
            }
          />
        );
      })}
    </View>
  );
}

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityRole?: 'radio' | 'checkbox' | 'button';
  disabled?: boolean;
};

export function Chip({ label, selected, onPress, accessibilityRole = 'radio', disabled = false }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={
        accessibilityRole === 'checkbox' ? { checked: selected, disabled } : { selected, disabled }
      }
      style={[
        styles.chip,
        { borderColor: theme.border },
        selected && { backgroundColor: theme.text, borderColor: theme.text },
        disabled && styles.disabled,
      ]}>
      <ThemedText type="small" style={selected && { color: theme.background }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  disabled: {
    opacity: 0.35,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
});
