import { RadarSignal } from './radarSignals';

export type ComposerChannel = 'texto' | 'audio' | 'video' | 'followup';
export type ComposerStyle = 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';
export type ComposerObjective =
  | 'iniciar_conversa'
  | 'descobrir_dor'
  | 'pedir_video'
  | 'explicar_dor'
  | 'convidar_trial'
  | 'acompanhar_trial'
  | 'retomar_conversa'
  | 'fechar';

export type ComposerOption = {
  id: string;
  text: string;
  style: ComposerStyle;
  channel: ComposerChannel;
};

export type ComposerPlan = {
  stage: number;
  stageLabel: string;
  objective: ComposerObjective;
  recommendedChannel: ComposerChannel;
  recommendedStyle: ComposerStyle;
  recommendation: string;
  why: string;
  tip: string;
  nextSmallYes: string;
  estimatedDurationSeconds?: number;
  factsUsed: string[];
  relationship: RelationshipComposerContext;
  options: ComposerOption[];
};

type PersonLike = {
  displayName?: unknown;
  signals?: unknown;
  lastCommercialAction?: unknown;
  lastCommercialAt?: unknown;
  lastCommercialDraft?: unknown;
  salesStage?: unknown;
  followUpAt?: unknown;
  lastDateKey?: unknown;
  recentConversationMessages?: unknown;
};

export type RelationshipComposerContext = {
  state: 'first_contact' | 'active_reply' | 'waiting_reply' | 'followup_due' | 'dormant' | 'continuation';
  continuation: boolean;
  respondedAfterLastContact: boolean;
  followUpDue: boolean;
  daysSinceLastContact: number | null;
  previousAction: string | null;
  previousStage: string | null;
  latestInboundDateKey: string | null;
  latestInboundSnippet: string | null;
  hasPreviousDraft: boolean;
  suggestedObjective: ComposerObjective;
};

function recentMessages(value: unknown): Array<{ dateKey: string; snippet: string }> {
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    dateKey: String((item as any)?.dateKey || ''),
    snippet: String((item as any)?.snippet || (item as any)?.text || '').replace(/\s+/g, ' ').trim().slice(0, 280),
  })).filter(item => item.dateKey || item.snippet).slice(0, 8);
}

function isKnownObjective(value: string): value is ComposerObjective {
  return ['iniciar_conversa','descobrir_dor','pedir_video','explicar_dor','convidar_trial','acompanhar_trial','retomar_conversa','fechar'].includes(value);
}

function buildRelationshipContext(person: PersonLike, signal: RadarSignal): RelationshipComposerContext {
  const now = Date.now();
  const previousAction = String(person.lastCommercialAction || '').trim() || null;
  const rawStage = String(person.salesStage || '').trim();
  const previousStage = rawStage || null;
  const lastCommercialAt = String(person.lastCommercialAt || '').trim();
  const contactMs = Date.parse(lastCommercialAt);
  const daysSinceLastContact = Number.isFinite(contactMs) ? Math.max(0, Math.floor((now - contactMs) / 86_400_000)) : null;
  const followMs = Date.parse(String(person.followUpAt || ''));
  const followUpDue = Number.isFinite(followMs) && followMs <= now;
  const latest = recentMessages(person.recentConversationMessages)[0] || null;
  const latestInboundDateKey = latest?.dateKey || (String(person.lastDateKey || '').trim() || null);
  const latestInboundSnippet = latest?.snippet || null;
  const commercialDay = lastCommercialAt ? lastCommercialAt.slice(0, 10) : '';
  const respondedAfterLastContact = Boolean(commercialDay && latestInboundDateKey && latestInboundDateKey > commercialDay);
  const continuation = Boolean(previousAction) || Boolean(lastCommercialAt)
    || Boolean(previousStage && previousStage !== 'iniciar_conversa')
    || signal.type === 'commercial_followup_due';

  let state: RelationshipComposerContext['state'] = 'first_contact';
  if (continuation) {
    if (respondedAfterLastContact) state = 'active_reply';
    else if (followUpDue || signal.type === 'commercial_followup_due') state = 'followup_due';
    else if (previousAction === 'sent_manual') state = 'waiting_reply';
    else if (daysSinceLastContact !== null && daysSinceLastContact >= 21) state = 'dormant';
    else state = 'continuation';
  }

  let suggestedObjective: ComposerObjective;
  if (!continuation) suggestedObjective = hasProductInterest(signal) ? 'descobrir_dor' : 'iniciar_conversa';
  else if (respondedAfterLastContact) suggestedObjective = 'descobrir_dor';
  else if (previousStage === 'convidar_trial' || previousStage === 'acompanhar_trial') suggestedObjective = 'acompanhar_trial';
  else if (followUpDue || state === 'waiting_reply' || state === 'dormant') suggestedObjective = 'retomar_conversa';
  else suggestedObjective = previousStage && isKnownObjective(previousStage) && previousStage !== 'iniciar_conversa'
    ? previousStage
    : 'retomar_conversa';

  return {
    state, continuation, respondedAfterLastContact, followUpDue, daysSinceLastContact,
    previousAction, previousStage, latestInboundDateKey, latestInboundSnippet,
    hasPreviousDraft: Boolean(String(person.lastCommercialDraft || '').trim()), suggestedObjective,
  };
}

function normalizedTokens(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(token => token.length > 2));
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const a = normalizedTokens(left); const b = normalizedTokens(right);
  if (!a.size || !b.size) return 0;
  let hit = 0; for (const token of a) if (b.has(token)) hit += 1;
  return hit / new Set([...a, ...b]).size;
}

function rankNovel(texts: string[], previousDraft: unknown): string[] {
  const previous = String(previousDraft || '').trim();
  return previous ? [...texts].sort((a,b) => similarity(a, previous) - similarity(b, previous)) : texts;
}

function adaptTiming(text: string, relationship: RelationshipComposerContext): string {
  if (!relationship.continuation) return text;
  if (relationship.daysSinceLastContact !== null && relationship.daysSinceLastContact >= 21) {
    return text.replace(/Voltando naquele ponto/gi, 'Faz um tempinho desde nossa conversa; voltando naquele ponto')
      .replace(/Passando só para retomar/gi, 'Faz um tempinho desde nossa conversa; retomando');
  }
  if (relationship.daysSinceLastContact !== null && relationship.daysSinceLastContact <= 1) {
    return text.replace(/Voltando naquele ponto/gi, 'Pegando o gancho daquele ponto')
      .replace(/Passando só para retomar/gi, 'Pegando o gancho do que a gente estava falando');
  }
  return text;
}

function firstName(value: unknown): string {
  const clean = String(value || '').trim();
  if (!clean || /^\+?\d/.test(clean)) return '';
  return clean.split(/\s+/)[0] || '';
}

function evidenceText(signal: RadarSignal): string {
  return signal.evidence.map(item => item.snippet).join(' ');
}

function topic(signal: RadarSignal): string {
  const text = evidenceText(signal);
  if (/cifra|repert[oó]rio|tom|tonalidade/i.test(text)) return 'repertório, cifras e tons';
  if (/ensaio/i.test(text)) return 'ensaio e preparação da equipe';
  if (/confirma|presen[cç]a|disponibilidade|faltar/i.test(text)) return 'confirmação e disponibilidade da equipe';
  if (/whatsapp/i.test(text)) return 'organização do louvor pelo WhatsApp';
  if (/escala/i.test(text)) return 'escalas do louvor';
  if (/louvor|worship|minist[eé]rio|banda|vocal|m[uú]sic/i.test(text)) return 'organização da equipe de louvor';
  return 'organização do louvor';
}

function isPastoral(signal: RadarSignal): boolean {
  return signal.type === 'unanswered_conversation' || signal.type === 'recurring_relevant_topic';
}

function hasProductInterest(signal: RadarSignal): boolean {
  return signal.type === 'explicit_product_interest';
}

function hasRelationship(signal: RadarSignal): boolean {
  return signal.type === 'commercial_followup_due';
}

function resolveStage(signal: RadarSignal, objective?: ComposerObjective): number {
  if (objective === 'pedir_video') return 4;
  if (objective === 'explicar_dor') return 7;
  if (objective === 'convidar_trial') return 8;
  if (objective === 'acompanhar_trial') return 9;
  if (objective === 'fechar') return 10;
  if (objective === 'retomar_conversa') return 1;
  if (objective === 'descobrir_dor') return 2;
  if (hasProductInterest(signal)) return 2;
  return 1;
}

function stageLabel(stage: number): string {
  return ({
    1: 'Abertura', 2: 'Descoberta', 3: 'História', 4: 'Permissão', 5: 'Demonstração',
    6: 'Diagnóstico', 7: 'Resposta focada', 8: 'Trial', 9: 'Ativação', 10: 'Fechamento',
  } as Record<number, string>)[stage] || 'Descoberta';
}

function defaultObjective(stage: number): ComposerObjective {
  if (stage === 1) return 'iniciar_conversa';
  if (stage === 2) return 'descobrir_dor';
  if (stage === 4) return 'pedir_video';
  if (stage === 7) return 'explicar_dor';
  if (stage === 8) return 'convidar_trial';
  if (stage === 9) return 'acompanhar_trial';
  if (stage === 10) return 'fechar';
  return 'descobrir_dor';
}

function defaultStyle(signal: RadarSignal): ComposerStyle {
  if (isPastoral(signal)) return 'pastoral';
  if (hasRelationship(signal)) return 'proximo';
  if (hasProductInterest(signal)) return 'consultivo';
  return 'amigavel';
}

function greeting(name: string, style: ComposerStyle, continuation = false): string {
  if (continuation) return name ? `${name},` : '';
  if (style === 'pastoral') return name ? `Olá, ${name}! Tudo bem?` : 'Olá! Tudo bem?';
  if (style === 'descontraido') return name ? `Ô, ${name}!` : 'Oi!';
  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';
}

function soften(style: ComposerStyle, text: string): string {
  if (style === 'objetivo') return text.replace(/Tudo bem\?\s*/g, '').replace(/Queria te fazer uma pergunta rapidinha:/g, 'Uma pergunta rápida:');
  if (style === 'profissional') return text.replace('Ô, ', 'Olá, ').replace('rapidinho', 'brevemente').replace('uma coisa', 'um ponto');
  if (style === 'pastoral') return text.replace('vocês', 'vocês aí na igreja');
  return text;
}

function openingVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  const t = topic(signal);
  if (continuation) {
    return [
      `${g} Voltando naquele ponto sobre ${t}: como isso está por aí agora?`,
      `${g} Fiquei pensando no que a gente falou sobre ${t}. O que está pesando mais nessa parte hoje?`,
      `${g} Sobre nossa conversa de ${t}: isso ainda continua sendo uma dificuldade para vocês?`,
    ].map(text => soften(style, text.trim()));
  }
  if (hasProductInterest(signal)) {
    return [
      `${g} Vi o que você comentou sobre ${t}. Hoje vocês ainda organizam isso mais pelo WhatsApp ou já usam alguma ferramenta?`,
      `${g} Lembrei do que você falou sobre ${t}. O que mais dá trabalho para vocês hoje nessa parte?`,
      `${g} Posso te fazer uma pergunta rápida? Como vocês organizam ${t} hoje na prática?`,
    ].map(text => soften(style, text));
  }
  if (isPastoral(signal)) {
    return [
      `${g} Queria te fazer uma pergunta rapidinha sobre o louvor. Hoje vocês organizam músicas, cifras, tons e escala mais pelo WhatsApp ou usam algum sistema?`,
      `${g} Uma curiosidade: como vocês organizam hoje escala, músicas e confirmações do pessoal do louvor?`,
      `${g} Posso te fazer uma pergunta rápida sobre como vocês organizam o ministério de louvor hoje?`,
    ].map(text => soften(style, text));
  }
  if (hasRelationship(signal)) {
    return [
      `${g} Lembrei de você e queria te perguntar uma coisa: vocês ainda organizam o louvor mais pelo WhatsApp?`,
      `${g} Deixa eu te perguntar uma coisa sobre o louvor daí: como vocês montam escala e repertório hoje?`,
      `${g} Posso te fazer uma pergunta rapidinha? O que mais dá trabalho para organizar o pessoal do louvor hoje?`,
    ].map(text => soften(style, text));
  }
  return [
    `${g} Posso te fazer uma pergunta rápida sobre como vocês organizam o louvor hoje?`,
    `${g} Como vocês organizam escala, repertório e confirmações do louvor atualmente?`,
    `${g} Hoje vocês usam mais WhatsApp para organizar o louvor ou já têm alguma ferramenta?`,
  ].map(text => soften(style, text));
}

function permissionVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  const t = topic(signal);
  return [
    `${g} Pelo que você comentou sobre ${t}, acho que faz sentido te mostrar uma coisa. Posso te mandar um vídeo de uns 30 segundos do MusicScale?`,
    `${g} A gente viveu algo bem parecido por aqui e acabou criando o MusicScale. Posso te mandar um vídeo curtinho para você ver como funciona?`,
    `${g} Em vez de te explicar tudo por texto, posso te mandar um vídeo bem rápido mostrando como a gente resolveu essa parte no MusicScale?`,
  ].map(text => soften(style, text));
}

function focusedVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  const t = topic(signal);
  return [
    `${g} Sobre ${t}: no MusicScale essa parte fica centralizada para a equipe, então ninguém precisa procurar informação espalhada. Se você quiser, te mostro só esse fluxo.`,
    `${g} O ponto que você comentou sobre ${t} é justamente uma das coisas que o MusicScale resolve. Quer que eu te mostre especificamente essa parte?`,
    `${g} Pensando no que você falou sobre ${t}, eu não te mostraria o app inteiro agora. Eu começaria só por essa função. Posso te mostrar?`,
  ].map(text => soften(style, text));
}

function trialVariants(name: string, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  return [
    `${g} Pelo que você viu até aqui, acho que o melhor é testar na realidade de vocês. Quer criar a organização da igreja e usar os 7 dias para montar uma escala real?`,
    `${g} Se fizer sentido, o próximo passo pode ser bem simples: testar por 7 dias com a própria equipe e ver se facilita de verdade. Quer que eu te mostre como começar?`,
    `${g} Em vez de decidir só pelo vídeo, vale testar numa escala real. Quer começar os 7 dias e colocar a equipe para usar?`,
  ].map(text => soften(style, text));
}

function followupVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  const t = topic(signal);
  return [
    `${g} Passando só para retomar aquele assunto sobre ${t}. Você conseguiu ver com calma?`,
    `${g} Lembrei da nossa conversa sobre ${t}. Ficou alguma dúvida ou alguma parte que você queria ver melhor?`,
    `${g} Só retomando sem pressa: aquilo sobre ${t} ainda é uma dificuldade aí para vocês?`,
  ].map(text => soften(style, text));
}

function closingVariants(name: string, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  return [
    `${g} Agora que vocês já usaram numa rotina real: facilitou a organização do louvor?`,
    `${g} Depois desse teste, queria saber uma coisa bem simples: ficou mais fácil para a equipe se organizar?`,
    `${g} O teste ajudou de verdade na rotina de vocês? Se sim, eu te explico como fica a continuidade para a igreja inteira.`,
  ].map(text => soften(style, text));
}

function audioVariants(name: string, signal: RadarSignal, style: ComposerStyle, continuation = false): string[] {
  const g = greeting(name, style, continuation);
  const t = topic(signal);
  return [
    `${g} Olha, aqui a gente também passava por muita coisa espalhada no WhatsApp, principalmente ${t}. Minha esposa lidera e ministra no louvor, e eu fui vendo de perto o trabalho que dava. Como eu trabalho com tecnologia, a gente acabou criando o MusicScale para resolver primeiro a nossa própria rotina: escala, repertório e confirmação da equipe num lugar só. Se você quiser, eu te mando um vídeo bem curto mostrando como funciona.`,
    `${g} A ideia do MusicScale nasceu de uma necessidade nossa mesmo na igreja. A gente tinha dificuldade com ${t} e muita informação ficava perdida em conversa. Então fomos montando uma ferramenta simples para a equipe inteira acompanhar escala, músicas e confirmações. Se fizer sentido para você, eu posso te mostrar em um vídeo de poucos segundos.`,
    `${g} Não foi um app que a gente inventou procurando o que vender. Ele nasceu porque a gente vivia essa rotina de louvor e queria facilitar ${t}. A ideia foi colocar o que a equipe precisa num lugar só e tirar peso do líder. Posso te mandar um vídeo rapidinho para você ver se faria sentido aí também?`,
  ].map(text => soften(style, text));
}

export function buildComposerPlan(input: {
  person: PersonLike;
  signal: RadarSignal;
  style?: ComposerStyle;
  channel?: ComposerChannel;
  objective?: ComposerObjective;
}): ComposerPlan {
  const relationship = buildRelationshipContext(input.person, input.signal);
  const requestedObjective = input.objective;
  const objective = relationship.continuation && requestedObjective === 'iniciar_conversa'
    ? relationship.suggestedObjective
    : requestedObjective || relationship.suggestedObjective;
  const stage = resolveStage(input.signal, objective);
  const style = input.style || defaultStyle(input.signal);
  const continuation = relationship.continuation;
  const name = firstName(input.person.displayName);
  const t = topic(input.signal);
  const channel: ComposerChannel = input.channel || (objective === 'retomar_conversa' ? 'followup' : 'texto');

  let texts: string[];
  let effectiveChannel = channel;
  if (channel === 'audio') {
    texts = audioVariants(name, input.signal, style, continuation);
  } else if (objective === 'pedir_video') {
    texts = permissionVariants(name, input.signal, style, continuation);
  } else if (objective === 'explicar_dor') {
    texts = focusedVariants(name, input.signal, style, continuation);
  } else if (objective === 'convidar_trial' || objective === 'acompanhar_trial') {
    texts = trialVariants(name, style, continuation);
  } else if (objective === 'retomar_conversa' || channel === 'followup') {
    texts = followupVariants(name, input.signal, style, true);
    effectiveChannel = 'followup';
  } else if (objective === 'fechar') {
    texts = closingVariants(name, style, true);
  } else {
    texts = openingVariants(name, input.signal, style, continuation);
  }

  texts = rankNovel(texts.map(text => adaptTiming(text.trim(), relationship)), input.person.lastCommercialDraft);
  const factsUsed = input.signal.evidence.slice(0, 4).map(item => `${item.dateKey}: ${item.snippet}`);
  if (relationship.previousAction && input.person.lastCommercialAt) factsUsed.unshift(`Última ação registrada: ${relationship.previousAction} · ${String(input.person.lastCommercialAt).slice(0, 10)}`);
  if (relationship.hasPreviousDraft) factsUsed.unshift('A mensagem anterior está registrada para evitar repetição de abordagem.');
  const continuityRecommendation = relationship.state === 'active_reply'
    ? 'A pessoa falou novamente depois do último contato registrado. Continue a partir do que ela trouxe; não volte para uma abertura fria.'
    : relationship.state === 'followup_due'
      ? 'O follow-up chegou. Retome o ponto anterior com naturalidade, sem repetir saudação ou a mesma pergunta.'
      : relationship.state === 'waiting_reply'
        ? 'Já houve envio registrado. Evite repetir a mensagem anterior e faça um follow-up leve, com uma única pergunta.'
        : relationship.state === 'dormant'
          ? 'Faz tempo desde o último contato. Reative o contexto sem fingir intimidade e sem começar do zero.'
          : 'Continue do ponto anterior, sem novo cumprimento de primeiro contato e sem repetir a pergunta já usada.';
  const recommendation = stage <= 2
    ? continuation
      ? continuityRecommendation
      : 'Comece com uma pergunta curta. Não apresente o MusicScale inteiro ainda.'
    : stage === 4
      ? 'Peça permissão antes de mandar o vídeo. O próximo passo é um pequeno “sim”.'
      : stage === 7
        ? `Fale somente da parte ligada a ${t}; não despeje todos os recursos.`
        : stage === 8
          ? 'Só convide para o trial quando houver intenção real. Use uma rotina da própria igreja.'
          : stage === 10
            ? 'Pergunte primeiro se facilitou. Só depois apresente continuidade e plano vigente.'
            : 'Avance uma etapa por vez e adapte a próxima mensagem à resposta real.';

  const why = continuation
    ? relationship.respondedAfterLastContact
      ? `Há uma mensagem mais recente no histórico depois do último contato registrado. O Composer usa esse contexto sobre ${t} e evita reiniciar a conversa.`
      : relationship.followUpDue
        ? `O acompanhamento está no prazo ou vencido. A mensagem retoma ${t} sem repetir uma abertura de primeiro contato.`
        : `Já existe contato anterior registrado. A mensagem continua a conversa sobre ${t}, considera a etapa anterior e evita repetir a abordagem.`
    : hasProductInterest(input.signal)
    ? `A própria conversa trouxe uma dor ligada a ${t}, então vale começar por esse contexto real.`
    : hasRelationship(input.signal)
      ? 'Já existe relacionamento comprovado, então uma abordagem natural é melhor que uma apresentação comercial fria.'
      : isPastoral(input.signal)
        ? 'É um contato pastoral/de liderança; use respeito, calor humano e descoberta antes de apresentar produto.'
        : 'Há contexto suficiente para uma abertura curta e consultiva.';

  const tip = effectiveChannel === 'audio'
    ? 'Fale como conversa, com frases curtas e pausas naturais. Não leia como anúncio.'
    : 'Envie uma pergunta por vez. Espere a resposta antes de avançar para a próxima etapa.';

  const nextSmallYes = stage <= 2
    ? 'Conseguir uma resposta sobre como eles organizam o louvor hoje.'
    : stage === 4
      ? 'Conseguir permissão para enviar um vídeo curto.'
      : stage === 7
        ? 'Confirmar se a função ligada à dor faz sentido para aquela igreja.'
        : stage === 8
          ? 'Conseguir concordância para testar 7 dias numa organização própria.'
          : stage === 9
            ? 'Levar a equipe a criar/publicar uma escala real e confirmar presença.'
            : 'Confirmar se o MusicScale facilitou a rotina antes de falar em continuidade.';

  return {
    stage,
    stageLabel: stageLabel(stage),
    objective,
    recommendedChannel: effectiveChannel,
    recommendedStyle: style,
    recommendation,
    why,
    tip,
    nextSmallYes,
    estimatedDurationSeconds: effectiveChannel === 'audio' ? (stage === 3 ? 45 : 30) : undefined,
    factsUsed: factsUsed.slice(0, 6),
    relationship,
    options: texts.slice(0, 3).map((text, index) => ({
      id: `option_${index + 1}`,
      text,
      style,
      channel: effectiveChannel,
    })),
  };
}
