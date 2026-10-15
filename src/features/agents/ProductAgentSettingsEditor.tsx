import React, { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../../types';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import type { ProductAgentSettings } from '../../core/agents/productAgentSettings';
import { saveProductAgentSettings, type ProductAgentOwnerChoice, type ProductAgentView } from '../../core/client/productAgentProfilesClient';

const labels = {
  'pt-BR': { edit: 'Configurar atendimento', enabled: 'Ativar respostas deste agente', paused: 'Desativado: solicitações seguem para atendimento humano.', style: 'Estilo de comunicação', practical: 'Prático', careful: 'Cuidadoso', welcoming: 'Acolhedor', owner: 'Responsável', queue: 'Fila da equipe', currentOwner: 'Responsável atual validado', directory: 'Não foi possível atualizar a lista de responsáveis.', language: 'Idioma do texto', overview: 'Orientação pública sobre o aplicativo', intake: 'Mensagem de acolhimento', confirm: 'Confirmo que estes textos são públicos e não contêm dados pessoais, financeiros ou credenciais.', save: 'Salvar configuração', saving: 'Salvando…', saved: 'Configuração salva.', conflict: 'Outra edição foi salva. Atualize os perfis antes de tentar novamente.', invalid: 'Revise os textos nos três idiomas. Use até 1.200 caracteres por campo, sem links ou dados privados.', denied: 'Acesso ou responsável não autorizado. Atualize sua sessão e os perfis.', error: 'Não foi possível confirmar o salvamento. Você pode tentar novamente ou atualizar os perfis.', note: 'Os textos aprovados são usados nas respostas públicas. As permissões das ferramentas continuam definidas pelo Hub e pelos aplicativos.' },
  'en-US': { edit: 'Configure support', enabled: 'Enable this agent’s replies', paused: 'Disabled: requests go to human support.', style: 'Communication style', practical: 'Practical', careful: 'Careful', welcoming: 'Welcoming', owner: 'Owner', queue: 'Team queue', currentOwner: 'Current verified owner', directory: 'Could not refresh the owner list.', language: 'Text language', overview: 'Public app guidance', intake: 'Welcome message', confirm: 'I confirm these texts are public and contain no personal data, financial records or credentials.', save: 'Save configuration', saving: 'Saving…', saved: 'Configuration saved.', conflict: 'Another edit was saved. Refresh profiles before trying again.', invalid: 'Review all three languages. Use up to 1,200 characters per field, without links or private data.', denied: 'Access or owner not authorized. Refresh your session and profiles.', error: 'Could not confirm the save. Retry or refresh profiles.', note: 'Approved texts are used in public replies. Tool permissions remain controlled by the Hub and domain apps.' },
  'es-ES': { edit: 'Configurar atención', enabled: 'Activar respuestas de este agente', paused: 'Desactivado: las solicitudes pasan a atención humana.', style: 'Estilo de comunicación', practical: 'Práctico', careful: 'Cuidadoso', welcoming: 'Acogedor', owner: 'Responsable', queue: 'Cola del equipo', currentOwner: 'Responsable actual validado', directory: 'No se pudo actualizar la lista de responsables.', language: 'Idioma del texto', overview: 'Orientación pública sobre la aplicación', intake: 'Mensaje de bienvenida', confirm: 'Confirmo que estos textos son públicos y no contienen datos personales, financieros ni credenciales.', save: 'Guardar configuración', saving: 'Guardando…', saved: 'Configuración guardada.', conflict: 'Se guardó otra edición. Actualiza los perfiles antes de volver a intentar.', invalid: 'Revisa los tres idiomas. Usa hasta 1.200 caracteres por campo, sin enlaces ni datos privados.', denied: 'Acceso o responsable no autorizado. Actualiza tu sesión y los perfiles.', error: 'No se pudo confirmar el guardado. Vuelve a intentar o actualiza los perfiles.', note: 'Los textos aprobados se usan en respuestas públicas. El Hub y las aplicaciones siguen controlando los permisos de las herramientas.' },
} satisfies Record<LanguageCode, Record<string, string>>;

export function ProductAgentSettingsEditor({ session, profile, currentLang, owners, onSaved }: {
  session: LiveConnectSession; profile: ProductAgentView; currentLang: LanguageCode;
  owners: ProductAgentOwnerChoice[] | null;
  onSaved: (settings: ProductAgentSettings, version: number) => void;
}) {
  const t = labels[currentLang];
  const [draft, setDraft] = useState<ProductAgentSettings>(() => ({ enabled: profile.enabled, communicationStyle: profile.communicationStyle,
    ownerUid: profile.ownerUid, overview: { ...profile.overview }, intake: { ...profile.intake } }));
  const [language, setLanguage] = useState<LanguageCode>(currentLang);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const active = useRef(true), controller = useRef<AbortController | null>(null);
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  function change(next: ProductAgentSettings) { setDraft(next); setConfirmed(false); setStatus(''); requestId.current = null; }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed || inFlight.current || status === 'AGENT_SETTINGS_CONFLICT') return;
    inFlight.current = true;
    const abort = new AbortController(); controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 10000);
    setSaving(true); setStatus('');
    try {
      requestId.current ??= crypto.randomUUID();
      const result = await saveProductAgentSettings(session, { product: profile.product, expectedVersion: profile.version,
        requestId: requestId.current, settings: draft, publicKnowledgeConfirmed: confirmed }, abort.signal);
      if (active.current) { requestId.current = null; setConfirmed(false); setStatus('saved'); onSaved(draft, result.version); }
    } catch (error) {
      if (active.current) setStatus(error instanceof Error ? error.message : 'AGENT_SETTINGS_UNAVAILABLE');
    } finally { inFlight.current = false; window.clearTimeout(timeout); if (active.current) setSaving(false); }
  }
  const message = status === 'saved' ? t.saved : status === 'AGENT_SETTINGS_CONFLICT' ? t.conflict : status === 'AGENT_SETTINGS_INVALID' ? t.invalid
    : ['AGENT_ACCESS_DENIED', 'AGENT_SESSION_REQUIRED'].includes(status) ? t.denied : status ? t.error : '';
  const field = 'connect-focus mt-1 min-h-11 w-full rounded-lg border border-[#315064] bg-[#0B141E] p-2 text-xs text-[#C8D4DE] disabled:opacity-50';
  return <details className="mt-4 border-t border-[#315064] pt-3">
    <summary className="connect-focus cursor-pointer text-xs font-semibold text-[#8FE6F3]">{t.edit}</summary>
    <form onSubmit={save} className="mt-3 space-y-3">
      <fieldset disabled={saving || status === 'AGENT_SETTINGS_CONFLICT'} className="min-w-0 space-y-3 disabled:opacity-70">
        <label className="flex min-h-11 items-center gap-2 text-xs text-[#C8D4DE]"><input type="checkbox" checked={draft.enabled} onChange={e => change({ ...draft, enabled: e.target.checked })} />{t.enabled}</label>
        {!draft.enabled ? <p className="text-xs text-[#C8D4DE]">{t.paused}</p> : null}
        <label className="block text-xs text-[#8093A6]">{t.style}<select className={field} value={draft.communicationStyle} onChange={e => change({ ...draft, communicationStyle: e.target.value as ProductAgentSettings['communicationStyle'] })}>
          {(['practical', 'careful', 'welcoming'] as const).map(style => <option key={style} value={style}>{t[style]}</option>)}
        </select></label>
        <label className="block text-xs text-[#8093A6]">{t.owner}<select className={field} value={draft.ownerUid ?? ''} disabled={!owners} onChange={e => change({ ...draft, ownerUid: e.target.value || null })}>
          <option value="">{t.queue}</option>
          {profile.ownerUid && !owners?.some(o => o.uid === profile.ownerUid) ? <option value={profile.ownerUid}>{t.currentOwner}</option> : null}
          {owners?.map(owner => <option key={owner.uid} value={owner.uid}>{owner.displayName}</option>)}
        </select></label>
        {!owners ? <p className="text-xs text-[#8093A6]">{t.directory}</p> : null}
        <label className="block text-xs text-[#8093A6]">{t.language}<select className={field} value={language} onChange={e => setLanguage(e.target.value as LanguageCode)}>
          <option value="pt-BR">Português</option><option value="en-US">English</option><option value="es-ES">Español</option>
        </select></label>
        <label className="block text-xs text-[#8093A6]">{t.overview}<textarea lang={language} className={`${field} min-h-28 resize-y`} maxLength={1200} required value={draft.overview[language]} onChange={e => change({ ...draft, overview: { ...draft.overview, [language]: e.target.value } })} /></label>
        <label className="block text-xs text-[#8093A6]">{t.intake}<textarea lang={language} className={`${field} min-h-28 resize-y`} maxLength={1200} required value={draft.intake[language]} onChange={e => change({ ...draft, intake: { ...draft.intake, [language]: e.target.value } })} /></label>
        <p className="text-xs leading-5 text-[#8093A6]">{t.note}</p>
        <label className="flex min-h-11 items-start gap-2 text-xs leading-5 text-[#C8D4DE]"><input type="checkbox" className="mt-1" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{t.confirm}</label>
        <button type="submit" disabled={!confirmed || saving} className={`${field} font-semibold`}>{saving ? t.saving : t.save}</button>
      </fieldset>
      <p role="status" aria-live="polite" className="text-xs leading-5 text-[#C8D4DE]">{message}</p>
    </form>
  </details>;
}
