from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"{label} anchor missing in {path}")
    p.write_text(s.replace(old, new, 1))


# Production keeps Live People/Smart Contacts and adds Intelligence beside it.
replace_once(
    "src/App.tsx",
    "import { PersonalSourcesPage } from './features/sources/PersonalSourcesPage';\n",
    "import { PersonalSourcesPage } from './features/sources/PersonalSourcesPage';\nimport { RelationshipIntelligencePage } from './features/intelligence/RelationshipIntelligencePage';\n",
    "intelligence import",
)
replace_once(
    "src/App.tsx",
    "    if (activeRoute === 'sources' && showRadar) {\n      return <PersonalSourcesPage session={liveSession} currentLang={currentLang} onNavigate={setActiveRoute} />;\n    }\n    if (activeRoute === 'overview') {",
    "    if (activeRoute === 'sources' && showRadar) {\n      return <PersonalSourcesPage session={liveSession} currentLang={currentLang} onNavigate={setActiveRoute} />;\n    }\n    if (activeRoute === 'intelligence' && showRadar) {\n      return <RelationshipIntelligencePage session={liveSession} currentLang={currentLang} />;\n    }\n    if (activeRoute === 'overview') {",
    "intelligence route",
)

replace_once(
    "src/components/layout/Shell.tsx",
    "const sourceLabels: Record<LanguageCode, string> = {\n  'pt-BR': 'Minhas fontes',\n  'en-US': 'My sources',\n  'es-ES': 'Mis fuentes',\n};\n",
    "const sourceLabels: Record<LanguageCode, string> = {\n  'pt-BR': 'Minhas fontes',\n  'en-US': 'My sources',\n  'es-ES': 'Mis fuentes',\n};\n\nconst intelligenceLabels: Record<LanguageCode, string> = {\n  'pt-BR': 'Inteligência',\n  'en-US': 'Intelligence',\n  'es-ES': 'Inteligencia',\n};\n",
    "intelligence labels",
)
replace_once(
    "src/components/layout/Shell.tsx",
    "      { id: 'radar', label: radarLabels[currentLang], icon: Radar },\n      { id: 'sources', label: sourceLabels[currentLang], icon: Database },\n",
    "      { id: 'radar', label: radarLabels[currentLang], icon: Radar },\n      { id: 'sources', label: sourceLabels[currentLang], icon: Database },\n      { id: 'intelligence', label: intelligenceLabels[currentLang], icon: BrainCircuit },\n",
    "intelligence navigation",
)

Path("src/core/client/liveSurfacePolicy.ts").write_text("""export const LIVE_OVERVIEW_ROUTE = 'overview' as const;
export const LIVE_RADAR_ROUTE = 'radar' as const;
export const LIVE_SOURCES_ROUTE = 'sources' as const;
export const LIVE_CONTACTS_ROUTE = 'contacts' as const;
export const LIVE_INTELLIGENCE_ROUTE = 'intelligence' as const;

export function getLiveNavigationRouteIds(showRadar: boolean): string[] {
  return showRadar
    ? [LIVE_OVERVIEW_ROUTE, LIVE_RADAR_ROUTE, LIVE_SOURCES_ROUTE, LIVE_CONTACTS_ROUTE, LIVE_INTELLIGENCE_ROUTE]
    : [LIVE_OVERVIEW_ROUTE];
}

export function isLiveRouteEnabled(route: string, showRadar: boolean): boolean {
  return getLiveNavigationRouteIds(showRadar).includes(route);
}
""")

replace_once(
    "src/tests/liveSurfacePolicy.test.ts",
    "equal(getLiveNavigationRouteIds(true), ['overview', 'radar', 'sources', 'contacts'], 'governance live users see real Core, Radar, Personal Sources and People surfaces');",
    "equal(getLiveNavigationRouteIds(true), ['overview', 'radar', 'sources', 'contacts', 'intelligence'], 'governance live users see Core, Radar, Personal Sources, People and Relationship Intelligence surfaces');",
    "production live routes expectation",
)
replace_once(
    "src/tests/liveSurfacePolicy.test.ts",
    "ok(isLiveRouteEnabled('contacts', true), 'People/Contacts is live for governance users');",
    "ok(isLiveRouteEnabled('contacts', true), 'People/Contacts is live for governance users');\nok(isLiveRouteEnabled('intelligence', true), 'Relationship Intelligence is live for governance users');",
    "production intelligence route assertion",
)

# Keep production-only Smart Contacts methods; add only the timeline call.
p = Path("src/core/client/personalRadarClient.ts")
s = p.read_text()
anchor = "\n  async search(query: string) {"
method = """

  async getPersonTimeline(personId: string, limit = 240) {
    const url = new URL(`/api/personal/intelligence/people/${encodeURIComponent(personId)}/timeline`, window.location.origin);
    url.searchParams.set('limit', String(limit));
    const response = await fetch(url.toString(), { method: 'GET', headers: this.headers(), cache: 'no-store' });
    return parseResponse(response);
  }
"""
if anchor not in s:
    raise SystemExit("production personal radar search anchor missing")
p.write_text(s.replace(anchor, method + anchor, 1))

# Person360: keep production UI and enrich with cross-source timeline.
p = Path("src/features/contacts/Person360Panel.tsx")
s = p.read_text()
old = """    client.getPersonContext(personId)
      .then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Error'); })
      .finally(() => { if (active) setLoading(false); });"""
new = """    Promise.all([client.getPersonContext(personId), client.getPersonTimeline(personId, 240)])
      .then(([result, timeline]) => { if (active) setData({ ...result, timeline: Array.isArray(timeline.items) ? timeline.items : [] }); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Error'); })
      .finally(() => { if (active) setLoading(false); });"""
if old not in s:
    raise SystemExit("production Person360 load anchor missing")
s = s.replace(old, new, 1)
s = s.replace("    recent: 'Mensagens recentes desta pessoa', evidence: 'Evidências de identidade', signals: 'Sinais explicáveis',", "    recent: 'Timeline unificada', evidence: 'Evidências de identidade', signals: 'Sinais explicáveis',", 1)
s = s.replace("    recent: 'Mensajes recientes de esta persona', evidence: 'Evidencias de identidad', signals: 'Señales explicables',", "    recent: 'Timeline unificada', evidence: 'Evidencias de identidad', signals: 'Señales explicables',", 1)
s = s.replace("    recent: 'Recent messages from this person', evidence: 'Identity evidence', signals: 'Explainable signals',", "    recent: 'Unified timeline', evidence: 'Identity evidence', signals: 'Explainable signals',", 1)
s = s.replace("  const messages = Array.isArray(data?.recentMessages) ? data.recentMessages : [];", "  const messages = Array.isArray(data?.timeline) && data.timeline.length ? data.timeline : Array.isArray(data?.recentMessages) ? data.recentMessages : [];", 1)
old = """{messages.slice(0, 18).map((message: any, index: number) => <div key={`${message.timestampLocal || message.dateKey}-${index}`} className=\"rounded-xl border border-white/6 bg-black/15 p-3\"><div className=\"text-[10px] font-medium text-slate-500\">{shortDate(message.dateKey || message.timestampLocal, currentLang)}</div><p className=\"mt-1 text-xs leading-5 text-slate-300\">{message.text}</p></div>)}"""
new = """{messages.slice(0, 30).map((message: any, index: number) => <div key={`${message.timestampLocal || message.dateKey}-${index}`} className=\"rounded-xl border border-white/6 bg-black/15 p-3\"><div className=\"flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-slate-500\"><span>{shortDate(message.dateKey || message.timestampLocal, currentLang)}</span><span className=\"text-slate-600\">{message.sourceLabel || (message.type === 'follow_up' ? 'Connect' : '')}</span></div><p className=\"mt-1 text-xs leading-5 text-slate-300\">{message.type === 'follow_up' ? `Follow-up · ${message.text}` : message.text}</p></div>)}"""
if old not in s:
    raise SystemExit("production Person360 message anchor missing")
p.write_text(s.replace(old, new, 1))

# Keep production contactPhoneIdentity regression and add V3 regression beside it.
replace_once(
    "package.json",
    'tsx src/tests/personalSourcesV2Service.test.ts && tsx src/tests/contactPhoneIdentity.test.ts && tsx src/tests/composerPlaybook.test.ts',
    'tsx src/tests/personalSourcesV2Service.test.ts && tsx src/tests/contactPhoneIdentity.test.ts && tsx src/tests/personalIntelligenceService.test.ts && tsx src/tests/composerPlaybook.test.ts',
    "production radar-pilot intelligence test",
)
