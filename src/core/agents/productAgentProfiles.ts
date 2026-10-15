import { CONNECT_PRODUCTS, type ConnectProduct } from '../routing/productRouting';
export type AgentLocale = 'pt-BR' | 'en-US' | 'es-ES';
type PublicAgentKnowledge = { overview: Record<AgentLocale, string>; intake: Record<AgentLocale, string>;
  communicationStyle?: 'practical' | 'careful' | 'welcoming' };
export const PRODUCT_AGENT_PROFILES = {
  musicscale: { style: 'practical', url: 'https://musicscale.millionsnest.com',
    overview: {
      'pt-BR': 'O MusicScale ajuda a organizar escalas de louvor e repertórios.',
      'en-US': 'MusicScale helps organize worship schedules and repertoires.',
      'es-ES': 'MusicScale ayuda a organizar turnos de alabanza y repertorios.',
    },
    intake: {
      'pt-BR': 'Você está no suporte do MusicScale. Posso orientar o acesso, explicar o aplicativo ou ajudar com sua próxima escala após validar seu acesso. Qual é sua dúvida?',
      'en-US': 'Welcome to MusicScale support. I can help with access, explain the app, or help with your next schedule after validating your access. What do you need?',
      'es-ES': 'Bienvenido al soporte de MusicScale. Puedo orientar el acceso, explicar la aplicación o ayudar con tu próximo turno tras validar tu acceso. ¿Qué necesitas?',
    } },
  nestfinance: { style: 'careful', url: 'https://nestfinance.millionsnest.com',
    overview: {
      'pt-BR': 'O NestFinance apoia a organização de documentos e rotinas financeiras. Mantenha documentos e valores dentro do aplicativo.',
      'en-US': 'NestFinance supports document organization and financial workflows. Keep documents and amounts inside the app.',
      'es-ES': 'NestFinance ayuda a organizar documentos y procesos financieros. Mantén documentos e importes dentro de la aplicación.',
    },
    intake: {
      'pt-BR': 'Você está no suporte do NestFinance. Posso orientar o acesso e o uso geral ou encaminhar à equipe. Qual é sua dúvida? Não envie documentos, valores ou dados financeiros aqui.',
      'en-US': 'Welcome to NestFinance support. I can help with access and general use or connect you with the team. What do you need? Do not send documents, amounts or financial records here.',
      'es-ES': 'Bienvenido al soporte de NestFinance. Puedo orientar el acceso y el uso general o derivar al equipo. ¿Qué necesitas? No envíes documentos, importes ni datos financieros aquí.',
    } },
  nestjourney: { style: 'welcoming', url: 'https://nestjourney.millionsnest.com',
    overview: {
      'pt-BR': 'O NestJourney apoia o acolhimento e o acompanhamento de pessoas na comunidade, preservando o acesso restrito aos registros.',
      'en-US': 'NestJourney supports welcoming and accompanying people in the community while keeping records access restricted.',
      'es-ES': 'NestJourney apoya la acogida y el acompañamiento de personas en la comunidad, con acceso restringido a los registros.',
    },
    intake: {
      'pt-BR': 'Seja bem-vindo ao suporte do NestJourney. Posso ajudar com o acesso e o uso geral do aplicativo ou encaminhar à equipe. Qual é sua dúvida? Registros de pessoas e cuidado pastoral devem permanecer no aplicativo.',
      'en-US': 'Welcome to NestJourney support. I can help with access and general app use or connect you with the team. What do you need? Keep personal and pastoral records inside the app.',
      'es-ES': 'Bienvenido al soporte de NestJourney. Puedo ayudar con el acceso y el uso general o derivar al equipo. ¿Qué necesitas? Mantén los registros personales y pastorales dentro de la aplicación.',
    } },
} as const;

/** Curated public knowledge only. It never reads records or grants domain authority. */
export function publicProductSupportReply(product: ConnectProduct, text: string, fallbackLocale: AgentLocale, knowledge?: PublicAgentKnowledge): string | null {
  if (text.length > 2048) return null;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(atendente|humano|humana|human|persona|pastor|pastoral|meu|minha|meus|minhas|my|mis|saldo|balance|cpf|cnpj|senha|password|contrasena|comprovante|documentos?|documents?|registros?|records?|visitantes?|visitors?|dados)\b/.test(normalized)) return null;
  const locale: AgentLocale = /^(i need|what |how )/.test(normalized) ? 'en-US'
    : /^(necesito|que es|para que sirve|como (acceder|accedo|puedes))/.test(normalized) ? 'es-ES' : fallbackLocale;
  const query = normalized.replace(new RegExp(`\\b${product}\\b`, 'g'), '').trim();
  const profile = { ...PRODUCT_AGENT_PROFILES[product], ...knowledge, url: PRODUCT_AGENT_PROFILES[product].url };
  const respond = (answer: string) => {
    if (knowledge?.communicationStyle === 'welcoming') return `${{ 'pt-BR': 'Conte conosco.', 'en-US': 'We are here to help.', 'es-ES': 'Cuenta con nosotros.' }[locale]} ${answer}`;
    if (knowledge?.communicationStyle === 'careful') return `${answer} ${{ 'pt-BR': 'Consultas pessoais exigem validação de acesso.', 'en-US': 'Personal queries require access validation.', 'es-ES': 'Las consultas personales requieren validar el acceso.' }[locale]}`;
    return answer;
  };
  if (/^(preciso de suporte (sobre|com)( o)?|i need support with|necesito ayuda con)$/.test(query)) return respond(profile.intake[locale]);
  if (/^(o que (e|faz)|para que serve|what is|what does|que es|para que sirve)\b/.test(query)) return respond(`${profile.overview[locale]} ${profile.url}`);
  if (/^(como (acesso|acessar|entrar|entro|abrir|abro)|onde (acesso|entro)|how (do i |can i |to )?(access|open|sign in)|como (acceder|accedo|entrar|abrir)|link (do|de|del))\b/.test(query)) {
    const label = { 'pt-BR': 'Acesse o aplicativo oficial e entre com sua conta:', 'en-US': 'Open the official app and sign in with your account:', 'es-ES': 'Abre la aplicación oficial e inicia sesión con tu cuenta:' }[locale];
    return respond(`${label} ${profile.url}`);
  }
  if (/^(como (voce )?pode (me )?ajudar|o que (voce )?(pode|consegue) fazer|what can you do|how can you help|como puedes ayudar|que puedes hacer)\b/.test(query)) return respond(profile.intake[locale]);
  return null;
}

export function productAgentProfile(product: ConnectProduct) {
  const profile = PRODUCT_AGENT_PROFILES[product];
  return { id: `support.${product}.v1`, product, label: CONNECT_PRODUCTS[product].label, communicationStyle: profile.style,
    executionMode: 'deterministic_public_knowledge', modelCost: 0, knowledge: profile,
    allowedToolRefs: [...CONNECT_PRODUCTS[product].tools], privateDataAuthority: 'canonical_hub_and_domain_tool_gateway', humanFallback: true };
}
