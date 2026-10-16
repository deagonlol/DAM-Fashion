import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FilterToggleProps = {
  label: string;
  /** How many values are selected in this filter; shown on the chip. */
  count: number;
  open: boolean;
  onPress: () => void;
};

/** A filter chip that opens or closes its dropdown panel. */
export function FilterToggle({ label, count, open, onPress }: FilterToggleProps) {
  const theme = useTheme();
  const active = count > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={active ? `${label}, ${count} selected` : label}
      style={[
        styles.chip,
        { borderColor: active || open ? theme.text : theme.border },
        active && { backgroundColor: theme.text },
      ]}>
      <ThemedText type="small" style={active && { color: theme.background }}>
        {active ? `${label} · ${count}` : label} {open ? '▴' : '▾'}
      </ThemedText>
    </Pressable>
  );
}

type FilterPanelProps = {
  children: ReactNode;
  onClear: () => void;
  onDone: () => void;
};

/** The dropdown body shown under the filter chips. */
export function FilterPanel({ children, onClear, onDone }: FilterPanelProps) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {children}
      <View style={styles.panelActions}>
        <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary">
            Clear
          </ThemedText>
        </Pressable>
        <Pressable onPress={onDone} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="smallBold">Done</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
