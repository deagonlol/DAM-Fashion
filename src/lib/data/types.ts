/** Type of clothing. Shown as "Type" in the UI. */
export const CATEGORIES = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Suits & Blazers',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Costumes',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Common college events a piece can be worn to. A listing can fit several. */
export const EVENTS = [
  'Game Day',
  'Professional',
  'Formal',
  'Semi-Formal',
  'Halloween',
  'Themed Party',
  'Concert & Festival',
  'Western',
  'Graduation',
] as const;
export type EventTag = (typeof EVENTS)[number];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type Size = (typeof SIZES)[number];

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  joinedAt: string;
  /** DAM Fashion team members can review reports. */
  role?: 'admin';
};

export const MAX_BIO_LENGTH = 160;

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: Category;
  events: EventTag[];
  size: Size;
  pricePerDay: number;
  /** Photos of the item from different angles. The first is the cover shown in lists. */
  imageUris: string[];
  createdAt: string;
  /** Paused listings are hidden from browsing and can't be requested. */
  paused?: boolean;
  /** Days (YYYY-MM-DD) the owner marked unavailable, e.g. they're wearing it themselves. */
  blockedDates?: string[];
};

export type NewListing = Omit<Listing, 'id' | 'ownerId' | 'createdAt' | 'paused' | 'blockedDates'>;

export const MAX_LISTING_PHOTOS = 6;

export const SORT_OPTIONS = ['Newest', 'Most relevant', 'Price: low to high', 'Price: high to low'] as const;
export type ListingSort = (typeof SORT_OPTIONS)[number];

/** Empty arrays mean "any". Within a filter, any selected value matches. */
export type ListingFilters = {
  query: string;
  categories: Category[];
  events: EventTag[];
  sizes: Size[];
  maxPrice: number | null;
};

/** A chat between a borrower and a listing's owner, about that listing. */
export type Conversation = {
  id: string;
  listingId: string;
  participantIds: [string, string];
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
};

/** Safe, public spots on campus for handoffs. A map picker can replace this later. */
export const PICKUP_SPOTS = [
  'Texas Union',
  'PCL (Perry-Castañeda Library)',
  'Gregory Gym',
  'Jester Center',
  'Speedway Plaza',
  'West Campus (Guadalupe & 24th)',
] as const;
export type PickupSpot = (typeof PICKUP_SPOTS)[number];

/**
 * Where a borrow is in its lifecycle:
 * requested → accepted → picked_up → returned, with declined / cancelled / no_show as dead ends.
 */
export type RentalStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'picked_up'
  | 'returned'
  | 'no_show';

/** One borrow of a listing, from request to return. */
export type Rental = {
  id: string;
  listingId: string;
  borrowerId: string;
  lenderId: string;
  /** Calendar dates, YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
  pickupSpot: PickupSpot;
  status: RentalStatus;
  createdAt: string;
  /**
   * Handoff codes, set when the lender accepts. The lender shows the pickup code and the
   * borrower enters it; at return it's the reverse. Proves both people met in person.
   * With a backend these are generated and checked on the server, never sent to the wrong side.
   */
  pickupCode?: string;
  returnCode?: string;
  pickedUpAt?: string;
  returnedAt?: string;
  /** Set at return if it came back after the due date plus the grace period. */
  returnedLate?: boolean;
  /** Set by the lender after return if the item came back damaged or dirty. */
  conditionIssue?: string;
  /** Who reported the other person didn't show up for pickup. */
  noShowReportedBy?: string;
};

export const REVIEW_TAGS = {
  /** Tags a borrower can give a lender. */
  lender: ['As described', 'Clean', 'Easy pickup', 'Quick replies'],
  /** Tags a lender can give a borrower. */
  borrower: ['On time', 'Took good care', 'Quick replies', 'Easy pickup'],
} as const;

/**
 * A review of a person, tied to one completed borrow so it always shows what was borrowed.
 * Reviews are double-blind: hidden until both people have reviewed, or the window closes.
 */
export type Review = {
  id: string;
  rentalId: string;
  reviewerId: string;
  revieweeId: string;
  /** The reviewee's role in that borrow. */
  revieweeRole: 'lender' | 'borrower';
  rating: number;
  tags: string[];
  comment: string;
  createdAt: string;
  /** The reviewee's one public reply. */
  reply?: { text: string; createdAt: string };
};

/** A user saving (liking) a listing. The heart count on a listing is how many saves it has. */
export type Save = {
  userId: string;
  listingId: string;
  createdAt: string;
};

export const REPORT_REASONS = [
  'No-show',
  'Harassment or threats',
  'Scam or payment issue',
  'Inappropriate messages',
  'Item not as described',
  'Damaged or kept an item',
  'Something else',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** A user reporting another user. The team reviews it and either upholds or dismisses it. */
export type Report = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  details: string;
  /** Where it happened, so the team can look at the chat, borrow, or listing. */
  conversationId?: string;
  rentalId?: string;
  listingId?: string;
  createdAt: string;
  status: 'open' | 'upheld' | 'dismissed';
  reviewedAt?: string;
};

/** One user blocking another: they can't see each other's listings, message, or borrow. */
export type Block = {
  blockerId: string;
  blockedId: string;
  createdAt: string;
};
