import { useMemo, useState } from 'react';
import { Building2, CheckCircle2, Link2, Loader2, ShieldCheck } from 'lucide-react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import type { LanguageCode } from '../../types';

const COPY: Record<LanguageCode, Record<string, string>> = {
  'pt-BR': {
    eyebrow: 'MILLIONSNEST CONNECT · WHATSAPP',
    title: 'Vincule com segurança',
    subtitle: 'Confirme qual organização o Connect pode consultar quando você falar com o MusicScale pelo WhatsApp.',
    organization: 'Organização',
    security: 'Seu telefone não vira uma credencial. O Hub continua validando identidade, organização e permissões em cada consulta.',
    action: 'Vincular e continuar no WhatsApp',
    linking: 'Vinculando…',
    success: 'WhatsApp vinculado',
    successText: 'Tudo certo. Volte ao WhatsApp: o Connect está continuando a solicitação que trouxe você até aqui.',
    invalid: 'Este link de vinculação não é válido. Envie novamente sua pergunta pelo WhatsApp para gerar outro.',
    genericError: 'Não consegui concluir a vinculação agora.',
  },
  'en-US': {
    eyebrow: 'MILLIONSNEST CONNECT · WHATSAPP',
    title: 'Link securely',
    subtitle: 'Confirm which organization Connect may consult when you use MusicScale through WhatsApp.',
    organization: 'Organization',
    security: 'Your phone never becomes a credential. Hub keeps validating identity, organization and permissions for every request.',
    action: 'Link and continue in WhatsApp',
    linking: 'Linking…',
    success: 'WhatsApp linked',
    successText: 'All set. Return to WhatsApp: Connect is continuing the request that brought you here.',
    invalid: 'This link is not valid. Send your question again in WhatsApp to get a new one.',
    genericError: 'I could not complete the link right now.',
  },
  'es-ES': {
    eyebrow: 'MILLIONSNEST CONNECT · WHATSAPP',
    title: 'Vincula de forma segura',
    subtitle: 'Confirma qué organización puede consultar Connect cuando uses MusicScale por WhatsApp.',
    organization: 'Organización',
    security: 'Tu teléfono nunca se convierte en una credencial. Hub sigue validando identidad, organización y permisos en cada consulta.',
    action: 'Vincular y continuar en WhatsApp',
    linking: 'Vinculando…',
    success: 'WhatsApp vinculado',
    successText: 'Listo. Vuelve a WhatsApp: Connect está continuando la solicitud que te trajo hasta aquí.',
    invalid: 'Este enlace no es válido. Envía de nuevo tu pregunta por WhatsApp para recibir otro.',
    genericError: 'No pude completar la vinculación ahora.',
  },
};

export function WhatsAppLinkPage({
  session,
  currentLang,
}: {
  session: LiveConnectSession;
  currentLang: LanguageCode;
}) {
  const copy = COPY[currentLang];
  const token = useMemo(() => new URL(window.location.href).searchParams.get('token')?.trim() || '', []);
  const [organizationId, setOrganizationId] = useState(session.context.activeOrganization.id);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    token ? 'idle' : 'error',
  );
  const [message, setMessage] = useState(token ? '' : copy.invalid);

  const link = async () => {
    if (!token || !organizationId || state === 'loading' || state === 'success') return;
    setState('loading');
    setMessage('');
    try {
      const response = await fetch('/api/core/channel-link/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.idToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ token, organizationId }),
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({})) as any;
      if (!response.ok || body?.success !== true) {
        setMessage(
          typeof body?.humanSummary === 'string' && body.humanSummary.trim()
            ? body.humanSummary.trim()
            : copy.genericError,
        );
        setState('error');
        return;
      }
      setMessage(
        typeof body?.humanSummary === 'string' && body.humanSummary.trim()
          ? body.humanSummary.trim()
          : copy.successText,
      );
      setState('success');
    } catch {
      setMessage(copy.genericError);
      setState('error');
    }
  };

  const organizations = session.context.availableOrganizations;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#07090d] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(101,94,255,.18),transparent_36%),radial-gradient(circle_at_88%_88%,rgba(61,210,173,.08),transparent_28%)]" />
      <section className="relative w-full max-w-[520px]">
        <div className="mb-6 px-1">
          <span className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">{copy.eyebrow}</span>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05]">
              <Link2 size={18} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em]">{state === 'success' ? copy.success : copy.title}</h1>
              <p className="mt-1 text-sm text-slate-400">
                {state === 'success' ? copy.successText : copy.subtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/[0.09] bg-white/[0.045] p-6 shadow-[0_28px_80px_rgba(0,0,0,.38)] backdrop-blur-2xl sm:p-7">
          {state === 'success' ? (
            <div className="text-center">
              <CheckCircle2 size={34} className="mx-auto text-emerald-300" />
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-300">{message || copy.successText}</p>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{copy.organization}</div>
                <div className="mt-3 space-y-2">
                  {organizations.map((organization) => {
                    const selected = organization.id === organizationId;
                    return (
                      <button
                        key={organization.id}
                        type="button"
                        onClick={() => setOrganizationId(organization.id)}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition ${selected ? 'border-indigo-300/30 bg-indigo-400/[0.09]' : 'border-white/[0.08] bg-black/15 hover:border-white/[0.16]'}`}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.055] text-slate-300">
                          <Building2 size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-semibold">{organization.name}</strong>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">{organization.slug}</span>
                        </span>
                        <span className={`h-2.5 w-2.5 rounded-full border ${selected ? 'border-indigo-200 bg-indigo-300' : 'border-slate-600'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/10 px-3.5 py-3">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-slate-500" />
                <p className="text-[11px] leading-5 text-slate-500">{copy.security}</p>
              </div>

              {state === 'error' && message ? (
                <p className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3.5 py-3 text-xs leading-5 text-rose-100/80">
                  {message}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void link()}
                disabled={!token || !organizationId || state === 'loading'}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {state === 'loading' ? copy.linking : copy.action}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
