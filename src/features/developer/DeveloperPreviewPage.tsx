import React from 'react';
import {
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  RotateCcw,
  ShieldCheck,
  Layers3,
  Languages,
  Building2,
  BadgeCheck,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  EXPERIENCE_PREVIEW_OPTIONS,
  ExperiencePreviewConfig,
  ExperienceProfile,
  ExperienceView,
  PreviewAccountState,
  PreviewDataMode,
  PreviewDevice,
  PreviewProduct,
  getExperienceNavigationRouteIds,
} from '../../core/client/liveSurfacePolicy';
import { LanguageCode } from '../../types';

interface DeveloperPreviewPageProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  config: ExperiencePreviewConfig;
  realProfile: ExperienceProfile;
  showRadar: boolean;
  onChange: (next: ExperiencePreviewConfig) => void;
  onChangeLang: (lang: LanguageCode) => void;
  onOpenHome: () => void;
}

const copy = {
  'pt-BR': {
    eyebrow: 'CENTRAL DO DESENVOLVEDOR',
    title: 'Teste cada jornada sem trocar seu cargo real.',
    subtitle: 'Esta área altera somente a experiência aparente. Sessão, RBAC, organização efetiva e autoridade do backend continuam sendo as suas.',
    role: 'Papel',
    organization: 'Organização de referência',
    product: 'Produto habilitado',
    plan: 'Plano',
    language: 'Idioma',
    device: 'Dispositivo',
    account: 'Estado da conta',
    data: 'Dados',
    reset: 'Restaurar visão real',
    open: 'Abrir Home com esta lente',
    guard: 'Somente visualização',
    guardDesc: 'Cenários sintéticos não concedem capabilities, não trocam o tenant real e não executam ações como outra pessoa.',
    compare: 'Comparação rápida',
    compareDesc: 'Veja como a navegação muda entre perfis para encontrar excesso, ausência ou permissão aparente incorreta.',
    visible: 'módulos aparentes',
    real: 'Minha visão real',
  },
  'en-US': {
    eyebrow: 'DEVELOPER CENTER',
    title: 'Test every journey without changing your real role.',
    subtitle: 'This area changes presentation only. Session, RBAC, effective organization and backend authority remain yours.',
    role: 'Role',
    organization: 'Reference organization',
    product: 'Enabled product',
    plan: 'Plan',
    language: 'Language',
    device: 'Device',
    account: 'Account state',
    data: 'Data',
    reset: 'Restore real view',
    open: 'Open Home with this lens',
    guard: 'Preview only',
    guardDesc: 'Synthetic scenarios never grant capabilities, change the real tenant, or execute actions as another person.',
    compare: 'Quick comparison',
    compareDesc: 'Compare navigation across roles to spot excess, missing functions or misleading permission states.',
    visible: 'visible modules',
    real: 'My real view',
  },
  'es-ES': {
    eyebrow: 'CENTRAL DEL DESARROLLADOR',
    title: 'Prueba cada recorrido sin cambiar tu rol real.',
    subtitle: 'Esta área cambia solo la presentación. La sesión, RBAC, organización efectiva y autoridad del backend siguen siendo tuyas.',
    role: 'Rol',
    organization: 'Organización de referencia',
    product: 'Producto habilitado',
    plan: 'Plan',
    language: 'Idioma',
    device: 'Dispositivo',
    account: 'Estado de la cuenta',
    data: 'Datos',
    reset: 'Restaurar vista real',
    open: 'Abrir Inicio con esta lente',
    guard: 'Solo visualización',
    guardDesc: 'Los escenarios sintéticos no conceden capabilities, no cambian el tenant real ni ejecutan acciones como otra persona.',
    compare: 'Comparación rápida',
    compareDesc: 'Compara la navegación entre perfiles para detectar exceso, ausencia o permisos aparentes incorrectos.',
    visible: 'módulos visibles',
    real: 'Mi vista real',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const roleLabels: Record<ExperienceView, Record<LanguageCode, string>> = {
  real: { 'pt-BR': 'Minha visão real', 'en-US': 'My real view', 'es-ES': 'Mi vista real' },
  ceo: { 'pt-BR': 'CEO', 'en-US': 'CEO', 'es-ES': 'CEO' },
  musician: { 'pt-BR': 'Músico', 'en-US': 'Musician', 'es-ES': 'Músico' },
  worship_leader: { 'pt-BR': 'Líder de louvor', 'en-US': 'Worship leader', 'es-ES': 'Líder de alabanza' },
  pastor_leader: { 'pt-BR': 'Pastor ou líder', 'en-US': 'Pastor or leader', 'es-ES': 'Pastor o líder' },
  support: { 'pt-BR': 'Atendimento', 'en-US': 'Support', 'es-ES': 'Atención' },
  commercial: { 'pt-BR': 'Comercial', 'en-US': 'Commercial', 'es-ES': 'Comercial' },
  organization_admin: { 'pt-BR': 'Administrador', 'en-US': 'Administrator', 'es-ES': 'Administrador' },
};

const accountLabels: Record<PreviewAccountState, Record<LanguageCode, string>> = {
  active: { 'pt-BR': 'Ativa', 'en-US': 'Active', 'es-ES': 'Activa' },
  new: { 'pt-BR': 'Nova / onboarding', 'en-US': 'New / onboarding', 'es-ES': 'Nueva / onboarding' },
  trial: { 'pt-BR': 'Trial', 'en-US': 'Trial', 'es-ES': 'Trial' },
  limited: { 'pt-BR': 'Limitada', 'en-US': 'Limited', 'es-ES': 'Limitada' },
  missing_permission: { 'pt-BR': 'Sem determinada permissão', 'en-US': 'Missing a permission', 'es-ES': 'Sin determinado permiso' },
};

const productLabels: Record<PreviewProduct, Record<LanguageCode, string>> = {
  auto: { 'pt-BR': 'Acesso real da conta', 'en-US': 'Real account access', 'es-ES': 'Acceso real de la cuenta' },
  connect: { 'pt-BR': 'Connect', 'en-US': 'Connect', 'es-ES': 'Connect' },
  musicscale: { 'pt-BR': 'MusicScale + Connect', 'en-US': 'MusicScale + Connect', 'es-ES': 'MusicScale + Connect' },
  nestjourney: { 'pt-BR': 'NestJourney + Connect', 'en-US': 'NestJourney + Connect', 'es-ES': 'NestJourney + Connect' },
  nestfinance: { 'pt-BR': 'NestFinance + Connect', 'en-US': 'NestFinance + Connect', 'es-ES': 'NestFinance + Connect' },
  nestlocal: { 'pt-BR': 'NestLocal + Connect', 'en-US': 'NestLocal + Connect', 'es-ES': 'NestLocal + Connect' },
};

const deviceLabels: Record<PreviewDevice, Record<LanguageCode, string>> = {
  auto: { 'pt-BR': 'Automático', 'en-US': 'Automatic', 'es-ES': 'Automático' },
  desktop: { 'pt-BR': 'Desktop', 'en-US': 'Desktop', 'es-ES': 'Desktop' },
  tablet: { 'pt-BR': 'Tablet', 'en-US': 'Tablet', 'es-ES': 'Tablet' },
  mobile: { 'pt-BR': 'Celular', 'en-US': 'Mobile', 'es-ES': 'Celular' },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl border border-white/[0.08] bg-black/15 p-3.5">
      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const DeveloperPreviewPage: React.FC<DeveloperPreviewPageProps> = ({
  session,
  currentLang,
  config,
  realProfile,
  showRadar,
  onChange,
  onChangeLang,
  onOpenHome,
}) => {
  const t = copy[currentLang];
  const update = <K extends keyof ExperiencePreviewConfig>(key: K, value: ExperiencePreviewConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const realOrgId = session.context.activeOrganization.id;
  const realPlan = session.context.activeOrganization.plan || 'real';
  const isSynthetic =
    config.view !== 'real' ||
    config.organizationId !== realOrgId ||
    config.product !== 'auto' ||
    config.plan !== 'real' ||
    config.device !== 'auto' ||
    config.accountState !== 'active' ||
    config.dataMode !== 'real_permitted';

  const reset = () => {
    onChange({
      view: 'real',
      organizationId: realOrgId,
      product: 'auto',
      plan: 'real',
      device: 'auto',
      accountState: 'active',
      dataMode: 'real_permitted',
    });
    onChangeLang('pt-BR');
  };

  const compareProfiles: ExperienceProfile[] = ['ceo', 'worship_leader', 'musician'];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_15%_0%,rgba(99,102,241,.17),transparent_34%),linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.018))] p-5 shadow-[0_30px_90px_rgba(0,0,0,.24)] sm:p-7 lg:p-9">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
            <Eye size={14} /> {t.eyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs text-emerald-100">
            <ShieldCheck size={14} /> {t.guard}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label={t.role}>
          <select value={config.view} onChange={(e) => update('view', e.target.value as ExperienceView)} className="w-full bg-transparent text-sm font-medium text-white outline-none">
            {EXPERIENCE_PREVIEW_OPTIONS.map((view) => <option key={view} value={view}>{roleLabels[view][currentLang]}</option>)}
          </select>
        </Field>

        <Field label={t.organization}>
          <div className="flex items-center gap-2">
            <Building2 size={14} className="shrink-0 text-indigo-300" />
            <select value={config.organizationId} onChange={(e) => update('organizationId', e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none">
              {session.context.availableOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </div>
        </Field>

        <Field label={t.product}>
          <div className="flex items-center gap-2">
            <Layers3 size={14} className="shrink-0 text-indigo-300" />
            <select value={config.product} onChange={(e) => update('product', e.target.value as PreviewProduct)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none">
              {(Object.keys(productLabels) as PreviewProduct[]).map((product) => <option key={product} value={product}>{productLabels[product][currentLang]}</option>)}
            </select>
          </div>
        </Field>

        <Field label={t.plan}>
          <div className="flex items-center gap-2">
            <BadgeCheck size={14} className="shrink-0 text-indigo-300" />
            <select value={config.plan} onChange={(e) => update('plan', e.target.value as ExperiencePreviewConfig['plan'])} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none">
              <option value="real">{currentLang === 'pt-BR' ? `Plano real · ${realPlan}` : currentLang === 'es-ES' ? `Plan real · ${realPlan}` : `Real plan · ${realPlan}`}</option>
              <option value="starter">Starter</option>
              <option value="advanced">Advanced</option>
              <option value="pro">Pro</option>
            </select>
          </div>
        </Field>

        <Field label={t.language}>
          <div className="flex items-center gap-2">
            <Languages size={14} className="shrink-0 text-indigo-300" />
            <select value={currentLang} onChange={(e) => onChangeLang(e.target.value as LanguageCode)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none">
              <option value="pt-BR">Português</option>
              <option value="en-US">English</option>
              <option value="es-ES">Español</option>
            </select>
          </div>
        </Field>

        <Field label={t.device}>
          <div className="flex items-center gap-2">
            {config.device === 'mobile' ? <Smartphone size={14} className="text-indigo-300" /> : config.device === 'tablet' ? <Tablet size={14} className="text-indigo-300" /> : <Monitor size={14} className="text-indigo-300" />}
            <select value={config.device} onChange={(e) => update('device', e.target.value as PreviewDevice)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none">
              {(Object.keys(deviceLabels) as PreviewDevice[]).map((device) => <option key={device} value={device}>{deviceLabels[device][currentLang]}</option>)}
            </select>
          </div>
        </Field>

        <Field label={t.account}>
          <select value={config.accountState} onChange={(e) => update('accountState', e.target.value as PreviewAccountState)} className="w-full bg-transparent text-sm font-medium text-white outline-none">
            {(Object.keys(accountLabels) as PreviewAccountState[]).map((state) => <option key={state} value={state}>{accountLabels[state][currentLang]}</option>)}
          </select>
        </Field>

        <Field label={t.data}>
          <select value={config.dataMode} onChange={(e) => update('dataMode', e.target.value as PreviewDataMode)} className="w-full bg-transparent text-sm font-medium text-white outline-none">
            <option value="real_permitted">{currentLang === 'pt-BR' ? 'Reais permitidos' : currentLang === 'es-ES' ? 'Reales permitidos' : 'Permitted real data'}</option>
            <option value="simulated">{currentLang === 'pt-BR' ? 'Cenário simulado' : currentLang === 'es-ES' ? 'Escenario simulado' : 'Simulated scenario'}</option>
          </select>
        </Field>
      </section>

      <section className="flex flex-col gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{t.guard}</div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{t.guardDesc}</p>
          {isSynthetic && (
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300">
              {roleLabels[config.view][currentLang]} · {productLabels[config.product][currentLang]} · {deviceLabels[config.device][currentLang]}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-xs font-medium text-slate-300 hover:bg-white/[0.04]">
            <RotateCcw size={14} /> {t.reset}
          </button>
          <button type="button" onClick={onOpenHome} className="min-h-10 rounded-xl bg-white px-4 text-xs font-semibold text-slate-950">
            {t.open}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="text-sm font-semibold text-white">{t.compare}</div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{t.compareDesc}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {compareProfiles.map((profile) => {
            const routes = getExperienceNavigationRouteIds(profile, showRadar);
            return (
              <button
                key={profile}
                type="button"
                onClick={() => onChange({ ...config, view: profile })}
                className="rounded-[22px] border border-white/[0.08] bg-black/15 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-400/20 hover:bg-indigo-400/[0.035]"
              >
                <div className="text-sm font-semibold text-white">{roleLabels[profile][currentLang]}</div>
                <div className="mt-1 text-[11px] text-slate-600">{routes.length} {t.visible}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {routes.slice(0, 6).map((route) => <span key={route} className="rounded-lg border border-white/[0.07] px-2 py-1 text-[9px] text-slate-500">{route}</span>)}
                  {routes.length > 6 && <span className="rounded-lg border border-white/[0.07] px-2 py-1 text-[9px] text-slate-600">+{routes.length - 6}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
};
