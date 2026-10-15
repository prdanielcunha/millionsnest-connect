import React, { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { listFinanceEntities, readFinancePendingDocuments, type FinanceEntityOption, type FinanceSummary } from '../../core/client/liveFinanceReadClient';
const copy = {
  'pt-BR': { title: 'NestFinance · Documentos pendentes', hint: 'Escolha a entidade financeira e consulte somente as contagens autorizadas. Comprovantes, valores e dados bancários permanecem no NestFinance.', load: 'Carregar entidades autorizadas', entity: 'Entidade financeira', choose: 'Selecione uma entidade', read: 'Consultar pendências', loading: 'Consultando…', empty: 'Nenhuma entidade disponível para consulta.', limited: 'Lista limitada. Se a entidade não aparece, abra o NestFinance.', denied: 'Seu acesso financeiro não permite esta consulta.', expired: 'Sua sessão expirou. Entre novamente.', error: 'Não foi possível consultar agora. Tente novamente ou procure a equipe de atendimento.', awaitingUpload: 'Aguardando envio', needsClassification: 'Aguardando classificação', pendingReview: 'Aguardando revisão', open: 'Abrir NestFinance' },
  'en-US': { title: 'NestFinance · Pending documents', hint: 'Choose a financial entity and read authorized counts only. Receipts, amounts and bank details stay inside NestFinance.', load: 'Load authorized entities', entity: 'Financial entity', choose: 'Select an entity', read: 'Check pending documents', loading: 'Checking…', empty: 'No entities are available for this query.', limited: 'Limited list. Open NestFinance if your entity is missing.', denied: 'Your financial access does not allow this query.', expired: 'Your session expired. Sign in again.', error: 'Could not complete the query. Try again or contact the support team.', awaitingUpload: 'Awaiting upload', needsClassification: 'Awaiting classification', pendingReview: 'Awaiting review', open: 'Open NestFinance' },
  'es-ES': { title: 'NestFinance · Documentos pendientes', hint: 'Selecciona la entidad financiera y consulta solo los recuentos autorizados. Los comprobantes, importes y datos bancarios permanecen en NestFinance.', load: 'Cargar entidades autorizadas', entity: 'Entidad financiera', choose: 'Selecciona una entidad', read: 'Consultar pendientes', loading: 'Consultando…', empty: 'No hay entidades disponibles para esta consulta.', limited: 'Lista limitada. Abre NestFinance si falta tu entidad.', denied: 'Tu acceso financiero no permite esta consulta.', expired: 'Tu sesión caducó. Inicia sesión de nuevo.', error: 'No se pudo completar la consulta. Inténtalo de nuevo o contacta al equipo de soporte.', awaitingUpload: 'Esperando envío', needsClassification: 'Esperando clasificación', pendingReview: 'Esperando revisión', open: 'Abrir NestFinance' },
} satisfies Record<LanguageCode, Record<string, string>>;
type State = { session: LiveConnectSession; entities: FinanceEntityOption[]; limited: boolean; selected: string; summary?: FinanceSummary; error?: string; loaded: boolean; busy: boolean };
export function LiveFinanceReadPanel({ session, currentLang }: { session: LiveConnectSession; currentLang: LanguageCode }) {
  const t = copy[currentLang], request = useRef<AbortController | null>(null), sequence = useRef(0);
  const [state, setState] = useState<State | null>(null);
  const current = state?.session === session ? state : null;
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, [session]);
  const initial = (): State => ({ session, entities: [], limited: false, selected: '', loaded: false, busy: false });
  const run = async (entity?: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const revision = ++sequence.current;
    const previous = current ?? initial();
    setState({ ...previous, summary: undefined, error: undefined, busy: true, ...(entity ? {} : { entities: [], selected: '', loaded: false }) });
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      if (entity) {
        if (!previous.entities.some(item => item.id === entity)) throw new Error('INVALID_FINANCE_SCOPE');
        const summary = await readFinancePendingDocuments(session, entity, controller.signal);
        if (revision === sequence.current) setState({ ...previous, summary, error: undefined, busy: false });
      } else {
        const result = await listFinanceEntities(session, controller.signal);
        if (revision === sequence.current) setState({ ...initial(), ...result, loaded: true });
      }
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : 'FINANCE_READ_UNAVAILABLE';
      const retained = entity && !['FINANCE_ACCESS_DENIED', 'FINANCE_SESSION_REQUIRED'].includes(code) ? previous : initial();
      if (revision === sequence.current) setState({ ...retained, summary: undefined, error: code, busy: false });
    } finally { window.clearTimeout(timer); }
  };
  const error = current?.error === 'FINANCE_ACCESS_DENIED' ? t.denied : current?.error === 'FINANCE_SESSION_REQUIRED' ? t.expired : current?.error ? t.error : '';
  return <section aria-labelledby="live-finance-title" className="connect-surface min-w-0 space-y-3 rounded-[14px] p-4 sm:p-5">
    <h2 id="live-finance-title" className="text-sm font-semibold text-[#EEF4F8]">{t.title}</h2>
    <p className="text-xs leading-5 text-[#8093A6]">{t.hint}</p>
    <div className="flex flex-wrap items-end gap-3">
      <button type="button" disabled={current?.busy} onClick={() => void run()} className="connect-focus min-h-11 rounded-lg border border-[#315064] px-3 text-xs text-[#C8D4DE] disabled:opacity-50">{t.load}</button>
      {current?.loaded && current.entities.length ? <><label className="min-w-0 flex-1 text-xs text-[#C8D4DE]">{t.entity}
        <select value={current.selected} disabled={current.busy} onChange={event => { sequence.current++; request.current?.abort(); setState({ ...current, selected: event.target.value, summary: undefined, error: undefined, busy: false }); }} className="connect-focus mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-[#315064] bg-[#101A27] px-2">
          <option value="">{t.choose}</option>{current.entities.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select></label>
        <button type="button" disabled={current.busy || !current.selected} onClick={() => void run(current.selected)} className="connect-focus min-h-11 rounded-lg border border-[#315064] px-3 text-xs text-[#C8D4DE] disabled:opacity-50">{t.read}</button></> : null}
    </div>
    <p role="status" aria-live="polite" className="text-xs text-[#C8D4DE]">{current?.busy ? t.loading : error || (current?.loaded && !current.entities.length ? t.empty : '')}</p>
    {current?.limited ? <p className="text-xs text-[#EACB8D]">{t.limited}</p> : null}
    {current?.summary ? <dl className="grid gap-3 sm:grid-cols-3">{(['awaitingUpload', 'needsClassification', 'pendingReview'] as const).map(key => <div key={key} className="rounded-lg border border-[#315064] p-3"><dt className="text-xs text-[#8093A6]">{t[key]}</dt><dd className="mt-1 text-xl font-semibold text-[#EEF4F8]">{current.summary![key]}</dd></div>)}</dl> : null}
    <a href="https://nestfinance.millionsnest.com" target="_blank" rel="noopener noreferrer" className="connect-focus inline-block text-xs text-[#8FE6F3] underline">{t.open}</a>
  </section>;
}
