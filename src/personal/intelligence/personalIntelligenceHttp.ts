import express from 'express';
import { AudienceDefinition, PersonalIntelligenceService } from './personalIntelligenceService';

function authToken(req: express.Request): string {
  const raw = req.headers.authorization;
  if (typeof raw !== 'string' || !/^Bearer\s+\S+$/i.test(raw.trim())) throw new Error('AUTH_REQUIRED');
  return raw.trim();
}

function organizationId(req: express.Request): string {
  const header = req.headers['x-organization-id'];
  const bodyValue = req.body && typeof req.body === 'object'
    ? (req.body as Record<string, unknown>).organizationId
    : undefined;
  const value = typeof header === 'string' ? header.trim() : typeof bodyValue === 'string' ? bodyValue.trim() : '';
  if (!value || value.length > 256 || value.includes('/') || value.includes('\\')) throw new Error('ORGANIZATION_REQUIRED');
  return value;
}

function safeId(value: string): string {
  const clean = value.trim();
  if (!clean || clean.length > 180 || clean.includes('/') || clean.includes('\\') || clean === '.' || clean === '..') throw new Error('INVALID_ID');
  return clean;
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  if (code === 'AUTH_REQUIRED') return 401;
  if (['RADAR_CONTEXT_DENIED', 'RADAR_PILOT_FORBIDDEN', 'RADAR_TENANT_MISMATCH'].includes(code)) return 403;
  if (['PERSON_NOT_FOUND', 'SOURCE_NOT_FOUND'].includes(code)) return 404;
  if (code.startsWith('FIRESTORE_')) return 503;
  if (['VCARD_FILE_SIZE_INVALID'].includes(code)) return 413;
  return 400;
}

function publicCode(error: unknown): string {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  if (code.startsWith('FIRESTORE_')) return 'PERSONAL_VAULT_UNAVAILABLE';
  return code.replace(/[^A-Z0-9_]/g, '') || 'RELATIONSHIP_INTELLIGENCE_REQUEST_FAILED';
}

function humanSummary(error: unknown): string {
  const code = publicCode(error);
  const summaries: Record<string, string> = {
    AUTH_REQUIRED: 'Sua sessão precisa ser confirmada novamente.',
    RADAR_PILOT_FORBIDDEN: 'A Inteligência de Relacionamento ainda está restrita ao piloto privado.',
    PERSON_NOT_FOUND: 'Esta pessoa não foi encontrada no seu cofre pessoal.',
    PROBABLE_NAME_NOT_AVAILABLE: 'Não há um nome provável pendente para esta pessoa.',
    FOLLOW_UP_DATE_INVALID: 'Escolha uma data válida para o acompanhamento.',
    AUDIENCE_NAME_REQUIRED: 'Dê um nome para salvar esta audiência.',
    VCARD_FILE_TYPE_INVALID: 'Use um arquivo .vcf exportado dos Contatos.',
    VCARD_FILE_SIZE_INVALID: 'O arquivo de contatos é grande demais para esta importação.',
    VCARD_EMPTY: 'Não encontramos contatos válidos neste arquivo.',
    PERSONAL_VAULT_UNAVAILABLE: 'Seu cofre pessoal está temporariamente indisponível.',
  };
  return summaries[code] || 'Não foi possível concluir esta operação de Inteligência de Relacionamento.';
}

function definition(body: Record<string, unknown>): AudienceDefinition {
  return {
    sourceId: typeof body.sourceId === 'string' ? body.sourceId : undefined,
    query: typeof body.query === 'string' ? body.query : undefined,
    signalType: typeof body.signalType === 'string' ? body.signalType : undefined,
    activeWithinDays: typeof body.activeWithinDays === 'number' ? body.activeWithinDays : undefined,
    minMessages: typeof body.minMessages === 'number' ? body.minMessages : undefined,
    favoritesOnly: typeof body.favoritesOnly === 'boolean' ? body.favoritesOnly : undefined,
  };
}

export function createPersonalIntelligenceRouter(service: PersonalIntelligenceService) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  const execute = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) => async (req: express.Request, res: express.Response) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return res.status(statusFor(error)).json({ success: false, code: publicCode(error), humanSummary: humanSummary(error) });
    }
  };

  router.get('/identity/review', execute(async (req, res) => {
    const result = await service.getIdentityReview({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

  router.post('/people/:personId/probable-name', express.json({ limit: '16kb' }), execute(async (req, res) => {
    const action = (req.body as Record<string, unknown>).action;
    if (action !== 'confirm' && action !== 'reject') throw new Error('IDENTITY_REVIEW_ACTION_INVALID');
    const result = await service.reviewProbableName(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.personId),
      action,
    );
    return res.status(200).json(result);
  }));

  router.get('/people/:personId/timeline', execute(async (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 240;
    const result = await service.getTimeline(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.personId),
      limit,
    );
    return res.status(200).json({ success: true, ...result });
  }));

  router.post('/people/:personId/follow-up', express.json({ limit: '16kb' }), execute(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const action = body.action;
    if (!['schedule', 'complete', 'clear'].includes(String(action))) throw new Error('FOLLOW_UP_ACTION_INVALID');
    const result = await service.updateFollowUp(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.personId),
      {
        action: action as 'schedule' | 'complete' | 'clear',
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : undefined,
        note: typeof body.note === 'string' ? body.note : undefined,
      },
    );
    return res.status(200).json(result);
  }));

  router.get('/follow-ups', execute(async (req, res) => {
    const result = await service.listFollowUps({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

  router.post('/audiences/preview', express.json({ limit: '24kb' }), execute(async (req, res) => {
    const result = await service.previewAudience(
      { authToken: authToken(req), organizationId: organizationId(req) },
      definition(req.body as Record<string, unknown>),
    );
    return res.status(200).json({ success: true, ...result });
  }));

  router.get('/audiences', execute(async (req, res) => {
    const result = await service.listAudiences({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

  router.post('/audiences', express.json({ limit: '24kb' }), execute(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = await service.saveAudience(
      { authToken: authToken(req), organizationId: organizationId(req) },
      {
        id: typeof body.id === 'string' ? body.id : undefined,
        name: typeof body.name === 'string' ? body.name : '',
        definition: definition((body.definition && typeof body.definition === 'object') ? body.definition as Record<string, unknown> : {}),
      },
    );
    return res.status(200).json(result);
  }));

  router.delete('/audiences/:audienceId', execute(async (req, res) => {
    const result = await service.deleteAudience(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.audienceId),
    );
    return res.status(200).json(result);
  }));

  router.post('/contacts/vcard', express.json({ limit: '4mb' }), execute(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = await service.importVCard(
      { authToken: authToken(req), organizationId: organizationId(req) },
      {
        fileName: typeof body.fileName === 'string' ? body.fileName : '',
        contentBase64: typeof body.contentBase64 === 'string' ? body.contentBase64 : '',
      },
    );
    return res.status(201).json(result);
  }));

  router.get('/imports/health', execute(async (req, res) => {
    const result = await service.getImportHealth({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

  router.get('/capabilities', execute(async (req, res) => {
    const result = await service.getCapabilities({ authToken: authToken(req), organizationId: organizationId(req) });
    return res.status(200).json({ success: true, ...result });
  }));

  // Narrow, evidence-aware read gateway for a future authenticated ChatGPT connector.
  // It never sends messages and does not expose organization data outside the caller's personal vault.
  router.post('/tools/search-people', express.json({ limit: '24kb' }), execute(async (req, res) => {
    const result = await service.toolSearchPeople(
      { authToken: authToken(req), organizationId: organizationId(req) },
      definition(req.body as Record<string, unknown>),
    );
    return res.status(200).json({ success: true, ...result });
  }));

  router.get('/tools/people/:personId/context', execute(async (req, res) => {
    const result = await service.toolGetPersonContext(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.personId),
    );
    return res.status(200).json({ success: true, ...result });
  }));

  return router;
}
