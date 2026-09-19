export type AutomationMaturity = 'prepared' | 'blocked' | 'planned';

export type ConnectAutomationDefinition = {
  id: string;
  sourceApp: 'musicscale' | 'nestjourney' | 'nestfinance';
  trigger: string;
  action: string;
  targetChannel: 'inapp' | 'whatsapp' | 'internal';
  idempotency: string;
  auditRequired: true;
  costPolicy: 'zero_cost' | 'provider_policy';
  maturity: AutomationMaturity;
};

export const CONNECT_AUTOMATION_CATALOG: ConnectAutomationDefinition[] = [
  {
    id: 'musicscale.scale_published.inapp',
    sourceApp: 'musicscale',
    trigger: 'scale.published',
    action: 'notify_assigned_members',
    targetChannel: 'inapp',
    idempotency: 'eventId + memberId + channel',
    auditRequired: true,
    costPolicy: 'zero_cost',
    maturity: 'prepared',
  },
  {
    id: 'musicscale.presence_pending.inapp',
    sourceApp: 'musicscale',
    trigger: 'scale.presence_pending',
    action: 'remind_pending_member',
    targetChannel: 'inapp',
    idempotency: 'eventId + memberId + reminderWindow',
    auditRequired: true,
    costPolicy: 'zero_cost',
    maturity: 'prepared',
  },
  {
    id: 'musicscale.trial_incomplete.internal',
    sourceApp: 'musicscale',
    trigger: 'trial.activation_incomplete',
    action: 'create_internal_commercial_followup',
    targetChannel: 'internal',
    idempotency: 'eventId + organizationId + followupKind',
    auditRequired: true,
    costPolicy: 'zero_cost',
    maturity: 'prepared',
  },
  {
    id: 'musicscale.scale_published.whatsapp',
    sourceApp: 'musicscale',
    trigger: 'scale.published',
    action: 'send_approved_template_to_assigned_members',
    targetChannel: 'whatsapp',
    idempotency: 'eventId + memberId + templateName',
    auditRequired: true,
    costPolicy: 'provider_policy',
    maturity: 'blocked',
  },
  {
    id: 'nestjourney.followup_due.inapp',
    sourceApp: 'nestjourney',
    trigger: 'followup.due',
    action: 'notify_responsible_person',
    targetChannel: 'inapp',
    idempotency: 'eventId + responsibleUid',
    auditRequired: true,
    costPolicy: 'zero_cost',
    maturity: 'planned',
  },
  {
    id: 'nestfinance.document_pending.inapp',
    sourceApp: 'nestfinance',
    trigger: 'document.pending',
    action: 'notify_authorized_user',
    targetChannel: 'inapp',
    idempotency: 'eventId + authorizedUid',
    auditRequired: true,
    costPolicy: 'zero_cost',
    maturity: 'planned',
  },
];

export function automationBlockers(
  definition: ConnectAutomationDefinition,
  channels: Array<{ id: string; sendReady: boolean; receiveReady: boolean; status: string }>,
): string[] {
  const blockers: string[] = ['event_source_not_mounted', 'execution_worker_not_mounted'];

  if (definition.targetChannel === 'whatsapp') {
    const whatsapp = channels.find((channel) => channel.id === 'whatsapp');
    if (!whatsapp?.sendReady) blockers.push('whatsapp_dispatch_not_ready');
  }

  if (definition.targetChannel === 'inapp') {
    const inapp = channels.find((channel) => channel.id === 'inapp');
    if (inapp?.status !== 'active') blockers.push('inapp_channel_not_ready');
  }

  if (definition.maturity === 'planned') blockers.push('cross_app_phase_not_started');
  return blockers;
}
