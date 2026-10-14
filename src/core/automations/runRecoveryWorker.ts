import { invokeAutomationRecovery } from './recoveryInvoker';
// Secret Manager injection is required by the scheduler/container deployment.
// Never log credentials, transport exceptions or provider response bodies.
invokeAutomationRecovery({ origin: process.env.CONNECT_AUTOMATION_RECOVERY_ORIGIN ?? '', secret: process.env.CONNECT_AUTOMATION_WORKER_SECRET ?? '' })
  .then(result => console.log(JSON.stringify({ event: 'connect_automation_recovery_evaluated', processed: result.processed })))
  .catch(() => { console.error('CONNECT_AUTOMATION_RECOVERY_FAILED'); process.exitCode = 1; });
