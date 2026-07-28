with open("src/tests/menuMobile.test.ts", "r") as f:
    content = f.read()

tool_addition = """  },
  {
    id: 't99',
    appId: 'musicscale',
    name: 'addSongToLivingLibrary',
    version: '1.0.0',
    title: 'Add Song',
    description: 'Add',
    inputSchema: {},
    outputSchema: {},
    requiredPermissions: ['livingLibrary.manage'],
    organizationScoped: false,
    riskLevel: 'R3_PRIVILEGED',
    confirmationPolicy: 'explicit',
    readOnly: false,
    idempotencyPolicy: 'required',
    supportsPreview: false,
    supportsUndo: false,
    timeoutMs: 1000,
    auditEventType: 'AUDIT_CREATE',
  }
];"""
content = content.replace("  }\n];", tool_addition)

with open("src/tests/menuMobile.test.ts", "w") as f:
    f.write(content)
