from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# 1) Service: persist message models in the existing owner-scoped Firestore personal vault.
service_path = Path('src/personal/radar/personalRadarService.ts')
service = service_path.read_text()
service = replace_once(
    service,
    "const COMMERCIAL_ACTIONS = new Set(['whatsapp_opened', 'sent_manual', 'copied']);\n",
    "const COMMERCIAL_ACTIONS = new Set(['whatsapp_opened', 'sent_manual', 'copied']);\nconst MESSAGE_MODEL_TONES = new Set<RadarComposerTone>(['curto', 'conversa', 'audio', 'video']);\n",
    'service tone set',
)
service_methods = r'''
  async listMessageModels(request: RadarRequestContext) {
    const context = await this.resolvePilotContext(request);
    const models = await this.vault.list(request.authToken, context.actorUid, ['messageModels'], 100);
    const ordered = models
      .filter(model => typeof model.text === 'string' && typeof model.label === 'string')
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 30);
    return { models: ordered, count: ordered.length };
  }

  async saveMessageModel(
    request: RadarRequestContext,
    input: { label?: unknown; text?: unknown; objective?: ComposerObjective; tone?: RadarComposerTone },
  ) {
    const context = await this.resolvePilotContext(request);
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text || text.length > 4_000) throw new Error('MESSAGE_MODEL_TEXT_INVALID');
    if (!input.objective || !SALES_STAGES.has(input.objective)) throw new Error('MESSAGE_MODEL_OBJECTIVE_INVALID');
    if (!input.tone || !MESSAGE_MODEL_TONES.has(input.tone)) throw new Error('MESSAGE_MODEL_TONE_INVALID');
    const label = (typeof input.label === 'string' ? input.label.trim() : '').slice(0, 120) || input.objective;
    const createdAt = isoNow(this.now);
    const id = `mdl_${crypto.createHash('sha256')
      .update(`${context.actorUid}|${createdAt}|${text}|${crypto.randomUUID()}`)
      .digest('hex').slice(0, 24)}`;
    const model = {
      id,
      ownerUid: context.actorUid,
      label,
      text,
      objective: input.objective,
      tone: input.tone,
      createdAt,
      updatedAt: createdAt,
      privacyScope: 'owner_only',
    };

    const existing = await this.vault.list(request.authToken, context.actorUid, ['messageModels'], 100);
    const excess = [...existing]
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .slice(0, Math.max(0, existing.length - 29));
    if (excess.length) {
      await this.vault.deleteMany(
        request.authToken,
        context.actorUid,
        excess.map(item => ['messageModels', String(item.id)]),
      );
    }
    await this.vault.writeMany(request.authToken, context.actorUid, [{ path: ['messageModels', id], data: model }]);
    return { success: true, model };
  }

  async deleteMessageModel(request: RadarRequestContext, modelId: string) {
    const context = await this.resolvePilotContext(request);
    const model = await this.vault.get(request.authToken, context.actorUid, ['messageModels', modelId]);
    if (!model) return { success: true, deleted: false };
    await this.vault.deleteMany(request.authToken, context.actorUid, [['messageModels', modelId]]);
    return { success: true, deleted: true };
  }

'''
service = replace_once(service, "  async deleteSource(request: RadarRequestContext, sourceId: string) {", service_methods + "  async deleteSource(request: RadarRequestContext, sourceId: string) {", 'service methods')
service_path.write_text(service)

# 2) HTTP API.
http_path = Path('src/personal/radar/personalRadarHttp.ts')
http = http_path.read_text()
http = replace_once(
    http,
    "  if (code === 'SALES_STAGE_INVALID' || code === 'COMMERCIAL_ACTION_INVALID') return 'O estado comercial informado é inválido.';\n",
    "  if (code === 'SALES_STAGE_INVALID' || code === 'COMMERCIAL_ACTION_INVALID') return 'O estado comercial informado é inválido.';\n  if (code.startsWith('MESSAGE_MODEL_')) return 'Não foi possível salvar este modelo de mensagem.';\n",
    'http error summary',
)
http_routes = r'''
  router.get('/message-models', execute(async (req, res) => {
    const result = await service.listMessageModels({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

  router.post('/message-models', express.json({ limit: '32kb' }), execute(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = await service.saveMessageModel(
      { authToken: authToken(req), organizationId: organizationId(req) },
      {
        label: body.label,
        text: body.text,
        objective: typeof body.objective === 'string' ? body.objective as ComposerObjective : undefined,
        tone: typeof body.tone === 'string' ? body.tone as RadarComposerTone : undefined,
      },
    );
    return res.status(201).json(result);
  }));

  router.delete('/message-models/:modelId', execute(async (req, res) => {
    const result = await service.deleteMessageModel(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.modelId),
    );
    return res.status(200).json(result);
  }));

'''
http = replace_once(http, "  router.post(\n    '/composer/draft',", http_routes + "  router.post(\n    '/composer/draft',", 'http message model routes')
http_path.write_text(http)

# 3) Browser client.
client_path = Path('src/core/client/personalRadarClient.ts')
client = client_path.read_text()
client = replace_once(
    client,
    "export type RadarClientPerson = {",
    "export type SavedMessageModel = {\n  id: string;\n  label: string;\n  text: string;\n  objective: 'iniciar_conversa' | 'descobrir_dor' | 'contar_historia' | 'pedir_video' | 'enviar_video' | 'diagnosticar' | 'explicar_dor' | 'convidar_trial' | 'acompanhar_trial' | 'retomar_conversa' | 'fechar';\n  tone: 'curto' | 'conversa' | 'audio' | 'video';\n  createdAt: string;\n  updatedAt?: string;\n};\n\nexport type RadarClientPerson = {",
    'client model type',
)
client_methods = r'''
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

'''
client = replace_once(client, "  async deleteSource(sourceId: string) {", client_methods + "  async deleteSource(sourceId: string) {", 'client methods')
client_path.write_text(client)

# 4) People UI: cloud load/save, with one-time migration of legacy device-only models.
ui_path = Path('src/features/contacts/LivePeoplePage.tsx')
ui = ui_path.read_text()
old_effect = r'''  const storageKey = `mn-connect-message-models:${session.actorUid || 'me'}`;
  useEffect(() => {
    try { setModels(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { setModels([]); }
  }, [storageKey]);
'''
new_effect = r'''  const storageKey = `mn-connect-message-models:${session.actorUid || 'me'}`;
  useEffect(() => {
    let active = true;
    const loadCloudModels = async () => {
      try {
        let remote = await client.getMessageModels();
        let cloud = remote.models as SavedModel[];
        let legacy: SavedModel[] = [];
        try {
          const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
          legacy = Array.isArray(parsed) ? parsed.slice(0, 30) : [];
        } catch { legacy = []; }
        if (legacy.length) {
          for (const model of legacy) {
            const duplicate = cloud.some(item => item.text === model.text && item.objective === model.objective && item.tone === model.tone);
            if (!duplicate && model.text && model.objective && model.tone) {
              await client.saveMessageModel({ label: model.label || 'Modelo migrado', text: model.text, objective: model.objective, tone: model.tone });
            }
          }
          localStorage.removeItem(storageKey);
          remote = await client.getMessageModels();
          cloud = remote.models as SavedModel[];
        }
        if (active) setModels(cloud);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar os modelos da nuvem.');
      }
    };
    void loadCloudModels();
    return () => { active = false; };
  }, [client, storageKey]);
'''
ui = replace_once(ui, old_effect, new_effect, 'ui cloud load effect')
old_save = r'''  const saveModel = () => {
    if (!draft.trim()) return;
    const item: SavedModel = { id: `${Date.now()}`, label: `${label(currentStage, currentLang)} · ${tone}`, text: draft.trim(), objective, tone, createdAt: new Date().toISOString() };
    const next = [item, ...models].slice(0, 30); setModels(next); localStorage.setItem(storageKey, JSON.stringify(next)); setNotice('Modelo salvo neste dispositivo.');
  };
'''
new_save = r'''  const saveModel = async () => {
    if (!draft.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await client.saveMessageModel({
        label: `${label(currentStage, currentLang)} · ${tone}`,
        text: draft.trim(),
        objective,
        tone,
      });
      setModels(previous => [result.model as SavedModel, ...previous.filter(item => item.id !== result.model.id)].slice(0, 30));
      localStorage.removeItem(storageKey);
      setNotice('Modelo salvo na nuvem do Firebase.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o modelo na nuvem.');
    } finally { setBusy(false); }
  };
'''
ui = replace_once(ui, old_save, new_save, 'ui cloud save')
ui = replace_once(ui, "models: 'Modelos salvos'", "models: 'Modelos na nuvem'", 'pt cloud label')
ui = replace_once(ui, "models: 'Modelos guardados'", "models: 'Modelos en la nube'", 'es cloud label')
ui = replace_once(ui, "models: 'Saved models'", "models: 'Cloud models'", 'en cloud label')
ui = replace_once(ui, "<button onClick={saveModel} disabled={!draft}", "<button onClick={()=>void saveModel()} disabled={!draft||busy}", 'ui save click')
ui_path.write_text(ui)

# 5) Regression test for owner-scoped cloud message models.
test_path = Path('src/tests/personalRadarService.test.ts')
test = test_path.read_text()
anchor = "  let invalidStageRejected = false;\n"
model_test = r'''  const savedModel = await service.saveMessageModel(request, {
    label: 'Descoberta · curto',
    text: 'Oi! Como vocês organizam hoje as escalas do louvor?',
    objective: 'descobrir_dor',
    tone: 'curto',
  });
  equal(savedModel.success, true, 'message model is persisted in the owner-scoped cloud vault');
  assert(vault.records.has(`messageModels/${savedModel.model.id}`), 'message model is stored under the personal Firestore vault');
  const cloudModels = await service.listMessageModels(request);
  equal(cloudModels.count, 1, 'saved message models are loaded from the cloud vault');
  equal((cloudModels.models[0] as any).text, 'Oi! Como vocês organizam hoje as escalas do louvor?', 'cloud model preserves message text');
  const removedModel = await service.deleteMessageModel(request, savedModel.model.id);
  equal(removedModel.deleted, true, 'cloud message model can be deleted');
  equal((await service.listMessageModels(request)).count, 0, 'deleted cloud model no longer appears');

'''
test = replace_once(test, anchor, model_test + anchor, 'model persistence test')
test_path.write_text(test)

print('cloud message model patch applied')
