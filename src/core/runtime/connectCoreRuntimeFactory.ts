import { ConnectCoreService } from './connectCore';
import {
  CoreFactFanoutPort,
  FactRecordingMusicScaleReadTool,
  StructuredLogCoreFactPort,
} from './canonicalFacts';
import { InMemoryToolActivityReadModel } from './factReadModels';
import { HubSessionContextHttpProvider } from './hubSessionContextHttpProvider';
import { MusicScaleNextScheduleHttpTool } from './musicScaleNextScheduleHttpTool';
import { MusicScaleNextScheduleRepertoireHttpTool } from './musicScaleNextScheduleRepertoireHttpTool';
import { MusicScaleNextSchedulePresenceHttpTool } from './musicScaleNextSchedulePresenceHttpTool';
import { MusicScaleNextScheduleChartHttpTool } from './musicScaleNextScheduleChartHttpTool';
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

export interface ConnectCoreRuntimeBundle {
  core: ConnectCoreService;
  readModels: {
    toolActivity: InMemoryToolActivityReadModel;
  };
}

/**
 * Server-only composition root for the first real Connect Core vertical.
 *
 * No Firebase Admin credentials are introduced in Connect: Hub remains the
 * identity/RBAC authority and MusicScale independently revalidates the user's
 * Firebase bearer for its own read boundary.
 *
 * Canonical facts fan out to PII-safe structured logs and to the first minimal
 * deterministic read model. The projection is intentionally process-memory
 * only in this slice; no durable store is claimed until the shared persistence
 * contract is selected.
 */
export function createConnectCoreRuntimeBundle(
  options: ConnectCoreRuntimeFactoryOptions = {},
): ConnectCoreRuntimeBundle {
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
  const nextScheduleTool = new MusicScaleNextScheduleHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const nextRepertoireTool = new MusicScaleNextScheduleRepertoireHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const nextPresenceTool = new MusicScaleNextSchedulePresenceHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const nextChartTool = new MusicScaleNextScheduleChartHttpTool({
    musicScaleOrigin,
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const musicScaleHttpTool = {
    getNextSchedule: nextScheduleTool.getNextSchedule.bind(nextScheduleTool),
    getNextScheduleRepertoire:
      nextRepertoireTool.getNextScheduleRepertoire.bind(nextRepertoireTool),
    getNextSchedulePresence:
      nextPresenceTool.getNextSchedulePresence.bind(nextPresenceTool),
    getNextScheduleChart:
      nextChartTool.getNextScheduleChart.bind(nextChartTool),
  };

  const toolActivity = new InMemoryToolActivityReadModel();
  const facts = new CoreFactFanoutPort([
    new StructuredLogCoreFactPort(logger),
    toolActivity,
  ]);
  const musicScaleReadTool = new FactRecordingMusicScaleReadTool(
    musicScaleHttpTool,
    facts,
    logger,
  );

  const audit = new StructuredLogCoreAuditPort(logger);
  const core = new ConnectCoreService(contextProvider, musicScaleReadTool, audit);

  return {
    core,
    readModels: {
      toolActivity,
    },
  };
}

export function createConnectCoreRuntime(
  options: ConnectCoreRuntimeFactoryOptions = {},
): ConnectCoreService {
  return createConnectCoreRuntimeBundle(options).core;
}
