const fs = require('fs');

function fixInbox() {
  let content = fs.readFileSync('src/features/inbox/InboxPage.tsx', 'utf-8');
  
  // Add state for modal
  const stateInjection = `
  const [pendingTool, setPendingTool] = useState<{ tool: any, args: any } | null>(null);
  `;
  content = content.replace('const [mobileView, setMobileView] = useState', stateInjection + '\n  const [mobileView, setMobileView] = useState');
  
  // Update handleSimulateTool
  const handleSimulateToolStr = `
  const handleSimulateTool = (toolName: string) => {
    const tool = mockTools.find((t) => t.name === toolName);
    if (!tool) return;
    
    const args = { title: 'Culto de Domingo Exemplo', query: 'Bondade de Deus' };
    
    if (tool.riskLevel === 'R0_PUBLIC' || tool.riskLevel === 'R1_AUTH_READ') {
      executeTool(tool, args);
    } else {
      setPendingTool({ tool, args });
    }
  };

  const executeTool = (tool: any, args: any, demoConfirmation?: any) => {
    const gatewayResult = ToolGatewayService.invokeTool(
      context,
      tool,
      args,
      {
        requestId: \`req_\${Date.now()}\`,
        correlationId: \`corr_\${Date.now()}\`,
        idempotencyKey: \`idempotency_\${Date.now()}\`,
        actor: {
          uid: context.user.uid,
          systemRole: context.user.systemRole,
        },
        organization: {
          id: context.activeOrganization.id,
        },
        appAccess: {
          appId: tool.appId,
          capabilities: [],
        },
        channel: {
          type: activeConversation.channel,
          conversationId: activeConversation.id,
        },
        locale: 'pt-BR',
        demoConfirmation
      }
    );

    const toolMsg: UnifiedMessage = {
      id: \`msg_tool_\${Date.now()}\`,
      conversationId: activeConversation.id,
      senderType: 'agent',
      senderName: 'Suporte MusicScale (Agente IA)',
      content: \`Disparando execução da ferramenta **\${tool.title}** pelo Tool Gateway...\`,
      createdAt: new Date().toISOString(),
      toolInvocation: {
        toolId: tool.id,
        toolName: tool.name,
        appId: tool.appId,
        args,
        status: gatewayResult.result.status === 'success' ? 'executed' : gatewayResult.result.status === 'needs_confirmation' ? 'requested' : 'rejected',
        result: gatewayResult.result,
        riskLevel: tool.riskLevel,
        requiresApproval: tool.confirmationPolicy === 'human_approval',
      },
    };

    setMessages((prev) => [...prev, toolMsg]);
  };
  
  const handleConfirmTool = () => {
    if (!pendingTool) return;
    const { tool, args } = pendingTool;
    const demoConfirmation = {
      confirmationId: \`conf_\${Date.now()}\`,
      requestId: \`req_\${Date.now()}\`, // in reality, should match the invocation requestId
      toolId: tool.id,
      organizationId: context.activeOrganization.id,
      policy: tool.confirmationPolicy === 'explicit' ? 'explicit' : 'simple',
      method: tool.confirmationPolicy === 'explicit' ? 'explicit_click' : 'simple_click',
      confirmedAt: new Date().toISOString(),
    };
    executeTool(tool, args, demoConfirmation);
    setPendingTool(null);
  };
  `;

  content = content.replace(/const handleSimulateTool = \(toolName: string\) => \{[\s\S]*?setMessages\(\(prev\) => \[\.\.\.prev, toolMsg\]\);\n  \};/, handleSimulateToolStr);
  
  // Add modal JSX
  const modalJSX = `
  {pendingTool && (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A2234] border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">Simulação de política: Confirmar Ação</h3>
        <p className="text-sm text-gray-400 mb-4">Esta confirmação é demonstrativa. A autorização real será reavaliada pelo backend do MillionsNest e pelo Tool Gateway.</p>
        <div className="mb-4 bg-black/20 p-3 rounded text-xs font-mono text-gray-300">
          <div>Ferramenta: {pendingTool.tool.name}</div>
          <div>Organização: {context.activeOrganization.name}</div>
          <div>Risco: {pendingTool.tool.riskLevel}</div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setPendingTool(null)} className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition">Cancelar</button>
          <button onClick={handleConfirmTool} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition">Confirmar</button>
        </div>
      </div>
    </div>
  )}
  `;

  content = content.replace('{/* Mobile View Toggle (Top Bar) */}', modalJSX + '\n        {/* Mobile View Toggle (Top Bar) */}');
  
  fs.writeFileSync('src/features/inbox/InboxPage.tsx', content);
}

function fixTools() {
  let content = fs.readFileSync('src/features/tools/ToolsPage.tsx', 'utf-8');
  
  const stateInjection = `
  const [pendingTool, setPendingTool] = useState<{ tool: any, input: any } | null>(null);
  `;
  content = content.replace('const [searchQuery, setSearchQuery] = useState', stateInjection + '\n  const [searchQuery, setSearchQuery] = useState');
  
  const handleInvokeStr = `
  const handleInvoke = () => {
    if (!selectedTool) return;
    
    let parsedInput = {};
    try {
      parsedInput = JSON.parse(testInput);
    } catch (e) {
      alert('JSON de entrada inválido.');
      return;
    }

    if (selectedTool.riskLevel === 'R0_PUBLIC' || selectedTool.riskLevel === 'R1_AUTH_READ') {
      executeTool(selectedTool, parsedInput);
    } else {
      setPendingTool({ tool: selectedTool, input: parsedInput });
    }
  };

  const executeTool = (tool: any, input: any, demoConfirmation?: any) => {
    const gatewayResult = ToolGatewayService.invokeTool(
      context,
      tool,
      input,
      {
        requestId: \`req_\${Date.now()}\`,
        correlationId: \`corr_\${Date.now()}\`,
        idempotencyKey: \`idempotency_\${Date.now()}\`,
        actor: {
          uid: context.user.uid,
          systemRole: context.user.systemRole,
        },
        organization: {
          id: context.activeOrganization.id,
        },
        appAccess: {
          appId: tool.appId,
          capabilities: [], // em um fluxo real o client nao deveria mandar, mas a interface pede
        },
        channel: {
          type: 'inapp',
          conversationId: 'cnv_test',
        },
        locale: 'pt-BR',
        demoConfirmation
      }
    );

    setExecutionResult({
      status: gatewayResult.result.status,
      data: gatewayResult.result.data,
      humanSummary: gatewayResult.result.humanSummary,
      auditId: gatewayResult.result.auditId,
      warnings: gatewayResult.result.warnings
    });
  };

  const handleConfirmTool = () => {
    if (!pendingTool) return;
    const { tool, input } = pendingTool;
    const reqId = \`req_\${Date.now()}\`;
    const demoConfirmation = {
      confirmationId: \`conf_\${Date.now()}\`,
      requestId: reqId,
      toolId: tool.id,
      organizationId: context.activeOrganization.id,
      policy: tool.confirmationPolicy === 'explicit' ? 'explicit' : 'simple',
      method: tool.confirmationPolicy === 'explicit' ? 'explicit_click' : 'simple_click',
      confirmedAt: new Date().toISOString(),
    };
    executeTool(tool, input, demoConfirmation);
    setPendingTool(null);
  };
  `;

  content = content.replace(/const handleInvoke = \(\) => \{[\s\S]*?\}\);[\s]*\};/, handleInvokeStr);
  
  const modalJSX = `
  {pendingTool && (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A2234] border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">Simulação de política: Confirmar Ação</h3>
        <p className="text-sm text-gray-400 mb-4">Esta confirmação é demonstrativa. A autorização real será reavaliada pelo backend do MillionsNest e pelo Tool Gateway.</p>
        <div className="mb-4 bg-black/20 p-3 rounded text-xs font-mono text-gray-300">
          <div>Ferramenta: {pendingTool.tool.name}</div>
          <div>Organização: {context.activeOrganization.name}</div>
          <div>Risco: {pendingTool.tool.riskLevel}</div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setPendingTool(null)} className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition">Cancelar</button>
          <button onClick={handleConfirmTool} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-600/20 transition">Confirmar</button>
        </div>
      </div>
    </div>
  )}
  `;

  content = content.replace('{/* Left Column: Tools Catalog */}', modalJSX + '\n        {/* Left Column: Tools Catalog */}');

  // Fix ToolsPage executionResult rendering
  content = content.replace(/executionResult\.result\?\.success \? 'border-emerald-500\/50 bg-emerald-500\/10 text-emerald-400' : 'border-rose-500\/50 bg-rose-500\/10 text-rose-400'/g, 
    "executionResult.status === 'success' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : executionResult.status === 'needs_confirmation' ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-rose-500/50 bg-rose-500/10 text-rose-400'"
  );
  
  content = content.replace(/executionResult\.result\?\.success \? 'SUCESSO' : 'NEGADO'/g, 
    "executionResult.status === 'success' ? 'SUCESSO' : executionResult.status === 'needs_confirmation' ? 'AGUARDANDO CONFIRMAÇÃO' : executionResult.status === 'conflict' ? 'CONFLITO' : executionResult.status === 'denied' ? 'NEGADO' : 'FALHA'"
  );

  content = content.replace(/executionResult\.result/g, "executionResult");

  fs.writeFileSync('src/features/tools/ToolsPage.tsx', content);
}

try {
  fixInbox();
  fixTools();
  console.log('Fixed UIs');
} catch (e) {
  console.error(e);
}
