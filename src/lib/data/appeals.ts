/**
 * Appeals: asking for one of your strikes to be removed. A first appeal goes to the AI reviewer
 * (supabase/functions/ai-review); if it's denied, a second appeal goes to a person on the team.
 * An approved appeal removes the strike everywhere.
 */
import { supabase } from '../supabase';
import { addOverturned, overturnedKey, type Strike } from './moderation';
import { toAppeal, unwrap, type AppealRow } from './rows';
import { createStore, upsertById } from './store';
import { MAX_APPEAL_LENGTH, MIN_APPEAL_LENGTH, type Appeal } from './types';

const appealsStore = createStore<Appeal[]>([]);

export const subscribeToAppeals = appealsStore.subscribe;
export const getAppealsSnapshot = appealsStore.get;

export function setAppeals(appeals: Appeal[]) {
  appealsStore.set(appeals);
}

export function putAppeal(appeal: Appeal) {
  appealsStore.set(upsertById(appealsStore.get(), appeal));
  if (appeal.status === 'approved') addOverturned(overturnedKey(appeal.userId, appeal.source, appeal.refId));
}

/** The latest appeal for a strike, if any. */
export function latestAppealFor(appeals: Appeal[], strike: Strike) {
  return appeals
    .filter(
      (appeal) => appeal.userId === strike.userId && appeal.source === strike.source && appeal.refId === strike.refId
    )
    .sort((a, b) => b.level - a.level)[0];
}

/** What the person can do about a strike: appeal it, ask for a human review, or nothing more. */
export function appealOption(latest: Appeal | undefined): 'appeal' | 'human_review' | null {
  if (!latest) return 'appeal';
  if (latest.status === 'denied' && latest.level === 1) return 'human_review';
  return null;
}

export async function fileAppeal(strike: Strike, reason: string) {
  const why = reason.trim();
  if (why.length < MIN_APPEAL_LENGTH) throw new Error('Tell us a little more about what happened.');
  if (why.length > MAX_APPEAL_LENGTH) throw new Error(`Keep it under ${MAX_APPEAL_LENGTH} characters.`);
  const { data, error } = await supabase
    .rpc('file_appeal', { strike_source: strike.source, strike_ref: strike.refId, why })
    .single<AppealRow>();
  if (error) throw new Error(error.message);
  putAppeal(toAppeal(data));
}

/** The team approves or denies an appeal. */
export async function decideAppeal(appealId: string, approve: boolean, note = '') {
  const row: AppealRow = unwrap(
    await supabase.rpc('decide_appeal', { target_id: appealId, approve, note }).single<AppealRow>()
  );
  putAppeal(toAppeal(row));
}
