/**
 * Safety: reports, blocks, strikes, and the penalties they lead to.
 *
 * Strikes come only from things that are verified, so one angry report can't ban someone:
 *   - a no-show the other person reported on a borrow
 *   - returning an item more than LATE_STRIKE_DAYS late (or still being that late, or reporting
 *     it lost after that point)
 *   - a report the team reviewed and upheld
 *
 * Penalties, counting strikes from the last STRIKE_WINDOW_DAYS:
 *   1 strike  → warning (no restrictions)
 *   2 strikes → soft ban for SOFT_BAN_DAYS after the latest strike: can't list, request, or
 *               accept, and their listings are hidden
 *   3+        → banned: can't sign in
 *
 * Rules are pure functions (exported for tests); the async functions at the bottom apply
 * them as the signed-in user, then save to Supabase. The database computes the same strikes
 * (strikes_for in supabase/migrations/*_app_functions.sql) and enforces them on every write.
 */
import { supabase } from '../supabase';
import { uploadReportPhotos } from './photos';
import { getCurrentUserId } from './session';
import { rentalsStore } from './rentals-store';
import { toBlock, toReport, unwrap, type BlockRow, type ReportRow } from './rows';
import { createStore } from './store';
import type { Block, Rental, Report, ReportReason } from './types';
import { getUserSnapshot } from './users';

export class ModerationError extends Error {}

export const STRIKE_WINDOW_DAYS = 180;
export const SOFT_BAN_DAYS = 7;
export const LATE_STRIKE_DAYS = 3;
export const MAX_REPORT_LENGTH = 1000;
export const MAX_REPORT_PHOTOS = 4;

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
/** Key for a strike overturned on appeal: who, what kind, and the borrow or report it came from. */
export const overturnedKey = (userId: string, source: Strike['source'], refId: string) => `${userId}:${source}:${refId}`;

export function strikesFor(
  userId: string,
  rentals: Rental[],
  reports: Report[],
  now: Date,
  /** Strikes removed on appeal (see overturnedKey). */
  overturned: ReadonlySet<string> = new Set()
): Strike[] {
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
      // Reporting it lost doesn't erase lateness that already happened. A lender can only mark
      // it lost well past this cutoff, so a lender-reported loss always comes with this strike.
      const lostVeryLate = rental.status === 'lost' && rental.lostAt && new Date(rental.lostAt).getTime() > lateCutoff;
      if (returnedVeryLate || stillOutVeryLate || lostVeryLate) {
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
    .filter((strike) => !overturned.has(overturnedKey(strike.userId, strike.source, strike.refId)))
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
  messageId?: string;
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

/**
 * Reports the signed-in user filed (every report, for the team), plus upheld reports about
 * anyone, which count as strikes. See toUpheldReport in rows.ts.
 */
const reportsStore = createStore<Report[]>([]);
/** Blocks either made by or against the signed-in user. */
const blocksStore = createStore<Block[]>([]);

export const subscribeToReports = reportsStore.subscribe;
export const getReportsSnapshot = reportsStore.get;
export const subscribeToBlocks = blocksStore.subscribe;
export const getBlocksSnapshot = blocksStore.get;

export function setReports(reports: Report[]) {
  reportsStore.set(reports);
}

/** Strikes removed on appeal, for everyone (see overturnedKey). */
const overturnedStore = createStore<ReadonlySet<string>>(new Set());

export const subscribeToOverturned = overturnedStore.subscribe;
export const getOverturnedSnapshot = overturnedStore.get;

export function setOverturned(keys: Iterable<string>) {
  overturnedStore.set(new Set(keys));
}

export function addOverturned(key: string) {
  overturnedStore.set(new Set([...overturnedStore.get(), key]));
}

export function setBlocks(blocks: Block[]) {
  blocksStore.set(blocks);
}

/** A user's current penalty from the live stores. */
export function penaltyForUser(userId: string, now: Date) {
  return penaltyFor(strikesFor(userId, rentalsStore.get(), reportsStore.get(), now, overturnedStore.get()), now);
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

/** Files a report, uploading any proof photos (local URIs) first. */
export async function submitReport(input: ReportInput, photoUris: string[] = []): Promise<Report> {
  const report = createReport(getCurrentUserId(), input, reportsStore.get(), new Date());
  if (photoUris.length > MAX_REPORT_PHOTOS) {
    throw new ModerationError(`Add up to ${MAX_REPORT_PHOTOS} photos.`);
  }
  const photoPaths = await uploadReportPhotos(report.reporterId, photoUris);
  const row = unwrap(
    await supabase
      .from('reports')
      .insert({
        reporter_id: report.reporterId,
        reported_user_id: report.reportedUserId,
        reason: report.reason,
        details: report.details,
        conversation_id: report.conversationId ?? null,
        rental_id: report.rentalId ?? null,
        listing_id: report.listingId ?? null,
        // Only sent when used, so plain reports still work before the proof migration runs.
        ...(report.messageId ? { message_id: report.messageId } : {}),
        ...(photoPaths.length > 0 ? { photo_paths: photoPaths } : {}),
      })
      .select()
      .single<ReportRow>(),
    ModerationError
  );
  const saved = toReport(row);
  reportsStore.set([...reportsStore.get(), saved]);
  return saved;
}

/** Team only: uphold (adds a strike) or dismiss a report. */
export async function decideReport(reportId: string, decision: 'upheld' | 'dismissed'): Promise<Report> {
  if (getUserSnapshot(getCurrentUserId())?.role !== 'admin') {
    throw new ModerationError('Only the Lendr team can review reports.');
  }
  const report = reportsStore.get().find((candidate) => candidate.id === reportId);
  if (!report) throw new ModerationError('Report not found.');
  const decided = reviewReport(report, decision, new Date());
  const row = unwrap(
    await supabase
      .from('reports')
      .update({ status: decided.status, reviewed_at: decided.reviewedAt })
      .eq('id', reportId)
      .select()
      .single<ReportRow>(),
    ModerationError
  );
  const updated = toReport(row);
  reportsStore.set(reportsStore.get().map((candidate) => (candidate.id === reportId ? updated : candidate)));
  return updated;
}

export async function blockUser(userId: string) {
  const blockerId = getCurrentUserId();
  if (blockerId === userId) throw new ModerationError("You can't block yourself.");
  if (blocksStore.get().some((block) => block.blockerId === blockerId && block.blockedId === userId)) return;
  const row = unwrap(
    await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: userId }).select().single<BlockRow>(),
    ModerationError
  );
  blocksStore.set([...blocksStore.get(), toBlock(row)]);
}

export async function unblockUser(userId: string) {
  const blockerId = getCurrentUserId();
  unwrap(
    await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', userId),
    ModerationError
  );
  blocksStore.set(blocksStore.get().filter((block) => !(block.blockerId === blockerId && block.blockedId === userId)));
}
