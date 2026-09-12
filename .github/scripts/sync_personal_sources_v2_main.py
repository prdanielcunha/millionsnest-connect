from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"{label} anchor missing in {path}")
    p.write_text(s.replace(old, new, 1))


replace_once(
    "package.json",
    '"test:radar-pilot": "tsx src/tests/personalRadarSignals.test.ts && tsx src/tests/identityResolution.test.ts && tsx src/tests/personalRadarService.test.ts && tsx src/tests/composerPlaybook.test.ts"',
    '"test:radar-pilot": "tsx src/tests/personalRadarSignals.test.ts && tsx src/tests/identityResolution.test.ts && tsx src/tests/personalRadarService.test.ts && tsx src/tests/personalSourcesV2Service.test.ts && tsx src/tests/composerPlaybook.test.ts"',
    "radar test script",
)

replace_once(
    "src/App.tsx",
    "import { RadarPage } from './features/radar/RadarPage';\n",
    "import { RadarPage } from './features/radar/RadarPage';\nimport { PersonalSourcesPage } from './features/sources/PersonalSourcesPage';\n",
    "sources import",
)
replace_once(
    "src/App.tsx",
    "    if (activeRoute === 'radar' && showRadar) {\n      return <RadarPage session={liveSession} currentLang={currentLang} />;\n    }\n    if (activeRoute === 'overview') {",
    "    if (activeRoute === 'radar' && showRadar) {\n      return <RadarPage session={liveSession} currentLang={currentLang} />;\n    }\n    if (activeRoute === 'sources' && showRadar) {\n      return <PersonalSourcesPage session={liveSession} currentLang={currentLang} onNavigate={setActiveRoute} />;\n    }\n    if (activeRoute === 'overview') {",
    "sources route",
)

Path("src/core/client/liveSurfacePolicy.ts").write_text(
    """export const LIVE_OVERVIEW_ROUTE = 'overview' as const;
export const LIVE_RADAR_ROUTE = 'radar' as const;
export const LIVE_SOURCES_ROUTE = 'sources' as const;

export function getLiveNavigationRouteIds(showRadar: boolean): string[] {
  return showRadar
    ? [LIVE_OVERVIEW_ROUTE, LIVE_RADAR_ROUTE, LIVE_SOURCES_ROUTE]
    : [LIVE_OVERVIEW_ROUTE];
}

export function isLiveRouteEnabled(route: string, showRadar: boolean): boolean {
  return getLiveNavigationRouteIds(showRadar).includes(route);
}
"""
)

p = Path("src/tests/liveSurfacePolicy.test.ts")
s = p.read_text()
old = "equal(getLiveNavigationRouteIds(true), ['overview', 'radar'], 'governance live users see only real Core and Radar surfaces');"
new = "equal(getLiveNavigationRouteIds(true), ['overview', 'radar', 'sources'], 'governance live users see real Core, Radar and Personal Sources surfaces');"
if old not in s:
    raise SystemExit("live route expectation missing")
s = s.replace(old, new, 1)
old = "ok(isLiveRouteEnabled('radar', true), 'Radar is live for governance users');"
new = old + "\nok(isLiveRouteEnabled('sources', true), 'Personal Sources is live for governance users');"
if old not in s:
    raise SystemExit("radar policy assertion missing")
p.write_text(s.replace(old, new, 1))

p = Path("src/core/client/personalRadarClient.ts")
s = p.read_text()
old = "export type RadarConversationSummary = { id: string; sourceId: string; conversationKey: string; label: string; kind: string; fileName: string; createdAt: string; firstDateKey?: string | null; lastDateKey?: string | null; participantCount: number; messageCount: number; };"
new = """export type RadarConversationSummary = {
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
};"""
if old not in s:
    raise SystemExit("conversation summary missing")
s = s.replace(old, new, 1)
old = "  sourceIds?: string[];\n  displayName: string;"
if old not in s:
    raise SystemExit("person source ids missing")
s = s.replace(old, "  sourceIds?: string[];\n  rawSourceIds?: string[];\n  displayName: string;", 1)
marker = "\nasync function fileToBase64(file: File): Promise<string> {"
detail = """

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
"""
if marker not in s:
    raise SystemExit("client type marker missing")
s = s.replace(marker, detail + marker, 1)
for old, new, label in [
    ("fetch('/api/personal/imports/whatsapp'", "fetch('/api/personal/v2/imports/whatsapp'", "import endpoint"),
    ("fetch('/api/personal/radar'", "fetch('/api/personal/v2/radar'", "radar endpoint"),
    ("new URL('/api/personal/search', window.location.origin)", "new URL('/api/personal/v2/search', window.location.origin)", "search endpoint"),
    ("fetch(`/api/personal/sources/${encodeURIComponent(sourceId)}`", "fetch(`/api/personal/v2/sources/${encodeURIComponent(sourceId)}`", "delete endpoint"),
]:
    if old not in s:
        raise SystemExit(label + " missing")
    s = s.replace(old, new, 1)
methods_anchor = "\n  async search(query: string) {"
methods = """

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
      method: 'POST', headers: this.headers(true),
      body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...input }),
    });
    return parseResponse(response);
  }
"""
if methods_anchor not in s:
    raise SystemExit("client methods anchor missing")
p.write_text(s.replace(methods_anchor, methods + methods_anchor, 1))

p = Path("src/personal/radar/personalRadarService.ts")
s = p.read_text()
old = """function sourceIdFromText(text: string): string {
  const normalized = text.replace(/\\r\\n?/g, '\\n').trim();
  return `wa_${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`;
}"""
new = """function sourceIdFromText(text: string, scope?: string): string {
  const normalized = text.replace(/\\r\\n?/g, '\\n').trim();
  const safeScope = typeof scope === 'string' ? scope.trim().slice(0, 200) : '';
  const material = safeScope ? `${normalized}\\n::scope:${safeScope}` : normalized;
  return `wa_${crypto.createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}"""
if old not in s:
    raise SystemExit("source hash helper missing")
s = s.replace(old, new, 1)
old = "input: { fileName: string; contentBase64: string; selfNames?: string[] },"
if old not in s:
    raise SystemExit("import signature missing")
s = s.replace(old, "input: { fileName: string; contentBase64: string; selfNames?: string[]; sourceScope?: string; relatedSourceIds?: string[] },", 1)
old = "const sourceId = sourceIdFromText(text);"
if old not in s:
    raise SystemExit("source hash call missing")
s = s.replace(old, "const sourceId = sourceIdFromText(text, input.sourceScope);", 1)
old = """    let identityReviewCount = 0;

    for (const person of people) {
      const rankedMatches = workingPeople
        .map(existing => ({ existing, match: compareIdentity(person, existing) }))"""
new = """    let identityReviewCount = 0;
    const relatedSourceIds = new Set(uniqueStrings(input.relatedSourceIds).slice(0, 240));

    for (const person of people) {
      const rankedMatches = workingPeople
        .map(existing => {
          let match = compareIdentity(person, existing);
          const existingSources = uniqueStrings(existing.sourceIds, existing.sourceId);
          const sameConversationSender = relatedSourceIds.size > 0
            && existingSources.some(source => relatedSourceIds.has(source))
            && normalizeIdentityName(existing.displayName) === normalizeIdentityName(person.displayName);
          if (sameConversationSender && match.kind !== 'conflict') {
            match = { kind: 'strong' as const, confidence: 98, reasons: ['same_conversation_sender'] };
          }
          return { existing, match };
        })"""
if old not in s:
    raise SystemExit("identity continuity block missing")
p.write_text(s.replace(old, new, 1))
