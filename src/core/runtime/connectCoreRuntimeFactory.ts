import { ConnectCoreService } from './connectCore';
import { HubSessionContextHttpProvider } from './hubSessionContextHttpProvider';
import { MusicScaleNextScheduleHttpTool } from './musicScaleNextScheduleHttpTool';
import {
  StructuredCoreAuditLogger,
  StructuredLogCoreAuditPort,
} from './structuredCoreAudit';

export interface ConnectCoreRuntimeEnvironment {
  MILLIONSNEST_HUB_ORIGIN?: string;
  MUSICSCALE_ORIGIN?: string;
}

export interface ConnectCoreRuntimeFactoryOptions {
  env?: ConnectCoreRuntimeEnvironment;
  logger?: StructuredCoreAuditLogger;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Server-only composition root for the first real Connect Core vertical.
 *
 * No Firebase Admin credentials are introduced in Connect: Hub remains the
 * identity/RBAC authority and MusicScale independently revalidates the user's
 * Firebase bearer for its own read boundary.
 */
export function createConnectCoreRuntime(
  options: ConnectCoreRuntimeFactoryOptions = {},
): ConnectCoreService {
  const env = options.env ?? process.env;
  const hubOrigin = env.MILLIONSNEST_HUB_ORIGIN?.trim();
  const musicScaleOrigin = env.MUSICSCALE_ORIGIN?.trim();

  if (!hubOrigin) {
    throw new Error('MILLIONSNEST_HUB_ORIGIN is required for Connect Core runtime.');
  }
  if (!musicScaleOrigin) {
    throw new Error('MUSICSCALE_ORIGIN is required for Connect Core runtime.');
  }

  const fetchImpl = options.fetchImpl
    ? ((input: string, init: any) => options.fetchImpl!(input, init) as any)
    : undefined;

  const contextProvider = new HubSessionContextHttpProvider({
    hubOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });

  const musicScaleReadTool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });

  const audit = new StructuredLogCoreAuditPort(options.logger ?? console);

  return new ConnectCoreService(contextProvider, musicScaleReadTool, audit);
}
