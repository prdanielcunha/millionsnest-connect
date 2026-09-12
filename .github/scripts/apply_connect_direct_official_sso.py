from pathlib import Path

bridge = Path('src/core/client/connectLaunchBridge.ts')
bridge.write_text("""const HUB_CONNECT_LAUNCH_URL = 'https://www.millionsnest.com/connect/launch';
const HUB_RECOVERABLE_BOOT_CODES = new Set([
  'HANDOFF_REQUIRED',
  'HANDOFF_INVALID',
  'HANDOFF_EXPIRED',
]);

export function buildHubConnectLaunchUrl(): string {
  return HUB_CONNECT_LAUNCH_URL;
}

export function shouldRedirectToHubConnectLaunch(errorCode: string): boolean {
  return HUB_RECOVERABLE_BOOT_CODES.has(errorCode);
}
""")

app = Path('src/App.tsx')
text = app.read_text()
anchor = "import { isGlobalGovernanceRole } from './core/roles/systemRoles';"
addition = anchor + "\nimport { buildHubConnectLaunchUrl, shouldRedirectToHubConnectLaunch } from './core/client/connectLaunchBridge';"
if anchor not in text:
    raise SystemExit('App import anchor not found')
text = text.replace(anchor, addition, 1)
old_catch = '''      .catch((error) => {
        if (!mounted) return;
        setLiveSession(null);
        setLiveBootErrorCode(safeBootstrapErrorCode(error));
        setLiveBootState('failed');
      });'''
new_catch = '''      .catch((error) => {
        if (!mounted) return;
        const errorCode = safeBootstrapErrorCode(error);
        if (shouldRedirectToHubConnectLaunch(errorCode)) {
          window.location.replace(buildHubConnectLaunchUrl());
          return;
        }
        setLiveSession(null);
        setLiveBootErrorCode(errorCode);
        setLiveBootState('failed');
      });'''
if old_catch not in text:
    raise SystemExit('App catch anchor not found')
text = text.replace(old_catch, new_catch, 1)
app.write_text(text)

test = Path('src/tests/liveConnectSession.test.ts')
text = test.read_text()
import_anchor = "import { bootstrapLiveConnectSession } from '../core/client/liveConnectSession';"
import_replacement = import_anchor + "\nimport { buildHubConnectLaunchUrl, shouldRedirectToHubConnectLaunch } from '../core/client/connectLaunchBridge';"
if import_anchor not in text:
    raise SystemExit('test import anchor not found')
text = text.replace(import_anchor, import_replacement, 1)
console_anchor = "console.log(`✅ Passed ${passed} / ${total} tests.`);"
checks = """equal(buildHubConnectLaunchUrl(), 'https://www.millionsnest.com/connect/launch', 'direct Connect boot uses canonical Hub launch bridge');
ok(shouldRedirectToHubConnectLaunch('HANDOFF_REQUIRED'), 'direct access without handoff redirects through Hub SSO');
ok(shouldRedirectToHubConnectLaunch('HANDOFF_EXPIRED'), 'expired handoff transparently revalidates through Hub');
ok(shouldRedirectToHubConnectLaunch('HANDOFF_INVALID'), 'invalid handoff is discarded and revalidated through Hub');
ok(!shouldRedirectToHubConnectLaunch('ORGANIZATION_ACCESS_DENIED'), 'authorization denial never becomes a redirect loop');

""" + console_anchor
if console_anchor not in text:
    raise SystemExit('test console anchor not found')
text = text.replace(console_anchor, checks, 1)
test.write_text(text)
