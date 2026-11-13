import type { SymbolViewProps } from 'expo-symbols';

import type { EventTag } from '@/lib/data/types';

type Icon = SymbolViewProps['name'];

/** One outline icon per event, used everywhere events show so the app has one icon style. */
export const EVENT_ICONS: Record<EventTag, Icon> = {
  'Game Day': { ios: 'football', android: 'sports_football', web: 'sports_football' },
  Professional: { ios: 'briefcase', android: 'work', web: 'work' },
  Formal: { ios: 'wineglass', android: 'wine_bar', web: 'wine_bar' },
  'Semi-Formal': { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  Halloween: { ios: 'moon.stars', android: 'nights_stay', web: 'nights_stay' },
  'Themed Party': { ios: 'party.popper', android: 'celebration', web: 'celebration' },
  'Concert & Festival': { ios: 'music.note', android: 'music_note', web: 'music_note' },
  Western: { ios: 'star', android: 'star', web: 'star' },
  Graduation: { ios: 'graduationcap', android: 'school', web: 'school' },
};
