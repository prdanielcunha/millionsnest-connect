from pathlib import Path

# personalRadarClient
p=Path('src/core/client/personalRadarClient.ts'); s=p.read_text()
s=s.replace("  followUpAt?: string | null;\n  signals:", "  followUpAt?: string | null;\n  sourceKinds?: string[];\n  radarEligible?: boolean;\n  signals:")
insert="""
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
"""
s=s.replace("  async search(query: string) {", insert+"\n  async search(query: string) {")
p.write_text(s)

# live surface policy
p=Path('src/core/client/liveSurfacePolicy.ts'); s=p.read_text()
s=s.replace("export const LIVE_RADAR_ROUTE = 'radar' as const;", "export const LIVE_RADAR_ROUTE = 'radar' as const;\nexport const LIVE_CONTACTS_ROUTE = 'contacts' as const;")
s=s.replace("? [LIVE_OVERVIEW_ROUTE, LIVE_RADAR_ROUTE]\n    : [LIVE_OVERVIEW_ROUTE];", "? [LIVE_OVERVIEW_ROUTE, LIVE_RADAR_ROUTE, LIVE_CONTACTS_ROUTE]\n    : [LIVE_OVERVIEW_ROUTE];")
p.write_text(s)

# app live route
p=Path('src/App.tsx'); s=p.read_text()
s=s.replace("import { RadarPage } from './features/radar/RadarPage';", "import { RadarPage } from './features/radar/RadarPage';\nimport { LivePeoplePage } from './features/contacts/LivePeoplePage';")
s=s.replace("    if (activeRoute === 'overview') {\n      return <LiveCorePage session={liveSession} currentLang={currentLang} />;\n    }", "    if (activeRoute === 'overview') {\n      return <LiveCorePage session={liveSession} currentLang={currentLang} />;\n    }\n    if (activeRoute === 'contacts' && showRadar) {\n      return <LivePeoplePage session={liveSession} currentLang={currentLang} />;\n    }")
p.write_text(s)

# service helpers and methods
p=Path('src/personal/radar/personalRadarService.ts'); s=p.read_text()
s=s.replace("function sourceIdFromText(text: string): string {", "function normalizedName(value: unknown): string { return String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\\s+/g, ' '); }\nfunction normalizedPhone(value: unknown): string { const digits = String(value || '').replace(/\\D/g, ''); return digits.length >= 10 && digits.length <= 15 ? digits : ''; }\n\nfunction sourceIdFromText(text: string): string {")
s=s.replace("          priority: personPriority(person),\n        },", "          priority: personPriority(person),\n          radarEligible: true,\n          sourceKinds: ['whatsapp_export'],\n        },")
s=s.replace("      .filter(person => person.radarState !== 'ignored' && !isActivelySnoozed(person, nowMs))", "      .filter(person => person.radarEligible !== false && person.radarState !== 'ignored' && !isActivelySnoozed(person, nowMs))")
marker="""  async search(request: RadarRequestContext, rawQuery: string) {"""
methods="""
  async getPeople(request: RadarRequestContext) {
    const context = await this.resolvePilotContext(request);
    const people = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 2_000);
    const ordered = people.sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR'));
    return { people: ordered, count: ordered.length };
  }

  async importContacts(request: RadarRequestContext, input: { contacts?: Array<{ name?: unknown; phone?: unknown }> }) {
    const context = await this.resolvePilotContext(request);
    const contacts = Array.isArray(input.contacts) ? input.contacts.slice(0, 500) : [];
    if (!contacts.length) throw new Error('CONTACTS_REQUIRED');
    const existing = await this.vault.list(request.authToken, context.actorUid, ['personalPeople'], 2_000);
    const writes: VaultWrite[] = [];
    let imported = 0;
    for (const raw of contacts) {
      const displayName = String(raw?.name || '').trim().replace(/\\s+/g, ' ').slice(0, 160);
      if (!displayName) continue;
      const phone = normalizedPhone(raw?.phone);
      const nameKey = normalizedName(displayName);
      let person = existing.find(item => phone && normalizedPhone(item.phone) === phone);
      if (!person) person = existing.find(item => !item.phone && normalizedName(item.displayName) === nameKey);
      const id = person ? String(person.id) : `ct_${crypto.createHash('sha256').update(`${nameKey}|${phone}`).digest('hex').slice(0, 24)}`;
      const currentKinds = Array.isArray(person?.sourceKinds) ? person!.sourceKinds as string[] : (String(person?.sourceId || '').startsWith('wa_') ? ['whatsapp_export'] : []);
      const sourceKinds = Array.from(new Set([...currentKinds, 'contacts_import']));
      const directSignal = {
        id: 'direct_contact', type: 'recurring_relevant_topic', reason: 'Contato disponível para abordagem direta.',
        nextAction: 'Escolha a etapa da conversa e prepare a próxima mensagem.', evidence: [],
      };
      writes.push({ path: ['personalPeople', id], data: {
        ...(person || {}), id, sourceId: String(person?.sourceId || 'contacts_import'), ownerUid: context.actorUid,
        displayName, phone: phone || person?.phone || null, sourceKinds,
        signals: Array.isArray(person?.signals) && person!.signals.length ? person!.signals : [directSignal],
        radarEligible: person?.radarEligible === undefined ? false : person.radarEligible,
        radarState: String(person?.radarState || 'active'), priority: Number(person?.priority ?? 99),
        salesStage: person?.salesStage || 'iniciar_conversa', importedAt: person?.importedAt || isoNow(this.now), updatedAt: isoNow(this.now),
      }});
      if (!person) existing.push({ id, displayName, phone, sourceKinds, signals: [directSignal], radarEligible: false });
      imported += 1;
    }
    if (!writes.length) throw new Error('CONTACTS_REQUIRED');
    await this.vault.writeMany(request.authToken, context.actorUid, writes);
    return { success: true, imported };
  }

"""
if marker not in s: raise SystemExit('service marker missing')
s=s.replace(marker, methods+marker, 1)
p.write_text(s)

# HTTP routes
p=Path('src/personal/radar/personalRadarHttp.ts'); s=p.read_text()
s=s.replace("  if (code === 'SEARCH_QUERY_INVALID') return 'Digite pelo menos dois caracteres para pesquisar.';", "  if (code === 'SEARCH_QUERY_INVALID') return 'Digite pelo menos dois caracteres para pesquisar.';\n  if (code === 'CONTACTS_REQUIRED') return 'Adicione pelo menos um contato válido.';")
marker="""  router.get('/radar', execute(async (req, res) => {"""
routes="""
  router.post('/imports/contacts', express.json({ limit: '512kb' }), execute(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = await service.importContacts(
      { authToken: authToken(req), organizationId: organizationId(req) },
      { contacts: Array.isArray(body.contacts) ? body.contacts as Array<{ name?: unknown; phone?: unknown }> : [] },
    );
    return res.status(201).json(result);
  }));

  router.get('/people', execute(async (req, res) => {
    const result = await service.getPeople({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

"""
if marker not in s: raise SystemExit('http marker missing')
s=s.replace(marker, routes+marker,1)
p.write_text(s)

# live surface policy test now includes the real People surface for governance users
p=Path('src/tests/liveSurfacePolicy.test.ts'); s=p.read_text()
s=s.replace("['overview', 'radar']", "['overview', 'radar', 'contacts']")
s=s.replace("governance live users see only real Core and Radar surfaces", "governance live users see real Core, Radar and People surfaces")
p.write_text(s)
