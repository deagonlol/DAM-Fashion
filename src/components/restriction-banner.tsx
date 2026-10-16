import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePenalty } from '@/hooks/use-moderation';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { restrictionMessage, SOFT_BAN_DAYS } from '@/lib/data/moderation';

/** Tells the signed-in user about strikes or a soft ban. Renders nothing for a clean record. */
export function RestrictionBanner() {
  const user = useCurrentUser();
  const penalty = usePenalty(user.id);
  const theme = useTheme();

  if (penalty.level === 'none' || penalty.level === 'banned') return null;

  const message =
    penalty.level === 'warning'
      ? penalty.strikes === 1
        ? `You have 1 strike from a missed pickup, late return, or upheld report. Another one limits your account for ${SOFT_BAN_DAYS} days.`
        : `You have ${penalty.strikes} recent strikes. One more and your account will be suspended.`
      : restrictionMessage(penalty);

  return (
    <View
      style={[styles.banner, { borderColor: penalty.level === 'soft_ban' ? theme.danger : theme.border, backgroundColor: theme.backgroundElement }]}
      accessibilityRole="alert">
      <ThemedText type="smallBold" themeColor={penalty.level === 'soft_ban' ? 'danger' : 'text'}>
        {penalty.level === 'soft_ban' ? 'Account limited' : 'Heads up'}
      </ThemedText>
      <ThemedText type="small">{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
