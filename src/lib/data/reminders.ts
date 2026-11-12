/**
 * "Coming up" on Home: the things that need the person soon, most urgent first. Built from data
 * the app already has, so it's free and works without notifications.
 */
import { formatTime } from '../format';
import { daysOverdue, isExpiredRequest, toDateString } from './rentals';
import type { Listing, Rental, RentalProposal, Sale } from './types';

export type Reminder = {
  key: string;
  title: string;
  detail?: string;
  tone: 'danger' | 'accent' | 'muted';
  /** Where tapping it goes. */
  href: string;
};

type ReminderInput = {
  userId: string;
  rentals: Rental[];
  sales: Sale[];
  proposals: RentalProposal[];
  listings: Listing[];
  now: Date;
};

/** "today", "tomorrow", or null when it's further out than that. */
function soonLabel(date: string, now: Date) {
  const today = toDateString(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === today) return 'today';
  if (date === toDateString(tomorrow)) return 'tomorrow';
  return null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function remindersFor({ userId, rentals, sales, proposals, listings, now }: ReminderInput): Reminder[] {
  const titleOf = (listingId: string) => listings.find((listing) => listing.id === listingId)?.title ?? 'your item';
  const today = toDateString(now);
  const urgent: Reminder[] = [];
  const soon: { at: string; reminder: Reminder }[] = [];
  const later: Reminder[] = [];

  for (const rental of rentals) {
    const borrowing = rental.borrowerId === userId;
    const lending = rental.lenderId === userId;
    if (!borrowing && !lending) continue;
    const item = titleOf(rental.listingId);
    const href = `/rental/${rental.id}`;

    if (rental.status === 'picked_up') {
      const late = daysOverdue(rental, now);
      if (late > 0) {
        urgent.push({
          key: `overdue-${rental.id}`,
          title: borrowing ? `Overdue: return the ${item}` : `${item} is overdue`,
          detail: `${late} ${late === 1 ? 'day' : 'days'} late · ${rental.pickupSpot}`,
          tone: 'danger',
          href,
        });
        continue;
      }
      const day = soonLabel(rental.endDate, now);
      if (day) {
        soon.push({
          at: `${rental.endDate}T${rental.returnTime ?? '23:59'}`,
          reminder: {
            key: `return-${rental.id}`,
            title: borrowing ? `Return due ${day}` : `${item} comes back ${day}`,
            detail: `${borrowing ? `${item} · ` : ''}${rental.returnTime ? `${formatTime(rental.returnTime)} · ` : ''}${rental.pickupSpot}`,
            tone: 'accent',
            href,
          },
        });
      }
    }

    if (rental.status === 'accepted') {
      const day = soonLabel(rental.startDate, now);
      if (day) {
        soon.push({
          at: `${rental.startDate}T${rental.pickupTime ?? '00:00'}`,
          reminder: {
            key: `pickup-${rental.id}`,
            title: `${capitalize(borrowing ? 'pickup' : 'handoff')} ${day}${rental.pickupTime ? `, ${formatTime(rental.pickupTime)}` : ''}`,
            detail: `${item} · ${rental.pickupSpot}`,
            tone: 'accent',
            href,
          },
        });
      }
    }
  }

  // Counter-offers and new plans waiting on this person.
  for (const proposal of proposals) {
    if (proposal.status !== 'pending' || proposal.proposerId === userId) continue;
    const rental = rentals.find((candidate) => candidate.id === proposal.rentalId);
    if (!rental || (rental.borrowerId !== userId && rental.lenderId !== userId)) continue;
    urgent.push({
      key: `proposal-${proposal.id}`,
      title: rental.status === 'requested' ? 'Counter-offer to review' : 'New plans to review',
      detail: titleOf(rental.listingId),
      tone: 'accent',
      href: `/rental/${rental.id}`,
    });
  }

  // Borrow and buy requests waiting for this person's answer, as one line.
  const borrowRequests = rentals.filter(
    (rental) => rental.lenderId === userId && rental.status === 'requested' && !isExpiredRequest(rental, today)
  ).length;
  const buyRequests = sales.filter((sale) => sale.sellerId === userId && sale.status === 'requested').length;
  const waiting = borrowRequests + buyRequests;
  if (waiting > 0) {
    later.push({
      key: 'requests',
      title: `${waiting} ${waiting === 1 ? 'request' : 'requests'} waiting for you`,
      detail: [borrowRequests ? `${borrowRequests} to borrow` : null, buyRequests ? `${buyRequests} to buy` : null]
        .filter(Boolean)
        .join(' · '),
      tone: 'accent',
      href: '/orders',
    });
  }

  return [...urgent, ...soon.sort((a, b) => a.at.localeCompare(b.at)).map((entry) => entry.reminder), ...later];
}
