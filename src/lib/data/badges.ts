/**
 * Trust badges, earned from verified activity and lost after strikes. Computed, never stored,
 * so they always reflect someone's current record.
 */
import type { Strike } from './moderation';
import { borrowCount, isOverdue, lendCount } from './rentals';
import { averageRating } from './reviews';
import type { Rental, Review } from './types';

export type BadgeId = 'verified_student' | 'trusted_lender' | 'on_time' | 'top_rated' | 'first_lend';

export const BADGES: Record<BadgeId, { label: string; description: string; icon: string }> = {
  verified_student: { label: 'UT verified', description: 'Signed up with a UT Austin email.', icon: '✓' },
  trusted_lender: {
    label: 'Trusted lender',
    description: '5+ completed lends, rated 4.5★ or higher, no strikes.',
    icon: '★',
  },
  on_time: { label: 'On-time returner', description: '3+ borrows, every one returned on time.', icon: '⏱' },
  top_rated: { label: 'Top rated', description: '3+ reviews averaging 4.8★ or higher.', icon: '♛' },
  first_lend: { label: 'First lend', description: 'Lent their first item.', icon: '✿' },
};

export const TRUSTED_LENDER_MIN_LENDS = 5;
export const TRUSTED_LENDER_MIN_RATING = 4.5;
export const ON_TIME_MIN_BORROWS = 3;
export const TOP_RATED_MIN_REVIEWS = 3;
export const TOP_RATED_MIN_RATING = 4.8;

type BadgeInput = {
  userId: string;
  isVerifiedStudent: boolean;
  rentals: Rental[];
  /** Public reviews about this user. */
  reviews: Review[];
  /** Strikes in the current window. Any strike removes the trust badges. */
  strikes: Strike[];
  now: Date;
};

/** The badges a user currently holds, most meaningful first. */
export function badgesFor({ userId, isVerifiedStudent, rentals, reviews, strikes, now }: BadgeInput): BadgeId[] {
  const badges: BadgeId[] = [];
  const clean = strikes.length === 0;
  if (isVerifiedStudent) badges.push('verified_student');

  const lends = lendCount(rentals, userId);
  const lenderRating = averageRating(reviews.filter((review) => review.revieweeRole === 'lender'));
  const trustedLender =
    clean &&
    lends >= TRUSTED_LENDER_MIN_LENDS &&
    (lenderRating === null || lenderRating >= TRUSTED_LENDER_MIN_RATING);
  if (trustedLender) badges.push('trusted_lender');

  const myBorrows = rentals.filter((rental) => rental.borrowerId === userId);
  const everLate = myBorrows.some((rental) => rental.returnedLate || isOverdue(rental, now));
  if (clean && borrowCount(rentals, userId) >= ON_TIME_MIN_BORROWS && !everLate) badges.push('on_time');

  const rating = averageRating(reviews);
  if (clean && reviews.length >= TOP_RATED_MIN_REVIEWS && rating !== null && rating >= TOP_RATED_MIN_RATING) {
    badges.push('top_rated');
  }

  if (lends >= 1 && !trustedLender) badges.push('first_lend');
  return badges;
}
