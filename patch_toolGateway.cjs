const fs = require('fs');

let content = fs.readFileSync('src/core/services/toolGateway.ts', 'utf8');

// Add imports
if (!content.includes('evaluateZeroCostPolicy')) {
  content = content.replace(
    "import { mockAuditEvents } from '../../demo/mockData';",
    "import { mockAuditEvents } from '../../demo/mockData';\nimport { evaluateZeroCostPolicy, ZeroCostState, defaultZeroCostState } from '../policies/zeroCost/zeroCostPolicy';\nimport { resolveSongChart, generateChartDelivery, generateScheduleSongbook } from './chartDelivery';"
  );
}

// Add state property
if (!content.includes('zeroCostState')) {
  content = content.replace(
    'static auditLogs: AuditEvent[] = [...mockAuditEvents];',
    'static auditLogs: AuditEvent[] = [...mockAuditEvents];\n  static zeroCostState: ZeroCostState = defaultZeroCostState;'
  );
}

// Evaluate zero cost
const executionLogic = `
    const zcDecision = evaluateZeroCostPolicy(tool.appId + '.' + tool.name, ToolGatewayService.zeroCostState);
    if (zcDecision.status === 'blocked' || zcDecision.status === 'paused') {
      const blockedEvent: AuditEvent = {
        id: \`aud_\${Math.floor(1000 + Math.random() * 9000)}\`,
        eventType: 'policy_denied',
        requestId: invocationContext.requestId,
        correlationId: invocationContext.correlationId,
        actor: invocationContext.actor.uid,
        organizationId: invocationContext.organization.id,
        appId: tool.appId,
        channel: invocationContext.channel.type,
        toolId: tool.id,
        toolName: tool.name,
        confirmationState: 'blocked',
        result: 'negado',
        details: \`Zero Cost Policy Block: \${zcDecision.reason}\`,
        timestamp,
        isDemoMode: true,
      };
      this.auditLogs.unshift(blockedEvent);
      return {
        decision,
        result: {
          status: 'denied',
          humanSummary: \`Bloqueado pela Política de Custo Zero: \${zcDecision.reason}\`,
          auditId: blockedEvent.id,
        },
        auditEvent: blockedEvent,
      };
    }
`;

if (!content.includes('evaluateZeroCostPolicy(tool.appId')) {
  content = content.replace(
    '// Simulated execution payload for mock tools',
    executionLogic + '\n    // Simulated execution payload for mock tools'
  );
}

// Add simulated data cases
const mockCases = `
    } else if (tool.name === 'searchSongs') {
      const res = resolveSongChart(typedInput?.songId as string || '', typedInput?.title as string || '', typedInput?.version as string || '');
      simulatedData = { results: res ? (Array.isArray((res as any).ambiguity) ? (res as any).ambiguity : [res]) : [] };
    } else if (tool.name === 'getSongChart') {
      const res = resolveSongChart(typedInput?.songId as string || '', typedInput?.title as string || '', typedInput?.version as string || '');
      if (res && !(res as any).ambiguity) {
        simulatedData = generateChartDelivery(res as any, typedInput?.requestedKey as string);
      } else {
        simulatedData = { error: 'Not found or ambiguous' };
      }
    } else if (tool.name === 'getScheduleSongCharts') {
      simulatedData = generateScheduleSongbook(typedInput?.scheduleId as string || 'test_schedule', invocationContext.organization.id);
    } else if (tool.name === 'transposeSongChart') {
      const res = resolveSongChart(typedInput?.songId as string || '', typedInput?.title as string || '', typedInput?.version as string || '');
      if (res && !(res as any).ambiguity) {
        simulatedData = generateChartDelivery(res as any, typedInput?.requestedKey as string);
      } else {
        simulatedData = { error: 'Not found or ambiguous' };
      }
    } else if (tool.name === 'renderSongChartDocument') {
      simulatedData = { documentUrl: 'blob:demo/song_chart_pdf', status: 'available' };
    } else if (tool.name === 'renderScheduleSongbook') {
      simulatedData = { documentUrl: 'blob:demo/schedule_songbook_pdf', status: 'available' };
`;

if (!content.includes('tool.name === \'searchSongs\'')) {
  content = content.replace(
    "} else {      simulatedData = {        message: `Execução simulada com sucesso da ferramenta ${tool.name}.`,",
    mockCases + "\n    } else {      simulatedData = {        message: `Execução simulada com sucesso da ferramenta ${tool.name}.`,"
  );
}

fs.writeFileSync('src/core/services/toolGateway.ts', content);
