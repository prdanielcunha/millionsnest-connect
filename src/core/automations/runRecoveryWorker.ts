import { invokeAutomationRecoveryFromEnvironment } from './recoveryEnvironment';
// Secret Manager injection is required by the scheduler/container deployment.
// Never log credentials, transport exceptions or provider response bodies.
invokeAutomationRecoveryFromEnvironment(process.env)
  .then(result => console.log(JSON.stringify({ event: 'connect_automation_recovery_evaluated', processed: result.processed })))
  .catch(() => { console.error('CONNECT_AUTOMATION_RECOVERY_FAILED'); process.exitCode = 1; });
