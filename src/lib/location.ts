/**
 * The person's rough location, asked for only when they tap "Show walking times", and shared
 * across screens for the rest of the session. Never stored or sent anywhere.
 */
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';

import { createStore } from './data/store';
import type { Coordinates } from './pickup-spots';

export type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'ready'; coords: Coordinates };

const locationStore = createStore<LocationState>({ status: 'idle' });

export async function requestLocation() {
  if (locationStore.get().status === 'loading') return;
  locationStore.set({ status: 'loading' });
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      locationStore.set({ status: 'denied' });
      return;
    }
    // Rough accuracy is plenty for walking times and comes back faster.
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    locationStore.set({
      status: 'ready',
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    });
  } catch {
    locationStore.set({ status: 'unavailable' });
  }
}

export function useLocationState() {
  return useSyncExternalStore(locationStore.subscribe, locationStore.get, locationStore.get);
}
