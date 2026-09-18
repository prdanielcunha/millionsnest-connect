export function isPlainUnknownRecord(
  value: unknown
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof Date ||
    value instanceof Map ||
    value instanceof Set
  ) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function validateOrganizationScopedArgs(
  args: unknown,
  organizationId: string
): boolean {
  if (!isPlainUnknownRecord(args)) {
    return false;
  }
  
  if (args.organizationId === undefined) {
    return true; // Not scoped by organization
  }

  if (typeof args.organizationId !== 'string') {
    return false; // Invalid type
  }

  return args.organizationId === organizationId;
}
