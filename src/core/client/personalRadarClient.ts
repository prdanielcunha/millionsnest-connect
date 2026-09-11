import { LiveConnectSession } from './liveConnectSession';

export type RadarClientPerson = {
  id: string;
  sourceId: string;
  displayName: string;
  phone?: string | null;
  lastDateKey?: string | null;
  messageCount?: number;
  radarState?: string;
  snoozedUntil?: string | null;
  priority?: number;
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
    const response = await fetch('/api/personal/imports/whatsapp', {
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

  async getRadar(): Promise<{ people: RadarClientPerson[]; count: number }> {
    const response = await fetch('/api/personal/radar', {
      method: 'GET',
      headers: this.headers(),
      cache: 'no-store',
    });
    const body = await parseResponse(response);
    return { people: Array.isArray(body.people) ? body.people : [], count: Number(body.count || 0) };
  }

  async search(query: string) {
    const url = new URL('/api/personal/search', window.location.origin);
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
      phone?: string;
      radarState?: 'active' | 'ignored' | 'snoozed';
      snoozeDays?: number;
    },
  ) {
    const response = await fetch(`/api/personal/people/${encodeURIComponent(personId)}`, {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...update }),
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

  async compose(personId: string, signalId: string, tone: 'curto' | 'conversa' | 'audio' | 'video') {
    const response = await fetch('/api/personal/composer/draft', {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({
        organizationId: this.session.expectedOrganizationId,
        personId,
        signalId,
        tone,
      }),
    });
    return parseResponse(response);
  }

  async deleteSource(sourceId: string) {
    const response = await fetch(`/api/personal/sources/${encodeURIComponent(sourceId)}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    return parseResponse(response);
  }
}
