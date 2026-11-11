import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip-group';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatTime } from '@/lib/format';

type TimePickerProps = {
  label: string;
  /** "HH:MM" options, in order. */
  times: readonly string[];
  value: string | null;
  onChange: (time: string) => void;
  /** Times that can't be picked, e.g. ones already past today. */
  isDisabled?: (time: string) => boolean;
};

/** A labeled, sideways-scrolling row of time chips. */
export function TimePicker({ label, times, value, onChange, isDisabled }: TimePickerProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {times.map((time) => (
          <Chip
            key={time}
            label={formatTime(time)}
            selected={time === value}
            disabled={isDisabled?.(time) ?? false}
            onPress={() => onChange(time)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.two,
  },
});
