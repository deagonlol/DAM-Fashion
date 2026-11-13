/**
 * Phone alerts for a confirmed borrow. The day before pickup, an hour before pickup, and on the
 * return day. Only future times are returned; the in-app list covers anything already due.
 */
import { formatTime } from '../format';
import { daysOverdue, toDateString } from './rentals';
import type { Listing, Rental } from './types';

export type NotificationPlan = {
  id: string;
  title: string;
  body: string;
  fireAt: Date;
  href: string;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Far enough to cover a borrow booked this month, inside the OS cap on scheduled alerts. */
const HORIZON_DAYS = 30;

function atLocal(date: string, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const at = new Date(`${date}T00:00:00`);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00`);
  shifted.setDate(shifted.getDate() + days);
  return toDateString(shifted);
}

export function notificationPlans({
  userId,
  rentals,
  listings,
  now,
}: {
  userId: string;
  rentals: Rental[];
  listings: Listing[];
  now: Date;
}): NotificationPlan[] {
  const titleOf = (listingId: string) => listings.find((listing) => listing.id === listingId)?.title ?? 'your item';
  const latest = now.getTime() + HORIZON_DAYS * DAY_MS;
  const plans: NotificationPlan[] = [];

  function add(plan: NotificationPlan) {
    const at = plan.fireAt.getTime();
    if (at > now.getTime() && at <= latest) plans.push(plan);
  }

  for (const rental of rentals) {
    const borrowing = rental.borrowerId === userId;
    const lending = rental.lenderId === userId;
    if (!borrowing && !lending) continue;
    const item = titleOf(rental.listingId);
    const href = `/rental/${rental.id}`;
    const when = rental.pickupTime ? formatTime(rental.pickupTime) : null;

    if (rental.status === 'accepted') {
      add({
        id: `pickup-eve-${rental.id}`,
        title: borrowing ? 'Pickup tomorrow' : 'Handoff tomorrow',
        body: [item, rental.pickupSpot, when].filter(Boolean).join(' · '),
        fireAt: atLocal(shiftDate(rental.startDate, -1), '18:00'),
        href,
      });
      if (rental.pickupTime) {
        add({
          id: `pickup-hour-${rental.id}`,
          title: borrowing ? 'Pickup in 1 hour' : 'Handoff in 1 hour',
          body: `${item} · ${rental.pickupSpot}`,
          fireAt: new Date(atLocal(rental.startDate, rental.pickupTime).getTime() - HOUR_MS),
          href,
        });
      }
    }

    if (rental.status === 'picked_up' && daysOverdue(rental, now) === 0) {
      const back = rental.returnTime ? formatTime(rental.returnTime) : null;
      add({
        id: `return-${rental.id}`,
        title: borrowing ? 'Return due today' : `${item} comes back today`,
        body: [borrowing ? item : null, back, rental.pickupSpot].filter(Boolean).join(' · '),
        fireAt: rental.returnTime
          ? new Date(atLocal(rental.endDate, rental.returnTime).getTime() - HOUR_MS)
          : atLocal(rental.endDate, '09:00'),
        href,
      });
    }
  }

  return plans.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
