import React, { useMemo, useState } from 'react';
import { ArrowUp, CheckCircle2, ExternalLink, Loader2, LockKeyhole, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
import { LanguageCode } from '../../types';
import { LiveConnectSession } from '../../core/client/liveConnectSession';

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
};

const copy = {
  'pt-BR': {
    eyebrow: 'CONNECT CORE · AO VIVO',
    title: 'Pergunte ao seu ecossistema',
    subtitle: 'Seu contexto vem do MillionsNest e cada leitura é validada novamente no aplicativo de origem.',
    verified: 'Sessão verificada',
    tenant: 'Organização ativa',
    greeting: 'Estou conectado ao seu contexto do MillionsNest. Nesta primeira integração real, já consigo consultar sua próxima escala pessoal no MusicScale.',
    suggestion: 'Qual é minha próxima escala?',
    placeholder: 'Pergunte sobre sua próxima escala…',
    sending: 'Consultando com segurança…',
    audit: 'Auditoria',
    openInMusicScale: 'Abrir no MusicScale',
    footer: 'Identidade, organização e permissões são validadas no servidor. O navegador não decide seu acesso.',
    genericError: 'Não consegui concluir a consulta agora. Tente novamente em instantes.',
  },
  'en-US': {
    eyebrow: 'CONNECT CORE · LIVE',
    title: 'Ask your ecosystem',
    subtitle: 'Your context comes from MillionsNest and each read is revalidated by the source app.',
    verified: 'Verified session',
    tenant: 'Active organization',
    greeting: 'I am connected to your MillionsNest context. In this first real integration, I can already check your next personal MusicScale schedule.',
    suggestion: 'What is my next schedule?',
    placeholder: 'Ask about your next schedule…',
    sending: 'Checking securely…',
    audit: 'Audit',
    openInMusicScale: 'Open in MusicScale',
    footer: 'Identity, organization, and permissions are validated on the server. The browser never decides access.',
    genericError: 'I could not complete that request right now. Please try again shortly.',
  },
  'es-ES': {
    eyebrow: 'CONNECT CORE · EN VIVO',
    title: 'Pregunta a tu ecosistema',
    subtitle: 'Tu contexto viene de MillionsNest y cada lectura se vuelve a validar en la aplicación de origen.',
    verified: 'Sesión verificada',
    tenant: 'Organización activa',
    greeting: 'Estoy conectado a tu contexto de MillionsNest. En esta primera integración real, ya puedo consultar tu próxima escala personal en MusicScale.',
    suggestion: '¿Cuál es mi próxima escala?',
    placeholder: 'Pregunta sobre tu próxima escala…',
    sending: 'Consultando de forma segura…',
    audit: 'Auditoría',
    openInMusicScale: 'Abrir en MusicScale',
    footer: 'La identidad, organización y permisos se validan en el servidor. El navegador no decide el acceso.',
    genericError: 'No pude completar la consulta ahora. Inténtalo de nuevo en unos instantes.',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

function toMusicScaleUrl(deepLink: string | undefined): string | null {
  const value = typeof deepLink === 'string' ? deepLink.trim() : '';
  if (!value || value.length > 512 || !value.startsWith('/') || value.startsWith('//')) return null;
  return `https://musicscale.millionsnest.com${value}`;
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
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-violet-300/90">
              <Sparkles size={14} />
              {t.eyebrow}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">{t.subtitle}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[390px]">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-200">
                <CheckCircle2 size={15} /> {t.verified}
              </div>
              <p className="mt-1 truncate text-sm text-white">{session.context.user.name}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <ShieldCheck size={15} /> {t.tenant}
              </div>
              <p className="mt-1 truncate text-sm text-white">{session.context.activeOrganization.name}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-[470px] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black/10 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {messages.map((message) => {
            const musicScaleUrl = toMusicScaleUrl(message.deepLink);
            return (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] sm:max-w-[72%] ${message.sender === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={message.sender === 'user'
                      ? 'rounded-[22px] rounded-br-md bg-white px-4 py-3 text-left text-sm leading-6 text-slate-950 shadow-lg'
                      : 'rounded-[22px] rounded-bl-md border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-slate-100'}
                  >
                    {message.content}
                  </div>
                  {musicScaleUrl && (
                    <a
                      href={musicScaleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-400/12"
                    >
                      {t.openInMusicScale} <ExternalLink size={12} />
                    </a>
                  )}
                  {message.auditId && (
                    <div className="mt-2 flex items-center gap-1.5 px-1 text-[10px] text-slate-500">
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

        <div className="border-t border-white/10 bg-black/15 p-4 sm:p-5">
          {messages.length === 1 && (
            <button
              type="button"
              onClick={() => submit(t.suggestion)}
              disabled={busy}
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-3.5 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-400/10 disabled:opacity-50"
            >
              <MessageSquareText size={14} /> {t.suggestion}
            </button>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(input);
            }}
            className="flex items-end gap-2 rounded-[22px] border border-white/10 bg-white/[0.045] p-2 focus-within:border-violet-400/35"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={t.placeholder}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} />}
            </button>
          </form>
          <p className="mt-3 flex items-start gap-2 px-1 text-[11px] leading-4 text-slate-500">
            <LockKeyhole size={12} className="mt-0.5 shrink-0" /> {t.footer}
          </p>
        </div>
      </section>
    </main>
  );
};
