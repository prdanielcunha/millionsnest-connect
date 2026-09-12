import { RadarSignal } from './radarSignals';

export type ComposerChannel = 'texto' | 'audio' | 'video' | 'followup';
export type ComposerStyle = 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';
export type ComposerObjective =
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
  options: ComposerOption[];
};

type PersonLike = {
  displayName?: unknown;
  signals?: unknown;
};

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
  if (objective === 'contar_historia') return 3;
  if (objective === 'pedir_video') return 4;
  if (objective === 'enviar_video') return 5;
  if (objective === 'diagnosticar') return 6;
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
  if (stage === 3) return 'contar_historia';
  if (stage === 4) return 'pedir_video';
  if (stage === 5) return 'enviar_video';
  if (stage === 6) return 'diagnosticar';
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

function greeting(name: string, style: ComposerStyle): string {
  if (style === 'amigavel') return name ? `E aí, ${name}! Tudo bem?` : 'E aí! Tudo bem?';
  if (style === 'profissional') return name ? `Olá, ${name}. Tudo bem?` : 'Olá. Tudo bem?';
  if (style === 'descontraido') return name ? `Fala, ${name}! Beleza?` : 'Fala! Beleza?';
  if (style === 'objetivo') return name ? `${name},` : 'Direto ao ponto:';
  if (style === 'proximo') return name ? `Oi, ${name}! Tudo bem por aí?` : 'Oi! Tudo bem por aí?';
  if (style === 'pastoral') return name ? `Paz, ${name}! Tudo bem?` : 'Paz! Tudo bem?';
  if (style === 'consultivo') return name ? `${name}, tudo bem?` : 'Tudo bem?';
  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';
}

function styleGuidance(style: ComposerStyle): string {
  if (style === 'amigavel') return 'Soa leve, acolhedor e natural, como uma conversa de WhatsApp sem pressão.';
  if (style === 'profissional') return 'Mantém clareza e cuidado, sem ficar frio, burocrático ou formal demais.';
  if (style === 'descontraido') return 'Usa linguagem casual e espontânea, sem exagerar em gírias.';
  if (style === 'objetivo') return 'Vai direto ao ponto, corta introduções e mantém uma única ação clara.';
  if (style === 'proximo') return 'Parte do relacionamento existente e soa pessoal, sem parecer mensagem pronta.';
  if (style === 'pastoral') return 'Fala como pastor com respeito e proximidade, usando “Paz” sem espiritualizar a venda.';
  return 'Faz diagnóstico antes de apresentar solução: pergunta, escuta e só então conecta o MusicScale à dor real.';
}

function soften(style: ComposerStyle, text: string): string {
  let result = text;

  if (style === 'amigavel') {
    return result
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Me conta uma coisa?')
      .replace(/Posso te fazer uma pergunta rapidinha\?/g, 'Me conta uma coisa?')
      .replace(/acho que faz sentido/g, 'acho que pode ajudar vocês')
      .replace(/O que mais dá trabalho/g, 'O que mais pesa na rotina')
      .replace(/Depois me diz/g, 'Depois me conta')
      .replace(/Quero entender antes de te mostrar qualquer outra coisa\./g, 'Quero te ouvir primeiro antes de mostrar qualquer outra coisa.');
  }

  if (style === 'profissional') {
    return result
      .replace(/\bA gente\b/g, 'Nós')
      .replace(/\ba gente\b/g, 'nós')
      .replace(/acho que faz sentido/g, 'acredito que vale a pena')
      .replace(/Posso te mandar/g, 'Posso enviar para você')
      .replace(/posso te mandar/g, 'posso enviar para você')
      .replace(/te mostrar/g, 'mostrar para você')
      .replace(/te explico/g, 'explico para você')
      .replace(/rapidinho/g, 'brevemente')
      .replace(/curtinho/g, 'breve')
      .replace(/vídeo bem rápido/g, 'vídeo breve')
      .replace(/equipe daí/g, 'equipe da sua igreja')
      .replace(/Depois me diz/g, 'Depois me diga');
  }

  if (style === 'descontraido') {
    return result
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Me diz uma coisa:')
      .replace(/Posso te fazer uma pergunta rapidinha\?/g, 'Me diz uma coisa:')
      .replace(/Em vez de te explicar tudo por texto/g, 'Pra não virar textão')
      .replace(/Se você quiser/g, 'Se quiser')
      .replace(/Você conseguiu ver com calma\?/g, 'Deu pra dar uma olhada?')
      .replace(/vou te mandar/g, 'te mando')
      .replace(/Depois me diz/g, 'Depois me fala');
  }

  if (style === 'objetivo') {
    return result
      .replace(/Espero que esteja bem\.\s*/g, '')
      .replace(/Tudo bem\?\s*/g, '')
      .replace(/Tudo certo\?\s*/g, '')
      .replace(/Tudo certo por aí\?\s*/g, '')
      .replace(/Queria te fazer uma pergunta rapidinha:/g, 'Pergunta direta:')
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Pergunta direta:')
      .replace(/Pelo que você comentou sobre/g, 'Sobre')
      .replace(/Pensando no que você falou sobre/g, 'Sobre')
      .replace(/acho que faz sentido te mostrar uma coisa\./g, 'vale te mostrar isso.')
      .replace(/Em vez de te explicar tudo por texto,/g, '')
      .replace(/Como combinamos, vou te mandar um vídeo bem curto mostrando justamente a parte de/g, 'Segue um vídeo curto sobre')
      .replace(/Separei um vídeo rápido do MusicScale focado em/g, 'Vídeo rápido do MusicScale sobre')
      .replace(/Passando só para retomar/g, 'Retomando')
      .replace(/Depois me diz/g, 'Me diga')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  if (style === 'proximo') {
    return result
      .replace(/Pelo que você comentou sobre/g, 'Lembrei do que você comentou sobre')
      .replace(/Pensando no que você falou sobre/g, 'Lembrei do que você falou sobre')
      .replace(/Passando só para retomar/g, 'Lembrei de você e quis retomar')
      .replace(/Se fizer sentido/g, 'Se isso fizer sentido pra você')
      .replace(/Quer que eu te mostre/g, 'Quer que eu te mostre do jeito mais simples')
      .replace(/Depois me diz/g, 'Depois me conta')
      .replace(/quero saber/g, 'quero te ouvir sobre');
  }

  if (style === 'pastoral') {
    return result
      .replace(/A gente viveu algo bem parecido por aqui/g, 'Nós também vivemos algo parecido no ministério por aqui')
      .replace(/acho que faz sentido/g, 'pode fazer sentido por aí')
      .replace(/Pensando na rotina de vocês/g, 'Pensando com cuidado na rotina da igreja de vocês')
      .replace(/Se você pudesse resolver só uma parte/g, 'Pensando na realidade da igreja, se vocês pudessem resolver uma parte')
      .replace(/Quer que eu te mostre/g, 'Se fizer sentido por aí, posso te mostrar')
      .replace(/O teste ajudou de verdade/g, 'O teste ajudou a rotina da equipe de vocês')
      .replace(/Depois me diz/g, 'Depois me conta como isso conversa com a realidade de vocês');
  }

  if (style === 'consultivo') {
    return result
      .replace(/Vi o que você comentou sobre ([^.]+)\. Hoje vocês ainda organizam isso mais pelo WhatsApp ou já usam alguma ferramenta\?/g, 'Você comentou sobre $1. Como vocês organizam isso hoje?')
      .replace(/Lembrei do que você falou sobre/g, 'Sobre o que você comentou de')
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Para eu entender melhor:')
      .replace(/Posso te fazer uma pergunta rapidinha\?/g, 'Para eu entender melhor:')
      .replace(/O que mais dá trabalho/g, 'Qual é hoje o principal gargalo')
      .replace(/Se você pudesse resolver só uma parte/g, 'Se tivesse que priorizar um único ponto')
      .replace(/acho que faz sentido te mostrar uma coisa\./g, 'pelo cenário que você trouxe, vale avaliar uma alternativa.')
      .replace(/Quer que eu te mostre especificamente essa parte\?/g, 'Faz sentido eu te mostrar somente essa parte para avaliarmos se resolve o problema?')
      .replace(/Ficou alguma dúvida ou alguma parte que você queria ver melhor\?/g, 'Qual ponto ainda precisa ficar mais claro para você avaliar se isso resolve a necessidade?')
      .replace(/Depois me diz se isso faria diferença aí para vocês\./g, 'Depois me diga se isso ataca o problema que você comentou.')
      .replace(/o que mais te chamou atenção no vídeo\?/g, 'qual ponto do vídeo teria maior impacto na rotina de vocês?');
  }

  return result;
}

function openingVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  const t = topic(signal);
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

function permissionVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Pelo que você comentou sobre ${t}, acho que faz sentido te mostrar uma coisa. Posso te mandar um vídeo de uns 30 segundos do MusicScale?`,
    `${g} A gente viveu algo bem parecido por aqui e acabou criando o MusicScale. Posso te mandar um vídeo curtinho para você ver como funciona?`,
    `${g} Em vez de te explicar tudo por texto, posso te mandar um vídeo bem rápido mostrando como a gente resolveu essa parte no MusicScale?`,
  ].map(text => soften(style, text));
}

function videoSendVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Como combinamos, vou te mandar um vídeo bem curto mostrando justamente a parte de ${t}. Depois me diz se isso faria diferença aí para vocês.`,
    `${g} Separei um vídeo rápido do MusicScale focado em ${t}. Assiste quando puder e depois quero saber qual parte mais conversa com a realidade de vocês.`,
    `${g} Te mando agora uma demonstração curtinha. Repara principalmente na parte de ${t}; depois me fala se hoje isso ajudaria a equipe daí.`,
  ].map(text => soften(style, text));
}

function diagnosticVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Do que você viu, qual parte faria mais diferença aí hoje: ${t}, a organização da equipe ou as confirmações?`,
    `${g} Pensando na rotina de vocês, o que mais te chamou atenção no vídeo? Quero entender antes de te mostrar qualquer outra coisa.`,
    `${g} Se você pudesse resolver só uma parte da organização do louvor agora, qual seria?`,
  ].map(text => soften(style, text));
}

function videoScriptVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const t = topic(signal);
  const who = name ? `, ${name}` : '';
  return [
    `Oi${who}! Gravei rapidinho porque é mais fácil te mostrar. O MusicScale nasceu da nossa própria rotina de igreja. Aqui a equipe recebe a escala, vê repertório, cifras e tons e confirma presença sem depender de mensagem perdida. Pensando no que você comentou sobre ${t}, olha como essa parte fica organizada.`,
    `Oi${who}! Em menos de meio minuto eu quero te mostrar só uma coisa. A gente tinha muita informação espalhada no WhatsApp e criou o MusicScale para centralizar a rotina do louvor. Repara especialmente nessa parte de ${t}, porque foi exatamente o ponto que lembrei da nossa conversa.`,
    `Oi${who}! Vou te mostrar sem apresentação comercial, só na prática. Aqui está uma escala real: equipe, músicas, cifras, tons e confirmação num lugar só. Pelo que você falou sobre ${t}, acho que essa é a parte que mais vale você olhar primeiro.`,
  ].map(text => soften(style, text));
}

function focusedVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Sobre ${t}: no MusicScale essa parte fica centralizada para a equipe, então ninguém precisa procurar informação espalhada. Se você quiser, te mostro só esse fluxo.`,
    `${g} O ponto que você comentou sobre ${t} é justamente uma das coisas que o MusicScale resolve. Quer que eu te mostre especificamente essa parte?`,
    `${g} Pensando no que você falou sobre ${t}, eu não te mostraria o app inteiro agora. Eu começaria só por essa função. Posso te mostrar?`,
  ].map(text => soften(style, text));
}

function trialVariants(name: string, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  return [
    `${g} Pelo que você viu até aqui, acho que o melhor é testar na realidade de vocês. Quer criar a organização da igreja e usar os 7 dias para montar uma escala real?`,
    `${g} Se fizer sentido, o próximo passo pode ser bem simples: testar por 7 dias com a própria equipe e ver se facilita de verdade. Quer que eu te mostre como começar?`,
    `${g} Em vez de decidir só pelo vídeo, vale testar numa escala real. Quer começar os 7 dias e colocar a equipe para usar?`,
  ].map(text => soften(style, text));
}

function followupVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  const t = topic(signal);
  return [
    `${g} Passando só para retomar aquele assunto sobre ${t}. Você conseguiu ver com calma?`,
    `${g} Lembrei da nossa conversa sobre ${t}. Ficou alguma dúvida ou alguma parte que você queria ver melhor?`,
    `${g} Só retomando sem pressa: aquilo sobre ${t} ainda é uma dificuldade aí para vocês?`,
  ].map(text => soften(style, text));
}

function closingVariants(name: string, style: ComposerStyle): string[] {
  const g = greeting(name, style);
  return [
    `${g} Agora que vocês já usaram numa rotina real: facilitou a organização do louvor?`,
    `${g} Depois desse teste, queria saber uma coisa bem simples: ficou mais fácil para a equipe se organizar?`,
    `${g} O teste ajudou de verdade na rotina de vocês? Se sim, eu te explico como fica a continuidade para a igreja inteira.`,
  ].map(text => soften(style, text));
}

function audioVariants(name: string, signal: RadarSignal, style: ComposerStyle): string[] {
  const g = greeting(name, style);
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
  const stage = resolveStage(input.signal, input.objective);
  const objective = input.objective || defaultObjective(stage);
  const style = input.style || defaultStyle(input.signal);
  const name = firstName(input.person.displayName);
  const t = topic(input.signal);
  const channel: ComposerChannel = input.channel || (objective === 'retomar_conversa' ? 'followup' : 'texto');

  let texts: string[];
  let effectiveChannel = channel;
  if (objective === 'contar_historia') {
    texts = audioVariants(name, input.signal, style);
    effectiveChannel = 'audio';
  } else if (objective === 'enviar_video' && channel === 'video') {
    texts = videoScriptVariants(name, input.signal, style);
    effectiveChannel = 'video';
  } else if (objective === 'enviar_video') {
    texts = videoSendVariants(name, input.signal, style);
  } else if (objective === 'diagnosticar') {
    texts = diagnosticVariants(name, input.signal, style);
  } else if (channel === 'audio') {
    texts = audioVariants(name, input.signal, style);
  } else if (objective === 'pedir_video') {
    texts = permissionVariants(name, input.signal, style);
  } else if (objective === 'explicar_dor') {
    texts = focusedVariants(name, input.signal, style);
  } else if (objective === 'convidar_trial' || objective === 'acompanhar_trial') {
    texts = trialVariants(name, style);
  } else if (objective === 'retomar_conversa' || channel === 'followup') {
    texts = followupVariants(name, input.signal, style);
    effectiveChannel = 'followup';
  } else if (objective === 'fechar') {
    texts = closingVariants(name, style);
  } else {
    texts = openingVariants(name, input.signal, style);
  }

  const factsUsed = input.signal.evidence.slice(0, 3).map(item => `${item.dateKey}: ${item.snippet}`);
  const recommendation = stage <= 2
    ? 'Comece com uma pergunta curta. Não apresente o MusicScale inteiro ainda.'
    : stage === 3
      ? 'Conte a história em 35–50 segundos, como conversa. Termine pedindo permissão para mostrar.'
      : stage === 4
      ? 'Peça permissão antes de mandar o vídeo. O próximo passo é um pequeno “sim”.'
      : stage === 5
        ? 'Mostre só o necessário em cerca de 30 segundos e conecte a demonstração à dor real da conversa.'
        : stage === 6
          ? 'Depois do vídeo, faça uma pergunta diagnóstica. Não continue apresentando recursos sem ouvir a resposta.'
      : stage === 7
        ? `Fale somente da parte ligada a ${t}; não despeje todos os recursos.`
        : stage === 8
          ? 'Só convide para o trial quando houver intenção real. Use uma rotina da própria igreja.'
          : stage === 10
            ? 'Pergunte primeiro se facilitou. Só depois apresente continuidade e plano vigente.'
            : 'Avance uma etapa por vez e adapte a próxima mensagem à resposta real.';

  const why = hasProductInterest(input.signal)
    ? `A própria conversa trouxe uma dor ligada a ${t}, então vale começar por esse contexto real.`
    : hasRelationship(input.signal)
      ? 'Já existe relacionamento comprovado, então uma abordagem natural é melhor que uma apresentação comercial fria.'
      : isPastoral(input.signal)
        ? 'É um contato pastoral/de liderança; use respeito, calor humano e descoberta antes de apresentar produto.'
        : 'Há contexto suficiente para uma abertura curta e consultiva.';

  const channelTip = effectiveChannel === 'audio'
    ? 'Fale como conversa, com frases curtas e pausas naturais. Não leia como anúncio.'
    : 'Envie uma pergunta por vez. Espere a resposta antes de avançar para a próxima etapa.';
  const tip = `${styleGuidance(style)} ${channelTip}`;

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
    factsUsed,
    options: texts.slice(0, 3).map((text, index) => ({
      id: `option_${index + 1}`,
      text,
      style,
      channel: effectiveChannel,
    })),
  };
}
