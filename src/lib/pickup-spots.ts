/**
 * Where the campus pickup spots are, a link to open each in the phone's maps app, and a rough
 * walking time from where the person is. Free: no map API or key, just links and arithmetic.
 */
import { Platform } from 'react-native';

import type { PickupSpot } from './data/types';

type SpotPlace = { latitude: number; longitude: number; /** What the maps app searches for. */ query: string };

/** Approximate building entrances on the UT Austin campus. Close enough for a pin and a walking time. */
export const SPOT_PLACES: Record<PickupSpot, SpotPlace> = {
  'Texas Union': { latitude: 30.28657, longitude: -97.74125, query: 'Texas Union, 2308 Whitis Ave, Austin, TX' },
  'PCL (Perry-Castañeda Library)': {
    latitude: 30.28276,
    longitude: -97.73812,
    query: 'Perry-Castañeda Library, 101 E 21st St, Austin, TX',
  },
  'Gregory Gym': { latitude: 30.28423, longitude: -97.73662, query: 'Gregory Gym, 2101 Speedway, Austin, TX' },
  'Jester Center': { latitude: 30.28293, longitude: -97.73665, query: 'Jester Center, 201 E 21st St, Austin, TX' },
  'Speedway Plaza': {
    latitude: 30.286,
    longitude: -97.7366,
    query: 'Speedway Plaza, Speedway & E 24th St, Austin, TX',
  },
  'West Campus (Guadalupe & 24th)': {
    latitude: 30.28778,
    longitude: -97.74188,
    query: 'Guadalupe St & W 24th St, Austin, TX',
  },
};

/** A link that opens the spot in Apple Maps on iPhone, and Google Maps everywhere else. */
export function mapsUrl(spot: PickupSpot) {
  const place = SPOT_PLACES[spot];
  const query = encodeURIComponent(place.query);
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?q=${query}&ll=${place.latitude},${place.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${place.latitude}%2C${place.longitude}`;
}

export type Coordinates = { latitude: number; longitude: number };

/** Straight-line distance in meters (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Walking speed (~1.3 m/s) with extra distance for streets not being straight lines. */
const METERS_PER_MINUTE = 80;
const DETOUR = 1.3;
/** Past this, it's not really a walk from where they are, so no time is shown. */
const MAX_WALK_MINUTES = 60;

/** "~6 min walk", or null when it's too far to call a walk. */
export function walkingLabel(from: Coordinates, spot: PickupSpot) {
  const minutes = Math.max(1, Math.round((distanceMeters(from, SPOT_PLACES[spot]) * DETOUR) / METERS_PER_MINUTE));
  return minutes > MAX_WALK_MINUTES ? null : `~${minutes} min walk`;
}
