/** The loaded rentals, shared by rentals.ts and moderation.ts without an import cycle. */
import { createStore } from './store';
import type { Rental } from './types';

export const rentalsStore = createStore<Rental[]>([]);
