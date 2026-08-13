import { ToolGatewayService } from '../core/services/toolGateway';
import { mockChartDataset } from '../demo/chartDataset';
import { mockEcosystemContext, mockTools } from '../demo/mockData';

let passed = 0;
let total = 0;

function checkEqual(actual: unknown, expected: unknown, message: string) {
  total++;
  if (actual === expected) {
    passed++;
  } else {
    console.error(`❌ ${message} - Expected: ${String(expected)}, Actual: ${String(actual)}`);
    throw new Error(message);
  }
}

function checkNull(actual: unknown, message: string) {
  total++;
  if (actual === null) {
    passed++;
  } else {
    console.error(`❌ ${message} - Expected: null, Actual: ${String(actual)}`);
    throw new Error(message);
  }
}

console.log('--- Running Chart Tenant Resolution Tests ---');

const getSongChartTool = mockTools.find(tool => tool.name === 'getSongChart')!;
const transposeSongChartTool = mockTools.find(tool => tool.name === 'transposeSongChart')!;
const renderDocumentTool = mockTools.find(tool => tool.name === 'renderSongChartDocument')!;
const otherTenantSong = mockChartDataset.find(song => song.songId === 'song_demo_other_org')!;

const baseInvocationContext = {
  requestId: 'req_tenant_resolution',
  correlationId: 'corr_tenant_resolution',
  actor: { uid: 'demo-user-001' },
  organization: { id: 'org_londrina_01' },
  appAccess: { appId: 'musicscale', capabilities: [] },
  channel: { type: 'inapp', conversationId: 'conv_tenant_resolution' },
  locale: 'pt-BR'
};

const forbiddenOtherTenantValues = [
  otherTenantSong.title,
  otherTenantSong.artist!,
  otherTenantSong.lyrics,
  otherTenantSong.chords,
  otherTenantSong.organizationId!
];

const assertSongNotResolved = (data: unknown, message: string) => {
  const unresolved = data as { error?: string; details?: unknown };
  checkEqual(unresolved.error, 'Song not found or ambiguous', `${message}: generic not-found error`);
  checkNull(unresolved.details, `${message}: details are null`);
  const serialized = JSON.stringify(data);
  for (const forbiddenValue of forbiddenOtherTenantValues) {
    checkEqual(serialized.includes(forbiddenValue), false, `${message}: foreign chart data is omitted`);
  }
};

ToolGatewayService.resetDemoState();
const nonexistentResult = ToolGatewayService.invokeTool(
  mockEcosystemContext,
  getSongChartTool,
  { songId: 'song_does_not_exist' },
  { ...baseInvocationContext, requestId: 'req_tenant_nonexistent' }
);

for (const [tool, input, requestId] of [
  [getSongChartTool, { songId: otherTenantSong.songId }, 'req_tenant_get'],
  [transposeSongChartTool, { songId: otherTenantSong.songId, requestedKey: 'E' }, 'req_tenant_transpose'],
  [renderDocumentTool, { songId: otherTenantSong.songId }, 'req_tenant_document']
] as const) {
  const crossTenantResult = ToolGatewayService.invokeTool(
    mockEcosystemContext,
    tool,
    input,
    { ...baseInvocationContext, requestId }
  );

  checkEqual(crossTenantResult.result.status, 'success', `${tool.name}: existing DEMO_MODE status is preserved`);
  assertSongNotResolved(crossTenantResult.result.data, tool.name);
  checkEqual(
    JSON.stringify(crossTenantResult.result.data),
    JSON.stringify(nonexistentResult.result.data),
    `${tool.name}: cross-tenant lookup matches nonexistent lookup`
  );
}

for (const songId of ['song_demo_01', 'song_demo_02']) {
  const allowedResult = ToolGatewayService.invokeTool(
    mockEcosystemContext,
    getSongChartTool,
    { songId },
    { ...baseInvocationContext, requestId: `req_tenant_allowed_${songId}` }
  );
  checkEqual(allowedResult.result.status, 'success', `${songId}: legitimate gateway lookup succeeds`);
  checkEqual((allowedResult.result.data as any).resolvedSong.songId, songId, `${songId}: legitimate chart is delivered`);
}

ToolGatewayService.resetDemoState();
console.log(`✅ Passed ${passed} / ${total} tests.`);
