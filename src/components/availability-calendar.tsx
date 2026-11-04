import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDateString, type DateRange } from '@/lib/data/rentals';

type AvailabilityCalendarProps = {
  /** Days held by accepted or active borrows. */
  bookedDates: Set<string>;
  /** Days the owner blocked off. */
  blockedDates: Set<string>;
  /** When set, tapping a free or blocked future day toggles it. */
  onToggleDay?: (date: string) => void;
  /** Picking borrow dates: the chosen range, and what to do when a free day is tapped. */
  selected?: DateRange | null;
  onSelectDay?: (date: string) => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS_AHEAD = 3;

/**
 * Month grid showing booked, blocked, and free days. Owners can tap to block days off; borrowers
 * can tap free days to pick their dates.
 */
export function AvailabilityCalendar({
  bookedDates,
  blockedDates,
  onToggleDay,
  selected,
  onSelectDay,
}: AvailabilityCalendarProps) {
  const picking = Boolean(onSelectDay);
  const theme = useTheme();
  const [today] = useState(() => toDateString(new Date()));
  const [monthOffset, setMonthOffset] = useState(0);

  const first = new Date(`${today}T00:00:00`);
  first.setDate(1);
  first.setMonth(first.getMonth() + monthOffset);
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = first.getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateString(new Date(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = first.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setMonthOffset((offset) => offset - 1)}
          disabled={monthOffset === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          style={monthOffset === 0 && styles.hidden}>
          <ThemedText>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{monthLabel}</ThemedText>
        <Pressable
          onPress={() => setMonthOffset((offset) => offset + 1)}
          disabled={monthOffset === MONTHS_AHEAD - 1}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
          style={monthOffset === MONTHS_AHEAD - 1 && styles.hidden}>
          <ThemedText>›</ThemedText>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((day, i) => (
          <View key={`${day}-${i}`} style={styles.cell}>
            <ThemedText type="small" themeColor="textSecondary">
              {day}
            </ThemedText>
          </View>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
          const past = date < today;
          const booked = bookedDates.has(date);
          const blocked = blockedDates.has(date);
          const inRange = Boolean(selected && date >= selected.startDate && date <= selected.endDate);
          // While picking, booked days look like any other day you can't choose.
          const showBooked = booked && !picking;
          const unavailable = blocked || (booked && picking);
          const canPress = picking ? !past && !booked && !blocked : Boolean(onToggleDay) && !past && !booked;
          const state = inRange
            ? 'selected'
            : showBooked
              ? 'booked'
              : unavailable
                ? 'unavailable'
                : past
                  ? 'past'
                  : 'free';
          const onPress = picking ? onSelectDay : onToggleDay;
          return (
            <Pressable
              key={date}
              onPress={canPress ? () => onPress?.(date) : undefined}
              disabled={!canPress}
              accessibilityRole={canPress ? 'button' : undefined}
              accessibilityState={picking ? { selected: inRange } : undefined}
              accessibilityLabel={`${new Date(`${date}T00:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric' })}, ${state}`}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  (showBooked || inRange) && { backgroundColor: theme.accent },
                  unavailable && { backgroundColor: theme.backgroundSelected },
                  date === today && { borderWidth: 1, borderColor: theme.text },
                ]}>
                <ThemedText
                  type="small"
                  style={[
                    (showBooked || inRange) && { color: theme.onAccent },
                    unavailable && styles.struck,
                    past && styles.past,
                  ]}>
                  {Number(date.slice(8))}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={theme.accent} label={picking ? 'Your dates' : 'Booked'} />
        <Legend color={theme.backgroundSelected} label="Unavailable" />
        <Legend color={theme.background} border={theme.border} label="Free" />
      </View>
    </View>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color, borderColor: border ?? color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  hidden: {
    opacity: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: '82%',
    height: '82%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  past: {
    opacity: 0.35,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
});
