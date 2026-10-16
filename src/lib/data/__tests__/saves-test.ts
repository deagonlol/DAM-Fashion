import { toggleSaveIn } from '../saves';

const now = new Date('2026-10-16T12:00:00Z');

describe('toggleSaveIn', () => {
  it('saves, then unsaves on a second toggle', () => {
    const saved = toggleSaveIn([], 'me', 'a', now);
    expect(saved).toEqual([{ userId: 'me', listingId: 'a', createdAt: now.toISOString() }]);
    expect(toggleSaveIn(saved, 'me', 'a', now)).toEqual([]);
  });

  it("leaves other people's saves of the same listing alone", () => {
    const saves = [{ userId: 'other', listingId: 'a', createdAt: now.toISOString() }];
    expect(toggleSaveIn(saves, 'me', 'a', now)).toHaveLength(2);
    expect(toggleSaveIn(toggleSaveIn(saves, 'me', 'a', now), 'me', 'a', now)).toEqual(saves);
  });
});
