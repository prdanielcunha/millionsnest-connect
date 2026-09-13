import express from 'express';
import { PersonalRadarService } from './personalRadarService';
import { RadarCloudSyncService } from './radarCloudSyncService';

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

function statusFor(error: unknown): number {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  if (code === 'AUTH_REQUIRED') return 401;
  if (['RADAR_CONTEXT_DENIED', 'RADAR_PILOT_FORBIDDEN', 'RADAR_TENANT_MISMATCH'].includes(code)) return 403;
  if (code.startsWith('FIRESTORE_')) return 503;
  return 400;
}

function publicCode(error: unknown): string {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  if (code.startsWith('FIRESTORE_')) return 'PERSONAL_VAULT_UNAVAILABLE';
  return code.replace(/[^A-Z0-9_]/g, '') || 'RADAR_SYNC_FAILED';
}

export function createRadarCloudSyncRouter(
  sync: RadarCloudSyncService,
  radar: PersonalRadarService,
) {
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
        humanSummary: publicCode(error) === 'PERSONAL_VAULT_UNAVAILABLE'
          ? 'Seu cofre pessoal na nuvem está temporariamente indisponível.'
          : 'Não foi possível sincronizar o Radar com a nuvem.',
      });
    }
  };

  // This route intentionally mounts before the legacy /radar handler. Opening
  // Radar on any device first upgrades stale imported cloud data, then reads the
  // canonical Firestore result. Once the version marker is current this becomes
  // a cheap metadata read and does not repeat the migration.
  router.get('/radar', execute(async (req, res) => {
    const request = {
      authToken: authToken(req),
      organizationId: organizationId(req),
    };
    const cloudSync = await sync.ensureCurrent(request);
    const result = await radar.getRadar(request);
    return res.status(200).json({ success: true, ...result, cloudSync });
  }));

  router.post('/radar/reprocess', express.json({ limit: '8kb' }), execute(async (req, res) => {
    const request = {
      authToken: authToken(req),
      organizationId: organizationId(req),
    };
    const cloudSync = await sync.ensureCurrent(request, true);
    const result = await radar.getRadar(request);
    return res.status(200).json({ success: true, ...result, cloudSync });
  }));

  return router;
}
