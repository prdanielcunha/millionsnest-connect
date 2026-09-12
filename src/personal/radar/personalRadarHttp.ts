import express from 'express';
import { PersonalRadarService, RadarComposerTone } from './personalRadarService';
import { ComposerChannel, ComposerObjective, ComposerStyle } from './composerPlaybook';

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
  const value = typeof header === 'string'
    ? header.trim()
    : typeof bodyValue === 'string'
      ? bodyValue.trim()
      : '';
  if (!value || value.length > 256 || value.includes('/') || value.includes('\\')) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return value;
}

function safeId(value: string): string {
  const clean = value.trim();
  if (!clean || clean.length > 180 || clean.includes('/') || clean.includes('\\') || clean === '.' || clean === '..') {
    throw new Error('INVALID_ID');
  }
  return clean;
}

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  if (code === 'AUTH_REQUIRED') return 401;
  if (['RADAR_CONTEXT_DENIED', 'RADAR_PILOT_FORBIDDEN', 'RADAR_TENANT_MISMATCH'].includes(code)) return 403;
  if (['PERSON_NOT_FOUND', 'SIGNAL_NOT_FOUND'].includes(code)) return 404;
  if (['IMPORT_FILE_SIZE_INVALID', 'IMPORT_MESSAGE_LIMIT_EXCEEDED'].includes(code)) return 413;
  if (code.startsWith('FIRESTORE_')) return 503;
  return 400;
}

function publicCode(error: unknown): string {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  if (code.startsWith('FIRESTORE_')) return 'PERSONAL_VAULT_UNAVAILABLE';
  if (code === 'RADAR_CONTEXT_DENIED') return 'RADAR_CONTEXT_DENIED';
  if (code === 'RADAR_PILOT_FORBIDDEN') return 'RADAR_PILOT_FORBIDDEN';
  if (code === 'RADAR_TENANT_MISMATCH') return 'RADAR_TENANT_MISMATCH';
  return code.replace(/[^A-Z0-9_]/g, '') || 'RADAR_REQUEST_FAILED';
}

function humanSummary(error: unknown): string {
  const code = publicCode(error);
  if (code === 'AUTH_REQUIRED') return 'Sua sessão precisa ser confirmada novamente.';
  if (code === 'RADAR_PILOT_FORBIDDEN') return 'O Radar ainda está em piloto privado para administração do ecossistema.';
  if (code === 'PERSONAL_VAULT_UNAVAILABLE') return 'Seu cofre pessoal está temporariamente indisponível.';
  if (code === 'WHATSAPP_FORMAT_UNRECOGNIZED') return 'Não reconhecemos este arquivo como uma exportação de conversa do WhatsApp.';
  if (code === 'WHATSAPP_TXT_NOT_FOUND') return 'O ZIP não contém um arquivo TXT de conversa do WhatsApp.';
  if (code === 'IMPORT_FILE_TYPE_INVALID') return 'Use uma exportação TXT ou ZIP do WhatsApp.';
  if (code === 'IMPORT_FILE_SIZE_INVALID') return 'O arquivo é grande demais para este piloto. Use uma exportação de até 5 MB.';
  if (code === 'IMPORT_MESSAGE_LIMIT_EXCEEDED') return 'A conversa ultrapassa o limite de mensagens deste piloto.';
  if (code === 'PERSON_NOT_FOUND') return 'Esta pessoa não foi encontrada no seu cofre pessoal.';
  if (code === 'SIGNAL_NOT_FOUND') return 'Este sinal não está mais disponível.';
  if (code === 'SEARCH_QUERY_INVALID') return 'Digite pelo menos dois caracteres para pesquisar.';
  if (code === 'CONTACTS_REQUIRED') return 'Adicione pelo menos um contato válido.';
  if (code === 'SNOOZE_DAYS_INVALID') return 'Escolha um adiamento entre 1 e 90 dias.';
  if (code === 'FOLLOW_UP_DAYS_INVALID') return 'Escolha um acompanhamento entre 1 e 90 dias.';
  if (code === 'SALES_STAGE_INVALID' || code === 'COMMERCIAL_ACTION_INVALID') return 'O estado comercial informado é inválido.';
  return 'Não foi possível concluir esta operação do Radar.';
}

export function createPersonalRadarRouter(service: PersonalRadarService) {
  const router = express.Router();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  const execute = (
    handler: (req: express.Request, res: express.Response) => Promise<unknown>,
  ) => async (req: express.Request, res: express.Response) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return res.status(statusFor(error)).json({
        success: false,
        code: publicCode(error),
        humanSummary: humanSummary(error),
      });
    }
  };

  router.post(
    '/imports/whatsapp',
    express.json({ limit: '8mb' }),
    execute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.importWhatsApp(
        { authToken: authToken(req), organizationId: organizationId(req) },
        {
          fileName: typeof body.fileName === 'string' ? body.fileName : '',
          contentBase64: typeof body.contentBase64 === 'string' ? body.contentBase64 : '',
          selfNames: Array.isArray(body.selfNames) ? body.selfNames as string[] : [],
        },
      );
      return res.status(result.status === 'deduplicated' ? 200 : 201).json({ success: true, ...result });
    }),
  );


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

  router.get('/radar', execute(async (req, res) => {
    const result = await service.getRadar({
      authToken: authToken(req),
      organizationId: organizationId(req),
    });
    return res.status(200).json({ success: true, ...result });
  }));

  router.get('/search', execute(async (req, res) => {
    const result = await service.search(
      { authToken: authToken(req), organizationId: organizationId(req) },
      typeof req.query.q === 'string' ? req.query.q : '',
    );
    return res.status(200).json({ success: true, ...result });
  }));

  router.patch(
    '/people/:personId',
    express.json({ limit: '32kb' }),
    execute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updatePerson(
        { authToken: authToken(req), organizationId: organizationId(req) },
        safeId(req.params.personId),
        {
          phone: typeof body.phone === 'string' ? body.phone : undefined,
          radarState: typeof body.radarState === 'string' ? body.radarState as any : undefined,
          snoozeDays: typeof body.snoozeDays === 'number' ? body.snoozeDays : undefined,
          salesStage: typeof body.salesStage === 'string' ? body.salesStage as ComposerObjective : undefined,
          commercialAction: typeof body.commercialAction === 'string' ? body.commercialAction as any : undefined,
          followUpDays: typeof body.followUpDays === 'number' ? body.followUpDays : undefined,
        },
      );
      return res.status(200).json(result);
    }),
  );

  router.post(
    '/opportunities/:personId/promote',
    express.json({ limit: '16kb' }),
    execute(async (req, res) => {
      const result = await service.promoteOpportunity(
        { authToken: authToken(req), organizationId: organizationId(req) },
        safeId(req.params.personId),
      );
      return res.status(200).json(result);
    }),
  );

  router.post(
    '/composer/draft',
    express.json({ limit: '32kb' }),
    execute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.compose(
        { authToken: authToken(req), organizationId: organizationId(req) },
        safeId(String(body.personId || '')),
        safeId(String(body.signalId || '')),
        String(body.tone || 'curto') as RadarComposerTone,
        {
          style: typeof body.style === 'string' ? body.style as ComposerStyle : undefined,
          channel: typeof body.channel === 'string' ? body.channel as ComposerChannel : undefined,
          objective: typeof body.objective === 'string' ? body.objective as ComposerObjective : undefined,
        },
      );
      return res.status(200).json({ success: true, ...result });
    }),
  );

  router.delete('/sources/:sourceId', execute(async (req, res) => {
    const result = await service.deleteSource(
      { authToken: authToken(req), organizationId: organizationId(req) },
      safeId(req.params.sourceId),
    );
    return res.status(200).json(result);
  }));

  return router;
}
