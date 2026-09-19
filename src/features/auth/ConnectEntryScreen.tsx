import { Building2, ChevronRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';

type Mode = 'login' | 'choose' | 'error';

type Props = {
  mode: Mode;
  language: LanguageCode;
  onLanguageChange(language: LanguageCode): void;
  errorCode?: string | null;
  session?: LiveConnectSession | null;
  onGoogle(): void;
  onHub(): void;
  onUseAnotherAccount(): void;
  onSelectOrganization(organizationId: string): void;
};

const COPY: Record<LanguageCode, Record<string, string>> = {
  'pt-BR': {
    eyebrow: 'MILLIONSNEST CONNECT',
    title: 'Entre para continuar',
    subtitle: 'Use sua conta MillionsNest. O Connect confirma sua organização e suas permissões antes de liberar qualquer dado.',
    google: 'Continuar com Google',
    hub: 'Entrar pelo MillionsNest',
    security: 'Google identifica você. O MillionsNest continua sendo a autoridade de organizações, acesso e permissões.',
    chooseTitle: 'Onde você quer trabalhar?',
    chooseSubtitle: 'Sua conta tem acesso a mais de uma organização. Escolha o contexto deste acesso.',
    another: 'Usar outra conta Google',
    errorTitle: 'Não foi possível concluir o acesso',
    errorText: 'Seu acesso não foi liberado com esta sessão. Tente outra conta ou abra o MillionsNest para revisar o contexto.',
    retry: 'Tentar com Google',
  },
  'en-US': {
    eyebrow: 'MILLIONSNEST CONNECT',
    title: 'Sign in to continue',
    subtitle: 'Use your MillionsNest account. Connect confirms your organization and permissions before exposing any data.',
    google: 'Continue with Google',
    hub: 'Sign in through MillionsNest',
    security: 'Google identifies you. MillionsNest remains the authority for organizations, access and permissions.',
    chooseTitle: 'Where do you want to work?',
    chooseSubtitle: 'Your account can access more than one organization. Choose the context for this session.',
    another: 'Use another Google account',
    errorTitle: 'We could not complete sign-in',
    errorText: 'Access was not granted for this session. Try another account or open MillionsNest to review the context.',
    retry: 'Try Google again',
  },
  'es-ES': {
    eyebrow: 'MILLIONSNEST CONNECT',
    title: 'Inicia sesión para continuar',
    subtitle: 'Usa tu cuenta MillionsNest. Connect confirma tu organización y permisos antes de mostrar cualquier dato.',
    google: 'Continuar con Google',
    hub: 'Entrar por MillionsNest',
    security: 'Google te identifica. MillionsNest sigue siendo la autoridad de organizaciones, acceso y permisos.',
    chooseTitle: '¿Dónde quieres trabajar?',
    chooseSubtitle: 'Tu cuenta tiene acceso a más de una organización. Elige el contexto de esta sesión.',
    another: 'Usar otra cuenta de Google',
    errorTitle: 'No pudimos completar el acceso',
    errorText: 'El acceso no fue autorizado para esta sesión. Prueba otra cuenta o abre MillionsNest para revisar el contexto.',
    retry: 'Intentar de nuevo con Google',
  },
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.8-2.4l-3.3-2.6c-.9.6-2.1 1-3.5 1a6 6 0 0 1-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.4H3A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.6l3.4-2.7Z" />
      <path fill="#EA4335" d="M12 6c1.6 0 3 .5 4 1.6L19 4.7A10 10 0 0 0 3 7.4l3.4 2.7A6 6 0 0 1 12 6Z" />
    </svg>
  );
}

export function ConnectEntryScreen(props: Props) {
  const c = COPY[props.language];
  const organizations = props.session?.context.availableOrganizations ?? [];

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#07090d] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(101,94,255,.17),transparent_35%),radial-gradient(circle_at_88%_88%,rgba(199,154,87,.08),transparent_28%)]" />
      <section className="relative w-full max-w-[450px]">
        <div className="mb-7 flex items-center justify-between px-1">
          <div>
            <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">{c.eyebrow}</span>
            <div className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Connect</div>
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/[0.035] p-1 text-[10px] font-semibold">
            {(['pt-BR', 'en-US', 'es-ES'] as LanguageCode[]).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => props.onLanguageChange(language)}
                className={`rounded-lg px-2 py-1.5 transition ${props.language === language ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                {language === 'pt-BR' ? 'PT' : language === 'en-US' ? 'EN' : 'ES'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/[0.09] bg-white/[0.045] p-6 shadow-[0_28px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl sm:p-7">
          {props.mode === 'choose' ? (
            <>
              <h1 className="text-[1.45rem] font-semibold tracking-[-0.035em]">{c.chooseTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{c.chooseSubtitle}</p>
              <div className="mt-6 space-y-2">
                {organizations.map((organization) => (
                  <button
                    key={organization.id}
                    type="button"
                    onClick={() => props.onSelectOrganization(organization.id)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/15 px-4 text-left transition hover:border-white/[0.16] hover:bg-white/[0.055]"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.055] text-slate-300">
                      <Building2 size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-semibold text-white">{organization.name}</strong>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{organization.slug}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={props.onUseAnotherAccount} className="mt-5 w-full py-3 text-sm font-medium text-slate-400 transition hover:text-white">
                {c.another}
              </button>
            </>
          ) : props.mode === 'error' ? (
            <div className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.045]">
                <LockKeyhole size={20} />
              </div>
              <h1 className="mt-5 text-xl font-semibold tracking-[-0.03em]">{c.errorTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{c.errorText}</p>
              {props.errorCode ? (
                <p className="mx-auto mt-3 w-fit rounded-lg border border-white/[0.08] bg-black/20 px-3 py-1.5 font-mono text-[10px] tracking-wide text-slate-600">
                  {props.errorCode}
                </p>
              ) : null}
              <div className="mt-6 space-y-2">
                <button type="button" onClick={props.onGoogle} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:opacity-90">
                  <GoogleMark /> {c.retry}
                </button>
                <button type="button" onClick={props.onHub} className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.065]">
                  {c.hub}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-[1.55rem] font-semibold tracking-[-0.04em]">{c.title}</h1>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{c.subtitle}</p>
              </div>
              <div className="mt-7 space-y-3">
                <button type="button" onClick={props.onGoogle} className="flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:opacity-90">
                  <GoogleMark /> {c.google}
                </button>
                <button type="button" onClick={props.onHub} className="min-h-13 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                  {c.hub}
                </button>
              </div>
              <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/10 px-3.5 py-3">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-slate-500" />
                <p className="text-[11px] leading-5 text-slate-500">{c.security}</p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
