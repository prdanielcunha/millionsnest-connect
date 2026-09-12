import { LiveConnectSession } from './liveConnectSession';

export type AudienceDefinition = {
  sourceId?: string;
  query?: string;
  signalType?: string;
  activeWithinDays?: number;
  minMessages?: number;
  favoritesOnly?: boolean;
};

async function parseResponse(response: Response): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const error = new Error(body?.humanSummary || 'O Connect não conseguiu concluir esta operação.');
    (error as any).code = body?.code || 'RELATIONSHIP_INTELLIGENCE_REQUEST_FAILED';
    throw error;
  }
  return body;
}

async function fileToBase64(file: File, maxBytes: number): Promise<string> {
  if (file.size <= 0 || file.size > maxBytes) throw new Error('FILE_SIZE_INVALID');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

export class PersonalIntelligenceClient {
  constructor(private readonly session: LiveConnectSession) {}

  private headers(contentType = false): Record<string, string> {
    return {
      Authorization: `Bearer ${this.session.idToken}`,
      'X-Organization-Id': this.session.expectedOrganizationId,
      Accept: 'application/json',
      ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  async getIdentityReview() {
    const response = await fetch('/api/personal/intelligence/identity/review', { headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async reviewProbableName(personId: string, action: 'confirm' | 'reject') {
    const response = await fetch(`/api/personal/intelligence/people/${encodeURIComponent(personId)}/probable-name`, {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, action }),
    });
    return parseResponse(response);
  }

  async getTimeline(personId: string, limit = 240) {
    const url = new URL(`/api/personal/intelligence/people/${encodeURIComponent(personId)}/timeline`, window.location.origin);
    url.searchParams.set('limit', String(limit));
    const response = await fetch(url.toString(), { headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async updateFollowUp(personId: string, input: { action: 'schedule' | 'complete' | 'clear'; dueAt?: string; note?: string }) {
    const response = await fetch(`/api/personal/intelligence/people/${encodeURIComponent(personId)}/follow-up`, {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...input }),
    });
    return parseResponse(response);
  }

  async getFollowUps() {
    const response = await fetch('/api/personal/intelligence/follow-ups', { headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async previewAudience(definition: AudienceDefinition) {
    const response = await fetch('/api/personal/intelligence/audiences/preview', {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...definition }),
    });
    return parseResponse(response);
  }

  async listAudiences() {
    const response = await fetch('/api/personal/intelligence/audiences', { headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async saveAudience(name: string, definition: AudienceDefinition, id?: string) {
    const response = await fetch('/api/personal/intelligence/audiences', {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, id, name, definition }),
    });
    return parseResponse(response);
  }

  async deleteAudience(audienceId: string) {
    const response = await fetch(`/api/personal/intelligence/audiences/${encodeURIComponent(audienceId)}`, {
      method: 'DELETE', headers: this.headers(),
    });
    return parseResponse(response);
  }

  async importVCard(file: File) {
    const contentBase64 = await fileToBase64(file, 2 * 1024 * 1024);
    const response = await fetch('/api/personal/intelligence/contacts/vcard', {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, fileName: file.name, contentBase64 }),
    });
    return parseResponse(response);
  }

  async getImportHealth() {
    const response = await fetch('/api/personal/intelligence/imports/health', { headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async getCapabilities() {
    const response = await fetch('/api/personal/intelligence/capabilities', { headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }

  async toolSearchPeople(definition: AudienceDefinition) {
    const response = await fetch('/api/personal/intelligence/tools/search-people', {
      method: 'POST', headers: this.headers(true), body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...definition }),
    });
    return parseResponse(response);
  }

  async toolGetPersonContext(personId: string) {
    const response = await fetch(`/api/personal/intelligence/tools/people/${encodeURIComponent(personId)}/context`, {
      headers: this.headers(), cache: 'no-store',
    });
    return parseResponse(response);
  }
}
