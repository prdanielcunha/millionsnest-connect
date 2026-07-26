/**
 * MillionsNest Connect - Tool Gateway Service
 * Simulates tool invocation, risk evaluation, confirmation flow, and audit event recording.
 */

import {
  EffectiveEcosystemContext,
  ToolDefinition,
  ToolInvocationResult,
  AuditEvent,
} from '../../types';
import { PermissionEngine } from '../policies/permissionEngine';
import { mockAuditEvents } from '../../demo/mockData';

export class ToolGatewayService {
  private static auditLogs: AuditEvent[] = [...mockAuditEvents];

  static getAuditLogs(): AuditEvent[] {
    return this.auditLogs;
  }

  static invokeTool(
    context: EffectiveEcosystemContext,
    tool: ToolDefinition,
    inputArgs: Record<string, any>,
    targetOrganizationId: string,
    conversationId?: string,
    channel: string = 'whatsapp'
  ): { decision: any; result?: ToolInvocationResult; auditEvent: AuditEvent } {
    const requestId = `req_${Math.random().toString(36).substring(2, 10)}`;
    const correlationId = `corr_${Math.random().toString(36).substring(2, 10)}`;
    const timestamp = new Date().toISOString();

    // Evaluate permissions
    const decision = PermissionEngine.evaluateToolPermission(
      context,
      tool,
      targetOrganizationId
    );

    if (!decision.allowed) {
      const isCrossTenant = decision.reason.includes('Cross-Tenant');
      const isLivingLibrary = decision.reason.includes('livingLibrary.manage');

      const auditEvent: AuditEvent = {
        id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
        requestId,
        correlationId,
        actor: `${context.user.name} (${context.user.email})`,
        organizationId: context.activeOrganization.id,
        channel,
        conversationId,
        toolId: tool.id,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        requiredPermission: tool.requiredPermissions.join(', ') || 'N/A',
        confirmationState: 'blocked',
        result: 'negado',
        details: decision.reason,
        timestamp,
        isCrossTenantBlocked: isCrossTenant,
        isLivingLibraryBlocked: isLivingLibrary,
      };

      this.auditLogs.unshift(auditEvent);

      return {
        decision,
        result: {
          success: false,
          error: decision.reason,
          executionTimeMs: 45,
        },
        auditEvent,
      };
    }

    // Simulated execution payload for mock tools
    let simulatedData: any = null;

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
          {
            id: 'sch_2026_08_02',
            date: '2026-08-02',
            service: 'Culto da Família - 10h',
            confirmedMusiciansCount: 4,
            totalNeeded: 6,
          },
        ],
      };
    } else if (tool.name === 'createScheduleDraft') {
      simulatedData = {
        draftId: `draft_${Math.random().toString(36).substring(2, 8)}`,
        title: inputArgs.title || 'Rascunho de Culto',
        status: 'RASCUNHO_CRIADO',
        message: 'Rascunho criado com sucesso no MusicScale. Voluntários ainda não foram notificados.',
      };
    } else if (tool.name === 'searchLivingLibrary') {
      simulatedData = {
        query: inputArgs.query || '',
        results: [
          { id: 'song_ll_01', title: 'Bondade de Deus', artist: 'Isaias Saad', key: 'G', bpm: 72 },
          { id: 'song_ll_02', title: 'Aos Pés da Cruz', artist: 'Kleber Lucas', key: 'E', bpm: 68 },
        ],
      };
    } else if (tool.name === 'addSongToLivingLibrary') {
      simulatedData = {
        globalSongId: `g_song_${Math.random().toString(36).substring(2, 8)}`,
        title: inputArgs.title || 'Música Nova',
        status: 'HOMOLOGADO_BIBLIOTECA_VIVA',
        message: 'Música homologada no acervo global compartilhada com todo o ecossistema MillionsNest.',
      };
    } else {
      simulatedData = {
        message: `Execução simulada com sucesso da ferramenta ${tool.name}.`,
        argsUsed: inputArgs,
      };
    }

    const auditEvent: AuditEvent = {
      id: `aud_${Math.floor(1000 + Math.random() * 9000)}`,
      requestId,
      correlationId,
      actor: `${context.user.name} (${context.user.email})`,
      organizationId: context.activeOrganization.id,
      channel,
      conversationId,
      toolId: tool.id,
      toolName: tool.name,
      riskLevel: tool.riskLevel,
      requiredPermission: tool.requiredPermissions.join(', ') || 'N/A',
      confirmationState: tool.confirmationPolicy === 'automatic' ? 'auto' : 'user_confirmed',
      result: 'sucesso',
      details: `Execução da ferramenta ${tool.title} (${tool.name}) com sucesso em DEMO_MODE.`,
      timestamp,
    };

    this.auditLogs.unshift(auditEvent);

    return {
      decision,
      result: {
        success: true,
        data: simulatedData,
        executionTimeMs: Math.floor(60 + Math.random() * 120),
      },
      auditEvent,
    };
  }
}
