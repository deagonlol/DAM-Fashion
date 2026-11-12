import { distanceMeters, SPOT_PLACES, walkingLabel } from '../pickup-spots';
import { PICKUP_SPOTS } from '../data/types';

describe('pickup spots', () => {
  it('has a place for every spot', () => {
    for (const spot of PICKUP_SPOTS) expect(SPOT_PLACES[spot]).toBeDefined();
  });

  it('measures distance between two points', () => {
    const union = SPOT_PLACES['Texas Union'];
    expect(distanceMeters(union, union)).toBe(0);
    // Texas Union to Gregory Gym is a few hundred meters across campus.
    const meters = distanceMeters(union, SPOT_PLACES['Gregory Gym']);
    expect(meters).toBeGreaterThan(300);
    expect(meters).toBeLessThan(800);
  });

  it('labels walks in minutes, and nothing when it is too far to walk', () => {
    expect(walkingLabel(SPOT_PLACES['Texas Union'], 'Texas Union')).toBe('~1 min walk');
    expect(walkingLabel(SPOT_PLACES['Texas Union'], 'Gregory Gym')).toMatch(/^~\d+ min walk$/);
    // Downtown Dallas.
    expect(walkingLabel({ latitude: 32.7767, longitude: -96.797 }, 'Texas Union')).toBeNull();
  });
});
