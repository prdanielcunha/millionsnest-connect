/**
 * MillionsNest Connect - Tool Gateway Service
 * Simulates tool invocation, risk evaluation, confirmation flow, and audit event recording.
 */

import {
  EffectiveEcosystemContext,
  ToolDefinition,
  ToolInvocationResult,
  AuditEvent,
  ToolInvocationContext,
  DemoPolicyDecision
} from '../../types';
import { DemoPolicySimulator } from '../../demo/policies/demoPolicySimulator';
import { createDemoConfirmationIntentFingerprint } from '../../demo/confirmations/demoConfirmationIntent';
import { mockAuditEvents } from '../../demo/mockData';
import { evaluateZeroCostPolicy, ZeroCostState, defaultZeroCostState, createDefaultZeroCostState } from '../policies/zeroCost/zeroCostPolicy';
import { resolveSongChart, generateChartDelivery, generateScheduleSongbook } from './chartDelivery';

type DemoIdempotencyRecord<T = unknown> = {
  result: ToolInvocationResult<T>;
  originalExecutionAuditId: string;
  originalConfirmationState: AuditEvent['confirmationState'];
  createdAt: string;
  toolId: string;
  organizationId: string;
};

export function createDemoIdempotencyFingerprint(value: string): string {
  // Funcao puramente demonstrativa, nao deve ser usada como hash criptografico em producao
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

export class ToolGatewayService {
  private static auditLogs: AuditEvent[] = [...mockAuditEvents];
  static zeroCostState: ZeroCostState = createDefaultZeroCostState();
  
  // In-memory store for idempotency in DEMO_MODE
  private static idempotencyStore = new Map<string, DemoIdempotencyRecord>();

  static getAuditLogs(): AuditEvent[] {
    return this.auditLogs;
  }

  static resetDemoState() {
    this.auditLogs = [...mockAuditEvents];
    this.idempotencyStore.clear();
    this.zeroCostState = createDefaultZeroCostState();
  }

  static invokeTool<TInput, TOutput>(
    ecosystemContext: EffectiveEcosystemContext,
    tool: ToolDefinition,
    input: TInput,
    invocationContext: ToolInvocationContext
  ): {
    decision: DemoPolicyDecision;
    result: ToolInvocationResult<TOutput>;
    auditEvent: AuditEvent;
  } {
    const timestamp = new Date().toISOString();
    
    // Evaluate permissions
    const decision = DemoPolicySimulator.evaluateToolPermission(
      ecosystemContext,
      tool,
      invocationContext
    );

    if (decision.status === 'allowed' && invocationContext.demoConfirmation) {
      const expectedIntentFingerprint = createDemoConfirmationIntentFingerprint({
        actorUid: invocationContext.actor.uid,
        requestId: invocationContext.requestId,
        toolId: tool.id,
        organizationId: invocationContext.organization.id,
        args: input,
        idempotencyKey: invocationContext.idempotencyKey,
      });

      if (invocationContext.demoConfirmation.intentFingerprint !== expectedIntentFingerprint) {
        decision.status = 'denied';
        decision.reason = 'A confirmação não corresponde ao intent atual da invocação.';
      }
    }

    if (tool.organizationScoped && input !== null && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'organizationId')) {
      const inputOrganizationId = (input as Record<string, unknown>).organizationId;

      if (typeof inputOrganizationId !== 'string' || inputOrganizationId.trim().length === 0) {
        decision.status = 'denied';
        decision.reason = 'O organizationId informado no input é um seletor de tenant inválido.';
      } else if (inputOrganizationId !== invocationContext.organization.id) {
        decision.status = 'denied';
        decision.reason = 'O organizationId informado no input diverge do tenant efetivo da invocação.';
      }
    }
    
    const fp = invocationContext.idempotencyKey 
      ? createDemoIdempotencyFingerprint(invocationContext.idempotencyKey)
      : undefined;
      
    // Idempotency check setup
    let cacheKey: string | null = null;
    if (tool.idempotencyPolicy === 'required') {
      if (!invocationContext.idempotencyKey) {
        decision.status = 'denied';
        decision.reason = 'A política de idempotência REQUIRED exige uma chave (idempotencyKey), mas nenhuma foi fornecida.';
      } else {
        cacheKey = `${tool.appId}:${tool.name}:${invocationContext.organization.id}:${invocationContext.idempotencyKey}`;
      }
    } else if (tool.idempotencyPolicy === 'recommended' && invocationContext.idempotencyKey) {
      cacheKey = `${tool.appId}:${tool.name}:${invocationContext.organization.id}:${invocationContext.idempotencyKey}`;
    }

    if (decision.status !== 'allowed') {
      let confirmationState: AuditEvent['confirmationState'] = 'blocked';
      let resultStatus: AuditEvent['result'] = 'negado';
      let eventType: AuditEvent['eventType'] = 'policy_denied';
      
      if (decision.status === 'needs_confirmation') {
        confirmationState = tool.confirmationPolicy === 'human_approval' ? 'human_approval_pending' : 'pending';
        resultStatus = 'pendente';
        eventType = 'confirmation_pending';
      }

      const auditEvent: AuditEvent = {
        id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
        eventType,
        requestId: invocationContext.requestId,
        correlationId: invocationContext.correlationId,
        idempotencyKeyFingerprint: fp,
        actor: invocationContext.actor.uid,
        organizationId: invocationContext.organization.id,
        appId: tool.appId,
        channel: invocationContext.channel.type,
        conversationId: invocationContext.channel.conversationId,
        toolId: tool.id,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        requiredPermission: tool.requiredPermissions.join(', '),
        confirmationPolicy: tool.confirmationPolicy,
        confirmationState,
        result: resultStatus,
        details: decision.reason,
        timestamp,
        isDemoMode: true,
      };

      this.auditLogs.unshift(auditEvent);

      return {
        decision,
        result: {
          status: decision.status,
          humanSummary: decision.reason,
          auditId: auditEvent.id,
        },
        auditEvent,
      };
    }

    
    const zcDecision = evaluateZeroCostPolicy(tool.appId + '.' + tool.name, ToolGatewayService.zeroCostState);

    if (zcDecision.status === 'blocked' || zcDecision.status === 'paused') {
      const blockedEvent: AuditEvent = {
        id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
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
        details: `Zero Cost Policy Block: ${zcDecision.reason}`,
        timestamp,
        isDemoMode: true,
      };
      this.auditLogs.unshift(blockedEvent);
      return {
        decision,
        result: {
          status: 'denied',
          humanSummary: `Bloqueado pela Política de Custo Zero: ${zcDecision.reason}`,
          auditId: blockedEvent.id,
        },
        auditEvent: blockedEvent,
      };
    }

    if (cacheKey && this.idempotencyStore.has(cacheKey)) {
      // Reutilização de resultado idempotente após revalidar a política Zero Cost atual
      const record = this.idempotencyStore.get(cacheKey)!;
      const cachedResult = record.result as ToolInvocationResult<TOutput>;

      const auditEvent: AuditEvent = {
        id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
        eventType: 'idempotency_reuse',
        requestId: invocationContext.requestId,
        correlationId: invocationContext.correlationId,
        idempotencyKeyFingerprint: fp,
        originalExecutionAuditId: record.originalExecutionAuditId,
        actor: invocationContext.actor.uid,
        organizationId: invocationContext.organization.id,
        appId: tool.appId,
        channel: invocationContext.channel.type,
        conversationId: invocationContext.channel.conversationId,
        toolId: tool.id,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        requiredPermission: tool.requiredPermissions.join(', '),
        confirmationPolicy: tool.confirmationPolicy,
        confirmationState: record.originalConfirmationState,
        result: 'sucesso',
        details: `Resultado reutilizado por idempotência. Ação original auditada sob ID ${record.originalExecutionAuditId}`,
        timestamp,
        isDemoMode: true,
      };

      this.auditLogs.unshift(auditEvent);

      return {
        decision,
        result: {
           ...cachedResult,
           auditId: record.originalExecutionAuditId, // preserva apontamento para o evento original no retorno client
           humanSummary: `${cachedResult.humanSummary} (Resultado reutilizado via idempotência)`,
           warnings: [...(cachedResult.warnings || []), 'Resultado reutilizado por idempotência demonstrativa.'],
        },
        auditEvent
      };
    }

    // Simulated execution payload for mock tools
    let simulatedData: unknown = null;
    const typedInput = input as Record<string, unknown>;

    if (tool.name === 'listSchedules') {
      simulatedData = {
        schedules: [
          {
            id: 'sch_2026_07_28',
            date: '2026-07-28',
            service: 'Culto de Celebração - 19h',
            confirmedMusiciansCount: 6,
            totalNeeded: 7,
          },
        ],
      };
    } else if (tool.name === 'createScheduleDraft') {
      simulatedData = {
        draftId: `draft_${Math.random().toString(36).substring(2, 8)}`,
        title: typedInput?.title || 'Rascunho de Culto',
        status: 'RASCUNHO_CRIADO',
        message: 'Rascunho criado com sucesso no MusicScale. Voluntários ainda não foram notificados.',
      };
    } else if (tool.name === 'searchLivingLibrary') {
      simulatedData = {
        query: typedInput?.query || '',
        results: [
          { id: 'song_ll_01', title: 'Bondade de Deus', artist: 'Isaias Saad', key: 'G', bpm: 72 },
        ],
      };
    } else if (tool.name === 'addSongToLivingLibrary') {
      simulatedData = {
        globalSongId: `g_song_${Math.random().toString(36).substring(2, 8)}`,
        title: typedInput?.title || 'Música Nova',
        status: 'HOMOLOGADO_BIBLIOTECA_VIVA',
        message: 'Música homologada no acervo global compartilhada com todo o ecossistema MillionsNest.',
      };
    } else if (tool.name === 'getSongChart' || tool.name === 'transposeSongChart' || tool.name === 'renderSongChartDocument') {
      const projectionResult = resolveSongChart(
        (typedInput?.songId as string) || 'song_demo_01',
        undefined,
        undefined,
        invocationContext.organization.id
      );
      
      if (projectionResult && !('ambiguity' in projectionResult)) {
        const targetKey = (typedInput?.requestedKey as string) || projectionResult.key || 'C';
        const purpose = tool.name === 'renderSongChartDocument'
          ? 'document'
          : invocationContext.channel.type === 'whatsapp' ? 'whatsapp_text' : 'full_display';
        simulatedData = generateChartDelivery(projectionResult, targetKey, purpose);
      } else {
        simulatedData = { error: 'Song not found or ambiguous', details: projectionResult };
      }
    } else if (tool.name === 'getScheduleSongCharts' || tool.name === 'renderScheduleSongbook') {
      const scheduleId = (typedInput?.scheduleId as string) || 'sch_2026_07_28';
      const purpose = tool.name === 'renderScheduleSongbook'
        ? 'document'
        : invocationContext.channel.type === 'whatsapp' ? 'whatsapp_text' : 'full_display';
      simulatedData = generateScheduleSongbook(scheduleId, invocationContext.organization.id, purpose);
    } else {
      simulatedData = {
        message: `Execução simulada com sucesso da ferramenta ${tool.name}.`,
        argsUsed: input,
      };
    }
    
    const confirmationState: AuditEvent['confirmationState'] = invocationContext.demoConfirmation ? 'confirmed' : 'not_required';

    const auditEventDetails = zcDecision.status === 'near_limit'
      ? `Execução da ferramenta ${tool.title} (${tool.name}) com sucesso. Aviso: status near_limit; resourceId=${zcDecision.resource}; measuredUsage=${zcDecision.measuredUsage}; freeLimit=${zcDecision.freeLimit}; financialCostBrl=0.`
      : `Execução da ferramenta ${tool.title} (${tool.name}) com sucesso em DEMO_MODE.`;

    const auditEvent: AuditEvent = {
      id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
      eventType: 'tool_execution',
      requestId: invocationContext.requestId,
      correlationId: invocationContext.correlationId,
      idempotencyKeyFingerprint: fp,
      actor: invocationContext.actor.uid,
      organizationId: invocationContext.organization.id,
      appId: tool.appId,
      channel: invocationContext.channel.type,
      conversationId: invocationContext.channel.conversationId,
      toolId: tool.id,
      toolName: tool.name,
      riskLevel: tool.riskLevel,
      requiredPermission: tool.requiredPermissions.join(', '),
      confirmationPolicy: tool.confirmationPolicy,
      confirmationState,
      result: 'sucesso',
      details: auditEventDetails,
      timestamp,
      isDemoMode: true,
    };
    this.auditLogs.unshift(auditEvent);

    const invocationResult: ToolInvocationResult<TOutput> = {
      status: 'success',
      data: simulatedData as TOutput,
      humanSummary: `Execução da ferramenta ${tool.title} (${tool.name}) com sucesso em DEMO_MODE.`,
      auditId: auditEvent.id,
    };

    if (zcDecision.status === 'near_limit') {
      invocationResult.warnings = [
        ...(invocationResult.warnings || []),
        'Recurso próximo do limite gratuito. A execução permaneceu dentro da política de custo zero.'
      ];
    }

    if (cacheKey) {
      this.idempotencyStore.set(cacheKey, {
        result: invocationResult as ToolInvocationResult<unknown>,
        originalExecutionAuditId: auditEvent.id,
        originalConfirmationState: confirmationState,
        createdAt: timestamp,
        toolId: tool.id,
        organizationId: invocationContext.organization.id
      });
    }

    return {
      decision,
      result: invocationResult,
      auditEvent,
    };
  }
}
