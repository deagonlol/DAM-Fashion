/**
 * Reviews of people, written after a completed borrow. Double-blind: a review stays hidden
 * until the other person reviews too, or the review window closes, so neither side can
 * retaliate. Rules are pure functions (exported for tests); the async functions at the bottom
 * apply them to the in-memory store as the signed-in user.
 */
import { getCurrentUserId } from './session';
import { MOCK_REVIEWS } from './mock-data';
import { getRentalSnapshot, getRentalsSnapshot } from './rentals';
import { createStore } from './store';
import { REVIEW_TAGS, type Rental, type Review } from './types';

export class ReviewError extends Error {}

export const REVIEW_WINDOW_DAYS = 14;
export const MAX_REVIEW_LENGTH = 500;
export const MAX_REPLY_LENGTH = 300;

function windowClosesAt(rental: Rental) {
  return rental.returnedAt
    ? new Date(rental.returnedAt).getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
    : null;
}

/** Days left to review, rounded up, or 0 if the window is closed or never opened. */
export function reviewDaysLeft(rental: Rental, now: Date) {
  const closes = windowClosesAt(rental);
  if (closes === null) return 0;
  return Math.max(0, Math.ceil((closes - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Throws a ReviewError explaining why this user can't review this borrow right now. */
export function assertCanReview(rental: Rental, reviewerId: string, reviews: Review[], now: Date) {
  if (reviewerId !== rental.borrowerId && reviewerId !== rental.lenderId) {
    throw new ReviewError('Only the people in this borrow can review it.');
  }
  if (rental.status !== 'returned') {
    throw new ReviewError('You can review once the item has been returned.');
  }
  if (reviews.some((review) => review.rentalId === rental.id && review.reviewerId === reviewerId)) {
    throw new ReviewError("You've already reviewed this borrow.");
  }
  if (reviewDaysLeft(rental, now) === 0) {
    throw new ReviewError(`Reviews close ${REVIEW_WINDOW_DAYS} days after the return.`);
  }
}

export function canReview(rental: Rental, reviewerId: string, reviews: Review[], now: Date) {
  try {
    assertCanReview(rental, reviewerId, reviews, now);
    return true;
  } catch {
    return false;
  }
}

export type ReviewInput = { rentalId: string; rating: number; tags: string[]; comment: string };

/** Builds a review after checking every rule. */
export function createReview(
  rental: Rental,
  reviewerId: string,
  reviews: Review[],
  input: ReviewInput,
  now: Date
): Review {
  assertCanReview(rental, reviewerId, reviews, now);
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ReviewError('Pick a rating from 1 to 5 stars.');
  }
  const revieweeRole = reviewerId === rental.borrowerId ? 'lender' : 'borrower';
  const allowedTags: readonly string[] = REVIEW_TAGS[revieweeRole];
  if (input.tags.some((tag) => !allowedTags.includes(tag))) {
    throw new ReviewError('One of those tags doesn’t apply here.');
  }
  if (input.comment.length > MAX_REVIEW_LENGTH) {
    throw new ReviewError(`Keep it under ${MAX_REVIEW_LENGTH} characters.`);
  }
  return {
    id: `rv${now.getTime()}`,
    rentalId: rental.id,
    reviewerId,
    revieweeId: revieweeRole === 'lender' ? rental.lenderId : rental.borrowerId,
    revieweeRole,
    rating: input.rating,
    tags: [...new Set(input.tags)],
    comment: input.comment.trim(),
    createdAt: now.toISOString(),
  };
}

/** Visible once the other person has reviewed the same borrow, or the review window closed. */
export function isReviewVisible(review: Review, reviews: Review[], rentals: Rental[], now: Date) {
  const otherSideReviewed = reviews.some(
    (other) => other.rentalId === review.rentalId && other.reviewerId === review.revieweeId
  );
  if (otherSideReviewed) return true;
  const rental = rentals.find((candidate) => candidate.id === review.rentalId);
  const closes = rental ? windowClosesAt(rental) : null;
  return closes !== null && now.getTime() > closes;
}

/** Reviews about a user that are public, newest first. */
export function visibleReviewsAbout(userId: string, reviews: Review[], rentals: Rental[], now: Date) {
  return reviews
    .filter((review) => review.revieweeId === userId && isReviewVisible(review, reviews, rentals, now))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Average rating rounded to one decimal, or null with no reviews. */
export function averageRating(reviews: Review[]) {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

/** Adds the reviewee's one public reply. */
export function addReply(
  review: Review,
  actorId: string,
  text: string,
  reviews: Review[],
  rentals: Rental[],
  now: Date
): Review {
  if (actorId !== review.revieweeId) throw new ReviewError('Only the person reviewed can reply.');
  if (review.reply) throw new ReviewError('You’ve already replied to this review.');
  if (!isReviewVisible(review, reviews, rentals, now)) {
    throw new ReviewError('You can reply once the review is public.');
  }
  const trimmed = text.trim();
  if (!trimmed) throw new ReviewError('Write a reply first.');
  if (trimmed.length > MAX_REPLY_LENGTH) throw new ReviewError(`Keep replies under ${MAX_REPLY_LENGTH} characters.`);
  return { ...review, reply: { text: trimmed, createdAt: now.toISOString() } };
}

// ---- Store ---------------------------------------------------------------------------------

const reviewsStore = createStore<Review[]>(MOCK_REVIEWS);

export const subscribeToReviews = reviewsStore.subscribe;
export const getReviewsSnapshot = reviewsStore.get;

export async function submitReview(input: ReviewInput): Promise<Review> {
  const rental = getRentalSnapshot(input.rentalId);
  if (!rental) throw new ReviewError('Borrow not found.');
  const review = createReview(rental, getCurrentUserId(), reviewsStore.get(), input, new Date());
  reviewsStore.set([...reviewsStore.get(), review]);
  return review;
}

export async function replyToReview(reviewId: string, text: string): Promise<Review> {
  const review = reviewsStore.get().find((candidate) => candidate.id === reviewId);
  if (!review) throw new ReviewError('Review not found.');
  const updated = addReply(review, getCurrentUserId(), text, reviewsStore.get(), getRentalsSnapshot(), new Date());
  reviewsStore.set(reviewsStore.get().map((candidate) => (candidate.id === reviewId ? updated : candidate)));
  return updated;
}
