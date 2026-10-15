import React, { useEffect, useState } from 'react';
import { Bot, RefreshCw, ShieldCheck } from 'lucide-react';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import { listProductAgentProfiles, listProductAgentOwners, type ProductAgentView, type ProductAgentOwnerChoice } from '../../core/client/productAgentProfilesClient';
import { ProductAgentSettingsEditor } from './ProductAgentSettingsEditor';
import { OperationWorkspaceHeader } from '../live/OperationWorkspaceHeader';

const copy = {
  'pt-BR': { title: 'Atendimento por aplicativo', description: 'Respostas públicas e orientação de acesso. Consultas pessoais exigem validação de acesso; pedidos sem ferramenta disponível seguem para a equipe.', refresh: 'Atualizar', loading: 'Carregando perfis…', denied: 'Somente responsáveis pela gestão do atendimento podem consultar estes perfis.', session: 'Sua sessão expirou. Entre novamente para consultar os perfis.', error: 'Não foi possível consultar os perfis agora. Tente novamente.', knowledge: 'Conhecimento público', response: 'Mensagem de acolhimento', owner: 'Responsável validado na organização', queue: 'Fila de atendimento humano', tools: 'Consultas disponíveis após validar acesso', noTools: 'Consultas privadas encaminhadas à equipe', cost: 'Respostas públicas sem custo de modelo de IA', config: 'Configuração atual definida pela equipe técnica. A edição nesta tela ainda não está disponível.', practical: 'Comunicação prática', careful: 'Comunicação cuidadosa', welcoming: 'Comunicação acolhedora' },
  'en-US': { title: 'Support by application', description: 'Public answers and access guidance. Personal queries require access validation; requests without an available tool go to the team.', refresh: 'Refresh', loading: 'Loading profiles…', denied: 'Only support managers can view these profiles.', session: 'Your session expired. Sign in again to view profiles.', error: 'Could not load profiles. Please try again.', knowledge: 'Public knowledge', response: 'Welcome message', owner: 'Owner verified in this organization', queue: 'Human support queue', tools: 'Queries available after access validation', noTools: 'Private queries go to the team', cost: 'Public replies without AI model costs', config: 'Current configuration is managed by the technical team. Editing on this screen is not available yet.', practical: 'Practical communication', careful: 'Careful communication', welcoming: 'Welcoming communication' },
  'es-ES': { title: 'Soporte por aplicación', description: 'Respuestas públicas y orientación de acceso. Las consultas personales requieren validar el acceso; las solicitudes sin herramienta disponible pasan al equipo.', refresh: 'Actualizar', loading: 'Cargando perfiles…', denied: 'Solo los responsables de soporte pueden consultar estos perfiles.', session: 'Tu sesión caducó. Inicia sesión de nuevo para consultar los perfiles.', error: 'No se pudieron consultar los perfiles. Inténtalo de nuevo.', knowledge: 'Conocimiento público', response: 'Mensaje de bienvenida', owner: 'Responsable validado en esta organización', queue: 'Cola de atención humana', tools: 'Consultas disponibles tras validar el acceso', noTools: 'Consultas privadas derivadas al equipo', cost: 'Respuestas públicas sin costo de modelo de IA', config: 'La configuración actual la gestiona el equipo técnico. La edición en esta pantalla aún no está disponible.', practical: 'Comunicación práctica', careful: 'Comunicación cuidadosa', welcoming: 'Comunicación acogedora' },
} satisfies Record<LanguageCode, Record<string, string>>;

type Result = { session: LiveConnectSession; profiles?: ProductAgentView[]; owners?: ProductAgentOwnerChoice[] | null; error?: string };
export function LiveProductAgentsPage({ session, currentLang, onNavigate }: {
  session: LiveConnectSession; currentLang: LanguageCode; onNavigate: (route: string) => void;
}) {
  const t = copy[currentLang];
  const [result, setResult] = useState<Result | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResult(null);
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    void listProductAgentProfiles(session, controller.signal).then(async profiles => {
      const owners = profiles.some(profile => profile.settingsEditable) ? await listProductAgentOwners(session, controller.signal).catch(() => null) : null;
      if (active) setResult({ session, profiles, owners });
    }).catch((error: unknown) => {
      if (active) setResult({ session, error: error instanceof Error ? error.message : 'AGENT_PROFILES_UNAVAILABLE' });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [session, refresh]);
  // Hide previous actor/organization/token results during the render before effect cleanup.
  const current = result?.session === session ? result : null;
  const error = current?.error === 'AGENT_ACCESS_DENIED' ? t.denied : current?.error === 'AGENT_SESSION_REQUIRED' ? t.session : current?.error ? t.error : '';
  return <main className="mx-auto w-full max-w-[1500px] space-y-4 pb-28 lg:pb-8">
    <OperationWorkspaceHeader currentLang={currentLang} activeRoute="agents" onNavigate={onNavigate} />
    <section className="connect-surface rounded-[14px] p-4 sm:p-5" aria-labelledby="product-agents-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><h2 id="product-agents-title" className="flex items-center gap-2 text-lg font-semibold text-[#F2F5FA]"><Bot size={19} aria-hidden="true" />{t.title}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#8093A6]">{t.description}</p></div>
        <button type="button" onClick={() => { setResult(null); setRefresh(value => value + 1); }} disabled={!current} className="connect-focus inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#315064] px-3 text-xs text-[#C8D4DE] disabled:opacity-50"><RefreshCw size={14} aria-hidden="true" />{t.refresh}</button>
      </div>
      <div role="status" aria-live="polite" className="mt-4 text-xs text-[#C8D4DE]">{!current ? t.loading : error}</div>
      {current?.profiles ? <div className="mt-4 grid gap-4 lg:grid-cols-3">{current.profiles.map(profile => <article key={profile.product} className="min-w-0 rounded-xl border border-[#315064] p-4">
        <h3 className="text-base font-semibold text-[#F2F5FA]">{profile.label}</h3>
        <p className="mt-1 text-xs text-[#8FE6F3]">{t[profile.communicationStyle]}</p>
        <h4 className="mt-4 text-xs font-semibold text-[#C8D4DE]">{t.knowledge}</h4>
        <p className="mt-1 text-xs leading-5 text-[#8093A6]">{profile.overview[currentLang]}</p>
        <a href={profile.url} target="_blank" rel="noopener noreferrer" className="connect-focus mt-2 inline-block break-all text-xs text-[#8FE6F3] underline">{profile.url}</a>
        <h4 className="mt-4 text-xs font-semibold text-[#C8D4DE]">{t.response}</h4>
        <p className="mt-1 text-xs leading-5 text-[#8093A6]">{profile.intake[currentLang]}</p>
        <p className="mt-4 flex items-center gap-2 text-xs text-[#C8D4DE]"><ShieldCheck size={14} aria-hidden="true" />{profile.ownerVerified ? t.owner : t.queue}</p>
        <p className="mt-3 text-xs leading-5 text-[#8093A6]">{profile.allowedToolRefs.length ? `${t.tools}: ${profile.allowedToolRefs.length}` : t.noTools}</p>
        {profile.settingsEditable ? <ProductAgentSettingsEditor session={session} profile={profile} currentLang={currentLang} owners={current.owners ?? null}
          onSaved={(settings, version) => setResult(previous => previous?.session === session ? { ...previous, profiles: previous.profiles?.map(item => item.product === profile.product ? {
            ...item, ...settings, version, ownerVerified: !!settings.ownerUid,
          } : item) } : previous)} /> : null}
      </article>)}</div> : null}
      <p className="mt-5 text-xs leading-5 text-[#8093A6]">{t.cost}{current?.profiles?.some(profile => profile.settingsEditable) ? '' : ` · ${t.config}`}</p>
    </section>
  </main>;
}
