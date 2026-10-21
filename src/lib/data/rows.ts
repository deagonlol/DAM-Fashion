/**
 * Database rows (snake_case, see supabase/migrations) to the app's types (camelCase), and the
 * error type for failed Supabase calls. Only data modules use these.
 */
import type {
  Block,
  Category,
  Conversation,
  EventTag,
  Listing,
  Message,
  PickupSpot,
  Rental,
  RentalStatus,
  Report,
  ReportReason,
  Review,
  Save,
  Size,
  User,
} from './types';

export type ProfileRow = {
  id: string;
  name: string;
  bio: string;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
};

export type ListingRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  events: string[];
  size: string;
  price_per_day: number | string;
  image_uris: string[];
  paused: boolean;
  blocked_dates: string[];
  created_at: string;
};

export type ConversationRow = {
  id: string;
  listing_id: string;
  borrower_id: string;
  owner_id: string;
  created_at: string;
};

export type MessageRow = { id: string; conversation_id: string; sender_id: string; text: string; created_at: string };

export type RentalRow = {
  id: string;
  listing_id: string;
  borrower_id: string;
  lender_id: string;
  start_date: string;
  end_date: string;
  pickup_spot: string | null;
  status: string;
  created_at: string;
  picked_up_at: string | null;
  returned_at: string | null;
  returned_late: boolean | null;
  condition_issue: string | null;
  no_show_reported_by: string | null;
};

export type RentalCodeRow = { rental_id: string; kind: 'pickup' | 'return'; code: string };

export type ReviewRow = {
  id: string;
  rental_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewee_role: 'lender' | 'borrower';
  rating: number;
  tags: string[];
  comment: string;
  created_at: string;
  reply_text: string | null;
  reply_created_at: string | null;
};

export type SaveRow = { user_id: string; listing_id: string; created_at: string };

export type ReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string;
  conversation_id: string | null;
  rental_id: string | null;
  listing_id: string | null;
  created_at: string;
  status: Report['status'];
  reviewed_at: string | null;
};

/** From upheld_reports(): enough to count a strike, without who filed it. */
export type UpheldReportRow = {
  id: string;
  reported_user_id: string;
  rental_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type BlockRow = { blocker_id: string; blocked_id: string; created_at: string };

/** Thrown when a Supabase call fails. The message is safe to show. */
export class BackendError extends Error {}

/** Unwraps a Supabase result, throwing `ErrorType` with the server's message on failure. */
export function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  ErrorType: new (message: string) => Error = BackendError
): T {
  if (result.error) throw new ErrorType(result.error.message);
  return result.data as T;
}

const optional = <T>(value: T | null): T | undefined => value ?? undefined;

/** Other people's emails aren't public, so `email` is only known for the signed-in user. */
export function toUser(row: ProfileRow, email = ''): User {
  return {
    id: row.id,
    name: row.name,
    email,
    avatarUrl: optional(row.avatar_url),
    bio: row.bio || undefined,
    joinedAt: row.created_at,
    role: row.role === 'admin' ? 'admin' : undefined,
  };
}

export function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    category: row.category as Category,
    events: row.events as EventTag[],
    size: row.size as Size,
    pricePerDay: Number(row.price_per_day),
    imageUris: row.image_uris,
    createdAt: row.created_at,
    paused: row.paused,
    blockedDates: row.blocked_dates,
  };
}

export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    listingId: row.listing_id,
    participantIds: [row.borrower_id, row.owner_id],
    createdAt: row.created_at,
  };
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at,
  };
}

/** Codes are only included for the person who holds them (the one who shows the code). */
export function toRental(row: RentalRow, codes: RentalCodeRow[] = []): Rental {
  const code = (kind: RentalCodeRow['kind']) =>
    codes.find((candidate) => candidate.rental_id === row.id && candidate.kind === kind)?.code;
  return {
    id: row.id,
    listingId: row.listing_id,
    borrowerId: row.borrower_id,
    lenderId: row.lender_id,
    startDate: row.start_date,
    endDate: row.end_date,
    // Hidden from people outside the borrow.
    pickupSpot: (row.pickup_spot ?? '') as PickupSpot,
    status: row.status as RentalStatus,
    createdAt: row.created_at,
    pickupCode: code('pickup'),
    returnCode: code('return'),
    pickedUpAt: optional(row.picked_up_at),
    returnedAt: optional(row.returned_at),
    returnedLate: optional(row.returned_late),
    conditionIssue: optional(row.condition_issue),
    noShowReportedBy: optional(row.no_show_reported_by),
  };
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    rentalId: row.rental_id,
    reviewerId: row.reviewer_id,
    revieweeId: row.reviewee_id,
    revieweeRole: row.reviewee_role,
    rating: row.rating,
    tags: row.tags,
    comment: row.comment,
    createdAt: row.created_at,
    reply:
      row.reply_text && row.reply_created_at
        ? { text: row.reply_text, createdAt: row.reply_created_at }
        : undefined,
  };
}

export function toSave(row: SaveRow): Save {
  return { userId: row.user_id, listingId: row.listing_id, createdAt: row.created_at };
}

export function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reportedUserId: row.reported_user_id,
    reason: row.reason as ReportReason,
    details: row.details,
    conversationId: optional(row.conversation_id),
    rentalId: optional(row.rental_id),
    listingId: optional(row.listing_id),
    createdAt: row.created_at,
    status: row.status,
    reviewedAt: optional(row.reviewed_at),
  };
}

/** An upheld report filed by someone else: only the parts strikes need. */
export function toUpheldReport(row: UpheldReportRow): Report {
  return {
    id: row.id,
    reporterId: '',
    reportedUserId: row.reported_user_id,
    reason: 'Something else',
    details: '',
    rentalId: optional(row.rental_id),
    createdAt: row.created_at,
    status: 'upheld',
    reviewedAt: optional(row.reviewed_at),
  };
}

export function toBlock(row: BlockRow): Block {
  return { blockerId: row.blocker_id, blockedId: row.blocked_id, createdAt: row.created_at };
}
