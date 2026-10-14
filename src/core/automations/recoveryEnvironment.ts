import { resolveExecutionSecretBundle } from '../../server/executionSecretBundle';
import { invokeAutomationRecovery } from './recoveryInvoker';

/** Reuse the API's validated mount; secrets stay transient and never become logs. */
export async function invokeAutomationRecoveryFromEnvironment(
  env: Record<string, string | undefined>,
  options: { load?: (path: string) => string; fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<{ processed: number }> {
  const resolved = resolveExecutionSecretBundle(env, options.load);
  return invokeAutomationRecovery({
    origin: resolved.CONNECT_AUTOMATION_RECOVERY_ORIGIN ?? '',
    secret: resolved.CONNECT_AUTOMATION_WORKER_SECRET ?? '',
    fetchImpl: options.fetchImpl,
    now: options.now,
  });
}
