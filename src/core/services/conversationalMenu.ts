/**
 * MillionsNest Connect - Conversational Menu Engine
 * Normalizes triggers (menu, ajuda, opções, começar, início, help, options, ayuda)
 * and generates structured menu responses for WhatsApp and Instagram.
 */

export interface ConversationalMenuItem {
  id: string;
  numberKey: string;
  title: string;
  description: string;
  category: 'public' | 'musicscale_auth';
  badge?: string;
  actionPayload: string;
}

export interface ConversationalMenuResponse {
  isTriggerMatch: boolean;
  matchedTrigger?: string;
  menuTitle: string;
  subtitle: string;
  publicOptions: ConversationalMenuItem[];
  musicscaleAuthOptions: ConversationalMenuItem[];
  footerNote: string;
}

const TRIGGER_KEYWORDS = [
  'menu',
  'ajuda',
  'opções',
  'opcoes',
  'começar',
  'comecar',
  'início',
  'inicio',
  'help',
  'options',
  'ayuda',
  '0',
  '#',
];

export class ConversationalMenuService {
  static isTrigger(input: string): boolean {
    const normalized = input.trim().toLowerCase().replace(/[^a-z0-9#]/g, '');
    return TRIGGER_KEYWORDS.some((kw) => normalized.includes(kw));
  }

  static getMenu(inputMessage: string, isLinkedToMillionsNest: boolean = false): ConversationalMenuResponse {
    const matched = TRIGGER_KEYWORDS.find((kw) =>
      inputMessage.toLowerCase().includes(kw)
    ) || 'menu';

    const publicOptions: ConversationalMenuItem[] = [
      {
        id: 'opt_pub_1',
        numberKey: '1',
        title: 'Conhecer os aplicativos',
        description: 'Explore o ecossistema MillionsNest: MusicScale e NestFinance.',
        category: 'public',
        actionPayload: 'ACTION_EXPLORE_APPS',
      },
      {
        id: 'opt_pub_2',
        numberKey: '2',
        title: 'Suporte técnico',
        description: 'Dúvidas sobre uso, erros, instalação ou sincronização.',
        category: 'public',
        actionPayload: 'ACTION_TECH_SUPPORT',
      },
      {
        id: 'opt_pub_3',
        numberKey: '3',
        title: 'Minha conta e organização',
        description: 'Verifique seu status de membro ou vincule sua conta.',
        category: 'public',
        actionPayload: 'ACTION_ACCOUNT_ORG',
      },
      {
        id: 'opt_pub_4',
        numberKey: '4',
        title: 'MusicScale (Louvor & Escalas)',
        description: 'Acesse escalas, cifras e voluntários do seu ministério.',
        category: 'public',
        badge: 'Popular',
        actionPayload: 'ACTION_MUSICSCALE_INFO',
      },
      {
        id: 'opt_pub_5',
        numberKey: '5',
        title: 'Falar com atendente',
        description: 'Transfere este atendimento para a equipe humana.',
        category: 'public',
        badge: 'Humano',
        actionPayload: 'ACTION_TRANSFER_HUMAN',
      },
      {
        id: 'opt_pub_6',
        numberKey: '6',
        title: 'Privacidade e segurança',
        description: 'Consulte políticas de privacidade, LGPD e consentimento.',
        category: 'public',
        actionPayload: 'ACTION_PRIVACY_TERMS',
      },
    ];

    const musicscaleAuthOptions: ConversationalMenuItem[] = [
      {
        id: 'opt_ms_1',
        numberKey: '7',
        title: 'Ver próximas escalas',
        description: 'Consulte datas, horários e instrumentos em que você está escalado.',
        category: 'musicscale_auth',
        badge: 'Membro Vinculado',
        actionPayload: 'TOOL_CALL_LIST_SCHEDULES',
      },
      {
        id: 'opt_ms_2',
        numberKey: '8',
        title: 'Ver detalhes de uma escala',
        description: 'Lista de músicas, tons, horários de ensaio e confirmações.',
        category: 'musicscale_auth',
        badge: 'Membro Vinculado',
        actionPayload: 'TOOL_CALL_GET_SCHEDULE',
      },
      {
        id: 'opt_ms_3',
        numberKey: '9',
        title: 'Criar rascunho de escala',
        description: 'Montagem prévia de culto para validação do líder.',
        category: 'musicscale_auth',
        badge: 'Líder',
        actionPayload: 'TOOL_CALL_CREATE_DRAFT',
      },
      {
        id: 'opt_ms_4',
        numberKey: '10',
        title: 'Clonar escala anterior',
        description: 'Duplica voluntários e repertório de um culto passado.',
        category: 'musicscale_auth',
        badge: 'Líder',
        actionPayload: 'TOOL_CALL_CLONE_SCHEDULE',
      },
      {
        id: 'opt_ms_5',
        numberKey: '11',
        title: 'Gerenciar membros',
        description: 'Consulte a lista de voluntários e instrumentos da igreja.',
        category: 'musicscale_auth',
        actionPayload: 'TOOL_CALL_LIST_MEMBERS',
      },
      {
        id: 'opt_ms_6',
        numberKey: '12',
        title: 'Gerenciar repertório local',
        description: 'Consulte ou adicione músicas cadastradas na igreja.',
        category: 'musicscale_auth',
        actionPayload: 'TOOL_CALL_MANAGE_REPERTOIRE',
      },
      {
        id: 'opt_ms_7',
        numberKey: '13',
        title: 'Pesquisar Biblioteca Viva',
        description: 'Acervo global de cifras e arranjos homologados.',
        category: 'musicscale_auth',
        badge: 'Global',
        actionPayload: 'TOOL_CALL_SEARCH_LIVING_LIBRARY',
      },
      {
        id: 'opt_ms_8',
        numberKey: '14',
        title: 'Falar com suporte do louvor',
        description: 'Encaminha para a liderança direta do seu ministério.',
        category: 'musicscale_auth',
        actionPayload: 'ACTION_TRANSFER_WORSHIP_LEAD',
      },
    ];

    return {
      isTriggerMatch: true,
      matchedTrigger: matched,
      menuTitle: '🤖 Menu do MillionsNest Connect',
      subtitle: isLinkedToMillionsNest
        ? 'Conta vinculada e autenticada! Escolha uma opção abaixo:'
        : 'Olá! Como podemos te ajudar hoje no ecossistema MillionsNest?',
      publicOptions,
      musicscaleAuthOptions: isLinkedToMillionsNest ? musicscaleAuthOptions : [],
      footerNote: 'Responda com o número desejado ou digite "Menu" a qualquer momento.',
    };
  }
}
