import { mapHubConnectSessionContext } from '../core/runtime/hubSessionContextAdapter';

let passed = 0;
let total = 0;

function checkEqual(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual !== expected) {
    console.error(`❌ ${message} - Expected: ${String(expected)}, Actual: ${String(actual)}`);
    throw new Error(message);
  }
  passed++;
}

console.log('--- Running Hub Connect Session Context Adapter Tests ---');

{
  const result = mapHubConnectSessionContext({
    success: false,
    protocolVersion: '1.0.0',
  });
  checkEqual(result.status, 'identity_required', 'failed Hub payload requires identity');
}

{
  const result = mapHubConnectSessionContext({
    success: true,
    protocolVersion: '1.0.0',
    user: { uid: 'user_01', systemRole: 'user', capabilities: [] },
    globalAccess: false,
    activeOrganizationId: null,
    activeOrganization: null,
    appAccess: null,
  });
  checkEqual(result.status, 'organization_required', 'missing active organization requests organization context');
}

{
  const result = mapHubConnectSessionContext({
    success: true,
    protocolVersion: '1.0.0',
    user: { uid: 'user_01', systemRole: 'user', capabilities: ['user.capability'] },
    globalAccess: false,
    activeOrganizationId: 'org_01',
    activeOrganization: {
      id: 'org_02',
      organizationRole: 'member',
      permissions: ['musicscale.schedules.view'],
      capabilities: [],
    },
    appAccess: null,
  });
  checkEqual(result.status, 'denied', 'Hub active organization mismatch fails closed');
}

{
  const result = mapHubConnectSessionContext({
    success: true,
    protocolVersion: '1.0.0',
    user: { uid: 'user_01', systemRole: 'user', capabilities: ['user.capability'] },
    globalAccess: false,
    activeOrganizationId: 'org_01',
    activeOrganization: {
      id: 'org_01',
      organizationRole: 'member',
      permissions: ['musicscale.schedules.view'],
      capabilities: ['org.capability'],
    },
    appAccess: {
      musicscale: {
        appId: 'musicscale',
        organizationId: 'org_02',
        accessible: true,
        decisionState: 'granted',
      },
    },
  });
  checkEqual(result.status, 'denied', 'MusicScale app access from another tenant fails closed');
}

{
  const result = mapHubConnectSessionContext({
    success: true,
    protocolVersion: '1.0.0',
    user: {
      uid: 'user_01',
      systemRole: 'ceo',
      capabilities: ['ecosystem.read', 'ecosystem.read'],
    },
    globalAccess: true,
    activeOrganizationId: 'org_01',
    activeOrganization: {
      id: 'org_01',
      organizationRole: null,
      permissions: [],
      capabilities: ['org.read'],
    },
    appAccess: {
      musicscale: {
        appId: 'musicscale',
        organizationId: 'org_01',
        accessible: true,
        decisionState: 'granted',
      },
    },
  });

  checkEqual(result.status, 'resolved', 'valid canonical Hub response resolves');
  if (result.status === 'resolved') {
    checkEqual(result.context.actorUid, 'user_01', 'actor uid comes from Hub user');
    checkEqual(result.context.organizationId, 'org_01', 'organization id comes from Hub active organization');
    checkEqual(result.context.globalAccess, true, 'global access remains explicit evidence');
    checkEqual(result.context.appAccess.musicscale, true, 'MusicScale access is mapped only from granted Hub appAccess');
    checkEqual(result.context.capabilities.length, 2, 'capabilities are deduplicated across canonical Hub scopes');
  }
}

console.log(`✅ Passed ${passed} / ${total} tests.`);
