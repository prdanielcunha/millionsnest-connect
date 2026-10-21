import type { ConnectCoreIntent } from './connectCore';

export type QuestionUnderstanding = {
  intent: ConnectCoreIntent;
  clarification?: 'scope' | 'multiple' | 'change' | 'unknown';
};

export function normalizeQuestion(text: string): string {
  return text.slice(0, 4000).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s/:.-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Local, zero-model-cost understanding of the actual read tools. This is a
 * routing suggestion, never identity, authorization, data or a tool argument.
 * Scope the tools cannot express is clarified rather than silently discarded.
 */
export function understandConnectQuestion(text: string): QuestionUnderstanding {
  const q = normalizeQuestion(text);
  const has = (pattern: RegExp) => pattern.test(q);
  const schedule = has(/\b(escalas?|escalad[oa]s?|schedule|scheduled|turno)\b/);
  const personalPerformance = has(/\b(quando|when|cuando)\b.*\b(tocar|cantar|servir|ministrar|playing|play|sing|serve|toco|canto)\b/);
  const repertoire = has(/\b(repertorio|repertoire|setlist|musicas|songs|canciones)\b/);
  const chart = has(/\b(cifras?|acordes|chords|chart)\b/);
  const presence = has(/\b(presenca|confirmacao|confirmad[oa]|confirmei|attendance|confirmed|asistencia|confirme|resposta|respuesta|response)\b/);
  const music = schedule || personalPerformance || repertoire || chart || presence ||
    has(/\b(nao|not|cannot|cant|no)\b.*\b(tocar|cantar|servir|play|attend)\b/);
  if (!music) return { intent: 'unknown' };
  // Product conflicts and explicit human requests must remain with the router.
  if (has(/\b(nestfinance|nestjourney|atendente|humano|humana|human|persona)\b/)) return { intent: 'unknown' };
  // A query of attendance is different from recording attendance or changing a scale.
  if (has(/\b(cancelar|cancele|apagar|apague|excluir|exclua|remover|remova|trocar|troque|alterar|altere|criar|crie|confirmar|confirma|confirmo|desmarcar|delete|remove|change|create|confirm|cancel|cambiar|crear)\b/) ||
      has(/\b(nao|no|not|cannot|cant)\b.*\b(vou|posso|consigo|poderei|tocar|cantar|servir|play|attend|podre|puedo)\b/)) {
    return { intent: 'unknown', clarification: 'change' };
  }
  // Current tools return only the authenticated person's NEXT scale. Do not
  // answer a date/person/history/list question by substituting that next scale.
  if (has(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado|hoje|amanha|ontem|semana|mes|passad[oa]|anterior|todas|todos|equipe|outro|outra|quem|who|quien|sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow|yesterday|week|month|previous|last|all|team|lunes|martes|miercoles|jueves|viernes|hoy|manana|ayer|equipo)\b/) ||
      has(/\b\d{1,4}[\/.-]\d{1,2}(?:[\/.-]\d{1,4})?\b/) ||
      has(/\b(?:escala|schedule|turno|repertorio|presenca)\s+(?:d[oa]|de|for)\s+(?!minha\b|meu\b|my\b|mi\b|louvor\b|alabanza\b|worship\b|proxima\b|next\b|musicscale\b)\p{L}/u)) {
    return { intent: 'unknown', clarification: 'scope' };
  }
  if ((repertoire && presence) || (chart && presence)) return { intent: 'unknown', clarification: 'multiple' };
  if (chart) return { intent: 'get_next_schedule_chart' };
  if (presence) return { intent: 'get_next_schedule_presence' };
  if (repertoire) return { intent: 'get_next_schedule_repertoire' };
  if (personalPerformance || schedule && has(/\b(proxim[oa]|next|quando|when|cual|qual|estou|tenho|tem|minha|meu|my|mi|am|estoy|estare|manda|mande|mostra|mostre|ver|consultar|consulta)\b/)) {
    return { intent: 'get_next_schedule' };
  }
  return { intent: 'unknown', clarification: 'unknown' };
}

export function questionGuidance(kind: QuestionUnderstanding['clarification'], locale: string): string {
  const language = locale.startsWith('en') ? 'en' : locale.startsWith('es') ? 'es' : 'pt';
  const messages = {
    scope: {
      pt: 'Por aqui consigo consultar sua próxima escala no MusicScale, o repertório, as cifras e sua confirmação. Ainda não filtro por uma data específica, outra pessoa ou todas as escalas. Para consultar a próxima, escreva “minha próxima escala”.',
      en: 'I can check your next MusicScale schedule, its songs, chords and your attendance status. I cannot filter by a specific date, another person or all schedules here yet. To check the next one, write “my next schedule”.',
      es: 'Puedo consultar tu próximo turno de MusicScale, su repertorio, acordes y tu confirmación. Todavía no filtro por una fecha específica, otra persona o todos los turnos. Para consultar el próximo, escribe “mi próxima escala”.',
    },
    change: {
      pt: 'Entendi que você quer fazer uma alteração. Por aqui ainda faço consultas; não registrei nenhuma mudança. Para alterar a escala ou confirmar/recusar presença, use o MusicScale: https://musicscale.millionsnest.com',
      en: 'I understand you want to make a change. I can only read information here so far; no change was recorded. To change a schedule or accept/decline attendance, open MusicScale: https://musicscale.millionsnest.com',
      es: 'Entiendo que quieres hacer un cambio. Por aquí todavía solo consulto información; no registré ningún cambio. Para cambiar un turno o aceptar/rechazar asistencia, abre MusicScale: https://musicscale.millionsnest.com',
    },
    multiple: {
      pt: 'Vamos consultar uma informação por vez: sua próxima escala, o repertório, uma cifra ou sua confirmação de presença. Qual delas você quer primeiro?',
      en: 'Let us check one item at a time: your next schedule, its songs, a song chart or your attendance status. Which one would you like first?',
      es: 'Consultemos una información a la vez: tu próximo turno, repertorio, acordes o confirmación de asistencia. ¿Cuál quieres primero?',
    },
    unknown: {
      pt: 'Não consegui identificar a consulta com segurança. Escreva uma das opções:\n• Próxima escala\n• Repertório\n• Presença\n• Cifra de [nome da música]\n\nVocê também pode escrever “atendente” ou informar outro aplicativo.',
      en: 'I could not identify the request safely. I can check your next MusicScale schedule, its songs, a song chart or your attendance status. You can also tell me which app you need help with.',
      es: 'No pude identificar la consulta con seguridad. Puedo buscar tu próximo turno de MusicScale, repertorio, acordes o confirmación de asistencia. También puedes decir sobre qué aplicación necesitas ayuda.',
    },
  };
  return messages[kind ?? 'unknown'][language];
}
