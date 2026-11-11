import { useEffect, useState } from 'react';
import { Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem, Textarea } from '@nextui-org/react';
import { toast } from 'sonner';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { useCurrency } from '@/stores/currency/currency.store';
import { getTenantSlug } from '@/utils/tenant';
import { useNetworkStatus } from '../offline/usePosOfflineSync';
import { cashDifference, cashError, useCashRegisterStore } from './cash-register.store';

export function CashRegisterPanel({ storeId, storeName }: { storeId: string; storeName: string }) {
  const user = useTenantAuthStore((state) => state.user);
  const cash = useCashRegisterStore();
  const { symbol } = useCurrency();
  const online = useNetworkStatus();
  const context = [getTenantSlug(), user?.id, storeId].join(':');
  const [view, setView] = useState<'open' | 'summary' | 'movement' | 'close' | 'history' | null>(null);
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [confirmClose, setConfirmClose] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [responsible, setResponsible] = useState('');
  const [reading, setReading] = useState(false);
  useEffect(() => { if (user) void cash.load(storeId, context); }, [storeId, context, online, user?.id, cash.load]);
  useEffect(() => { if (cash.ready && !cash.session && cash.context === context) setView('open'); }, [cash.ready, cash.session, cash.context, context]);
  const read = async (action: () => Promise<void>) => {
    setReading(true);
    try { await action(); } catch (error) { toast.error(cashError(error)); }
    finally { setReading(false); }
  };
  const show = (next: typeof view) => {
    setAmount('0'); setNote(''); setReason(''); setConfirmClose(false); setView(next);
    if (next === 'summary' || next === 'close') void read(() => cash.refreshSummary());
    if (next === 'history') void read(() => cash.loadHistory());
  };
  const submit = async () => {
    try {
      if (view === 'open') await cash.open(amount, note);
      if (view === 'movement') await cash.movement(type, amount, reason, note);
      if (view === 'close') {
        if (!confirmClose) { setConfirmClose(true); return; }
        await cash.close(amount, note);
      }
      toast.success(view === 'close' ? 'Caja cerrada correctamente.' : 'Operación de caja registrada.');
      setView(null);
    } catch (error) { toast.error(cashError(error)); }
  };
  let difference = '';
  try { if (cash.summary) difference = cashDifference(amount, cash.summary.expected_cash); } catch { difference = ''; }
  const money = (value: string | null | undefined) => symbol + ' ' + (value ?? '—');
  return <section aria-label="Caja de la tienda" className="flex flex-wrap items-center gap-2 rounded-xl border border-default-200 p-2 text-xs">
    <strong>{cash.loading ? 'Consultando caja…' : cash.session ? 'Caja abierta' : 'Caja cerrada'}</strong>
    {cash.error && <span role="alert" className="text-danger">{cash.error}</span>}
    {!cash.ready && <Button size="sm" isLoading={cash.loading} onPress={() => void cash.load(storeId, context)}>Reintentar</Button>}
    {cash.ready && !cash.session && <Button size="sm" onPress={() => show('open')}>Abrir caja</Button>}
    {cash.session && <>
      <Button size="sm" variant="flat" onPress={() => show('summary')}>Resumen</Button>
      <Button size="sm" variant="flat" isDisabled={!online} onPress={() => show('movement')}>Ingreso / Egreso</Button>
      <Button size="sm" color="warning" variant="flat" isDisabled={!online} onPress={() => show('close')}>Cerrar caja</Button>
    </>}
    <Button size="sm" variant="light" isDisabled={!online || !cash.ready} onPress={() => show('history')}>Historial</Button>
    {!online && <span>Sin conexión: caja verificada anteriormente. Sincroniza antes de cerrar.</span>}
    <Modal isOpen={view !== null} onClose={() => { if (!cash.busy) setView(null); }} isDismissable={!cash.busy} scrollBehavior="inside" size="2xl">
      <ModalContent>
        <ModalHeader>{({ open: 'Apertura de caja', summary: 'Resumen de caja', movement: 'Ingreso / Egreso', close: 'Cierre de caja', history: 'Historial de cajas' } as const)[view ?? 'open']}</ModalHeader>
        <ModalBody className="gap-3">
          <p>{storeName} · Responsable: {user?.name}</p>
          {reading && <p role="status">Cargando información…</p>}
          {(view === 'summary' || view === 'close') && cash.summary && <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Apertura</dt><dd>{money(cash.summary.opening_amount)}</dd>
            {Object.entries(cash.summary.sales.by_method).map(([method, value]) => <div key={method} className="contents"><dt>Ventas {method}</dt><dd>{money(value)}</dd></div>)}
            <dt>Total vendido</dt><dd>{money(cash.summary.sales.total)}</dd>
            <dt>Otros ingresos</dt><dd>{money(cash.summary.movements.income)}</dd>
            <dt>Egresos</dt><dd>{money(cash.summary.movements.expense)}</dd>
            <dt className="font-bold">Efectivo esperado</dt><dd className="font-bold">{money(cash.summary.expected_cash)}</dd>
          </dl>}
          {view === 'movement' && <>
            <Select label="Tipo" selectedKeys={[type]} onChange={(e) => setType(e.target.value === 'expense' ? 'expense' : 'income')}>
              <SelectItem key="income">Ingreso</SelectItem><SelectItem key="expense">Egreso</SelectItem>
            </Select>
            <Input label="Motivo" value={reason} onValueChange={setReason} maxLength={255} isRequired />
          </>}
          {(view === 'open' || view === 'movement' || view === 'close') && <>
            <Input label={view === 'open' ? 'Monto inicial' : view === 'close' ? 'Efectivo contado' : 'Monto'} startContent={<span>{symbol}</span>} inputMode="decimal" value={amount} onValueChange={(value) => { setAmount(value.replace(',', '.')); setConfirmClose(false); }} isRequired />
            <Textarea label="Observación" value={note} onValueChange={setNote} maxLength={2000} />
          </>}
          {view === 'close' && difference && <p role="status" className="font-semibold">
            {difference === '0.00' ? 'Exacto' : difference.startsWith('-') ? 'Faltante' : 'Sobrante'}: {money(difference.replace('-', ''))}
          </p>}
          {confirmClose && <p role="alert" className="text-warning">Confirma el cierre. La sesión quedará cerrada y bloqueará nuevas ventas.</p>}
          {view === 'history' && <>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" label="Desde" value={from} onValueChange={setFrom} />
              <Input type="date" label="Hasta" value={to} onValueChange={setTo} />
              <Input label="ID responsable" inputMode="numeric" value={responsible} onValueChange={setResponsible} />
              <Select label="Estado" selectedKeys={historyStatus ? [historyStatus] : []} onChange={(e) => setHistoryStatus(e.target.value)}>
                <SelectItem key="open">Abierta</SelectItem><SelectItem key="closed">Cerrada</SelectItem>
              </Select>
            </div>
            <Button size="sm" isLoading={reading} onPress={() => void read(() => cash.loadHistory({ from_date: from || undefined, to_date: to || undefined, user_id: responsible || undefined, status: historyStatus || undefined }))}>Filtrar</Button>
            {cash.history?.data.map((session) => <article key={session.id} className="border border-default-200 rounded-lg p-3 text-sm">
              <p>{new Date(session.opened_at).toLocaleString()} · {session.status === 'open' ? 'Abierta' : 'Cerrada'}</p>
              <p>Apertura: {session.user?.name} · Cierre: {session.closedBy?.name ?? '—'}</p>
              <p>Inicial: {money(session.opening_amount)} · Ventas: {money(session.sales_sum_total)}</p>
              <p>Esperado: {money(session.expected_amount)} · Contado: {money(session.closing_amount)} · Diferencia: {money(session.difference)}</p>
            </article>)}
            <div className="flex gap-2">
              {[['Anterior', -1], ['Siguiente', 1]].map(([label, step]) => <Button key={label} size="sm" isDisabled={reading || !cash.history || (Number(step) < 0 ? cash.history.current_page <= 1 : cash.history.current_page >= cash.history.last_page)} onPress={() => void read(() => cash.loadHistory({ status: historyStatus || undefined, from_date: from || undefined, to_date: to || undefined, user_id: responsible || undefined, page: (cash.history?.current_page ?? 1) + Number(step) }))}>{label}</Button>)}
            </div>
          </>}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" isDisabled={cash.busy} onPress={() => setView(null)}>Volver al POS</Button>
          {(view === 'open' || view === 'movement' || view === 'close') && <Button color={view === 'close' ? 'warning' : 'primary'} isLoading={cash.busy} isDisabled={!online || reading || (view === 'close' && !cash.summary)} onPress={() => void submit()}>
            {view === 'open' ? 'Abrir caja' : view === 'movement' ? 'Registrar movimiento' : confirmClose ? 'Confirmar cierre' : 'Cerrar caja'}
          </Button>}
        </ModalFooter>
      </ModalContent>
    </Modal>
  </section>;
}
