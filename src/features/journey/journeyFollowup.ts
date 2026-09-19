import type { LanguageCode } from '../../types';

const FOLLOWUP_PATH = /^\/journey-followup\/([A-Za-z0-9._:-]{1,220})\/?$/;

export interface NestJourneyFollowupContext {
  success: true;
  organization: {
    id: string;
    name: string;
  };
  followup: {
    id: string;
    careRequestId: string;
    congregationId: string;
    dueAt: string | null;
  };
  person: {
    name: string;
    phone: string;
  };
  returnTo: string;
}

export function resolveJourneyFollowupId(pathname: string): string | null {
  const match = String(pathname || '').trim().match(FOLLOWUP_PATH);
  return match?.[1] || null;
}

function firstName(value: string, fallback: string): string {
  const clean = String(value || '').trim();
  return clean ? clean.split(/\s+/)[0] : fallback;
}

export function buildFirstContactMessage(input: {
  locale: LanguageCode;
  personName: string;
  senderName: string;
  organizationName: string;
}): string {
  const person = firstName(input.personName, input.locale === 'en-US' ? 'there' : input.locale === 'es-ES' ? 'hola' : 'olá');
  const sender = firstName(input.senderName, input.locale === 'en-US' ? 'our team' : input.locale === 'es-ES' ? 'nuestro equipo' : 'nossa equipe');
  const organization = String(input.organizationName || '').trim() || 'MillionsNest';

  if (input.locale === 'en-US') {
    return `Hi, ${person}. This is ${sender} from ${organization}. It was a joy to meet you. I hope you felt welcome with us. Thank you for being with us, and please know you can count on us. If there is anything we can pray about for you or your family, feel free to tell me. May God bless your week and your home.`;
  }

  if (input.locale === 'es-ES') {
    return `Hola, ${person}. Soy ${sender}, de ${organization}. Fue una alegría conocerte. Espero que te hayas sentido bien entre nosotros. Gracias por haber estado con nosotros, y quiero que sepas que puedes contar con nosotros. Si hay algo por lo que podamos orar por ti o por tu familia, puedes decírmelo con libertad. Que Dios bendiga tu semana y tu hogar.`;
  }

  return `Oi, ${person}. Aqui é ${sender}, da ${organization}. Foi uma alegria conhecer você. Espero que tenha se sentido bem entre nós. Queria agradecer por ter estado conosco e dizer que pode contar com a gente. Se houver algo pelo qual possamos orar por você ou pela sua família, fique à vontade para falar comigo. Que Deus abençoe sua semana e sua casa.`;
}

export function isSafeJourneyReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'nestjourney.millionsnest.com' &&
      url.pathname === '/followup-runtime' &&
      Boolean(url.searchParams.get('followup'));
  } catch {
    return false;
  }
}
