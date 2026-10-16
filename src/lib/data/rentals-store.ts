/** The in-memory rentals table, shared by rentals.ts and moderation.ts without an import cycle. */
import { MOCK_RENTALS } from './mock-data';
import { createStore } from './store';
import type { Rental } from './types';

export const rentalsStore = createStore<Rental[]>(MOCK_RENTALS);
