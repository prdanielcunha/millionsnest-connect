import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  MessageSquareText,
  Sparkles,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { LiveConnectSession } from '../../core/client/liveConnectSession';
import {
  ApproachProfile,
  PersonalRadarClient,
  RadarClientPerson,
  SavedMessageModel,
} from '../../core/client/personalRadarClient';
import { LanguageCode } from '../../types';

type ComposerObjective =
  | 'iniciar_conversa'
  | 'descobrir_dor'
  | 'contar_historia'
  | 'pedir_video'
  | 'enviar_video'
  | 'diagnosticar'
  | 'explicar_dor'
  | 'convidar_trial'
  | 'acompanhar_trial'
  | 'retomar_conversa'
  | 'fechar';

type Tone = 'curto' | 'conversa' | 'audio' | 'video';

interface BaseProps {
  session: LiveConnectSession;
  currentLang: LanguageCode;
  onNavigate: (route: string) => void;
}

const objectiveOrder: ComposerObjective[] = [
  'iniciar_conversa',
  'descobrir_dor',
  'contar_historia',
  'pedir_video',
  'enviar_video',
  'diagnosticar',
  'explicar_dor',
  'convidar_trial',
  'acompanhar_trial',
  'retomar_conversa',
  'fechar',
];

const objectiveLabels: Record<ComposerObjective, Record<LanguageCode, string>> = {
  iniciar_conversa: { 'pt-BR': 'Abertura', 'en-US': 'Opening', 'es-ES': 'Apertura' },
  descobrir_dor: { 'pt-BR': 'Descoberta', 'en-US': 'Discovery', 'es-ES': 'Descubrimiento' },
  contar_historia: { 'pt-BR': 'História', 'en-US': 'Story', 'es-ES': 'Historia' },
  pedir_video: { 'pt-BR': 'Permissão', 'en-US': 'Permission', 'es-ES': 'Permiso' },
  enviar_video: { 'pt-BR': 'Demonstração', 'en-US': 'Demo', 'es-ES': 'Demostración' },
  diagnosticar: { 'pt-BR': 'Diagnóstico', 'en-US': 'Diagnosis', 'es-ES': 'Diagnóstico' },
  explicar_dor: { 'pt-BR': 'Resposta focada', 'en-US': 'Focused answer', 'es-ES': 'Respuesta enfocada' },
  convidar_trial: { 'pt-BR': 'Trial', 'en-US': 'Trial', 'es-ES': 'Trial' },
  acompanhar_trial: { 'pt-BR': 'Ativação', 'en-US': 'Activation', 'es-ES': 'Activación' },
  retomar_conversa: { 'pt-BR': 'Retomar', 'en-US': 'Resume', 'es-ES': 'Retomar' },
  fechar: { 'pt-BR': 'Fechamento', 'en-US': 'Close', 'es-ES': 'Cierre' },
};

const approachLabels: Record<ApproachProfile, Record<LanguageCode, string>> = {
  worship_leader: { 'pt-BR': 'Líder/ministro de louvor', 'en-US': 'Worship leader/minister', 'es-ES': 'Líder/ministro de alabanza' },
  pastor_bridge: { 'pt-BR': 'Pastor · ponte', 'en-US': 'Pastor · bridge', 'es-ES': 'Pastor · puente' },
  pastor_worship: { 'pt-BR': 'Pastor envolvido no louvor', 'en-US': 'Pastor involved in worship', 'es-ES': 'Pastor involucrado en alabanza' },
  administrative: { 'pt-BR': 'Secretaria/administrativo', 'en-US': 'Secretary/administrative', 'es-ES': 'Secretaría/administrativo' },
  unknown: { 'pt-BR': 'Perfil não confirmado', 'en-US': 'Profile not confirmed', 'es-ES': 'Perfil no confirmado' },
};

const opportunityCopy = {
  'pt-BR': {
    eyebrow: 'RELACIONAMENTO · OPORTUNIDADES',
    title: 'Conversas que viraram acompanhamento real.',
    subtitle: 'Somente pessoas promovidas manualmente aparecem aqui. Ajuste o estágio sem perder o contexto e volte ao Radar quando precisar compor a próxima mensagem.',
    empty: 'Nenhuma oportunidade aberta',
    emptyDesc: 'No Radar, promova apenas quem realmente merece acompanhamento. O Connect não transforma pessoas em lead automaticamente.',
    stage: 'Estágio',
    followup: 'Próximo acompanhamento',
    approach: 'Abordagem',
    lastAction: 'Última ação',
    radar: 'Abrir no Radar',
    product: 'MusicScale',
  },
  'en-US': {
    eyebrow: 'RELATIONSHIPS · OPPORTUNITIES',
    title: 'Conversations that became real follow-up.',
    subtitle: 'Only manually promoted people appear here. Adjust the stage without losing context and return to Radar when you need the next message.',
    empty: 'No open opportunities',
    emptyDesc: 'Promote only people who truly need follow-up. Connect never turns people into leads automatically.',
    stage: 'Stage',
    followup: 'Next follow-up',
    approach: 'Approach',
    lastAction: 'Last action',
    radar: 'Open in Radar',
    product: 'MusicScale',
  },
  'es-ES': {
    eyebrow: 'RELACIONES · OPORTUNIDADES',
    title: 'Conversaciones que se convirtieron en seguimiento real.',
    subtitle: 'Solo aparecen personas promovidas manualmente. Ajusta la etapa sin perder contexto y vuelve a Radar cuando necesites el próximo mensaje.',
    empty: 'No hay oportunidades abiertas',
    emptyDesc: 'En Radar, promueve solo a quien realmente merece seguimiento. Connect nunca convierte personas en leads automáticamente.',
    stage: 'Etapa',
    followup: 'Próximo seguimiento',
    approach: 'Enfoque',
    lastAction: 'Última acción',
    radar: 'Abrir en Radar',
    product: 'MusicScale',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

export const CommercialOpportunitiesPage: React.FC<BaseProps> = ({ session, currentLang, onNavigate }) => {
  const t = opportunityCopy[currentLang];
  const client = useMemo(() => new PersonalRadarClient(session), [session]);
  const [people, setPeople] = useState<RadarClientPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await client.getRadar();
      setPeople(result.people.filter((person) => person.opportunityStatus === 'open'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  const updateStage = async (person: RadarClientPerson, stage: ComposerObjective) => {
    setSaving((current) => ({ ...current, [person.id]: true }));
    const previous = people;
    setPeople((current) => current.map((item) => item.id === person.id ? { ...item, salesStage: stage } : item));
    try {
      const result = await client.updatePerson(person.id, { salesStage: stage });
      if (result.person) {
        setPeople((current) => current.map((item) => item.id === person.id ? result.person : item));
      }
      setError('');
    } catch (e) {
      setPeople(previous);
      setError(e instanceof Error ? e.message : 'Could not update opportunity.');
    } finally {
      setSaving((current) => ({ ...current, [person.id]: false }));
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.15),transparent_35%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300">{t.eyebrow}</div>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
        <div className="mt-5 inline-flex rounded-full border border-white/[0.08] bg-black/15 px-3 py-1.5 text-[10px] font-semibold text-slate-400">{t.product}</div>
      </section>

      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100">{error}</div>}

      {loading ? (
        <div className="grid min-h-52 place-items-center text-slate-500"><Loader2 className="animate-spin" size={22} /></div>
      ) : people.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <UsersRound size={28} className="mx-auto text-slate-600" />
          <div className="mt-4 text-base font-semibold text-white">{t.empty}</div>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{t.emptyDesc}</p>
          <button type="button" onClick={() => onNavigate('radar')} className="mt-5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-950">{t.radar}</button>
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {people.map((person) => {
            const stage = objectiveOrder.includes(person.salesStage as ComposerObjective)
              ? person.salesStage as ComposerObjective
              : 'iniciar_conversa';
            const approach = person.approachProfile || 'unknown';
            return (
              <article key={person.id} className="rounded-[26px] border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-white">{person.probableName || person.displayName}</h2>
                      {saving[person.id] && <Loader2 size={13} className="animate-spin text-indigo-300" />}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600">{t.product}</div>
                  </div>
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                    open
                  </span>
                </div>

                <label className="mt-4 block rounded-2xl border border-white/[0.08] bg-black/15 p-3">
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.stage}</span>
                  <div className="mt-2 flex items-center gap-2">
                    <select value={stage} onChange={(e) => void updateStage(person, e.target.value as ComposerObjective)} className="min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium text-slate-200 outline-none">
                      {objectiveOrder.map((value) => <option key={value} value={value}>{objectiveLabels[value][currentLang]}</option>)}
                    </select>
                    <ChevronDown size={13} className="text-slate-600" />
                  </div>
                </label>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.approach}</div>
                    <div className="mt-2 text-xs font-medium text-slate-300">{approachLabels[approach][currentLang]}</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-600"><Clock3 size={11} /> {t.followup}</div>
                    <div className="mt-2 text-xs font-medium text-slate-300">{person.followUpAt ? new Date(person.followUpAt).toLocaleString(currentLang) : '—'}</div>
                  </div>
                </div>

                {person.lastCommercialAction && (
                  <div className="mt-3 text-[11px] text-slate-600">{t.lastAction}: <span className="text-slate-400">{person.lastCommercialAction}</span></div>
                )}

                <button type="button" onClick={() => onNavigate('radar')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.04]">
                  <Sparkles size={14} /> {t.radar} <ArrowRight size={13} />
                </button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
};

const playbookCopy = {
  'pt-BR': {
    eyebrow: 'RELACIONAMENTO · PLAYBOOKS',
    title: 'MusicScale: conduza a conversa até o próximo pequeno “sim”.',
    subtitle: 'O playbook não tenta vender em toda mensagem. Cada etapa tem um objetivo curto, um canal adequado e uma saída clara.',
    rule: 'Regra de ouro',
    ruleText: 'Descubra a dor antes de apresentar. Para pastor-ponte, peça acesso ao responsável do louvor. Para líder/ministro, converse a partir da rotina que ele realmente vive.',
    radar: 'Aplicar no Radar',
  },
  'en-US': {
    eyebrow: 'RELATIONSHIPS · PLAYBOOKS',
    title: 'MusicScale: move the conversation to the next small “yes”.',
    subtitle: 'The playbook does not try to sell in every message. Each stage has a small objective, the right channel and a clear exit.',
    rule: 'Golden rule',
    ruleText: 'Discover pain before presenting. For a pastor-bridge, ask for access to the worship owner. For a worship leader, start from the routine they actually live.',
    radar: 'Apply in Radar',
  },
  'es-ES': {
    eyebrow: 'RELACIONES · PLAYBOOKS',
    title: 'MusicScale: lleva la conversación al próximo pequeño “sí”.',
    subtitle: 'El playbook no intenta vender en cada mensaje. Cada etapa tiene un objetivo corto, un canal adecuado y una salida clara.',
    rule: 'Regla de oro',
    ruleText: 'Descubre el dolor antes de presentar. Para pastor-puente, pide acceso al responsable de alabanza. Para líder/ministro, comienza por la rutina que realmente vive.',
    radar: 'Aplicar en Radar',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const playbookStages: Array<{
  objective: ComposerObjective;
  channel: Record<LanguageCode, string>;
  goal: Record<LanguageCode, string>;
}> = [
  { objective: 'iniciar_conversa', channel: { 'pt-BR': 'Texto curto', 'en-US': 'Short text', 'es-ES': 'Texto corto' }, goal: { 'pt-BR': 'Cumprimento verdadeiro + pergunta sobre rotina.', 'en-US': 'Real greeting + question about routine.', 'es-ES': 'Saludo real + pregunta sobre la rutina.' } },
  { objective: 'descobrir_dor', channel: { 'pt-BR': 'Texto', 'en-US': 'Text', 'es-ES': 'Texto' }, goal: { 'pt-BR': 'Entender a dor antes de apresentar.', 'en-US': 'Understand pain before presenting.', 'es-ES': 'Entender el dolor antes de presentar.' } },
  { objective: 'contar_historia', channel: { 'pt-BR': 'Áudio 35–50s', 'en-US': '35–50s audio', 'es-ES': 'Audio 35–50s' }, goal: { 'pt-BR': 'Contar a origem do MusicScale a partir de uma necessidade real.', 'en-US': 'Tell the MusicScale origin from a real need.', 'es-ES': 'Contar el origen de MusicScale desde una necesidad real.' } },
  { objective: 'pedir_video', channel: { 'pt-BR': 'Texto', 'en-US': 'Text', 'es-ES': 'Texto' }, goal: { 'pt-BR': 'Pedir autorização antes de enviar vídeo.', 'en-US': 'Ask permission before sending video.', 'es-ES': 'Pedir permiso antes de enviar video.' } },
  { objective: 'enviar_video', channel: { 'pt-BR': 'Vídeo ~30s', 'en-US': '~30s video', 'es-ES': 'Video ~30s' }, goal: { 'pt-BR': 'Mostrar antes/depois sem tour completo do produto.', 'en-US': 'Show before/after without a full product tour.', 'es-ES': 'Mostrar antes/después sin un tour completo.' } },
  { objective: 'diagnosticar', channel: { 'pt-BR': 'Texto', 'en-US': 'Text', 'es-ES': 'Texto' }, goal: { 'pt-BR': 'Perguntar o que mais ajudaria aquela igreja.', 'en-US': 'Ask what would help that church most.', 'es-ES': 'Preguntar qué ayudaría más a esa iglesia.' } },
  { objective: 'explicar_dor', channel: { 'pt-BR': 'Texto/áudio curto', 'en-US': 'Short text/audio', 'es-ES': 'Texto/audio corto' }, goal: { 'pt-BR': 'Mostrar apenas o recurso ligado à dor.', 'en-US': 'Show only the feature tied to the pain.', 'es-ES': 'Mostrar solo el recurso ligado al dolor.' } },
  { objective: 'convidar_trial', channel: { 'pt-BR': 'Texto', 'en-US': 'Text', 'es-ES': 'Texto' }, goal: { 'pt-BR': 'Quando houver intenção, iniciar 7 dias na organização real.', 'en-US': 'When intent exists, start 7 days in the real organization.', 'es-ES': 'Cuando exista intención, iniciar 7 días en la organización real.' } },
  { objective: 'acompanhar_trial', channel: { 'pt-BR': 'Follow-up', 'en-US': 'Follow-up', 'es-ES': 'Follow-up' }, goal: { 'pt-BR': 'Levar a um ciclo real de escala/publicação/confirmação.', 'en-US': 'Move to a real schedule/publish/confirmation cycle.', 'es-ES': 'Llevar a un ciclo real de escala/publicación/confirmación.' } },
  { objective: 'fechar', channel: { 'pt-BR': 'Conversa', 'en-US': 'Conversation', 'es-ES': 'Conversación' }, goal: { 'pt-BR': 'Perguntar se facilitou e só então apresentar continuidade.', 'en-US': 'Ask whether it helped, then present continuity.', 'es-ES': 'Preguntar si ayudó y solo entonces presentar continuidad.' } },
];

export const CommercialPlaybooksPage: React.FC<BaseProps> = ({ currentLang, onNavigate }) => {
  const t = playbookCopy[currentLang];
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.15),transparent_34%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300"><BookOpen size={14} /> {t.eyebrow}</div>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
      </section>

      <section className="rounded-[24px] border border-indigo-400/15 bg-indigo-400/[0.045] p-4 sm:p-5">
        <div className="text-xs font-semibold text-indigo-100">{t.rule}</div>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-indigo-100/55">{t.ruleText}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {playbookStages.map((stage, index) => (
          <article key={stage.objective} className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/[0.08] bg-black/15 text-xs font-semibold text-indigo-200">{index + 1}</span>
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-500">{stage.channel[currentLang]}</span>
            </div>
            <h2 className="mt-4 text-sm font-semibold text-white">{objectiveLabels[stage.objective][currentLang]}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">{stage.goal[currentLang]}</p>
          </article>
        ))}
      </section>

      <button type="button" onClick={() => onNavigate('radar')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-950">
        <Sparkles size={14} /> {t.radar} <ArrowRight size={13} />
      </button>
    </main>
  );
};

const composerCopy = {
  'pt-BR': {
    eyebrow: 'RELACIONAMENTO · COMPOSER',
    title: 'Biblioteca de mensagens que continua humana.',
    subtitle: 'Salve modelos úteis para reutilizar no Radar. O contexto da pessoa e a geração da abordagem continuam no Composer contextual — o envio nunca é automático.',
    label: 'Nome do modelo',
    objective: 'Objetivo',
    tone: 'Formato',
    text: 'Mensagem',
    save: 'Salvar modelo',
    saving: 'Salvando…',
    saved: 'Modelo salvo',
    library: 'Modelos salvos',
    empty: 'Nenhum modelo salvo ainda.',
    contextual: 'Criar abordagem contextual no Radar',
    delete: 'Excluir',
  },
  'en-US': {
    eyebrow: 'RELATIONSHIPS · COMPOSER',
    title: 'A message library that stays human.',
    subtitle: 'Save useful models for reuse in Radar. Person context and outreach generation stay in the contextual Composer — sending is never automatic.',
    label: 'Model name',
    objective: 'Objective',
    tone: 'Format',
    text: 'Message',
    save: 'Save model',
    saving: 'Saving…',
    saved: 'Model saved',
    library: 'Saved models',
    empty: 'No saved models yet.',
    contextual: 'Create contextual outreach in Radar',
    delete: 'Delete',
  },
  'es-ES': {
    eyebrow: 'RELACIONES · COMPOSER',
    title: 'Una biblioteca de mensajes que sigue humana.',
    subtitle: 'Guarda modelos útiles para reutilizar en Radar. El contexto de la persona y la generación siguen en Composer contextual — el envío nunca es automático.',
    label: 'Nombre del modelo',
    objective: 'Objetivo',
    tone: 'Formato',
    text: 'Mensaje',
    save: 'Guardar modelo',
    saving: 'Guardando…',
    saved: 'Modelo guardado',
    library: 'Modelos guardados',
    empty: 'Todavía no hay modelos guardados.',
    contextual: 'Crear enfoque contextual en Radar',
    delete: 'Eliminar',
  },
} satisfies Record<LanguageCode, Record<string, string>>;

const toneLabels: Record<Tone, Record<LanguageCode, string>> = {
  curto: { 'pt-BR': 'Curto', 'en-US': 'Short', 'es-ES': 'Corto' },
  conversa: { 'pt-BR': 'Conversa', 'en-US': 'Conversation', 'es-ES': 'Conversación' },
  audio: { 'pt-BR': 'Áudio', 'en-US': 'Audio', 'es-ES': 'Audio' },
  video: { 'pt-BR': 'Vídeo', 'en-US': 'Video', 'es-ES': 'Video' },
};

export const CommercialComposerPage: React.FC<BaseProps> = ({ session, currentLang, onNavigate }) => {
  const t = composerCopy[currentLang];
  const client = useMemo(() => new PersonalRadarClient(session), [session]);
  const [models, setModels] = useState<SavedMessageModel[]>([]);
  const [label, setLabel] = useState('');
  const [objective, setObjective] = useState<ComposerObjective>('descobrir_dor');
  const [tone, setTone] = useState<Tone>('curto');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await client.getMessageModels();
      setModels(result.models);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load message models.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const result = await client.saveMessageModel({
        label: label.trim() || objectiveLabels[objective][currentLang],
        text: text.trim(),
        objective,
        tone,
      });
      setModels((current) => [result.model, ...current.filter((item) => item.id !== result.model.id)].slice(0, 30));
      setLabel('');
      setText('');
      setNotice(t.saved);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save message model.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (model: SavedMessageModel) => {
    try {
      await client.deleteMessageModel(model.id);
      setModels((current) => current.filter((item) => item.id !== model.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete message model.');
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 lg:pb-10">
      <section className="rounded-[32px] border border-white/[0.09] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.07),transparent_30%),radial-gradient(circle_at_top_right,rgba(99,102,241,.15),transparent_34%),rgba(255,255,255,.025)] p-5 sm:p-7 lg:p-9">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300"><MessageSquareText size={14} /> {t.eyebrow}</div>
        <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{t.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{t.subtitle}</p>
      </section>

      {(error || notice) && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-rose-400/20 bg-rose-400/[0.06] text-rose-100' : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100'}`}>
          {error ? null : <Check size={15} />}{error || notice}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
        <article className="rounded-[28px] border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.label}</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-white outline-none focus:border-indigo-400/30" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.objective}</span>
                <select value={objective} onChange={(e) => setObjective(e.target.value as ComposerObjective)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#101622] px-3 text-xs text-slate-200 outline-none">
                  {objectiveOrder.map((value) => <option key={value} value={value}>{objectiveLabels[value][currentLang]}</option>)}
                </select>
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.tone}</span>
                <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#101622] px-3 text-xs text-slate-200 outline-none">
                  {(Object.keys(toneLabels) as Tone[]).map((value) => <option key={value} value={value}>{toneLabels[value][currentLang]}</option>)}
                </select>
              </label>
            </div>
          </div>
          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">{t.text}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-white/10 bg-black/15 p-3 text-sm leading-6 text-white outline-none focus:border-indigo-400/30" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={!text.trim() || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-slate-950 disabled:opacity-35">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {saving ? t.saving : t.save}
            </button>
            <button type="button" onClick={() => onNavigate('radar')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.04]">
              <UserRoundCheck size={14} /> {t.contextual} <ArrowRight size={13} />
            </button>
          </div>
        </article>

        <article className="rounded-[28px] border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5">
          <div className="text-sm font-semibold text-white">{t.library}</div>
          {loading ? (
            <div className="grid min-h-40 place-items-center text-slate-600"><Loader2 size={20} className="animate-spin" /></div>
          ) : models.length === 0 ? (
            <div className="py-10 text-sm text-slate-600">{t.empty}</div>
          ) : (
            <div className="mt-3 space-y-2">
              {models.map((model) => (
                <div key={model.id} className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-200">{model.label}</div>
                      <div className="mt-1 text-[9px] uppercase tracking-[0.11em] text-slate-600">{objectiveLabels[model.objective][currentLang]} · {toneLabels[model.tone][currentLang]}</div>
                    </div>
                    <button type="button" onClick={() => void remove(model)} aria-label={t.delete} title={t.delete} className="rounded-lg p-2 text-slate-600 hover:bg-rose-400/[0.06] hover:text-rose-200"><Trash2 size={14} /></button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{model.text}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
};
