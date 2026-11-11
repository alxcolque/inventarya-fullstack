import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { tenantApi } from '@/api';
import { posDb } from '../offline/pos-db';

export interface CashSession {
  id: string; store_id: string; status: 'open' | 'closed'; opening_amount: string;
  expected_amount: string | null; closing_amount: string | null; difference: string | null;
  opened_at: string; closed_at: string | null;
  user?: { name: string }; closed_by?: number; closedBy?: { name: string };
  store?: { name: string }; sales_sum_total?: string | null;
}
export interface CashSummary {
  session: CashSession;
  sales: { count: number; total: string; cash: string; by_method: Record<string, string> };
  movements: { income: string; expense: string };
  opening_amount: string; expected_cash: string;
}
export interface CashHistory { data: CashSession[]; current_page: number; last_page: number }
export interface HistoryFilters { status?: string; from_date?: string; to_date?: string; user_id?: string; page?: number }
export function cashError(error: unknown): string {
  return isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'No se pudo conectar con el servidor.' :
    error instanceof Error ? error.message : 'No se pudo completar la operación de caja.';
}
export function cents(value: string): bigint {
  if (!/^\d+(\.\d{0,2})?$/.test(value)) throw new Error('Ingresa un monto válido con hasta dos decimales.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function cashDifference(counted: string, expected: string): string {
  const negative = expected.startsWith('-');
  const amount = cents(counted) - (negative ? -cents(expected.slice(1)) : cents(expected));
  const absolute = amount < 0n ? -amount : amount;
  return (amount < 0n ? '-' : '') + (absolute / 100n) + '.' + (absolute % 100n).toString().padStart(2, '0');
}
interface CashState {
  context: string; storeId: string; session: CashSession | null; summary: CashSummary | null;
  history: CashHistory | null; ready: boolean; loading: boolean; busy: boolean; error: string | null;
  load: (storeId: string, context: string) => Promise<void>;
  open: (amount: string, note: string) => Promise<void>;
  movement: (type: 'income' | 'expense', amount: string, reason: string, description: string) => Promise<void>;
  close: (amount: string, note: string) => Promise<void>;
  refreshSummary: (id?: string) => Promise<void>;
  loadHistory: (filters?: HistoryFilters) => Promise<void>;
}
const cacheKey = (context: string) => 'inventarya-cash:' + context;
export const useCashRegisterStore = create<CashState>((set, get) => {
  const mutate = async (action: () => Promise<void>) => {
    if (get().busy) throw new Error('Hay una operación de caja en curso.');
    if (!navigator.onLine) throw new Error('Conéctate para abrir, cerrar o registrar movimientos de caja.');
    set({ busy: true, error: null });
    try { await action(); } catch (error) { set({ error: cashError(error) }); throw error; }
    finally { set({ busy: false }); }
  };
  const cache = (session: CashSession | null) => {
    const key = cacheKey(get().context);
    if (session) localStorage.setItem(key, JSON.stringify(session));
    else localStorage.removeItem(key);
  };
  return {
    context: '', storeId: '', session: null, summary: null, history: null, ready: false, loading: false, busy: false, error: null,
    load: async (storeId, context) => {
      if (get().busy || (get().loading && get().context === context)) return;
      set({ context, storeId, session: null, summary: null, history: null, ready: false, loading: true, error: null });
      try {
        let session: CashSession | null = null;
        if (navigator.onLine) session = (await tenantApi.get<{ session: CashSession | null }>('/cash-register/active/' + storeId)).data.session;
        else {
          const saved = localStorage.getItem(cacheKey(context));
          if (saved) {
            const candidate = JSON.parse(saved) as CashSession;
            if (candidate.store_id === storeId && candidate.status === 'open' && typeof candidate.id === 'string') session = candidate;
          }
          if (!session) throw new Error('Conéctate para verificar y abrir una caja antes de vender.');
        }
        if (get().context !== context) return;
        set({ session, ready: true }); cache(session);
      } catch (error) { if (get().context === context) set({ error: cashError(error) }); }
      finally { if (get().context === context) set({ loading: false }); }
    },
    open: (opening_amount, opening_note) => mutate(async () => {
      cents(opening_amount);
      const { data } = await tenantApi.post<{ session: CashSession }>('/cash-register/open', { store_id: get().storeId, opening_amount, opening_note });
      set({ session: data.session, ready: true }); cache(data.session);
    }),
    movement: (type, amount, reason, description) => mutate(async () => {
      cents(amount);
      const id = get().session?.id;
      if (!id) throw new Error('No existe una caja abierta.');
      await tenantApi.post('/cash-register/' + id + '/movements', { type, amount, reason, description });
      await get().refreshSummary();
    }),
    close: (closing_amount, closing_note) => mutate(async () => {
      cents(closing_amount);
      // Query directly, including failed/syncing entries. A failed count must never imply zero.
      const pending = await posDb.pos_pending_sales.filter((sale) => String(sale.store_id) === get().storeId).count();
      if (pending) throw new Error('Existen ventas pendientes de sincronización. Sincronízalas antes de cerrar la caja.');
      const id = get().session?.id;
      if (!id) throw new Error('No existe una caja abierta.');
      await tenantApi.post('/cash-register/' + id + '/close', { closing_amount, closing_note });
      set({ session: null, summary: null, ready: true }); cache(null);
    }),
    refreshSummary: async (id) => {
      const context = get().context;
      const sessionId = id ?? get().session?.id;
      if (!sessionId) return;
      const { data } = await tenantApi.get<CashSummary>('/cash-register/' + sessionId + '/summary');
      if (get().context === context) set({ summary: data });
    },
    loadHistory: async (filters = {}) => {
      const context = get().context;
      const { data } = await tenantApi.get<CashHistory>('/cash-register/history', { params: { ...filters, store_id: get().storeId } });
      if (get().context === context) set({ history: data });
    },
  };
});
