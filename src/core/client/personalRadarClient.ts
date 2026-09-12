import { LiveConnectSession } from './liveConnectSession';

export type SavedMessageModel = {
  id: string;
  label: string;
  text: string;
  objective: 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';
  tone: 'curto' | 'conversa' | 'audio' | 'video';
  createdAt: string;
  updatedAt?: string;
};

export type RadarPotentialLevel = 'very_high' | 'high' | 'medium' | 'low' | 'unknown';
export type RadarManualPriority = 'normal' | 'important' | 'priority';

export type RadarConversationSummary = {
  id: string;
  sourceId: string;
  conversationKey: string;
  label: string;
  kind: string;
  fileName: string;
  createdAt: string;
  updatedAt?: string;
  lastImportedAt?: string;
  firstDateKey?: string | null;
  lastDateKey?: string | null;
  participantCount: number;
  messageCount: number;
  peopleCount?: number;
  importCount?: number;
  lastAddedMessageCount?: number;
  rawSourceIds?: string[];
  syncMode?: 'incremental' | 'legacy';
};
export type RadarIdentityEvidence = { kind: string; score: number; sourceId: string; messageIndex: number; dateKey: string; sender: string; snippet: string; };

export type RadarIdentityReviewCandidate = {
  personId: string;
  displayName: string;
  confidence: number;
  reasons: string[];
};

export type RadarClientPerson = {
  id: string;
  sourceId: string;
  sourceIds?: string[];
  rawSourceIds?: string[];
  displayName: string;
  normalizedName?: string;
  probableName?: string | null;
  normalizedProbableName?: string;
  probableNameConfidence?: 'high' | 'medium' | 'low' | 'none';
  probableNameScore?: number;
  identityEvidence?: RadarIdentityEvidence[];
  sources?: RadarConversationSummary[];
  phone?: string | null;
  lastDateKey?: string | null;
  messageCount?: number;
  radarState?: string;
  snoozedUntil?: string | null;
  priority?: number;
  automaticPotential?: RadarPotentialLevel;
  manualPotential?: RadarPotentialLevel | null;
  effectivePotential?: RadarPotentialLevel;
  manualPriority?: RadarManualPriority;
  favorite?: boolean;
  notRelevant?: boolean;
  identityResolution?: string;
  identityConfidence?: number;
  identityReview?: RadarIdentityReviewCandidate[];
  identityAliases?: string[];
  salesStage?: string | null;
  lastCommercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied' | null;
  lastCommercialAt?: string | null;
  followUpAt?: string | null;
  sourceKinds?: string[];
  radarEligible?: boolean;
  signals: Array<{
    id: string;
    type: string;
    reason: string;
    nextAction: string;
    evidence: Array<{
      dateKey: string;
      sender: string;
      snippet: string;
    }>;
  }>;
};

export type PersonalSourceDetail = {
  source: RadarConversationSummary;
  participants: Array<{ name: string; messageCount: number }>;
  people: Array<{
    id: string;
    displayName: string;
    originalName: string;
    phone?: string | null;
    messageCount: number;
    lastDateKey?: string | null;
    favorite?: boolean;
    manualPriority?: string;
    effectivePotential?: string;
    signal?: Record<string, unknown> | null;
  }>;
  recentMessages: Array<{ index: number; sender: string; text: string; dateKey: string; timestampLocal: string }>;
  imports: Array<{ id: string; fileName: string; createdAt: string; incomingMessageCount: number; addedMessageCount: number; status: string }>;
};

async function fileToBase64(file: File): Promise<string> {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('IMPORT_FILE_SIZE_INVALID');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

async function parseResponse(response: Response): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.humanSummary || 'O Radar não conseguiu concluir esta operação.');
    (error as any).code = body?.code || 'RADAR_REQUEST_FAILED';
    throw error;
  }
  return body;
}

export class PersonalRadarClient {
  constructor(private readonly session: LiveConnectSession) {}

  private headers(contentType = false): Record<string, string> {
    return {
      Authorization: `Bearer ${this.session.idToken}`,
      'X-Organization-Id': this.session.expectedOrganizationId,
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  async importWhatsApp(file: File, selfNames: string[]) {
    const contentBase64 = await fileToBase64(file);
    const response = await fetch('/api/personal/v2/imports/whatsapp', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({
        organizationId: this.session.expectedOrganizationId,
        fileName: file.name,
        contentBase64,
        selfNames,
      }),
    });
    return parseResponse(response);
  }

  async getRadar(): Promise<{ people: RadarClientPerson[]; count: number; conversations: RadarConversationSummary[] }> {
    const response = await fetch('/api/personal/v2/radar', {
      method: 'GET',
      headers: this.headers(),
      cache: 'no-store',
    });
    const body = await parseResponse(response);
    return { people: Array.isArray(body.people) ? body.people : [], count: Number(body.count || 0), conversations: Array.isArray(body.conversations) ? body.conversations : [] };
  }

  async getSources(): Promise<{
    sources: RadarConversationSummary[];
    count: number;
    totals: { conversations: number; people: number; messages: number; imports: number };
    recentImports: Array<{ id: string; groupId: string; fileName: string; createdAt: string; incomingMessageCount: number; addedMessageCount: number; status: string }>;
  }> {
    const response = await fetch('/api/personal/v2/sources', { method: 'GET', headers: this.headers(), cache: 'no-store' });
    const body = await parseResponse(response);
    return {
      sources: Array.isArray(body.sources) ? body.sources : [],
      count: Number(body.count || 0),
      totals: body.totals || { conversations: 0, people: 0, messages: 0, imports: 0 },
      recentImports: Array.isArray(body.recentImports) ? body.recentImports : [],
    };
  }

  async getSource(sourceId: string): Promise<PersonalSourceDetail> {
    const response = await fetch(`/api/personal/v2/sources/${encodeURIComponent(sourceId)}`, {
      method: 'GET', headers: this.headers(), cache: 'no-store',
    });
    return parseResponse(response);
  }

  async getPersonContext(personId: string) {
    const response = await fetch(`/api/personal/v2/people/${encodeURIComponent(personId)}/context`, {
      method: 'GET', headers: this.headers(), cache: 'no-store',
    });
    return parseResponse(response);
  }

  async getRelationshipBrief() {
    const response = await fetch('/api/personal/v2/brief', { method: 'GET', headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async prepareSourceOutreach(
    sourceId: string,
    input: {
      limit?: number;
      tone?: 'curto' | 'conversa' | 'audio' | 'video';
      style?: 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';
      channel?: 'texto' | 'audio' | 'video' | 'followup';
      objective?: 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';
    } = {},
  ) {
    const response = await fetch(`/api/personal/v2/sources/${encodeURIComponent(sourceId)}/outreach`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...input }),
    });
    return parseResponse(response);
  }

  async getPeople(): Promise<{ people: RadarClientPerson[]; count: number }> {
    const response = await fetch('/api/personal/people', { method: 'GET', headers: this.headers(), cache: 'no-store' });
    const body = await parseResponse(response);
    return { people: Array.isArray(body.people) ? body.people : [], count: Number(body.count || 0) };
  }

  async importContacts(contacts: Array<{ name: string; phone?: string }>) {
    const response = await fetch('/api/personal/imports/contacts', {
      method: 'POST', headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, contacts }),
    });
    return parseResponse(response);
  }

  async search(query: string) {
    const url = new URL('/api/personal/v2/search', window.location.origin);
    url.searchParams.set('q', query);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers(),
      cache: 'no-store',
    });
    return parseResponse(response);
  }

  async updatePerson(
    personId: string,
    update: {
      phone?: string | null;
      radarState?: 'active' | 'ignored' | 'snoozed';
      snoozeDays?: number;
      favorite?: boolean;
      manualPriority?: RadarManualPriority;
      manualPotential?: RadarPotentialLevel | null;
      notRelevant?: boolean;
      salesStage?: 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';
      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';
      followUpDays?: number;
    },
  ) {
    const response = await fetch(`/api/personal/people/${encodeURIComponent(personId)}`, {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...update }),
    });
    return parseResponse(response);
  }

  async resolveIdentity(personId: string, candidatePersonId: string, action: 'merge' | 'keep_separate') {
    const response = await fetch(`/api/personal/people/${encodeURIComponent(personId)}/identity`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({
        organizationId: this.session.expectedOrganizationId,
        candidatePersonId,
        action,
      }),
    });
    return parseResponse(response);
  }

  async undoIdentityMerge(mergeId: string) {
    const response = await fetch(`/api/personal/identity-merges/${encodeURIComponent(mergeId)}/undo`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId }),
    });
    return parseResponse(response);
  }

  async promote(personId: string) {
    const response = await fetch(`/api/personal/opportunities/${encodeURIComponent(personId)}/promote`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId }),
    });
    return parseResponse(response);
  }

  async compose(
    personId: string,
    signalId: string,
    tone: 'curto' | 'conversa' | 'audio' | 'video',
    preferences: {
      style?: 'amigavel' | 'profissional' | 'descontraido' | 'objetivo' | 'proximo' | 'pastoral' | 'consultivo';
      channel?: 'texto' | 'audio' | 'video' | 'followup';
      objective?: 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';
    } = {},
  ) {
    const response = await fetch('/api/personal/composer/draft', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({
        organizationId: this.session.expectedOrganizationId,
        personId,
        signalId,
        tone,
        ...preferences,
      }),
    });
    return parseResponse(response);
  }

  async getMessageModels(): Promise<{ models: SavedMessageModel[]; count: number }> {
    const response = await fetch('/api/personal/message-models', {
      method: 'GET', headers: this.headers(), cache: 'no-store',
    });
    const body = await parseResponse(response);
    return { models: Array.isArray(body.models) ? body.models : [], count: Number(body.count || 0) };
  }

  async saveMessageModel(model: Omit<SavedMessageModel, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await fetch('/api/personal/message-models', {
      method: 'POST', headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...model }),
    });
    return parseResponse(response) as Promise<{ success: true; model: SavedMessageModel }>;
  }

  async deleteMessageModel(modelId: string) {
    const response = await fetch(`/api/personal/message-models/${encodeURIComponent(modelId)}`, {
      method: 'DELETE', headers: this.headers(),
    });
    return parseResponse(response);
  }

  async deleteSource(sourceId: string) {
    const response = await fetch(`/api/personal/v2/sources/${encodeURIComponent(sourceId)}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    return parseResponse(response);
  }
}
