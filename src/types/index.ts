/**
 * MillionsNest Connect - Domain Types & Contracts
 * DEMO_MODE - Local Typed Contracts
 */

export type EnvironmentMode = 'DEMO_MODE' | 'PRODUCTION_STUB';

export type LanguageCode = 'pt-BR' | 'en-US' | 'es-ES';

export interface EcosystemUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  globalRole: 'super_admin' | 'ecosystem_admin' | 'user';
  globalCapabilities: string[]; // e.g. 'livingLibrary.manage'
}

export interface EcosystemOrganization {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  plan: 'enterprise' | 'pro' | 'starter';
  isCanonical: boolean;
}

export interface EcosystemMembership {
  id: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
  permissions: string[];
}

export interface EffectiveEcosystemContext {
  mode: EnvironmentMode;
  user: EcosystemUser;
  activeOrganization: EcosystemOrganization;
  availableOrganizations: EcosystemOrganization[];
  memberships: EcosystemMembership[];
  effectiveCapabilities: string[];
}

export interface ExternalIdentity {
  channel: 'whatsapp' | 'instagram' | 'inapp';
  channelUserId: string; // e.g. +5543999907071 or @instahandle
  linkedUserId?: string;
  isVerified: boolean;
  linkedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  instagramHandle?: string;
  identities: ExternalIdentity[];
  linkingStatus: 'nao_vinculado' | 'pendente' | 'vinculado' | 'revogado';
  consents: {
    marketing: boolean;
    support: boolean;
    dataRetention: boolean;
    updatedAt: string;
  };
  preferredLanguage: LanguageCode;
  authorizedOrgsHistory: { organizationId: string; organizationName: string; grantedAt: string }[];
  tags: string[];
  createdAt: string;
}

export type ConversationChannel = 'whatsapp' | 'instagram' | 'inapp';
export type ConversationMode = 'automatico' | 'com_aprovacao' | 'humano';
export type ConversationStatus = 'aberto' | 'aguardando_humano' | 'resolvido' | 'arquivado';
export type ConversationPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatar?: string;
  channel: ConversationChannel;
  channelIdentifier: string;
  mode: ConversationMode;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedToUserId?: string;
  assignedToUserName?: string;
  organizationId: string;
  tags: string[];
  lastMessageSnippet: string;
  lastMessageAt: string;
  unreadCount: number;
  aiSummary?: string;
  aiIntent?: string;
  aiSentiment?: 'positivo' | 'neutro' | 'negativo' | 'urgente';
}

export type RiskLevel = 'R0_PUBLIC' | 'R1_AUTH_READ' | 'R2_REVERSIBLE_WRITE' | 'R3_PRIVILEGED' | 'R4_CRITICAL';

export interface ToolInvocationState {
  toolId: string;
  toolName: string;
  appId: string;
  args: Record<string, any>;
  status: 'requested' | 'confirmed' | 'executed' | 'rejected' | 'failed';
  result?: any;
  riskLevel: RiskLevel;
  requiredCapabilities?: string[];
  requiresApproval: boolean;
  executedAt?: string;
  error?: string;
}

export interface UnifiedMessage {
  id: string;
  conversationId: string;
  senderType: 'contact' | 'agent' | 'human_agent' | 'system';
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  isInternalNote?: boolean;
  attachments?: { name: string; url: string; type: string; size: string }[];
  toolInvocation?: ToolInvocationState;
}

export interface AgentVersion {
  version: string;
  updatedAt: string;
  updatedBy: string;
  changelog: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  avatarUrl?: string;
  channelScope: ('whatsapp' | 'instagram' | 'inapp')[];
  version: string;
  autonomyMode: 'so_sugerir' | 'responder_com_aprovacao' | 'responder_automaticamente' | 'executar_ferramentas_com_confirmacao';
  status: 'ativo' | 'pausado' | 'rascunho';
  resolutionRate: number; // percentage e.g. 84.5
  goals: string[];
  knowledgeSourceIds: string[];
  allowedToolIds: string[];
  blockedThemes: string[];
  transferPolicy: string;
  costLimitMonthly: number;
  currentCostMonthly: number;
  language: LanguageCode;
  promptStructure: {
    role: string;
    systemDirective: string;
    guardrails: string[];
  };
  versions: AgentVersion[];
}

export interface KnowledgeSource {
  id: string;
  title: string;
  type: 'faq' | 'pagina' | 'documento' | 'url' | 'politica' | 'produto' | 'evento' | 'dado_dinamico';
  owner: string;
  scope: 'global' | 'organizacao';
  language: LanguageCode;
  version: string;
  validUntil?: string;
  status: 'revisado' | 'pendente_revisao' | 'expirado' | 'conflito';
  lastUpdatedAt: string;
  contentSnippet: string;
  organizationId?: string;
}

export interface AutomationBlock {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'wait' | 'approval';
  label: string;
  config: string;
}

export interface AutomationDefinition {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  status: 'rascunho' | 'teste' | 'ativo' | 'pausado';
  executionsCount: number;
  blocks: AutomationBlock[];
}

export interface ToolDefinition {
  id: string;
  appId: 'musicscale' | 'nestfinance' | 'connect_core';
  name: string;
  version: string;
  title: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
  requiredPermissions: string[];
  organizationScoped: boolean;
  riskLevel: RiskLevel;
  confirmationPolicy: 'automatic' | 'user_confirmation' | 'admin_approval';
  readOnly: boolean;
  idempotencyPolicy: string;
  supportsPreview: boolean;
  supportsUndo: boolean;
  timeoutMs: number;
  auditEventType: string;
}

export interface ToolInvocationContext {
  requestId: string;
  correlationId: string;
  actorId: string;
  organizationId: string;
  channel: string;
  conversationId: string;
}

export interface ToolInvocationResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs: number;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
  requiredCapability?: string;
  checkedAt: string;
}

export interface AuditEvent {
  id: string;
  requestId: string;
  correlationId: string;
  actor: string;
  organizationId: string;
  channel: string;
  conversationId?: string;
  toolId?: string;
  toolName?: string;
  riskLevel?: RiskLevel;
  requiredPermission?: string;
  confirmationState: 'auto' | 'user_confirmed' | 'blocked' | 'system_approved';
  result: 'sucesso' | 'negado' | 'falha' | 'pendente';
  details: string;
  timestamp: string;
  isCrossTenantBlocked?: boolean;
  isLivingLibraryBlocked?: boolean;
}

export interface ChannelConnection {
  id: string;
  type: 'whatsapp' | 'instagram' | 'inapp';
  name: string;
  identifier: string;
  status: 'saudavel' | 'atencao' | 'desconectado';
  lastSync: string;
  webhookUrl: string;
  errorCount: number;
  coexistenceStatus: string;
  details: Record<string, string>;
}

export interface AppManifest {
  appId: string;
  name: string;
  iconName: string;
  description: string;
  status: 'ativo' | 'planejado' | 'desativado';
  registeredToolsCount: number;
}
