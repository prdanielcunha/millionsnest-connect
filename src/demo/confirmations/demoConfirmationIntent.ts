export interface DemoConfirmationIntentInput {
  actorUid: string;
  requestId: string;
  toolId: string;
  organizationId: string;
  args: unknown;
  idempotencyKey?: string;
}

function canonicalizeDemoValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'string':
      return `string:${JSON.stringify(value)}`;
    case 'number':
      if (Number.isNaN(value)) return 'number:NaN';
      if (value === Infinity) return 'number:Infinity';
      if (value === -Infinity) return 'number:-Infinity';
      if (Object.is(value, -0)) return 'number:-0';
      return `number:${String(value)}`;
    case 'boolean':
      return `boolean:${value ? 'true' : 'false'}`;
    case 'bigint':
      return `bigint:${value.toString()}`;
    case 'symbol':
      return `symbol:${String(value.description ?? '')}`;
    case 'function':
      return `function:${value.name || 'anonymous'}`;
    case 'object': {
      if (Array.isArray(value)) {
        return `array:[${value.map(canonicalizeDemoValue).join(',')}]`;
      }

      const record = value as Record<string, unknown>;
      const entries = Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalizeDemoValue(record[key])}`);
      return `object:{${entries.join(',')}}`;
    }
  }
}

export function createDemoConfirmationIntentFingerprint(input: DemoConfirmationIntentInput): string {
  // Fingerprint puramente demonstrativo. Nao e hash criptografico nem assinatura para producao.
  const canonical = canonicalizeDemoValue({
    actorUid: input.actorUid,
    requestId: input.requestId,
    toolId: input.toolId,
    organizationId: input.organizationId,
    args: input.args,
    idempotencyKey: input.idempotencyKey,
  });

  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `intent_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function canonicalizeDemoConfirmationIntentValue(value: unknown): string {
  return canonicalizeDemoValue(value);
}
