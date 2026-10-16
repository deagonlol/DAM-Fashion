/**
 * Safety: reports, blocks, strikes, and the penalties they lead to.
 *
 * Strikes come only from things that are verified, so one angry report can't ban someone:
 *   - a no-show the other person reported on a borrow
 *   - returning an item more than LATE_STRIKE_DAYS late (or still being that late)
 *   - a report the team reviewed and upheld
 *
 * Penalties, counting strikes from the last STRIKE_WINDOW_DAYS:
 *   1 strike  → warning (no restrictions)
 *   2 strikes → soft ban for SOFT_BAN_DAYS after the latest strike: can't list, request, or
 *               accept, and their listings are hidden
 *   3+        → banned: can't sign in
 *
 * Rules are pure functions (exported for tests); the async functions at the bottom apply
 * them to the in-memory stores as the signed-in user. With a backend, strikes and penalties
 * are computed server-side and enforced in every write.
 */
import { getCurrentUserId } from './session';
import { MOCK_BLOCKS, MOCK_REPORTS } from './mock-data';
import { rentalsStore } from './rentals-store';
import { createStore } from './store';
import type { Block, Rental, Report, ReportReason } from './types';
import { getUserSnapshot } from './users';

export class ModerationError extends Error {}

export const STRIKE_WINDOW_DAYS = 180;
export const SOFT_BAN_DAYS = 7;
export const LATE_STRIKE_DAYS = 3;
export const MAX_REPORT_LENGTH = 1000;

const DAY = 24 * 60 * 60 * 1000;

export type Strike = {
  userId: string;
  source: 'no_show' | 'late_return' | 'report';
  /** The borrow or report it came from. */
  refId: string;
  at: string;
};

export type Penalty =
  | { level: 'none' }
  | { level: 'warning'; strikes: number }
  | { level: 'soft_ban'; strikes: number; until: string }
  | { level: 'banned'; strikes: number };

function dueTime(rental: Rental) {
  return new Date(`${rental.endDate}T23:59:59`).getTime();
}

/** Every strike against a user within the strike window, oldest first. */
export function strikesFor(userId: string, rentals: Rental[], reports: Report[], now: Date): Strike[] {
  const strikes: Strike[] = [];

  for (const rental of rentals) {
    // The person who didn't show is whoever *didn't* report it.
    if (rental.status === 'no_show' && rental.noShowReportedBy) {
      const noShowUser = rental.noShowReportedBy === rental.lenderId ? rental.borrowerId : rental.lenderId;
      if (noShowUser === userId) {
        strikes.push({ userId, source: 'no_show', refId: rental.id, at: new Date(`${rental.startDate}T12:00:00`).toISOString() });
      }
    }
    if (rental.borrowerId === userId) {
      const lateCutoff = dueTime(rental) + LATE_STRIKE_DAYS * DAY;
      const returnedVeryLate =
        rental.status === 'returned' && rental.returnedAt && new Date(rental.returnedAt).getTime() > lateCutoff;
      const stillOutVeryLate = rental.status === 'picked_up' && now.getTime() > lateCutoff;
      if (returnedVeryLate || stillOutVeryLate) {
        strikes.push({
          userId,
          source: 'late_return',
          refId: rental.id,
          at: new Date(returnedVeryLate ? rental.returnedAt! : lateCutoff).toISOString(),
        });
      }
    }
  }

  // An upheld report about a borrow that already produced a strike (e.g. reporting the same
  // no-show) doesn't count twice.
  const struckRentals = new Set(strikes.map((strike) => strike.refId));
  for (const report of reports) {
    if (report.rentalId && struckRentals.has(report.rentalId)) continue;
    if (report.reportedUserId === userId && report.status === 'upheld') {
      strikes.push({ userId, source: 'report', refId: report.id, at: report.reviewedAt ?? report.createdAt });
    }
  }

  const windowStart = now.getTime() - STRIKE_WINDOW_DAYS * DAY;
  return strikes
    .filter((strike) => new Date(strike.at).getTime() >= windowStart && new Date(strike.at).getTime() <= now.getTime())
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function penaltyFor(strikes: Strike[], now: Date): Penalty {
  if (strikes.length === 0) return { level: 'none' };
  if (strikes.length >= 3) return { level: 'banned', strikes: strikes.length };
  if (strikes.length === 2) {
    const latest = new Date(strikes[strikes.length - 1].at).getTime();
    const until = latest + SOFT_BAN_DAYS * DAY;
    if (now.getTime() < until) {
      return { level: 'soft_ban', strikes: 2, until: new Date(until).toISOString() };
    }
  }
  return { level: 'warning', strikes: strikes.length };
}

/** Whether the penalty stops someone from listing, requesting, or accepting. */
export function isRestricted(penalty: Penalty) {
  return penalty.level === 'soft_ban' || penalty.level === 'banned';
}

export function restrictionMessage(penalty: Penalty) {
  switch (penalty.level) {
    case 'banned':
      return 'This account has been suspended for repeated safety issues.';
    case 'soft_ban':
      return `Your account is limited until ${new Date(penalty.until).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })} because of recent no-shows or reports. You can still message and return items.`;
    default:
      return null;
  }
}

/** Whether either user has blocked the other. */
export function isBlockedBetween(blocks: Block[], a: string, b: string) {
  return blocks.some(
    (block) => (block.blockerId === a && block.blockedId === b) || (block.blockerId === b && block.blockedId === a)
  );
}

export type ReportInput = {
  reportedUserId: string;
  reason: ReportReason;
  details: string;
  conversationId?: string;
  rentalId?: string;
  listingId?: string;
};

export function createReport(reporterId: string, input: ReportInput, reports: Report[], now: Date): Report {
  if (reporterId === input.reportedUserId) throw new ModerationError("You can't report yourself.");
  const details = input.details.trim();
  if (!details) throw new ModerationError('Tell us what happened.');
  if (details.length > MAX_REPORT_LENGTH) {
    throw new ModerationError(`Keep it under ${MAX_REPORT_LENGTH} characters.`);
  }
  const duplicate = reports.some(
    (report) =>
      report.status === 'open' &&
      report.reporterId === reporterId &&
      report.reportedUserId === input.reportedUserId &&
      report.reason === input.reason
  );
  if (duplicate) throw new ModerationError('You already have an open report about this. Our team is on it.');
  return {
    id: `rp${now.getTime()}`,
    reporterId,
    ...input,
    details,
    createdAt: now.toISOString(),
    status: 'open',
  };
}

export function reviewReport(report: Report, decision: 'upheld' | 'dismissed', now: Date): Report {
  if (report.status !== 'open') throw new ModerationError('This report was already reviewed.');
  return { ...report, status: decision, reviewedAt: now.toISOString() };
}

// ---- Stores --------------------------------------------------------------------------------

const reportsStore = createStore<Report[]>(MOCK_REPORTS);
const blocksStore = createStore<Block[]>(MOCK_BLOCKS);

export const subscribeToReports = reportsStore.subscribe;
export const getReportsSnapshot = reportsStore.get;
export const subscribeToBlocks = blocksStore.subscribe;
export const getBlocksSnapshot = blocksStore.get;

/** A user's current penalty from the live stores. */
export function penaltyForUser(userId: string, now: Date) {
  return penaltyFor(strikesFor(userId, rentalsStore.get(), reportsStore.get(), now), now);
}

/** Throws if the user is soft-banned or banned. Call before listing, requesting, or accepting. */
export function assertCanTransact(userId: string, now: Date) {
  const message = restrictionMessage(penaltyForUser(userId, now));
  if (message) throw new ModerationError(message);
}

/** Throws if either user blocked the other. */
export function assertNotBlocked(a: string, b: string) {
  if (isBlockedBetween(blocksStore.get(), a, b)) {
    throw new ModerationError("You can't interact with this person.");
  }
}

export async function submitReport(input: ReportInput): Promise<Report> {
  const report = createReport(getCurrentUserId(), input, reportsStore.get(), new Date());
  reportsStore.set([...reportsStore.get(), report]);
  return report;
}

/** Team only: uphold (adds a strike) or dismiss a report. */
export async function decideReport(reportId: string, decision: 'upheld' | 'dismissed'): Promise<Report> {
  if (getUserSnapshot(getCurrentUserId())?.role !== 'admin') {
    throw new ModerationError('Only the DAM Fashion team can review reports.');
  }
  const report = reportsStore.get().find((candidate) => candidate.id === reportId);
  if (!report) throw new ModerationError('Report not found.');
  const updated = reviewReport(report, decision, new Date());
  reportsStore.set(reportsStore.get().map((candidate) => (candidate.id === reportId ? updated : candidate)));
  return updated;
}

export async function blockUser(userId: string) {
  const blockerId = getCurrentUserId();
  if (blockerId === userId) throw new ModerationError("You can't block yourself.");
  if (blocksStore.get().some((block) => block.blockerId === blockerId && block.blockedId === userId)) return;
  blocksStore.set([...blocksStore.get(), { blockerId, blockedId: userId, createdAt: new Date().toISOString() }]);
}

export async function unblockUser(userId: string) {
  const blockerId = getCurrentUserId();
  blocksStore.set(blocksStore.get().filter((block) => !(block.blockerId === blockerId && block.blockedId === userId)));
}
