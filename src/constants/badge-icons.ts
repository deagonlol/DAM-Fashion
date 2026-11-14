import type { SymbolViewProps } from 'expo-symbols';

import type { BadgeId } from '@/lib/data/badges';

type Icon = SymbolViewProps['name'];

/** One outline icon per badge, in the same style as the event icons. */
export const BADGE_ICONS: Record<BadgeId, Icon> = {
  verified_student: { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  trusted_lender: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  on_time: { ios: 'clock', android: 'schedule', web: 'schedule' },
  top_rated: { ios: 'crown', android: 'workspace_premium', web: 'workspace_premium' },
  first_lend: { ios: 'hanger', android: 'checkroom', web: 'checkroom' },
};
