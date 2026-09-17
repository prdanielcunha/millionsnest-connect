import { ConnectCoreService } from './connectCore';
import {
  FactRecordingMusicScaleReadTool,
  StructuredLogCoreFactPort,
} from './canonicalFacts';
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
 *
 * The real tool boundary is also decorated with the first canonical Fact
 * Stream events (TOOL_ACTION_REQUESTED / TOOL_ACTION_COMPLETED). The initial
 * sink is structured logging only, so no new database/event-bus dependency is
 * introduced before the shared persistence contract is finalized.
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

  const logger = options.logger ?? console;
  const musicScaleHttpTool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const facts = new StructuredLogCoreFactPort(logger);
  const musicScaleReadTool = new FactRecordingMusicScaleReadTool(
    musicScaleHttpTool,
    facts,
    logger,
  );

  const audit = new StructuredLogCoreAuditPort(logger);

  return new ConnectCoreService(contextProvider, musicScaleReadTool, audit);
}
