import {
  ConnectThreadEventType,
  ConnectThreadProjection,
  CreateConnectThreadEventInput,
  createConnectThreadEvent,
} from './threadDomain';
import {
  ConnectThreadAppendResult,
  ConnectThreadScope,
  ConnectThreadStore,
} from './threadStore';

export interface ConnectThreadCommandBase {
  requestId: string;
  organizationId: string;
  conversationId: string;
  evidenceRef: string;
  occurredAt?: Date;
}

export interface OpenConnectThreadCommand extends ConnectThreadCommandBase {
  channel: string;
}

export interface AssignConnectThreadCommand extends ConnectThreadCommandBase {
  assigneeType: 'user' | 'team';
  assigneeRef: string;
  reasonCode?: string;
}

export interface HandoffConnectThreadCommand extends AssignConnectThreadCommand {}

export interface ReasonedConnectThreadCommand extends ConnectThreadCommandBase {
  reasonCode?: string;
}

export type ConnectThreadCommandResult = ConnectThreadAppendResult;

function scopeOf(command: ConnectThreadCommandBase): ConnectThreadScope {
  return {
    organizationId: command.organizationId,
    conversationId: command.conversationId,
  };
}

/**
 * Application service for Inbox thread transitions.
 *
 * It deliberately accepts only stable evidence references and routing metadata;
 * message bodies and contact PII do not belong in the thread event stream.
 */
export class ConnectThreadCommandService {
  constructor(
    private readonly store: ConnectThreadStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getThread(scope: ConnectThreadScope): Promise<ConnectThreadProjection | null> {
    return this.store.load(scope);
  }

  async open(command: OpenConnectThreadCommand): Promise<ConnectThreadCommandResult> {
    return this.execute('CONVERSATION_OPENED', command, {
      channel: command.channel,
    });
  }

  async recordPersonReply(
    command: ConnectThreadCommandBase,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('MESSAGE_REPLIED', command);
  }

  async recordHumanReplySent(
    command: ConnectThreadCommandBase,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('HUMAN_REPLY_SENT', command);
  }

  async assign(
    command: AssignConnectThreadCommand,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('THREAD_ASSIGNED', command, {
      assigneeType: command.assigneeType,
      assigneeRef: command.assigneeRef,
      reasonCode: command.reasonCode,
    });
  }

  async handoff(
    command: HandoffConnectThreadCommand,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('HANDOFF_CREATED', command, {
      assigneeType: command.assigneeType,
      assigneeRef: command.assigneeRef,
      reasonCode: command.reasonCode,
    });
  }

  async waitForPerson(
    command: ReasonedConnectThreadCommand,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('THREAD_WAITING_PERSON', command, {
      reasonCode: command.reasonCode,
    });
  }

  async resolve(
    command: ReasonedConnectThreadCommand,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('THREAD_RESOLVED', command, {
      reasonCode: command.reasonCode,
    });
  }

  async reopen(
    command: ReasonedConnectThreadCommand,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('THREAD_REOPENED', command, {
      reasonCode: command.reasonCode,
    });
  }

  async archive(
    command: ReasonedConnectThreadCommand,
  ): Promise<ConnectThreadCommandResult> {
    return this.execute('THREAD_ARCHIVED', command, {
      reasonCode: command.reasonCode,
    });
  }

  private async execute(
    eventType: ConnectThreadEventType,
    command: ConnectThreadCommandBase,
    extra: Partial<CreateConnectThreadEventInput> = {},
  ): Promise<ConnectThreadCommandResult> {
    const scope = scopeOf(command);
    const current = await this.store.load(scope);
    const event = createConnectThreadEvent({
      eventType,
      requestId: command.requestId,
      organizationId: command.organizationId,
      conversationId: command.conversationId,
      evidenceRef: command.evidenceRef,
      occurredAt: command.occurredAt ?? this.now(),
      channel: extra.channel,
      assigneeType: extra.assigneeType,
      assigneeRef: extra.assigneeRef,
      reasonCode: extra.reasonCode,
    });

    return this.store.append(event, current?.sourceEventCount ?? 0);
  }
}
