/**
 * When a lender is usually free to meet, as weekday + part of day ("mon-morning"). The request
 * and change-plans forms only offer times inside those windows. No windows means any time.
 */
import { MEETING_TIMES } from './rentals';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export const DAY_PARTS = ['morning', 'afternoon', 'evening'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

/** Which part of the day a meeting time ("HH:MM") falls in: 9-11, 12-4, or 5-9. */
export function dayPartOf(time: string): DayPart {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

export function weekdayOf(date: string): Weekday {
  // getDay() is 0 for Sunday.
  return WEEKDAYS[(new Date(`${date}T00:00:00`).getDay() + 6) % 7];
}

export const windowKey = (day: Weekday, part: DayPart) => `${day}-${part}`;

/** Meeting times on a date that fit the lender's windows. Every time when they set none. */
export function timesForDate(windows: string[] | undefined, date: string | null): string[] {
  if (!windows || windows.length === 0 || !date) return MEETING_TIMES;
  const day = weekdayOf(date);
  return MEETING_TIMES.filter((time) => windows.includes(windowKey(day, dayPartOf(time))));
}
