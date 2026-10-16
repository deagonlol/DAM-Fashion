import type { Block, Conversation, Listing, Message, Rental, Report, Review, Save, User } from './types';

/** Local calendar date `offset` days from today, as YYYY-MM-DD. Keeps in-progress mock borrows current. */
function day(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Timestamp `offset` days from now. */
function at(offset: number) {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString();
}

/** Every mock account signs in with this password. */
export const MOCK_PASSWORD = 'password';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Alex Kim',
    email: 'alex@utexas.edu',
    bio: 'Business junior. Mostly professional stuff and the occasional costume.',
    joinedAt: '2026-08-20T00:00:00Z',
  },
  {
    id: 'u2',
    name: 'Ronit S.',
    email: 'ronit@utexas.edu',
    avatarUrl: 'https://i.pravatar.cc/200?img=12',
    bio: 'Never miss a home game. Happy to lend gameday fits.',
    joinedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'u3',
    name: 'Maya L.',
    email: 'maya@utexas.edu',
    avatarUrl: 'https://i.pravatar.cc/200?img=47',
    bio: 'Formals, festivals, and boots. Pickups near Jester.',
    joinedAt: '2025-09-02T00:00:00Z',
  },
  {
    // Two recent no-shows, so currently soft-banned.
    id: 'u4',
    name: 'Jordan P.',
    email: 'jordan@utexas.edu',
    joinedAt: '2026-07-01T00:00:00Z',
  },
  {
    // DAM Fashion team account: sign in as admin@utexas.edu to review reports.
    id: 'u5',
    name: 'DAM Team',
    email: 'admin@utexas.edu',
    joinedAt: '2025-08-01T00:00:00Z',
    role: 'admin',
  },
];

const image = (seed: string) => `https://picsum.photos/seed/${seed}/600/800`;

export const MOCK_LISTINGS: Listing[] = [
  {
    id: 'l1',
    ownerId: 'u2',
    title: 'Burnt orange gameday polo',
    description: 'Worn twice. Perfect for a home game at DKR.',
    category: 'Tops',
    events: ['Game Day'],
    size: 'M',
    pricePerDay: 5,
    imageUris: [image('polo'), image('polo-back'), image('polo-detail')],
    createdAt: '2026-10-01T12:00:00Z',
  },
  {
    id: 'l2',
    ownerId: 'u3',
    title: 'Black satin formal dress',
    description: 'Floor length, great for formals and galas.',
    category: 'Dresses',
    events: ['Formal', 'Semi-Formal'],
    size: 'S',
    pricePerDay: 15,
    imageUris: [image('dress'), image('dress-back'), image('dress-detail')],
    createdAt: '2026-10-02T12:00:00Z',
  },
  {
    id: 'l3',
    ownerId: 'u2',
    title: 'Navy blazer',
    description: 'Slim fit. Good for career fair or interviews.',
    category: 'Suits & Blazers',
    events: ['Professional', 'Formal'],
    size: 'L',
    pricePerDay: 10,
    imageUris: [image('blazer'), image('blazer-back'), image('blazer-detail')],
    createdAt: '2026-10-03T12:00:00Z',
  },
  {
    id: 'l4',
    ownerId: 'u3',
    title: 'White cowboy boots',
    description: 'Size 8 women’s. Western-themed events, ACL, rodeo.',
    category: 'Shoes',
    events: ['Western', 'Concert & Festival'],
    size: 'M',
    pricePerDay: 8,
    imageUris: [image('boots'), image('boots-back'), image('boots-detail')],
    createdAt: '2026-10-04T12:00:00Z',
  },
  {
    id: 'l5',
    ownerId: 'u1',
    title: 'Khaki chinos',
    description: 'Business casual staple.',
    category: 'Bottoms',
    events: ['Professional'],
    size: 'M',
    pricePerDay: 4,
    imageUris: [image('chinos'), image('chinos-back'), image('chinos-detail')],
    createdAt: '2026-10-05T12:00:00Z',
  },
  {
    id: 'l6',
    ownerId: 'u2',
    title: 'Longhorns denim jacket',
    description: 'Embroidered back patch.',
    category: 'Outerwear',
    events: ['Game Day', 'Concert & Festival'],
    size: 'XL',
    pricePerDay: 7,
    imageUris: [image('denim'), image('denim-back'), image('denim-detail')],
    createdAt: '2026-10-06T12:00:00Z',
  },
  {
    id: 'l7',
    ownerId: 'u3',
    title: 'Gold statement earrings',
    description: 'Lightweight, pairs with anything formal.',
    category: 'Accessories',
    events: ['Formal', 'Semi-Formal', 'Graduation'],
    size: 'M',
    pricePerDay: 3,
    imageUris: [image('earrings'), image('earrings-back'), image('earrings-detail')],
    createdAt: '2026-10-07T12:00:00Z',
  },
  {
    id: 'l8',
    ownerId: 'u1',
    title: 'Halloween costume cape',
    description: 'Red velvet cape, one size fits most.',
    category: 'Costumes',
    events: ['Halloween', 'Themed Party'],
    size: 'L',
    pricePerDay: 6,
    imageUris: [image('cape'), image('cape-back'), image('cape-detail')],
    createdAt: '2026-10-08T12:00:00Z',
  },
  {
    // Hidden from browsing while Jordan is restricted.
    id: 'l9',
    ownerId: 'u4',
    title: 'Grey suit jacket',
    description: 'Two-button, good for interviews.',
    category: 'Suits & Blazers',
    events: ['Professional'],
    size: 'M',
    pricePerDay: 9,
    imageUris: [image('suit'), image('suit-back')],
    createdAt: '2026-10-09T12:00:00Z',
  },
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  { id: 'c1', listingId: 'l1', participantIds: ['u1', 'u2'], createdAt: '2026-10-09T15:00:00Z' },
  { id: 'c2', listingId: 'l5', participantIds: ['u3', 'u1'], createdAt: '2026-10-10T18:00:00Z' },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    text: 'Hey! Could I borrow the polo for Saturday’s game?',
    createdAt: '2026-10-09T15:00:00Z',
  },
  {
    id: 'm2',
    conversationId: 'c1',
    senderId: 'u2',
    text: 'For sure. Want to pick it up Friday near Jester?',
    createdAt: '2026-10-09T15:12:00Z',
  },
  {
    id: 'm3',
    conversationId: 'c2',
    senderId: 'u3',
    text: 'Are the chinos still available for next week?',
    createdAt: '2026-10-10T18:00:00Z',
  },
];

/**
 * Borrows covering each stage and the main edge cases. "Alex" (u1) is the sample login.
 */
export const MOCK_RENTALS: Rental[] = [
  // Finished borrows, both sides reviewed.
  {
    id: 'r1', listingId: 'l1', borrowerId: 'u1', lenderId: 'u2', pickupSpot: 'Jester Center',
    startDate: '2026-09-12', endDate: '2026-09-13', status: 'returned', createdAt: '2026-09-08T12:00:00Z',
    pickedUpAt: '2026-09-12T15:00:00Z', returnedAt: '2026-09-13T20:00:00Z',
  },
  {
    id: 'r2', listingId: 'l3', borrowerId: 'u1', lenderId: 'u2', pickupSpot: 'Texas Union',
    startDate: '2026-09-24', endDate: '2026-09-25', status: 'returned', createdAt: '2026-09-20T12:00:00Z',
    pickedUpAt: '2026-09-24T10:00:00Z', returnedAt: '2026-09-25T18:00:00Z',
  },
  {
    id: 'r4', listingId: 'l5', borrowerId: 'u3', lenderId: 'u1', pickupSpot: 'PCL (Perry-Castañeda Library)',
    startDate: '2026-09-30', endDate: '2026-10-01', status: 'returned', createdAt: '2026-09-27T12:00:00Z',
    pickedUpAt: '2026-09-30T12:00:00Z', returnedAt: '2026-10-01T19:00:00Z',
  },
  {
    id: 'r8', listingId: 'l2', borrowerId: 'u2', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: '2026-04-10', endDate: '2026-04-11', status: 'returned', createdAt: '2026-04-05T12:00:00Z',
    pickedUpAt: '2026-04-10T18:00:00Z', returnedAt: '2026-04-11T21:00:00Z',
  },
  // Returned recently: Maya reviewed Alex, Alex hasn't reviewed yet, so Maya's review stays hidden.
  {
    id: 'r3', listingId: 'l4', borrowerId: 'u1', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: day(-12), endDate: day(-11), status: 'returned', createdAt: at(-15),
    pickedUpAt: at(-12), returnedAt: at(-10),
  },
  // Alex borrowed the polo a second time; returned, nobody has reviewed yet.
  {
    id: 'r5', listingId: 'l1', borrowerId: 'u1', lenderId: 'u2', pickupSpot: 'Speedway Plaza',
    startDate: day(-5), endDate: day(-4), status: 'returned', createdAt: at(-8),
    pickedUpAt: at(-5), returnedAt: at(-4),
  },
  // Overdue: Alex has Maya's earrings and the return date has passed.
  {
    id: 'r9', listingId: 'l7', borrowerId: 'u1', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: day(-3), endDate: day(-1), status: 'picked_up', createdAt: at(-6),
    pickupCode: '5310', returnCode: '7724', pickedUpAt: at(-3),
  },
  // Accepted, pickup coming up: Alex is borrowing Ronit's denim jacket.
  {
    id: 'r7', listingId: 'l6', borrowerId: 'u1', lenderId: 'u2', pickupSpot: 'Texas Union',
    startDate: day(2), endDate: day(3), status: 'accepted', createdAt: at(-1),
    pickupCode: '4821', returnCode: '1937',
  },
  // Waiting on Alex: Ronit wants to borrow Alex's cape.
  {
    id: 'r6', listingId: 'l8', borrowerId: 'u2', lenderId: 'u1', pickupSpot: 'Gregory Gym',
    startDate: day(3), endDate: day(4), status: 'requested', createdAt: at(-0.2),
  },
  // More of Maya's lending history (earns her the Trusted lender badge).
  {
    id: 'r11', listingId: 'l4', borrowerId: 'u2', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: '2026-03-01', endDate: '2026-03-02', status: 'returned', createdAt: '2026-02-25T12:00:00Z',
    pickedUpAt: '2026-03-01T12:00:00Z', returnedAt: '2026-03-02T18:00:00Z',
  },
  {
    id: 'r12', listingId: 'l7', borrowerId: 'u2', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: '2026-05-01', endDate: '2026-05-01', status: 'returned', createdAt: '2026-04-25T12:00:00Z',
    pickedUpAt: '2026-05-01T12:00:00Z', returnedAt: '2026-05-01T22:00:00Z',
  },
  {
    id: 'r13', listingId: 'l2', borrowerId: 'u1', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: '2026-09-05', endDate: '2026-09-06', status: 'returned', createdAt: '2026-09-01T12:00:00Z',
    pickedUpAt: '2026-09-05T12:00:00Z', returnedAt: '2026-09-06T20:00:00Z',
  },
  // Jordan's two no-shows: two strikes, so a soft ban for 7 days after the latest.
  {
    id: 'r20', listingId: 'l1', borrowerId: 'u4', lenderId: 'u2', pickupSpot: 'Gregory Gym',
    startDate: day(-30), endDate: day(-29), status: 'no_show', createdAt: at(-33),
    pickupCode: '1111', returnCode: '2222', noShowReportedBy: 'u2',
  },
  {
    id: 'r21', listingId: 'l2', borrowerId: 'u4', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: day(-3), endDate: day(-2), status: 'no_show', createdAt: at(-6),
    pickupCode: '3333', returnCode: '4444', noShowReportedBy: 'u3',
  },
  // Waiting on Maya: Alex asked to borrow the formal dress.
  {
    id: 'r10', listingId: 'l2', borrowerId: 'u1', lenderId: 'u3', pickupSpot: 'Jester Center',
    startDate: day(5), endDate: day(6), status: 'requested', createdAt: at(-0.5),
  },
];

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'rv1', rentalId: 'r1', reviewerId: 'u1', revieweeId: 'u2', revieweeRole: 'lender', rating: 5,
    tags: ['As described', 'Easy pickup'], comment: 'Polo was perfect for the game!',
    createdAt: '2026-09-14T12:00:00Z',
  },
  {
    id: 'rv2', rentalId: 'r1', reviewerId: 'u2', revieweeId: 'u1', revieweeRole: 'borrower', rating: 5,
    tags: ['On time', 'Took good care'], comment: 'Returned it washed. Would lend again.',
    createdAt: '2026-09-14T15:00:00Z',
  },
  {
    id: 'rv3', rentalId: 'r2', reviewerId: 'u1', revieweeId: 'u2', revieweeRole: 'lender', rating: 4,
    tags: ['Quick replies'], comment: 'Blazer fit great, it was a little wrinkled though.',
    createdAt: '2026-09-26T12:00:00Z',
    reply: { text: 'Thanks! I’ll steam it before the next pickup.', createdAt: '2026-09-26T18:00:00Z' },
  },
  {
    id: 'rv4', rentalId: 'r2', reviewerId: 'u2', revieweeId: 'u1', revieweeRole: 'borrower', rating: 5,
    tags: ['On time'], comment: '', createdAt: '2026-09-26T13:00:00Z',
  },
  {
    id: 'rv5', rentalId: 'r3', reviewerId: 'u3', revieweeId: 'u1', revieweeRole: 'borrower', rating: 4,
    tags: ['Took good care'], comment: 'Boots came back in great shape.', createdAt: at(-9),
  },
  {
    id: 'rv6', rentalId: 'r4', reviewerId: 'u3', revieweeId: 'u1', revieweeRole: 'lender', rating: 5,
    tags: ['As described', 'Clean'], comment: 'Chinos were spotless.', createdAt: '2026-10-02T12:00:00Z',
  },
  {
    id: 'rv7', rentalId: 'r4', reviewerId: 'u1', revieweeId: 'u3', revieweeRole: 'borrower', rating: 5,
    tags: ['On time'], comment: 'Easy as it gets.', createdAt: '2026-10-02T14:00:00Z',
  },
  {
    id: 'rv8', rentalId: 'r8', reviewerId: 'u2', revieweeId: 'u3', revieweeRole: 'lender', rating: 5,
    tags: ['As described'], comment: 'Gorgeous dress, got so many compliments.', createdAt: '2026-04-12T12:00:00Z',
  },
  {
    id: 'rv9', rentalId: 'r8', reviewerId: 'u3', revieweeId: 'u2', revieweeRole: 'borrower', rating: 5,
    tags: ['On time', 'Took good care'], comment: '', createdAt: '2026-04-12T13:00:00Z',
  },
];

export const MOCK_SAVES: Save[] = [
  { userId: 'u1', listingId: 'l2', createdAt: '2026-10-11T12:00:00Z' },
  { userId: 'u1', listingId: 'l7', createdAt: '2026-10-09T12:00:00Z' },
  { userId: 'u2', listingId: 'l2', createdAt: '2026-10-10T12:00:00Z' },
  { userId: 'u2', listingId: 'l8', createdAt: '2026-10-12T12:00:00Z' },
  { userId: 'u3', listingId: 'l1', createdAt: '2026-10-08T12:00:00Z' },
  { userId: 'u3', listingId: 'l6', createdAt: '2026-10-08T13:00:00Z' },
  { userId: 'u3', listingId: 'l2', createdAt: '2026-10-08T14:00:00Z' },
];

/** Open reports for the team to review (sign in as admin@utexas.edu). */
export const MOCK_REPORTS: Report[] = [
  {
    id: 'rp1', reporterId: 'u3', reportedUserId: 'u4', reason: 'No-show', rentalId: 'r21',
    details: 'Confirmed pickup at Jester at 6pm, waited 30 minutes, no reply.', createdAt: at(-2), status: 'open',
  },
  {
    id: 'rp2', reporterId: 'u2', reportedUserId: 'u4', reason: 'Inappropriate messages',
    details: 'Got rude after I asked them to reschedule.', createdAt: at(-1), status: 'open',
  },
];

export const MOCK_BLOCKS: Block[] = [];
