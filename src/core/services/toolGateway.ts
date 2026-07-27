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
import { mockAuditEvents } from '../../demo/mockData';

export class ToolGatewayService {
  private static auditLogs: AuditEvent[] = [...mockAuditEvents];
  
  // Im-memory store for idempotency in DEMO_MODE
  private static idempotencyStore: Record<string, ToolInvocationResult> = {};

  static getAuditLogs(): AuditEvent[] {
    return this.auditLogs;
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

    if (cacheKey && decision.status === 'allowed' && this.idempotencyStore[cacheKey]) {
      // Reutilização de resultado idempotente
      const cachedResult = this.idempotencyStore[cacheKey] as ToolInvocationResult<TOutput>;
      
      const auditEvent: AuditEvent = {
        id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
        requestId: invocationContext.requestId,
        correlationId: invocationContext.correlationId,
        idempotencyKey: invocationContext.idempotencyKey, // hash would be better in prod
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
        confirmationState: 'confirmed',
        result: 'sucesso',
        details: `Resultado reutilizado por idempotência. (Chave original executada anteriormente)`,
        timestamp,
        isDemoMode: true,
      };

      return {
        decision,
        result: {
           ...cachedResult,
           auditId: auditEvent.id, // Update audit ID for this fetch
           humanSummary: `${cachedResult.humanSummary} (Resultado reutilizado via idempotência)`,
           warnings: ['Resultado reutilizado por idempotência demonstrativa.'],
        },
        auditEvent
      };
    }

    if (decision.status !== 'allowed') {
      let confirmationState: AuditEvent['confirmationState'] = 'blocked';
      let resultStatus: AuditEvent['result'] = 'negado';
      
      if (decision.status === 'needs_confirmation') {
        confirmationState = tool.confirmationPolicy === 'human_approval' ? 'human_approval_pending' : 'pending';
        resultStatus = 'pendente';
      }

      const auditEvent: AuditEvent = {
        id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
        requestId: invocationContext.requestId,
        correlationId: invocationContext.correlationId,
        idempotencyKey: invocationContext.idempotencyKey,
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

    // Simulated execution payload for mock tools
    let simulatedData: unknown = null;

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
      const args = input as any;
      simulatedData = {
        draftId: `draft_${Math.random().toString(36).substring(2, 8)}`,
        title: args?.title || 'Rascunho de Culto',
        status: 'RASCUNHO_CRIADO',
        message: 'Rascunho criado com sucesso no MusicScale. Voluntários ainda não foram notificados.',
      };
    } else if (tool.name === 'searchLivingLibrary') {
      const args = input as any;
      simulatedData = {
        query: args?.query || '',
        results: [
          { id: 'song_ll_01', title: 'Bondade de Deus', artist: 'Isaias Saad', key: 'G', bpm: 72 },
        ],
      };
    } else if (tool.name === 'addSongToLivingLibrary') {
      const args = input as any;
      simulatedData = {
        globalSongId: `g_song_${Math.random().toString(36).substring(2, 8)}`,
        title: args?.title || 'Música Nova',
        status: 'HOMOLOGADO_BIBLIOTECA_VIVA',
        message: 'Música homologada no acervo global compartilhada com todo o ecossistema MillionsNest.',
      };
    } else {
      simulatedData = {
        message: `Execução simulada com sucesso da ferramenta ${tool.name}.`,
        argsUsed: input,
      };
    }

    const auditEvent: AuditEvent = {
      id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
      requestId: invocationContext.requestId,
      correlationId: invocationContext.correlationId,
      idempotencyKey: invocationContext.idempotencyKey,
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
      confirmationState: invocationContext.confirmedAt ? 'confirmed' : 'not_required',
      result: 'sucesso',
      details: `Execução da ferramenta ${tool.title} (${tool.name}) com sucesso em DEMO_MODE.`,
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

    if (cacheKey) {
      this.idempotencyStore[cacheKey] = invocationResult as ToolInvocationResult<unknown>;
    }

    return {
      decision,
      result: invocationResult,
      auditEvent,
    };
  }
}
