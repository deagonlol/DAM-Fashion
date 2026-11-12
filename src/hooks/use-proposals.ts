import { useMemo, useSyncExternalStore } from 'react';

import { getProposalsSnapshot, openProposal, subscribeToProposals } from '@/lib/data/proposals';

export function useProposals() {
  return useSyncExternalStore(subscribeToProposals, getProposalsSnapshot, getProposalsSnapshot);
}

/** The borrow's open counter-offer or change of plans, if any. */
export function useOpenProposal(rentalId: string | undefined) {
  const proposals = useProposals();
  return useMemo(() => (rentalId ? openProposal(proposals, rentalId) : undefined), [proposals, rentalId]);
}
