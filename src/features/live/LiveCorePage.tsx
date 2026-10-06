import React, { useMemo, useState } from 'react';
import { ArrowUp, CheckCircle2, ExternalLink, FileMusic, ListMusic, Loader2, LockKeyhole, MessageSquareText, Music2, ShieldCheck, Sparkles } from 'lucide-react';
import { LanguageCode } from '../../types';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import { toTrustedMusicScaleUrl } from '../../core/client/liveDeepLink';
import { LiveResultProjection, normalizeLiveResultProjection } from '../../core/client/liveResultProjection';

interface LiveCorePageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}

type LiveMessage = {
  id: string;
  sender: 'user' | 'connect';
  content: string;
  auditId?: string;
  deepLink?: string;
  result?: LiveResultProjection;
};

const copy = {
  'pt-BR': {
    eyebrow: 'CONNECT CORE · AO VIVO',
    title: 'Pergunte ao seu ecossistema',
    subtitle: 'Seu contexto vem do MillionsNest e cada leitura é validada novamente no aplicativo de origem.',
    verified: 'Sessão verificada',
    tenant: 'Organização ativa',
    greeting: 'Estou conectado ao seu contexto do MillionsNest. Já consigo consultar sua próxima escala, repertório, presença e abrir cifras validadas pelo MusicScale.',
    suggestions: ['Qual é minha próxima escala?', 'Quais músicas vou tocar?', 'Eu confirmei presença?'],
    placeholder: 'Pergunte sobre sua escala, repertório, presença ou cifra…',
    sending: 'Consultando com segurança…',
    audit: 'Auditoria',
    openInMusicScale: 'Abrir no MusicScale',
    footer: 'Identidade, organização e permissões são validadas no servidor. O navegador não decide seu acesso.',
    genericError: 'Não consegui concluir a consulta agora. Tente novamente em instantes.',
    repertoire: 'Repertório',
    scheduledKey: 'Tom da escala',
    bpm: 'BPM',
    presence: 'Presença',
    presencePending: 'Pendente',
    presenceAccepted: 'Confirmada',
    presenceMaybe: 'Talvez',
    presenceDeclined: 'Não vou',
    presenceMixed: 'Respostas divergentes',
    chart: 'Cifra',
    sourceKey: 'Tom de origem',
    chartReview: 'A cifra precisa ser revisada no MusicScale antes de aparecer aqui.',
    schedule: 'Próxima escala',
  },
  'en-US': {
    eyebrow: 'CONNECT CORE · LIVE',
    title: 'Ask your ecosystem',
    subtitle: 'Your context comes from MillionsNest and each read is revalidated by the source app.',
    verified: 'Verified session',
    tenant: 'Active organization',
    greeting: 'I am connected to your MillionsNest context. I can already check your next schedule, repertoire, attendance and open charts validated by MusicScale.',
    suggestions: ['What is my next schedule?', 'What songs am I playing?', 'Am I confirmed for my next schedule?'],
    placeholder: 'Ask about your schedule, repertoire, attendance or chart…',
    sending: 'Checking securely…',
    audit: 'Audit',
    openInMusicScale: 'Open in MusicScale',
    footer: 'Identity, organization, and permissions are validated on the server. The browser never decides access.',
    genericError: 'I could not complete that request right now. Please try again shortly.',
    repertoire: 'Repertoire',
    scheduledKey: 'Scheduled key',
    bpm: 'BPM',
    presence: 'Attendance',
    presencePending: 'Pending',
    presenceAccepted: 'Confirmed',
    presenceMaybe: 'Maybe',
    presenceDeclined: 'Cannot attend',
    presenceMixed: 'Mixed responses',
    chart: 'Chart',
    sourceKey: 'Source key',
    chartReview: 'This chart needs a MusicScale review before it can appear here.',
    schedule: 'Next schedule',
  },
  'es-ES': {
    eyebrow: 'CONNECT CORE · EN VIVO',
    title: 'Pregunta a tu ecosistema',
    subtitle: 'Tu contexto viene del MillionsNest y cada lectura se vuelve a validar en la aplicación de origen.',
    verified: 'Sesión verificada',
    tenant: 'Organización activa',
    greeting: 'Estoy conectado a tu contexto de MillionsNest. Ya puedo consultar tu próxima escala, repertorio, asistencia y abrir cifras validadas por MusicScale.',
    suggestions: ['¿Cuál es mi próxima escala?', '¿Qué canciones voy a tocar?', '¿Confirmé mi asistencia?'],
    placeholder: 'Pregunta sobre tu escala, repertorio, asistencia o cifra…',
    sending: 'Consultando de forma segura…',
    audit: 'Auditoría',
    openInMusicScale: 'Abrir en MusicScale',
    footer: 'La identidad, organización y permisos se validan en el servidor. El navegador no decide el acceso.',
    genericError: 'No pude completar la consulta ahora. Inténtalo de nuevo en unos instantes.',
    repertoire: 'Repertorio',
    scheduledKey: 'Tono programado',
    bpm: 'BPM',
    presence: 'Asistencia',
    presencePending: 'Pendiente',
    presenceAccepted: 'Confirmada',
    presenceMaybe: 'Tal vez',
    presenceDeclined: 'No asistiré',
    presenceMixed: 'Respuestas diferentes',
    chart: 'Cifra',
    sourceKey: 'Tono de origen',
    chartReview: 'Esta cifra necesita revisión en MusicScale antes de aparecer aquí.',
    schedule: 'Próxima escala',
  },
} satisfies Record<LanguageCode, Record<string, string | string[]>>;

function LiveStructuredResult({
  result,
  t,
}: {
  result: LiveResultProjection;
  t: Record<string, string>;
}) {
  if (!result) return null;

  const scheduleCard = (schedule: NonNullable<Extract<LiveResultProjection, { kind: 'schedule' }>['schedule']> | null) => {
    if (!schedule) return null;
    const dateTime = [schedule.date, schedule.time].filter(Boolean).join(' · ');
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-300">
          <Music2 size={12} /> {t.schedule}
        </span>
        {dateTime && <span>{dateTime}</span>}
        {schedule.functionNames.length > 0 && <span>{schedule.functionNames.join(' · ')}</span>}
      </div>
    );
  };

  if (result.kind === 'schedule') {
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
        {scheduleCard(result.schedule)}
      </div>
    );
  }

  if (result.kind === 'repertoire') {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/15">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
            <ListMusic size={14} /> {t.repertoire}
          </span>
          <span className="text-[10px] text-[#667A90]">{result.songs.length}</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {result.songs.map((song) => (
            <div key={song.id} className="flex items-start gap-3 px-4 py-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-semibold text-slate-400">
                {song.order}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-100">{song.title}</p>
                {song.artist && <p className="mt-0.5 truncate text-[10px] text-[#667A90]">{song.artist}</p>}
              </div>
              <div className="shrink-0 text-right text-[10px] text-slate-400">
                {song.scheduledKey && <div>{t.scheduledKey}: <span className="text-slate-200">{song.scheduledKey}</span></div>}
                {song.bpm && <div>{song.bpm} {t.bpm}</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          {scheduleCard(result.schedule)}
        </div>
      </div>
    );
  }

  if (result.kind === 'presence') {
    const statusLabels = {
      pending: t.presencePending,
      accepted: t.presenceAccepted,
      maybe: t.presenceMaybe,
      declined: t.presenceDeclined,
      mixed: t.presenceMixed,
    };
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-300">{t.presence}</span>
          {result.presence && (
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-slate-200">
              {statusLabels[result.presence.status]}
            </span>
          )}
        </div>
        <div className="mt-3">{scheduleCard(result.schedule)}</div>
      </div>
    );
  }

  if (result.kind === 'chart') {
    const chart = result.chart;
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
              <FileMusic size={14} /> {t.chart}
            </span>
            {chart?.title && <p className="mt-1 truncate text-sm font-medium text-white">{chart.title}</p>}
            {chart?.artist && <p className="truncate text-[10px] text-[#667A90]">{chart.artist}</p>}
          </div>
          {chart && (
            <div className="shrink-0 text-right text-[10px] text-slate-400">
              {chart.scheduledKey && <div>{t.scheduledKey}: <span className="font-semibold text-violet-200">{chart.scheduledKey}</span></div>}
              {chart.sourceKey && chart.sourceKey !== chart.scheduledKey && <div>{t.sourceKey}: {chart.sourceKey}</div>}
              {chart.bpm && <div>{chart.bpm} {t.bpm}</div>}
            </div>
          )}
        </div>
        {chart?.chords ? (
          <pre className="max-h-[56vh] overflow-auto whitespace-pre p-4 font-mono text-[12px] leading-6 text-slate-100 selection:bg-violet-400/30">
            {chart.chords}
          </pre>
        ) : (
          <div className="px-4 py-4 text-xs leading-5 text-slate-400">{t.chartReview}</div>
        )}
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          {scheduleCard(result.schedule)}
        </div>
      </div>
    );
  }

  return null;
}

export const LiveCorePage: React.FC<LiveCorePageProps> = ({ session, currentLang }) => {
  const t = copy[currentLang];
  const conversationId = useMemo(
    () => `connect-live-${session.context.activeOrganization.id}-${session.context.user.uid}`,
    [session.context.activeOrganization.id, session.context.user.uid],
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([
    { id: 'welcome', sender: 'connect', content: t.greeting },
  ]);

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;

    const userMessage: LiveMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
    };
    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setBusy(true);

    try {
      const result = await session.sendMessage(text, conversationId, currentLang);
      setMessages((previous) => [
        ...previous,
        {
          id: `connect-${Date.now()}`,
          sender: 'connect',
          content: result.humanSummary || t.genericError,
          auditId: result.auditId,
          deepLink: result.deepLink,
          result: normalizeLiveResultProjection(result.data),
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        { id: `connect-error-${Date.now()}`, sender: 'connect', content: t.genericError },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[1120px] flex-col gap-4 pb-28 lg:pb-8">
      <header className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 connect-eyebrow"><Sparkles size={13} /> ASSIST</div>
          <h1 className="connect-page-title mt-2">{t.title}</h1>
          <p className="connect-page-subtitle mt-1.5">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <div className="flex min-h-9 items-center gap-2 rounded-[9px] border border-[#7CDEB3]/18 bg-[#7CDEB3]/[0.055] px-3">
            <CheckCircle2 size={13} className="text-[#7CDEB3]" />
            <div className="min-w-0">
              <div className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#6F947F]">{t.verified}</div>
              <div className="max-w-[160px] truncate text-[10px] font-semibold text-[#D7E9DF]">{session.context.user.name}</div>
            </div>
          </div>
          <div className="flex min-h-9 items-center gap-2 rounded-[9px] border border-[#2B3A4D] bg-[#111A27] px-3">
            <ShieldCheck size={13} className="text-[#86A1B8]" />
            <div className="min-w-0">
              <div className="text-[8px] font-semibold uppercase tracking-[.1em] text-[#607489]">{t.tenant}</div>
              <div className="max-w-[180px] truncate text-[10px] font-semibold text-[#D7E0E8]">{session.context.activeOrganization.name}</div>
            </div>
          </div>
        </div>
      </header>

      <section className="connect-surface flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[14px]">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {messages.map((message) => {
            const musicScaleUrl = toTrustedMusicScaleUrl(message.deepLink);
            return (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] sm:max-w-[72%] ${message.sender === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={message.sender === 'user'
                      ? 'rounded-[14px] rounded-br-md border border-[#66D9EF]/18 bg-[#163442]/70 px-4 py-3 text-left text-[13px] leading-5 text-[#EAFBFF]'
                      : 'rounded-[14px] rounded-bl-md border border-[#2B3A4D] bg-[#111A27] px-4 py-3 text-[13px] leading-5 text-[#E3EBF1]'}
                  >
                    {message.content}
                  </div>
                  {message.sender === 'connect' && message.result && (
                    <LiveStructuredResult result={message.result} t={t} />
                  )}
                  {musicScaleUrl && (
                    <a
                      href={musicScaleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[#66D9EF]/18 bg-[#163442]/45 px-3 py-2 text-xs font-medium text-[#B9F2FA] transition hover:bg-[#163442]/65"
                    >
                      {t.openInMusicScale} <ExternalLink size={12} />
                    </a>
                  )}
                  {message.auditId && (
                    <div className="mt-2 flex items-center gap-1.5 px-1 text-[10px] text-[#667A90]">
                      <LockKeyhole size={11} />
                      {t.audit}: {message.auditId}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                <Loader2 size={15} className="animate-spin" />
                {t.sending}
              </div>
            </div>
          )}
        </div>

        <div className="border-t connect-divider bg-[#0B121B]/75 p-4 sm:p-5">
          {messages.length === 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {t.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-[#66D9EF]/18 bg-[#163442]/45 px-3.5 py-2 text-xs font-medium text-[#B9F2FA] transition hover:bg-[#163442]/65 disabled:opacity-50"
                >
                  <MessageSquareText size={14} /> {suggestion}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(input);
            }}
            className="flex items-end gap-2 rounded-[12px] border border-[#31465A] bg-[#101A27] p-2 focus-within:border-[#66D9EF]/35"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                const desktopKeyboard = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
                if (desktopKeyboard && event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={t.placeholder}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-[#EEF4F8] outline-none placeholder:text-[#5C7085] md:text-sm"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="connect-accent-button connect-focus grid h-11 w-11 shrink-0 place-items-center rounded-[10px] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} />}
            </button>
          </form>
          <p className="mt-3 flex items-start gap-2 px-1 text-[11px] leading-4 text-[#667A90]">
            <LockKeyhole size={12} className="mt-0.5 shrink-0" /> {t.footer}
          </p>
        </div>
      </section>
    </main>
  );
};
