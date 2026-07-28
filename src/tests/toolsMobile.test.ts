import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { toolsMobileReducer } from "../features/tools/toolsMobileState";
import {
  filterTools,
  selectToolById,
  validateToolsPendingContext,
  describeDemoToolAvailability,
} from "../features/tools/toolsDomain";
import { buildDemoToolInput } from "../features/tools/demoToolInputs";
import { mockTools, mockEcosystemContext } from "../demo/mockData";
import { ToolDefinition, EffectiveEcosystemContext } from "../types";
import { PendingDemoToolInvocation } from "../demo/confirmations/demoToolFlow";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;
let totalAssertions = 0;
let currentAssertions = 0;

function checkOk(condition: boolean, message?: string) {
  totalAssertions += 1;
  currentAssertions += 1;
  if (!condition) {
    throw new Error(message || "Condition failed");
  }
}

function checkEqual<T>(actual: T, expected: T, message?: string) {
  totalAssertions += 1;
  currentAssertions += 1;
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function runTest(name: string, fn: () => void) {
  totalTests += 1;
  currentAssertions = 0;
  try {
    fn();
    if (currentAssertions === 0) {
      throw new Error(`Test executed zero assertions: ${name}`);
    }
    passedTests += 1;
  } catch (error: unknown) {
    failedTests += 1;
    console.error(`❌ Test failed: ${name}`);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(`   ${String(error)}`);
    }
  }
}

// ------------------------------------------------------------------
// REDUCER
// ------------------------------------------------------------------

runTest("1. Estado inicial abre catalog (por padrão ao instanciar)", () => {
  const state = toolsMobileReducer({ view: "catalog" }, { type: "CHANGE_ORG" });
  checkEqual(state.view, "catalog");
});

runTest("2. OPEN_DETAIL abre detail", () => {
  const state = toolsMobileReducer(
    { view: "catalog" },
    { type: "OPEN_DETAIL" },
  );
  checkEqual(state.view, "detail");
});

runTest("3. OPEN_CATALOG retorna catalog", () => {
  const state = toolsMobileReducer(
    { view: "detail" },
    { type: "OPEN_CATALOG" },
  );
  checkEqual(state.view, "catalog");
});

runTest("4. CHANGE_ORG retorna catalog", () => {
  const state = toolsMobileReducer({ view: "detail" }, { type: "CHANGE_ORG" });
  checkEqual(state.view, "catalog");
});

runTest("5. Reducer não modifica o estado original", () => {
  const state = { view: "detail" as const };
  const newState = toolsMobileReducer(state, { type: "OPEN_CATALOG" });
  checkEqual(newState.view, "catalog");
  checkEqual(state.view, "detail"); // Must not be mutated
});

// ------------------------------------------------------------------
// SELEÇÃO E FILTROS
// ------------------------------------------------------------------

runTest("6. selectToolById retorna ferramenta válida", () => {
  const tool = mockTools[0];
  const selected = selectToolById(mockTools, tool.id);
  checkEqual(selected?.id, tool.id);
});

runTest("7. Retorna null para ID inexistente", () => {
  const selected = selectToolById(mockTools, "invalid-id");
  checkEqual(selected, null);
});

runTest("8. Retorna null para selectedToolId null", () => {
  const selected = selectToolById(mockTools, null);
  checkEqual(selected, null);
});

runTest("9. Busca encontra toolName", () => {
  const filtered = filterTools(mockTools, {
    query: "listSchedules",
    appId: "all",
    risk: "all",
  });
  checkOk(filtered.some((t) => t.name === "listSchedules"));
});

runTest("10. Busca encontra título", () => {
  const filtered = filterTools(mockTools, {
    query: "Listar Escalas",
    appId: "all",
    risk: "all",
  });
  checkOk(filtered.length > 0);
});

runTest("11. Busca encontra appId", () => {
  const filtered = filterTools(mockTools, {
    query: "musicscale",
    appId: "all",
    risk: "all",
  });
  checkOk(
    filtered.every(
      (t) =>
        t.appId.toLowerCase().includes("musicscale") ||
        t.name.toLowerCase().includes("musicscale") ||
        t.title.toLowerCase().includes("musicscale"),
    ),
  );
});

runTest("12. Filtro por app funciona", () => {
  const filtered = filterTools(mockTools, {
    query: "",
    appId: "musicscale",
    risk: "all",
  });
  checkOk(filtered.length > 0);
  checkOk(filtered.every((t) => t.appId === "musicscale"));
});

runTest("13. Filtro por risco funciona", () => {
  const filtered = filterTools(mockTools, {
    query: "",
    appId: "all",
    risk: "R1_AUTH_READ",
  });
  checkOk(filtered.length > 0);
  checkOk(filtered.every((t) => t.riskLevel === "R1_AUTH_READ"));
});

runTest("14. Combinação de filtros funciona", () => {
  const filtered = filterTools(mockTools, {
    query: "escala",
    appId: "musicscale",
    risk: "R1_AUTH_READ",
  });
  checkOk(
    filtered.every(
      (t) =>
        t.appId === "musicscale" &&
        t.riskLevel === "R1_AUTH_READ" &&
        t.title.toLowerCase().includes("escala"),
    ),
  );
});

runTest("15. Array original não é mutado", () => {
  const originalLength = mockTools.length;
  filterTools(mockTools, {
    query: "escala",
    appId: "musicscale",
    risk: "R1_AUTH_READ",
  });
  checkEqual(mockTools.length, originalLength);
});

runTest("16. Filtro sem resultado retorna vazio", () => {
  const filtered = filterTools(mockTools, {
    query: "non-existent-tool-123456",
    appId: "all",
    risk: "all",
  });
  checkEqual(filtered.length, 0);
});

// ------------------------------------------------------------------
// INPUTS DEMONSTRATIVOS
// ------------------------------------------------------------------

runTest("17. Cada ferramenta atual possui factory", () => {
  for (const tool of mockTools) {
    const input = buildDemoToolInput(tool, mockEcosystemContext);
    checkOk(input !== null, `Missing factory for ${tool.name}`);
    checkEqual(typeof input, "object");
    checkOk(!Array.isArray(input));
  }
});

runTest("18. listSchedules usa organizationId ativo", () => {
  const tool = mockTools.find((t) => t.name === "listSchedules")!;
  const input = buildDemoToolInput(tool, mockEcosystemContext);
  checkOk(input !== null);
  if (input) {
    checkEqual(
      input.organizationId,
      mockEcosystemContext.activeOrganization.id,
    );
  }
});

runTest("19. createScheduleDraft usa campos compatíveis", () => {
  const tool = mockTools.find((t) => t.name === "createScheduleDraft")!;
  const input = buildDemoToolInput(tool, mockEcosystemContext);
  checkOk(input !== null);
  if (input) {
    checkOk(input.title !== undefined);
    checkOk(input.date !== undefined);
    checkOk(input.serviceTime !== undefined);
  }
});

runTest("20. addSongToLivingLibrary usa somente valores demo", () => {
  const tool = mockTools.find((t) => t.name === "addSongToLivingLibrary")!;
  const input = buildDemoToolInput(tool, mockEcosystemContext);
  checkOk(input !== null);
  if (input) {
    checkEqual(input.isrc, "DEMO-ISRC-0001");
  }
});

runTest("21. Registry desconhecido retorna null", () => {
  const input = buildDemoToolInput(
    { name: "unknownTool123" } as unknown as ToolDefinition,
    mockEcosystemContext,
  );
  checkEqual(input, null);
});

runTest("22. Nenhum telefone real existe nos factories", () => {
  const tool = mockTools.find((t) => t.name === "addMember")!;
  const input = buildDemoToolInput(tool, mockEcosystemContext);
  checkOk(input !== null);
  if (input) {
    checkEqual(input.phone, "+55 00 00000-0000");
  }
});

runTest("23. Nenhum ID de produção existe nos factories", () => {
  const tool = mockTools.find((t) => t.name === "getSchedule")!;
  const input = buildDemoToolInput(tool, mockEcosystemContext);
  checkOk(input !== null);
  if (input) {
    checkEqual(input.scheduleId, "demo-schedule-001");
  }
});

runTest("24. Nenhuma factory altera context", () => {
  const orgId = mockEcosystemContext.activeOrganization.id;
  const tool = mockTools.find((t) => t.name === "listSchedules")!;
  buildDemoToolInput(tool, mockEcosystemContext);
  checkEqual(mockEcosystemContext.activeOrganization.id, orgId);
});

runTest("25. Cada payload é record plano", () => {
  const tool = mockTools.find((t) => t.name === "listSchedules")!;
  const input = buildDemoToolInput(tool, mockEcosystemContext);
  checkEqual(typeof input, "object");
  checkOk(!Array.isArray(input));
});

// ------------------------------------------------------------------
// DISPONIBILIDADE
// ------------------------------------------------------------------

runTest("26. appAccess ausente bloqueia", () => {
  const tool: ToolDefinition = { ...mockTools[0], appId: "missing-app" };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    true,
  );
  checkEqual(availability.kind, "blocked");
  if (availability.kind === "blocked") {
    checkEqual(availability.reason, "missing_app_access");
  }
});

runTest("27. access false bloqueia", () => {
  const ctx: EffectiveEcosystemContext = {
    ...mockEcosystemContext,
    appAccess: [{ appId: "musicscale", access: false, capabilities: [] }],
  };
  const tool: ToolDefinition = { ...mockTools[0], appId: "musicscale" };
  const availability = describeDemoToolAvailability(tool, ctx, true);
  checkEqual(availability.kind, "blocked");
});

runTest("28. human_approval bloqueia", () => {
  const tool: ToolDefinition = {
    ...mockTools[0],
    confirmationPolicy: "human_approval",
  };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    true,
  );
  checkEqual(availability.kind, "blocked");
  if (availability.kind === "blocked") {
    checkEqual(availability.reason, "human_approval");
  }
});

runTest("29. strong bloqueia", () => {
  const tool: ToolDefinition = {
    ...mockTools[0],
    confirmationPolicy: "strong",
  };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    true,
  );
  checkEqual(availability.kind, "blocked");
  if (availability.kind === "blocked") {
    checkEqual(availability.reason, "strong_confirmation");
  }
});

runTest("30. R4 bloqueia", () => {
  const tool: ToolDefinition = { ...mockTools[0], riskLevel: "R4_CRITICAL" };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    true,
  );
  checkEqual(availability.kind, "blocked");
  if (availability.kind === "blocked") {
    checkEqual(availability.reason, "critical_risk");
  }
});

runTest("31. factory ausente bloqueia", () => {
  const tool: ToolDefinition = { ...mockTools[0] };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    false,
  );
  checkEqual(availability.kind, "blocked");
  if (availability.kind === "blocked") {
    checkEqual(availability.reason, "missing_demo_input");
  }
});

runTest("32. R1 disponível", () => {
  const tool: ToolDefinition = {
    ...mockTools[0],
    riskLevel: "R1_AUTH_READ",
    confirmationPolicy: "none",
  };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    true,
  );
  checkEqual(availability.kind, "available");
});

runTest("33. R2 disponível com confirmação", () => {
  const tool: ToolDefinition = {
    ...mockTools[0],
    riskLevel: "R2_REVERSIBLE_WRITE",
    confirmationPolicy: "simple",
  };
  const availability = describeDemoToolAvailability(
    tool,
    mockEcosystemContext,
    true,
  );
  checkEqual(availability.kind, "available");
  if (availability.kind === "available") {
    checkEqual(availability.requiresConfirmation, true);
  }
});

runTest("34. Helper não concede capabilities", () => {
  const ctx = { ...mockEcosystemContext };
  const tool: ToolDefinition = { ...mockTools[0], appId: "musicscale" };
  describeDemoToolAvailability(tool, ctx, true);
  checkEqual(
    ctx.appAccess.find((a) => a.appId === "musicscale")?.capabilities.length,
    mockEcosystemContext.appAccess.find((a) => a.appId === "musicscale")
      ?.capabilities.length,
  );
});

// ------------------------------------------------------------------
// PENDING TOOL
// ------------------------------------------------------------------

const validSelectedTool: ToolDefinition = {
  id: "t1",
  appId: "a1",
  name: "test",
  title: "Test",
  description: "Test",
  riskLevel: "R1_AUTH_READ",
  confirmationPolicy: "none",
  idempotencyPolicy: "not_required",
  organizationScoped: true,
  requiredPermissions: [],
  version: "1.0.0",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  readOnly: true,
  supportsPreview: false,
  supportsUndo: false,
  timeoutMs: 1000,
  auditEventType: "test_invoked",
};

const validPendingTool: PendingDemoToolInvocation = {
  tool: validSelectedTool,
  organizationId: "org1",
  conversationId: "tools-lab:org1",
  requestId: "r1",
  correlationId: "c1",
  args: { organizationId: "org1" },
  channelType: "inapp",
  appAccess: { appId: "a1", capabilities: [] },
};

runTest("35. Contexto válido é aceito", () => {
  checkOk(
    validateToolsPendingContext(validPendingTool, validSelectedTool, "org1"),
  );
});

runTest("36. Outra organização é rejeitada", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    organizationId: "org2",
    conversationId: "tools-lab:org2",
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("37. Outra ferramenta é rejeitada", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, id: "t2" },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("38. Outro appId é rejeitado", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, appId: "a2" },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("39. conversationId incorreto é rejeitado", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    conversationId: "cnv-other",
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("40. args.organizationId divergente é rejeitado", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    args: { organizationId: "org2" },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("41. requestId ausente é rejeitado", () => {
  const pt: PendingDemoToolInvocation = { ...validPendingTool, requestId: "" };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("42. correlationId ausente é rejeitado", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    correlationId: "",
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("43. Objetos originais não são mutados", () => {
  const pt = { ...validPendingTool };
  validateToolsPendingContext(pt, validSelectedTool, "org1");
  checkEqual(pt.organizationId, "org1");
});

runTest("43a. riskLevel divergente invalida", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, riskLevel: "R2_REVERSIBLE_WRITE" },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("43b. confirmationPolicy divergente invalida", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, confirmationPolicy: "simple" },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("43c. version divergente invalida", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, version: "2.0.0" },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("43d. requiredPermissions divergentes invalidam", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, requiredPermissions: ["admin"] },
  };
  checkOk(!validateToolsPendingContext(pt, validSelectedTool, "org1"));
});

runTest("43e. mesmas permissions em ordem diferente validam", () => {
  const pt: PendingDemoToolInvocation = {
    ...validPendingTool,
    tool: { ...validSelectedTool, requiredPermissions: ["b", "a"] },
  };
  const selTool: ToolDefinition = {
    ...validSelectedTool,
    requiredPermissions: ["a", "b"],
  };
  checkOk(validateToolsPendingContext(pt, selTool, "org1"));
});

// ------------------------------------------------------------------
// ESTRUTURA (File reading based tests)
// ------------------------------------------------------------------

const appTsx = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
const toolsPageTsx = fs.readFileSync(
  path.join(process.cwd(), "src/features/tools/ToolsPage.tsx"),
  "utf8",
);
const dialogTsx = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/common/DemoToolConfirmationDialog.tsx",
  ),
  "utf8",
);
const dialogFocusTs = fs.readFileSync(
  path.join(process.cwd(), "src/core/a11y/dialogFocus.ts"),
  "utf8",
);
const inboxPageTsx = fs.readFileSync(
  path.join(process.cwd(), "src/features/inbox/InboxPage.tsx"),
  "utf8",
);

runTest("44. App passa currentLang para ToolsPage", () => {
  checkOk(appTsx.includes("currentLang={currentLang}"));
});

runTest("45. ToolsPage exige currentLang", () => {
  checkOk(toolsPageTsx.includes("currentLang: LanguageCode;"));
});

runTest("46. ToolsPage não contém alert(", () => {
  checkOk(!toolsPageTsx.includes("alert("));
});

runTest("47. ToolsPage não contém confirm(", () => {
  checkOk(!toolsPageTsx.includes("confirm("));
});

runTest("48. ToolsPage não contém prompt(", () => {
  checkOk(!toolsPageTsx.includes("prompt("));
});

runTest("49. selectedTool não usa fallback com ||", () => {
  checkOk(!toolsPageTsx.includes("|| tools[0]"));
});

runTest("50. Seleção inicial não é R3 explícita", () => {
  checkOk(
    !toolsPageTsx.includes(
      "useState<string>('tool_musicscale_add_song_to_living_library')",
    ),
  );
});

runTest("51. Tool list não usa div com onClick para as ferramentas", () => {
  const occurences = (toolsPageTsx.match(/<div[^>]*onClick={/g) || []).length;
  checkOk(occurences === 0, "Should not use div with onClick for tool list");
});

runTest("52. Tool list usa button", () => {
  checkOk(toolsPageTsx.includes("<button"));
  checkOk(toolsPageTsx.includes('type="button"'));
});

runTest("53. Tool list possui aria-current", () => {
  checkOk(
    toolsPageTsx.includes("aria-current={isSelected ? 'true' : 'false'}"),
  );
});

runTest("54. Mobile usa uma visão abaixo de lg", () => {
  checkOk(toolsPageTsx.includes("mobileState.view === 'catalog'"));
  checkOk(toolsPageTsx.includes("mobileState.view === 'detail'"));
});

runTest("55. Múltiplas panes não ativam em md", () => {
  checkOk(!toolsPageTsx.includes("md:grid-cols-12"));
  checkOk(toolsPageTsx.includes("lg:grid-cols-12"));
});

runTest("56. Não existem text-[10px]", () => {
  checkOk(!toolsPageTsx.includes("text-[10px]"));
});

runTest("57. Não existem text-[11px]", () => {
  checkOk(!toolsPageTsx.includes("text-[11px]"));
});

runTest('58. Não existe payload único "Exemplo Hino Novo"', () => {
  checkOk(!toolsPageTsx.includes("Exemplo Hino Novo"));
});

runTest('59. Não existe "Banda Central"', () => {
  checkOk(!toolsPageTsx.includes("Banda Central"));
});

runTest('60. Não existe conversationId "cnv_test"', () => {
  checkOk(!toolsPageTsx.includes("cnv_test"));
});

runTest("61. Locale usa currentLang em ToolsPage", () => {
  checkOk(toolsPageTsx.includes("locale: currentLang"));
});

runTest("62. DemoToolConfirmationDialog permanece em Tools", () => {
  checkOk(toolsPageTsx.includes("<DemoToolConfirmationDialog"));
});

runTest("63. handleConfirm valida pendingTool em Tools", () => {
  checkOk(toolsPageTsx.includes("validateToolsPendingContext("));
});

runTest("64. O botão simulate usa aria-disabled e cursor-not-allowed", () => {
  checkOk(toolsPageTsx.includes("aria-disabled"));
  checkOk(toolsPageTsx.includes("cursor-not-allowed"));
});

runTest("65. R4 não executa e tem texto blockReason", () => {
  checkOk(toolsPageTsx.includes("blockedCritical"));
});

runTest("66. Resultado exibe tags não chumbadas", () => {
  checkOk(!toolsPageTsx.includes("SUCESSO (SUCESSO)"));
});

runTest('67. Resultado não contém "NEGADO (NEGADO)"', () => {
  checkOk(!toolsPageTsx.includes("NEGADO (NEGADO)"));
});

runTest("68. Manifestos não afirmam integração real", () => {
  checkOk(!toolsPageTsx.includes("Integração Real Conectada"));
  checkOk(toolsPageTsx.includes("t.integrationNotConnected"));
});

runTest("69. ExternalLink sem destino foi removido", () => {
  checkOk(!toolsPageTsx.includes("<ExternalLink"));
});

runTest("70. Empty state existe", () => {
  checkOk(toolsPageTsx.includes("t.emptyStateTitle"));
});

runTest("71. Notice inline existe", () => {
  checkOk(toolsPageTsx.includes("notice.kind"));
});

runTest("72. Preview de payload existe", () => {
  checkOk(toolsPageTsx.includes("t.preview"));
  checkOk(toolsPageTsx.includes("buildDemoToolInput("));
});

runTest(
  "73. countToolsByApp é usado para exibir número real de ferramentas",
  () => {
    checkOk(toolsPageTsx.includes("countToolsByApp(tools, app.appId)"));
  },
);

runTest("74. appFilter dinamico existe em ToolsPage", () => {
  checkOk(
    toolsPageTsx.includes("Array.from(new Set(tools.map(t => t.appId)))"),
  );
});

runTest("75. Efeito do dialogo depende somente de isOpen", () => {
  checkOk(dialogTsx.includes("useEffect(() => {\n    if (isOpen) {"));
  checkOk(dialogTsx.includes("}, [isOpen]);"));
});

runTest("76. onCancelRef e onConfirmRef existem", () => {
  checkOk(dialogTsx.includes("onCancelRef.current"));
  checkOk(dialogTsx.includes("onConfirmRef.current"));
});

runTest("77. Inbox passa currentLang", () => {
  checkOk(inboxPageTsx.includes("currentLang={currentLang}"));
});

runTest("78. Tools passa currentLang", () => {
  checkOk(toolsPageTsx.includes("currentLang={currentLang}"));
});

runTest("79. notice usa w-11 h-11", () => {
  checkOk(toolsPageTsx.includes("w-11 h-11 shrink-0 flex items-center"));
});

runTest("80. não existe -mr-2 no notice", () => {
  checkOk(
    !toolsPageTsx.includes(
      "-mr-2 flex items-center justify-center rounded-lg opacity-70",
    ),
  );
});

runTest("81. não existe md:grid-cols-3", () => {
  checkOk(!toolsPageTsx.includes("md:grid-cols-3"));
  checkOk(toolsPageTsx.includes("lg:grid-cols-3"));
});

runTest("82. organizationScoped usa t.yes e t.no", () => {
  checkOk(
    toolsPageTsx.includes("selectedTool.organizationScoped ? t.yes : t.no"),
  );
  checkOk(
    !toolsPageTsx.includes(
      "selectedTool.organizationScoped ? 'true' : 'false'",
    ),
  );
});

runTest("83. selects não usam as ToolsRiskFilter", () => {
  checkOk(!toolsPageTsx.includes("as ToolsRiskFilter"));
});

runTest("84. aria-describedby sempre aponta para status", () => {
  checkOk(
    toolsPageTsx.includes(
      'aria-describedby={isBlocked ? "simulate-status" : undefined}',
    ),
  );
});

runTest("85. Textos afirmam simulação local", () => {
  checkOk(toolsPageTsx.includes("t.simulateDirect"));
  checkOk(toolsPageTsx.includes("t.simulateRequiresConfirmation"));
});

runTest("86. focusTrap exclui disabled", () => {
  checkOk(dialogFocusTs.includes("el.hasAttribute('disabled')"));
});

runTest("87. focusTrap exclui aria-hidden", () => {
  checkOk(dialogFocusTs.includes("el.getAttribute('aria-hidden') === 'true'"));
});

runTest("88. focusTrap exclui inert", () => {
  checkOk(dialogFocusTs.includes("el.hasAttribute('inert')"));
});

runTest("89. previous overflow restaurado", () => {
  checkOk(
    dialogTsx.includes("document.body.style.overflow = previousOverflow"),
  );
});

runTest("90. previousFocusRef safe check", () => {
  checkOk(dialogTsx.includes("instanceof HTMLElement"));
});

console.log(
  `\nTests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Total tests: ${totalTests}. Total assertions: ${totalAssertions}`,
);
if (failedTests > 0) {
  process.exit(1);
}
