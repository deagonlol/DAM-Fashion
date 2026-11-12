import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAY_PART_LABELS, DAY_PARTS, WEEKDAY_LABELS, WEEKDAYS, windowKey } from '@/lib/data/availability';

type PickupWindowsEditorProps = {
  value: string[];
  onChange: (windows: string[]) => void;
};

/** A week grid: tap the mornings, afternoons and evenings you're usually free to meet. */
export function PickupWindowsEditor({ value, onChange }: PickupWindowsEditorProps) {
  const theme = useTheme();

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((existing) => existing !== key) : [...value, key]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.dayLabel} />
        {DAY_PARTS.map((part) => (
          <ThemedText key={part} type="small" themeColor="textSecondary" style={styles.partLabel}>
            {DAY_PART_LABELS[part]}
          </ThemedText>
        ))}
      </View>
      {WEEKDAYS.map((day) => (
        <View key={day} style={styles.row}>
          <ThemedText type="smallBold" style={styles.dayLabel}>
            {WEEKDAY_LABELS[day]}
          </ThemedText>
          {DAY_PARTS.map((part) => {
            const key = windowKey(day, part);
            const on = value.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggle(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${WEEKDAY_LABELS[day]} ${DAY_PART_LABELS[part].toLowerCase()}`}
                style={[
                  styles.cell,
                  { borderColor: on ? theme.accent : theme.border },
                  on && { backgroundColor: theme.accent },
                ]}>
                <ThemedText type="smallBold" style={{ color: on ? theme.onAccent : theme.textSecondary }}>
                  {on ? '✓' : ''}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayLabel: {
    width: 40,
  },
  partLabel: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
