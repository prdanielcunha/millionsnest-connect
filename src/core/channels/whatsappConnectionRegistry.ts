export type WhatsAppConnectionBinding = {
  organizationId: string;
  phoneNumberId: string;
  connectionRef: string;
  enabled: boolean;
};

function safeSegment(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (
    !clean ||
    clean.length > maxLength ||
    clean.includes('/') ||
    clean.includes('\\')
  ) {
    return '';
  }
  return clean;
}

export function parseWhatsAppConnectionBindings(
  env: NodeJS.ProcessEnv,
): WhatsAppConnectionBinding[] {
  const raw = env.CONNECT_WHATSAPP_CONNECTIONS_JSON?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('WHATSAPP_CONNECTIONS_JSON_INVALID');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('WHATSAPP_CONNECTIONS_JSON_INVALID');
  }

  const result: WhatsAppConnectionBinding[] = [];
  const seenPhoneNumberIds = new Set<string>();

  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('WHATSAPP_CONNECTION_BINDING_INVALID');
    }
    const source = item as Record<string, unknown>;
    const organizationId = safeSegment(source.organizationId, 180);
    const phoneNumberId = safeSegment(source.phoneNumberId, 128);
    const connectionRef = safeSegment(source.connectionRef, 180);
    const enabled = source.enabled !== false;

    if (!organizationId || !phoneNumberId || !connectionRef) {
      throw new Error('WHATSAPP_CONNECTION_BINDING_INVALID');
    }
    if (seenPhoneNumberIds.has(phoneNumberId)) {
      throw new Error('WHATSAPP_PHONE_NUMBER_ID_DUPLICATE');
    }
    seenPhoneNumberIds.add(phoneNumberId);

    result.push({
      organizationId,
      phoneNumberId,
      connectionRef,
      enabled,
    });
  }

  return result;
}

export class WhatsAppConnectionRegistry {
  private readonly byPhoneNumberId: Map<string, WhatsAppConnectionBinding>;

  constructor(bindings: WhatsAppConnectionBinding[]) {
    this.byPhoneNumberId = new Map(
      bindings
        .filter((binding) => binding.enabled)
        .map((binding) => [binding.phoneNumberId, binding]),
    );
  }

  resolve(phoneNumberId: string): WhatsAppConnectionBinding | null {
    return this.byPhoneNumberId.get(phoneNumberId.trim()) ?? null;
  }

  get size(): number {
    return this.byPhoneNumberId.size;
  }
}

export function hasWhatsAppConnectionBindings(env: NodeJS.ProcessEnv): boolean {
  try {
    return parseWhatsAppConnectionBindings(env).some((binding) => binding.enabled);
  } catch {
    return false;
  }
}
