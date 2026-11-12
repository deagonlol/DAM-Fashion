import { dayPartOf, timesForDate, weekdayOf } from '../availability';
import { MEETING_TIMES } from '../rentals';

describe('dayPartOf', () => {
  it('splits the day into morning (9-11), afternoon (12-4) and evening (5-9)', () => {
    expect(dayPartOf('09:00')).toBe('morning');
    expect(dayPartOf('11:00')).toBe('morning');
    expect(dayPartOf('12:00')).toBe('afternoon');
    expect(dayPartOf('16:00')).toBe('afternoon');
    expect(dayPartOf('17:00')).toBe('evening');
    expect(dayPartOf('21:00')).toBe('evening');
  });
});

describe('weekdayOf', () => {
  it('names the weekday of a date', () => {
    expect(weekdayOf('2026-11-09')).toBe('mon');
    expect(weekdayOf('2026-11-14')).toBe('sat');
    expect(weekdayOf('2026-11-15')).toBe('sun');
  });
});

describe('timesForDate', () => {
  it('offers every time when the lender set no windows, or no date is picked', () => {
    expect(timesForDate([], '2026-11-14')).toEqual(MEETING_TIMES);
    expect(timesForDate(undefined, '2026-11-14')).toEqual(MEETING_TIMES);
    expect(timesForDate(['sat-evening'], null)).toEqual(MEETING_TIMES);
  });

  it('offers only times inside that weekday’s windows', () => {
    const windows = ['sat-morning', 'sat-evening', 'mon-afternoon'];
    expect(timesForDate(windows, '2026-11-14')).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '17:00',
      '18:00',
      '19:00',
      '20:00',
      '21:00',
    ]);
    expect(timesForDate(windows, '2026-11-09')).toEqual(['12:00', '13:00', '14:00', '15:00', '16:00']);
    expect(timesForDate(windows, '2026-11-10')).toEqual([]);
  });
});
