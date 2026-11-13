import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FEES_CHARGED, type PriceBreakdown as Breakdown } from '@/lib/fees';
import { formatPrice } from '@/lib/format';

type Props = {
  price: Breakdown;
  /** Payer sees the fee and their total; payee sees what they get. */
  role: 'payer' | 'payee';
  /** e.g. "$6/day × 2 days" or "Item price". */
  label: string;
};

/** What the borrower or buyer pays, and what the lender or seller gets. */
export function PriceBreakdown({ price, role, label }: Props) {
  const theme = useTheme();
  const payer = role === 'payer';
  return (
    <View style={styles.box}>
      <Line label={label} value={formatPrice(price.subtotal)} />
      {payer ? <Line label="Service fee" value={formatPrice(price.fee)} /> : null}
      <View style={[styles.rule, { backgroundColor: theme.border }]} />
      <Line label={payer ? 'You pay' : 'You get'} value={formatPrice(payer ? price.total : price.subtotal)} bold />
      <ThemedText type="small" themeColor="textSecondary">
        {payer
          ? FEES_CHARGED
            ? 'The service fee covers payment protection and support.'
            : `Beta: the service fee isn’t charged yet. Pay ${formatPrice(price.subtotal)} at pickup.`
          : 'You keep 100% of your price. Lendr’s fee is paid by the other person.'}
      </ThemedText>
    </View>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <ThemedText
        type={bold ? 'smallBold' : 'small'}
        themeColor={bold ? undefined : 'textSecondary'}
        style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.two,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
  },
});
