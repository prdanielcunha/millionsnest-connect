const fs = require('fs');
const file = 'src/demo/mockData.ts';
let data = fs.readFileSync(file, 'utf8');
const newTool = `
  {
    id: "tool_freemium_service",
    appId: "freemium",
    name: "service",
    version: "1.0",
    title: "Serviço Freemium",
    description: "Serviço de testes com custo Freemium",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    requiredPermissions: ["freemium.use"],
    organizationScoped: false,
    riskLevel: "R1_AUTH_READ",
    confirmationPolicy: "none",
    readOnly: true,
    idempotencyPolicy: "not_required",
    supportsPreview: false,
    supportsUndo: false,
    timeoutMs: 3000,
    auditEventType: "AUDIT_READ"
  },
];`;
data = data.replace('];\n\nexport const mockAgents', newTool + '\n\nexport const mockAgents');
fs.writeFileSync(file, data);
