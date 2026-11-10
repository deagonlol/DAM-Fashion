import { useMemo, useSyncExternalStore } from 'react';

import { getSalesSnapshot, subscribeToSales } from '@/lib/data/sales';
import type { Sale } from '@/lib/data/types';

export function useSales() {
  return useSyncExternalStore(subscribeToSales, getSalesSnapshot, getSalesSnapshot);
}

export function useSale(id: string | undefined) {
  const sales = useSales();
  return useMemo(() => sales.find((sale) => sale.id === id), [sales, id]);
}

export type SaleActivity = {
  sale: Sale;
  role: 'lender' | 'borrower';
  needsAction: string | null;
  priority: number;
};

/** Buy requests the user still needs to see, with ones waiting on them first. */
export function useSaleActivity(userId: string): SaleActivity[] {
  const sales = useSales();
  return useMemo(() => {
    const items: SaleActivity[] = [];
    for (const sale of sales) {
      const role = sale.buyerId === userId ? 'borrower' : sale.sellerId === userId ? 'lender' : null;
      if (!role) continue;
      if (sale.status === 'requested') {
        items.push({
          sale,
          role,
          needsAction: role === 'lender' ? 'Respond to buy request' : 'Waiting on the seller',
          priority: role === 'lender' ? 1 : 4,
        });
      } else if (sale.status === 'accepted') {
        items.push({ sale, role, needsAction: 'Sold', priority: 4 });
      }
    }
    return items.sort((a, b) => a.priority - b.priority || b.sale.createdAt.localeCompare(a.sale.createdAt));
  }, [sales, userId]);
}
