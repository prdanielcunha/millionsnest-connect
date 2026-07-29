import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeMenuTrigger,
  matchMenuTrigger,
  resolveDemoMenuProjection,
  staticOptionDefinitions,
  optionsLocalizedCatalog,
  DemoIdentityScenario,
  MenuOptionDefinition,
} from '../features/menu/menuDomain';
import { ConversationalMenuService } from '../core/services/conversationalMenu';
import { menuUxCatalog } from '../i18n/menuUx';
import { menuMobileReducer, initialMobileState, MenuMobileState } from '../features/menu/menuMobileState';
import { EffectiveEcosystemContext, ToolDefinition, EcosystemMembership, DemoAppAccess } from '../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;
let totalAssertions = 0;
let currentAssertions = 0;

function ensureTestHasAssertions(assertionCount: number): void {
  if (assertionCount === 0) {
    throw new Error('Test executed 0 assertions.');
  }
}

function runTest(name: string, fn: () => void): void {
  totalTests++;
  currentAssertions = 0;

  try {
    fn();
    ensureTestHasAssertions(currentAssertions);
    passedTests++;
    console.log(`✅ Test passed: ${name}`);
  } catch (error: unknown) {
    failedTests++;
    console.error(`❌ Test failed: ${name}`);
    console.error(error);
  }
}

function checkOk(condition: boolean, msg = 'Condition not satisfied'): void {
  totalAssertions++;
  currentAssertions++;

  if (!condition) {
    throw new Error(msg);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function checkEqual<T>(actual: T, expected: T, msg = ''): void {
  totalAssertions++;
  currentAssertions++;

  if (actual !== expected) {
    throw new Error(
      `${msg ? `${msg}: ` : ''}Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

// ------------------------------------------------------------------
// TEST DATA FOR PROJECTIONS
// ------------------------------------------------------------------

const cloneContext = (context: EffectiveEcosystemContext): EffectiveEcosystemContext => {
  return structuredClone(context) as EffectiveEcosystemContext;
};

// ------------------------------------------------------------------
const testBaseContext: EffectiveEcosystemContext = {
  mode: 'DEMO_MODE',
  user: {
    uid: 'test-user-999',
    name: 'Test User',
    email: 'test@millionsnest.com.invalid',
    capabilities: [],
  },
  activeOrganization: {
    id: 'test_org_01',
    name: 'Test Organization 01',
    slug: 'test-org-01',
    plan: 'pro',
    isDemo: true,
  },
  availableOrganizations: [
    {
      id: 'test_org_01',
      name: 'Test Organization 01',
      slug: 'test-org-01',
      plan: 'pro',
      isDemo: true,
    },
    {
      id: 'test_org_02',
      name: 'Test Organization 02',
      slug: 'test-org-02',
      plan: 'pro',
      isDemo: true,
    }
  ],
  memberships: [
    {
      id: 'test_mem_01',
      uid: 'test-user-999',
      organizationId: 'test_org_01',
      organizationName: 'Test Organization 01',
      status: 'active',
      permissions: ['musicscale.schedules.view', 'musicscale.schedules.manage'],
    }
  ],
  appAccess: [
    { appId: 'musicscale', access: true, capabilities: [] }
  ],
};

const testTools: ToolDefinition[] = [
  {
    id: 't1',
    appId: 'musicscale',
    name: 'listSchedules',
    version: '1.0.0',
    title: 'List Schedules',
    description: 'List',
    inputSchema: {},
    outputSchema: {},
    requiredPermissions: ['musicscale.schedules.view'],
    organizationScoped: true,
    riskLevel: 'R1_AUTH_READ',
    confirmationPolicy: 'none',
    readOnly: true,
    idempotencyPolicy: 'recommended',
    supportsPreview: true,
    supportsUndo: false,
    timeoutMs: 1000,
    auditEventType: 'AUDIT_LIST',
  },
  {
    id: 't2',
    appId: 'musicscale',
    name: 'createScheduleDraft',
    version: '1.0.0',
    title: 'Create Draft',
    description: 'Draft',
    inputSchema: {},
    outputSchema: {},
    requiredPermissions: ['musicscale.schedules.manage'],
    organizationScoped: true,
    riskLevel: 'R2_REVERSIBLE_WRITE',
    confirmationPolicy: 'explicit',
    readOnly: false,
    idempotencyPolicy: 'required',
    supportsPreview: true,
    supportsUndo: true,
    timeoutMs: 1000,
    auditEventType: 'AUDIT_CREATE',
  },
  {
    id: 't99',
    appId: 'musicscale',
    name: 'addSongToLivingLibrary',
    version: '1.0.0',
    title: 'Add Song',
    description: 'Add',
    inputSchema: {},
    outputSchema: {},
    requiredPermissions: ['livingLibrary.manage'],
    organizationScoped: false,
    riskLevel: 'R3_PRIVILEGED',
    confirmationPolicy: 'human_approval',
    readOnly: false,
    idempotencyPolicy: 'required',
    supportsPreview: false,
    supportsUndo: false,
    timeoutMs: 1000,
    auditEventType: 'AUDIT_CREATE',
  }
];

// ------------------------------------------------------------------
// RUN TESTS
// ------------------------------------------------------------------

// TRIGGER TESTS (1-30)

runTest('Locale match: menu + pt-BR -> pt-BR', () => {
  const match = matchMenuTrigger('menu', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'menu');
  checkEqual(match?.locale, 'pt-BR');
});
runTest('Locale match: menu + en-US -> en-US', () => {
  const match = matchMenuTrigger('menu', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'menu');
  checkEqual(match?.locale, 'en-US');
});
runTest('Locale match: menu + es-ES -> es-ES', () => {
  const match = matchMenuTrigger('menu', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'menu');
  checkEqual(match?.locale, 'es-ES');
});
runTest('Locale match: início + pt-BR -> pt-BR', () => {
  const match = matchMenuTrigger('início', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'início');
  checkEqual(match?.locale, 'pt-BR');
});
runTest('Locale match: inicio + es-ES -> es-ES', () => {
  const match = matchMenuTrigger('inicio', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'inicio');
  checkEqual(match?.locale, 'es-ES');
});
runTest('Locale match: 0 + pt-BR -> pt-BR', () => {
  const match = matchMenuTrigger('0', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '0');
  checkEqual(match?.locale, 'pt-BR');
});
runTest('Locale match: 0 + en-US -> en-US', () => {
  const match = matchMenuTrigger('0', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '0');
  checkEqual(match?.locale, 'en-US');
});
runTest('Locale match: 0 + es-ES -> es-ES', () => {
  const match = matchMenuTrigger('0', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '0');
  checkEqual(match?.locale, 'es-ES');
});
runTest('Locale match: # + pt-BR -> pt-BR', () => {
  const match = matchMenuTrigger('#', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '#');
  checkEqual(match?.locale, 'pt-BR');
});
runTest('Locale match: # + en-US -> en-US', () => {
  const match = matchMenuTrigger('#', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '#');
  checkEqual(match?.locale, 'en-US');
});
runTest('Locale match: # + es-ES -> es-ES', () => {
  const match = matchMenuTrigger('#', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '#');
  checkEqual(match?.locale, 'es-ES');
});
runTest('Locale fallback: ajuda com preferredLocale en-US -> pt-BR', () => {
  const match = matchMenuTrigger('ajuda', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'ajuda');
  checkEqual(match?.locale, 'pt-BR');
});
runTest('Locale fallback: help com preferredLocale pt-BR -> en-US', () => {
  const match = matchMenuTrigger('help', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'help');
  checkEqual(match?.locale, 'en-US');
});
runTest('Locale fallback: ayuda com preferredLocale en-US -> es-ES', () => {
  const match = matchMenuTrigger('ayuda', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'ayuda');
  checkEqual(match?.locale, 'es-ES');
});

runTest('1. Trigger "menu" matches exactly', () => {
  const match = matchMenuTrigger('menu', 'pt-BR');
  checkOk(match !== null, 'Match should not be null');
  checkEqual(match?.canonicalTrigger, 'menu');
});

runTest('2. Trigger "ajuda" matches exactly', () => {
  const match = matchMenuTrigger('ajuda', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'ajuda');
});

runTest('3. Trigger "opções" matches exactly', () => {
  const match = matchMenuTrigger('opções', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'opções');
});

runTest('4. Trigger "opcoes" matches exactly', () => {
  const match = matchMenuTrigger('opcoes', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'opções');
});

runTest('5. Trigger "começar" matches exactly', () => {
  const match = matchMenuTrigger('começar', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'começar');
});

runTest('6. Trigger "comecar" matches exactly', () => {
  const match = matchMenuTrigger('comecar', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'começar');
});

runTest('7. Trigger "início" matches exactly', () => {
  const match = matchMenuTrigger('início', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'início');
});

runTest('8. Trigger "inicio" matches exactly', () => {
  const match = matchMenuTrigger('inicio', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'início');
});

runTest('9. Trigger "help" matches exactly', () => {
  const match = matchMenuTrigger('help', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'help');
});

runTest('10. Trigger "options" matches exactly', () => {
  const match = matchMenuTrigger('options', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'options');
});

runTest('11. Trigger "start" matches exactly', () => {
  const match = matchMenuTrigger('start', 'en-US');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'start');
});

runTest('12. Trigger "ayuda" matches exactly', () => {
  const match = matchMenuTrigger('ayuda', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'ayuda');
});

runTest('13. Trigger "opciones" matches exactly', () => {
  const match = matchMenuTrigger('opciones', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'opciones');
});

runTest('14. Trigger "comenzar" matches exactly', () => {
  const match = matchMenuTrigger('comenzar', 'es-ES');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'comenzar');
});

runTest('15. Shortcut "0" matches exactly', () => {
  const match = matchMenuTrigger('0', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '0');
});

runTest('16. Shortcut "#" matches exactly', () => {
  const match = matchMenuTrigger('#', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, '#');
});

runTest('17. Uppercase trigger is matched', () => {
  const match = matchMenuTrigger('MENU', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'menu');
});

runTest('18. Outer spaces in trigger are removed', () => {
  const match = matchMenuTrigger('  começar   ', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'começar');
});

runTest('19. Diacritics are removed during normalization', () => {
  const norm = normalizeMenuTrigger('óptïmõ');
  checkEqual(norm, 'optimo');
});

runTest('20. Punctuation around trigger is handled correctly', () => {
  const match = matchMenuTrigger('menu!', 'pt-BR');
  checkOk(match !== null);
  checkEqual(match?.canonicalTrigger, 'menu');
});

runTest('21. Reject "submenu"', () => {
  const match = matchMenuTrigger('submenu', 'pt-BR');
  checkEqual(match, null);
});

runTest('22. Reject "helpful"', () => {
  const match = matchMenuTrigger('helpful', 'en-US');
  checkEqual(match, null);
});

runTest('23. Reject "opcional"', () => {
  const match = matchMenuTrigger('opcional', 'pt-BR');
  checkEqual(match, null);
});

runTest('24. Reject "opções extras"', () => {
  const match = matchMenuTrigger('opções extras', 'pt-BR');
  checkEqual(match, null);
});

runTest('25. Reject "começar agora"', () => {
  const match = matchMenuTrigger('começar agora', 'pt-BR');
  checkEqual(match, null);
});

runTest('26. Reject "menu123"', () => {
  const match = matchMenuTrigger('menu123', 'pt-BR');
  checkEqual(match, null);
});

runTest('27. Reject "10"', () => {
  const match = matchMenuTrigger('10', 'pt-BR');
  checkEqual(match, null);
});

runTest('28. Reject phone containing zero', () => {
  const match = matchMenuTrigger('+5500000000000', 'pt-BR');
  checkEqual(match, null);
});

runTest('29. Reject empty string', () => {
  const match = matchMenuTrigger('', 'pt-BR');
  checkEqual(match, null);
});

runTest('30. Reject spaces-only string', () => {
  const match = matchMenuTrigger('     ', 'pt-BR');
  checkEqual(match, null);
});

// RESPONSE TESTS (31-38)
runTest('31. True match contains matchedTrigger', () => {
  const res = ConversationalMenuService.getMenu({
    input: 'menu',
    locale: 'pt-BR',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(res.isTriggerMatch, true);
  checkEqual(res.matchedTrigger, 'menu');
});

runTest('32. No-match returns isTriggerMatch false', () => {
  const res = ConversationalMenuService.getMenu({
    input: 'something-invalid',
    locale: 'pt-BR',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(res.isTriggerMatch, false);
});

runTest('33. No-match has no matchedTrigger', () => {
  const res = ConversationalMenuService.getMenu({
    input: 'invalid',
    locale: 'pt-BR',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(res.matchedTrigger, undefined);
});

runTest('34. No-match returns empty options lists', () => {
  const res = ConversationalMenuService.getMenu({
    input: 'invalid',
    locale: 'pt-BR',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(res.publicOptions.length, 0);
  checkEqual(res.musicscaleAuthOptions.length, 0);
});

runTest('35. Action payloads remain identical across languages', () => {
  const ptRes = ConversationalMenuService.getMenu({
    input: 'menu',
    locale: 'pt-BR',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  const enRes = ConversationalMenuService.getMenu({
    input: 'menu',
    locale: 'en-US',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(ptRes.publicOptions[0].actionPayload, enRes.publicOptions[0].actionPayload);
});

runTest('36. Subtitles change based on selected locale', () => {
  const ptRes = ConversationalMenuService.getMenu({
    input: 'menu',
    locale: 'pt-BR',
    
    scenario: 'unlinked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  const enRes = ConversationalMenuService.getMenu({
    input: 'menu',
    locale: 'en-US',
    
    scenario: 'unlinked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkOk(ptRes.subtitle !== enRes.subtitle, 'Subtitles should be translated');
});

runTest('37. Invalid input does not return complete menu', () => {
  const res = ConversationalMenuService.getMenu({
    input: 'hello',
    locale: 'pt-BR',
    
    scenario: 'linked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(res.isTriggerMatch, false);
  checkEqual(res.publicOptions.length, 0);
});

runTest('38. Service does not mutate input', () => {
  const inputVal = '  AJUDA! ';
  ConversationalMenuService.getMenu({
    input: inputVal,
    locale: 'pt-BR',
    
    scenario: 'unlinked_demo',
    context: testBaseContext,
    tools: testTools,
  });
  checkEqual(inputVal, '  AJUDA! ');
});

// PROJECTION TESTS (39-56)
runTest('39. unlinked_demo displays public options only', () => {
  const results = resolveDemoMenuProjection(
    testBaseContext,
    'unlinked_demo',
    staticOptionDefinitions,
    testTools
  );
  const publicAllowed = staticOptionDefinitions
    .filter((o) => o.category === 'public')
    .every((o) => results[o.id].allowed === true);
  const protectedBlocked = staticOptionDefinitions
    .filter((o) => o.category === 'protected')
    .every((o) => results[o.id].allowed === false);

  checkOk(publicAllowed);
  checkOk(protectedBlocked);
});

runTest('40. linked_demo alone does not bypass membership check', () => {
  const emptyMemContext = { ...testBaseContext, memberships: [] };
  const results = resolveDemoMenuProjection(
    emptyMemContext,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  const opt = staticOptionDefinitions.find((o) => o.id === 'opt_ms_1');
  checkOk(opt !== undefined);
  checkEqual(results[opt!.id].allowed, false);
  checkEqual(results[opt!.id].reason, 'membership_missing');
});

runTest('41. Blocked if membership is absent', () => {
  const context = { ...testBaseContext, memberships: [] };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'membership_missing');
});

runTest('42. Blocked if membership is inactive', () => {
  const context = {
    ...testBaseContext,
    memberships: [
      {
        ...testBaseContext.memberships[0],
        status: 'inactive' as const,
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'membership_inactive');
});

runTest('43. Blocked if membership organization belongs to another tenant', () => {
  const context = {
    ...testBaseContext,
    memberships: [
      {
        ...testBaseContext.memberships[0],
        organizationId: 'different_org',
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'membership_missing');
});

runTest('44. Blocked if appAccess is absent', () => {
  const context = { ...testBaseContext, appAccess: [] };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'app_access_missing');
});

runTest('45. Blocked if appAccess is false', () => {
  const context = {
    ...testBaseContext,
    appAccess: [{ appId: 'musicscale', access: false, capabilities: [] }],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'app_access_disabled');
});

runTest('46. Blocked if tool definition does not exist', () => {
  const results = resolveDemoMenuProjection(
    testBaseContext,
    'linked_demo',
    staticOptionDefinitions,
    [] // zero tools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'tool_missing');
});

runTest('47. Blocked if required permission is absent', () => {
  const context = {
    ...testBaseContext,
    memberships: [
      {
        ...testBaseContext.memberships[0],
        permissions: [], // no permissions
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'permission_missing');
});

runTest('48. Exact permission matches and allows projection', () => {
  const results = resolveDemoMenuProjection(
    testBaseContext,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, true);
});

runTest('49. Exact capability matches and allows projection', () => {
  const context = {
    ...testBaseContext,
    memberships: [
      {
        ...testBaseContext.memberships[0],
        permissions: [], // no direct permissions
      }
    ],
    appAccess: [
      {
        appId: 'musicscale',
        access: true,
        capabilities: ['musicscale.schedules.view'], // provided via capabilities
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, true);
});

runTest('50. Owner role does not bypass membership requirements', () => {
  const context = {
    ...testBaseContext,
    memberships: [
      {
        ...testBaseContext.memberships[0],
        organizationRole: 'owner',
        permissions: [], // empty permissions should still block
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'permission_missing');
});

runTest('51. Admin role does not bypass permissions', () => {
  const context = {
    ...testBaseContext,
    memberships: [
      {
        ...testBaseContext.memberships[0],
        organizationRole: 'admin',
        permissions: [],
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
});

runTest('52. systemRole does not bypass permissions', () => {
  const context = {
    ...testBaseContext,
    user: {
      ...testBaseContext.user,
      systemRole: 'global_admin' as const,
    },
    memberships: [
      {
        ...testBaseContext.memberships[0],
        permissions: [],
      }
    ],
  };
  const results = resolveDemoMenuProjection(
    context,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
});

runTest('53. Original context is not mutated', () => {
  const serializedBefore = JSON.stringify(testBaseContext);
  resolveDemoMenuProjection(
    testBaseContext,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(JSON.stringify(testBaseContext), serializedBefore);
});

runTest('54. Changed active organization recalculates options', () => {
  // Let's change active organization to test_org_02, which test-user-999 has no membership for
  const changedContext = {
    ...testBaseContext,
    activeOrganization: {
      id: 'test_org_02',
      name: 'Test Org 02',
      slug: 'test-org-02',
      plan: 'pro',
      isDemo: true as const,
    },
  };
  const results = resolveDemoMenuProjection(
    changedContext,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_ms_1'].allowed, false);
  checkEqual(results['opt_ms_1'].reason, 'membership_missing');
});

runTest('55. Global option does not receive synthesized permissions', () => {
  const results = resolveDemoMenuProjection(
    testBaseContext,
    'unlinked_demo',
    staticOptionDefinitions,
    testTools
  );
  checkEqual(results['opt_pub_1'].allowed, true);
  checkEqual(results['opt_pub_1'].reason, undefined);
});


runTest('livingLibrary.manage policies', () => {
  const tool: ToolDefinition = {
    id: 't_ll',
    version: '1.0',
    title: 'Test',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    appId: 'musicscale',
    name: 'addSongToLivingLibrary',
    description: 'Add a song',
    requiredPermissions: ['livingLibrary.manage'],
    organizationScoped: false,
    riskLevel: 'R3_PRIVILEGED',
    confirmationPolicy: 'human_approval',
    readOnly: false,
    idempotencyPolicy: 'required',
    supportsUndo: false,
    supportsPreview: false,
    timeoutMs: 1000,
    auditEventType: 'test'
  };

  const optionDef: MenuOptionDefinition = {
    id: 'opt_test_ll',
    category: 'protected',
    numberKey: '9',
    actionPayload: 'test',
    requiresActiveMembership: true,
    appId: 'musicscale',
    toolName: 'addSongToLivingLibrary'
  };

  // 1. Without permission
  const c1 = cloneContext(testBaseContext);
  c1.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [] }];
  c1.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const r1 = resolveDemoMenuProjection(c1, 'linked_demo', [optionDef], [tool]);
  checkEqual(r1['opt_test_ll'].allowed, false);
  checkEqual(r1['opt_test_ll'].reason, 'permission_missing');

  // Matrix of roles without permission
  // Owner
  const cOwner = cloneContext(testBaseContext);
  cOwner.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [], organizationRole: 'owner' }];
  cOwner.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const resOwner = resolveDemoMenuProjection(cOwner, 'linked_demo', [optionDef], [tool]);
  checkEqual(resOwner['opt_test_ll'].allowed, false);
  checkEqual(resOwner['opt_test_ll'].reason, 'permission_missing');

  // Admin
  const cAdmin = cloneContext(testBaseContext);
  cAdmin.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [], organizationRole: 'admin' }];
  cAdmin.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const resAdmin = resolveDemoMenuProjection(cAdmin, 'linked_demo', [optionDef], [tool]);
  checkEqual(resAdmin['opt_test_ll'].allowed, false);
  checkEqual(resAdmin['opt_test_ll'].reason, 'permission_missing');

  // ceo
  const cCeo = cloneContext(testBaseContext);
  cCeo.user = { ...cCeo.user, systemRole: 'ceo' };
  cCeo.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [] }];
  cCeo.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const resCeo = resolveDemoMenuProjection(cCeo, 'linked_demo', [optionDef], [tool]);
  checkEqual(resCeo['opt_test_ll'].allowed, false);
  checkEqual(resCeo['opt_test_ll'].reason, 'permission_missing');

  // global_admin
  const cGlobalAdmin = cloneContext(testBaseContext);
  cGlobalAdmin.user = { ...cGlobalAdmin.user, systemRole: 'global_admin' };
  cGlobalAdmin.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [] }];
  cGlobalAdmin.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const resGlobalAdmin = resolveDemoMenuProjection(cGlobalAdmin, 'linked_demo', [optionDef], [tool]);
  checkEqual(resGlobalAdmin['opt_test_ll'].allowed, false);
  checkEqual(resGlobalAdmin['opt_test_ll'].reason, 'permission_missing');

  // ecosystem_owner
  const cEcosystemOwner = cloneContext(testBaseContext);
  cEcosystemOwner.user = { ...cEcosystemOwner.user, systemRole: 'ecosystem_owner' };
  cEcosystemOwner.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [] }];
  cEcosystemOwner.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const resEcosystemOwner = resolveDemoMenuProjection(cEcosystemOwner, 'linked_demo', [optionDef], [tool]);
  checkEqual(resEcosystemOwner['opt_test_ll'].allowed, false);
  checkEqual(resEcosystemOwner['opt_test_ll'].reason, 'permission_missing');

  // founder
  const cFounder = cloneContext(testBaseContext);
  cFounder.user = { ...cFounder.user, systemRole: 'founder' };
  cFounder.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [] }];
  cFounder.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  const resFounder = resolveDemoMenuProjection(cFounder, 'linked_demo', [optionDef], [tool]);
  checkEqual(resFounder['opt_test_ll'].allowed, false);
  checkEqual(resFounder['opt_test_ll'].reason, 'permission_missing');

  // With permission in membership
  const cPerm = cloneContext(testBaseContext);
  cPerm.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: ['livingLibrary.manage'] }];
  cPerm.appAccess = [{ appId: 'musicscale', access: true, capabilities: [] }];
  
  // Immutability test setup for cPerm
  const cPermPermissionsReference = cPerm.memberships[0].permissions;
  const cPermPermissionsSnapshot = [...cPermPermissionsReference];
  
  const resPerm = resolveDemoMenuProjection(cPerm, 'linked_demo', [optionDef], [tool]);
  checkEqual(resPerm['opt_test_ll'].allowed, false);
  checkEqual(resPerm['opt_test_ll'].reason, 'global_policy_unavailable');
  checkEqual(cPerm.memberships[0].permissions, cPermPermissionsReference, 'cPerm permissions reference changed');
  checkEqual(JSON.stringify(cPerm.memberships[0].permissions), JSON.stringify(cPermPermissionsSnapshot), 'cPerm permissions content changed');

  // With capability in appAccess
  const cCap = cloneContext(testBaseContext);
  cCap.memberships = [{ id: 'm1', organizationName: 'org1', uid: 'test-user-999', organizationId: 'test_org_01', status: 'active', permissions: [] }];
  cCap.appAccess = [{ appId: 'musicscale', access: true, capabilities: ['livingLibrary.manage'] }];
  
  // Immutability test setup for cCap
  const cCapCapabilitiesReference = cCap.appAccess[0].capabilities;
  const cCapCapabilitiesSnapshot = [...cCapCapabilitiesReference];
  
  const resCap = resolveDemoMenuProjection(cCap, 'linked_demo', [optionDef], [tool]);
  checkEqual(resCap['opt_test_ll'].allowed, false);
  checkEqual(resCap['opt_test_ll'].reason, 'global_policy_unavailable');
  checkEqual(cCap.appAccess[0].capabilities, cCapCapabilitiesReference, 'cCap capabilities reference changed');
  checkEqual(JSON.stringify(cCap.appAccess[0].capabilities), JSON.stringify(cCapCapabilitiesSnapshot), 'cCap capabilities content changed');
});
runTest('Structural checks and hardcoded removals', () => {
  const pageTsx = fs.readFileSync('src/features/menu/ConversationalMenuPage.tsx', 'utf8');
  const serviceTs = fs.readFileSync('src/core/services/conversationalMenu.ts', 'utf8');
  const stateTs = fs.readFileSync('src/features/menu/menuMobileState.ts', 'utf8');

  // Hardcoded UI text removals
  checkEqual(pageTsx.includes('App:'), false, 'App: still hardcoded');
  checkEqual(pageTsx.includes('Tool:'), false, 'Tool: still hardcoded');
  checkEqual(pageTsx.includes('ID:'), false, 'ID: still hardcoded');
  checkEqual(pageTsx.includes('N/A'), false, 'N/A still hardcoded');
  checkEqual(pageTsx.includes('<span>DEMO</span>'), false, 'DEMO still hardcoded');
  checkEqual(pageTsx.includes('<span></span>'), false, 'Empty span still exists');
  checkEqual(pageTsx.includes('notch mock'), false, 'notch mock still exists');

  // New structural and policy checks
  checkOk(/<section[^>]*aria-label=\{strings\.menuPreviewLabel\}/.test(pageTsx), 'menuPreviewLabel not semantically used in section');
  checkOk(pageTsx.includes('strings.actionNotExecuted'), 'actionNotExecuted not used');
  checkEqual((pageTsx.match(/placeholder=\{strings\.inputPlaceholder\}/g) || []).length, 1, 'inputPlaceholder not properly assigned to placeholder attribute');
  checkEqual((pageTsx.match(/strings\.inputPlaceholder/g) || []).length, 1, 'inputPlaceholder used in more places than just the input attribute');
  checkEqual(pageTsx.includes('proj.reason ==='), false, 'proj.reason === still used');
  checkEqual(pageTsx.includes('Blocked:'), false, 'Blocked: fallback still used');
  checkEqual(pageTsx.includes('as MenuProjectionReason'), false, 'as MenuProjectionReason still used');
  checkEqual(pageTsx.includes('MenuProjectionReason'), false, 'MenuProjectionReason imported or used in page');
  checkEqual((pageTsx.match(/getProjectionReasonText\(proj\.reason, strings\)/g) || []).length, 1, 'Exactly one getProjectionReasonText call expected');

  // Search script check
  checkEqual(fs.existsSync('search_checks.sh'), false, 'search_checks.sh still exists');

  // Domain structure checks
  const domainTs = fs.readFileSync('src/features/menu/menuDomain.ts', 'utf8');
  checkOk(domainTs.includes('reason?: MenuProjectionReason;'), 'ProjectedMenuOption.reason is not correctly typed');
  checkOk(domainTs.includes('reason: MenuProjectionReason | undefined'), 'getProjectionReasonText reason param not correctly typed');
  checkOk(domainTs.includes('strings: MenuUxStrings'), 'getProjectionReasonText strings param not correctly typed');
  checkEqual(domainTs.includes('any'), false, 'menuDomain.ts contains any');
  
  // Ux checks
  const uxTs = fs.readFileSync('src/i18n/menuUx.ts', 'utf8');
  checkOk(uxTs.includes('Datos técnicos de la acción:'), 'es-ES selectedActionPayload missing');
  checkEqual(uxTs.includes('Payload técnico da ação:'), true, 'pt-BR payload missing'); // ensure we didn't remove the pt-BR one
  checkEqual((uxTs.match(/Payload técnico da ação:/g) || []).length, 1, 'Too many Payload técnico da ação'); // Should be 1
  
  // Effect invalidating selectedAction
  checkOk(pageTsx.includes('setSelectedAction(null)'), 'setSelectedAction(null) not used in effect');
  checkOk(pageTsx.includes('userInput, currentLang, scenario, context.activeOrganization.id, channel'), 'useEffect invalidation lacks dependencies');

  // min-h-[44px]
  checkEqual(pageTsx.includes('min-h-[38px]'), false, 'min-h-[38px] found');
  
  // The test expects these elements to have min-h-[44px]
  checkOk((pageTsx.match(/min-h-\[44px\]/g) || []).length > 5, 'min-h-[44px] is not used enough');

  // channel in ConversationalMenuService
  checkEqual(serviceTs.includes('channel:'), false, 'channel still in service');

  // selectedOptionId in state
  checkEqual(stateTs.includes('selectedOptionId'), false, 'selectedOptionId still in state');
});

runTest('opt_ms_8 returns contract_missing', () => {
  const proj = resolveDemoMenuProjection(testBaseContext, 'linked_demo', staticOptionDefinitions, []);
  const result = proj['opt_ms_8'];
  checkOk(result !== undefined);
  checkEqual(result.allowed, false);
  checkEqual(result.reason, 'contract_missing');
});

runTest('57. Initial state is "configure"', () => {
  checkEqual(initialMobileState.activeView, 'configure');
});

runTest('58. OPEN_PREVIEW changes view to "preview"', () => {
  const state = menuMobileReducer(initialMobileState, { type: 'OPEN_PREVIEW' });
  checkEqual(state.activeView, 'preview');
});

runTest('59. OPEN_CONFIGURE returns view to "configure"', () => {
  const state = menuMobileReducer(
    { activeView: 'preview' },
    { type: 'OPEN_CONFIGURE' }
  );
  checkEqual(state.activeView, 'configure');
});

runTest('60. CHANGE_ORG resets state to "configure" and clears selected option', () => {
  const state = menuMobileReducer(
    { activeView: 'preview' },
    { type: 'CHANGE_ORG' }
  );
  checkEqual(state.activeView, 'configure');
  });

runTest('61. Reducer does not mutate the original state', () => {
  const originalState: MenuMobileState = { activeView: 'preview' };
  const serializedBefore = JSON.stringify(originalState);
  menuMobileReducer(originalState, { type: 'CHANGE_ORG' });
  checkEqual(JSON.stringify(originalState), serializedBefore);
});

// STATIC STRUCTURAL UNIT TESTS (62-86)
const appTsx = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
const pageTsx = fs.readFileSync(path.join(process.cwd(), 'src/features/menu/ConversationalMenuPage.tsx'), 'utf8');
const domainTs = fs.readFileSync(path.join(process.cwd(), 'src/features/menu/menuDomain.ts'), 'utf8');
const packageJson = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');

runTest('62. App passes context prop', () => {
  checkOk(appTsx.includes('context={context}'));
});

runTest('63. App passes currentLang prop', () => {
  checkOk(appTsx.includes('currentLang={currentLang}'));
});

runTest('64. ConversationalMenuPage specifies its prop types strictly', () => {
  checkOk(pageTsx.includes('interface ConversationalMenuPageProps'));
  checkOk(pageTsx.includes('React.FC<ConversationalMenuPageProps>'));
});

runTest('65. ConversationalMenuPage does not contain local isLinked state hook', () => {
  checkOk(!pageTsx.includes('const [isLinked,'));
});

runTest('66. ConversationalMenuPage does not claim synchronization with authentication', () => {
  checkOk(!pageTsx.includes('sincronizado com a autenticação'));
});

runTest('67. ConversationalMenuPage does not claim official verified account', () => {
  checkOk(!pageTsx.includes('Conta Oficial Verificada'));
});

runTest('68. ConversationalMenuPage contains no text-[9px]', () => {
  checkOk(!pageTsx.includes('text-[9px]'));
});

runTest('69. ConversationalMenuPage contains no text-[10px]', () => {
  checkOk(!pageTsx.includes('text-[10px]'));
});

runTest('70. ConversationalMenuPage contains no text-[11px]', () => {
  checkOk(!pageTsx.includes('text-[11px]'));
});

runTest('71. ConversationalMenuPage uses button tag for interactive menu items', () => {
  checkOk(pageTsx.includes('<button'));
});

runTest('72. ConversationalMenuPage has no cursor-pointer clickable divs', () => {
  checkOk(!pageTsx.includes('<div className="cursor-pointer"') && !pageTsx.includes('<div onClick={'));
});

runTest('73. Interactive items ensure minimum target size (e.g. min-h-[44px] or similar)', () => {
  checkOk(pageTsx.includes('min-h-[44px]') && !pageTsx.includes('min-h-[38px]'));
});

runTest('74. ConversationalMenuPage has no md:grid-cols-12 class', () => {
  checkOk(!pageTsx.includes('md:grid-cols-12'));
});

runTest('75. ConversationalMenuPage has lg:grid-cols-12 class', () => {
  checkOk(pageTsx.includes('lg:grid-cols-12'));
});

runTest('76. WhatsApp exists as a preview option', () => {
  checkOk(pageTsx.includes('whatsapp') || pageTsx.includes('WhatsApp'));
});

runTest('77. Instagram exists as a preview option', () => {
  checkOk(pageTsx.includes('instagram') || pageTsx.includes('Instagram'));
});

runTest('78. In-app exists as a preview option', () => {
  checkOk(pageTsx.includes('inapp') || pageTsx.includes('In-app'));
});

runTest('79. ToolGatewayService is not imported or used', () => {
  checkOk(!pageTsx.includes('ToolGatewayService') && !domainTs.includes('ToolGatewayService'));
});

runTest('80. prepareDemoToolInvocation is not used', () => {
  checkOk(!pageTsx.includes('prepareDemoToolInvocation') && !domainTs.includes('prepareDemoToolInvocation'));
});

runTest('81. classifyDemoToolFlow is not used', () => {
  checkOk(!pageTsx.includes('classifyDemoToolFlow') && !domainTs.includes('classifyDemoToolFlow'));
});

runTest('82. fetch is not used directly inside menu page', () => {
  checkOk(!pageTsx.includes('fetch(') && !domainTs.includes('fetch('));
});

runTest('83. window.alert is not used', () => {
  checkOk(!pageTsx.includes('alert('));
});

runTest('84. window.confirm is not used', () => {
  checkOk(!pageTsx.includes('confirm('));
});

runTest('85. window.prompt is not used', () => {
  checkOk(!pageTsx.includes('prompt('));
});

runTest('86. No extra npm dependencies have been added to package.json', () => {
  const pkg = JSON.parse(packageJson);
  const depKeys = Object.keys(pkg.dependencies || {});
  const expectedDeps = ['@google/genai', '@tailwindcss/vite', '@vitejs/plugin-react', 'lucide-react', 'react', 'react-dom', 'vite', 'express', 'dotenv', 'motion'];
  checkEqual(depKeys.length, expectedDeps.length);
  for (const d of expectedDeps) {
    checkOk(depKeys.includes(d));
  }

  const devDepKeys = Object.keys(pkg.devDependencies || {});
  const expectedDevDeps = ['@types/node', 'autoprefixer', 'esbuild', 'tailwindcss', 'tsx', 'typescript', 'vite', '@types/express'];
  checkEqual(devDepKeys.length, expectedDevDeps.length);
  for (const d of expectedDevDeps) {
    checkOk(devDepKeys.includes(d));
  }
});


runTest('87. Harness guard prevents zero assertions', () => {
  let threw = false;
  try {
    ensureTestHasAssertions(0);
  } catch (error: unknown) {
    if (getErrorMessage(error).includes('0 assertions')) {
      threw = true;
    }
  }
  checkEqual(threw, true);
  ensureTestHasAssertions(1); // Should not throw
});

runTest('testTools R1, R2, R3 policies', () => {
  const t1 = testTools.find(t => t.id === 't1');
  const t2 = testTools.find(t => t.id === 't2');
  const t99 = testTools.find(t => t.id === 't99');

  checkOk(!!t1, 't1 not found');
  checkEqual(t1.riskLevel, 'R1_AUTH_READ');
  checkEqual(t1.confirmationPolicy, 'none');

  checkOk(!!t2, 't2 not found');
  checkEqual(t2.riskLevel, 'R2_REVERSIBLE_WRITE');
  checkEqual(t2.confirmationPolicy, 'explicit');

  checkOk(!!t99, 't99 not found');
  checkEqual(t99.riskLevel, 'R3_PRIVILEGED');
  checkEqual(t99.confirmationPolicy, 'human_approval');
});

console.log(`\nTests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Total tests: ${totalTests}. Total assertions: ${totalAssertions}`);

if (failedTests > 0 || totalTests === 0 || totalAssertions === 0) {
  process.exit(1);
} else {
  process.exit(0);
}
