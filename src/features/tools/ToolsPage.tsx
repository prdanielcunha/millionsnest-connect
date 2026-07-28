/**
 * MillionsNest Connect - Ecosystem Apps & Registered Tools
 */

import React, { useState, useEffect, useReducer } from 'react';
import { 
  prepareDemoToolInvocation, 
  classifyDemoToolFlow, 
  createDemoConfirmationEvidence, 
  buildDemoToolInvocationContext, 
  PendingDemoToolInvocation 
} from '../../demo/confirmations/demoToolFlow';
import { DemoToolConfirmationDialog } from '../../components/common/DemoToolConfirmationDialog';
import {
  Grid,
  ShieldCheck,
  Music,
  Landmark,
  Bot,
  AlertTriangle,
  Play,
  CheckCircle2,
  Lock,
  Code2,
  Search,
  X,
  ChevronLeft,
  XCircle,
  Info
} from 'lucide-react';
import { ToolDefinition, EffectiveEcosystemContext, RiskLevel, ToolGatewayInvocationResponse, LanguageCode } from '../../types';
import { mockTools, mockAppManifests } from '../../demo/mockData';
import { ToolGatewayService } from '../../core/services/toolGateway';
import { 
  toolsMobileReducer, 
  ToolsMobileState, 
  ToolsMobileAction 
} from './toolsMobileState';
import { 
  filterTools, 
  selectToolById, 
  validateToolsPendingContext, 
  describeDemoToolAvailability, 
  ToolsAppFilter, 
  ToolsRiskFilter,
  countToolsByApp,
  isToolVisibleInFilteredSet,
  isToolsRiskFilter
} from './toolsDomain';
import { buildDemoToolInput } from './demoToolInputs';
import { toolsUxCatalog } from '../../i18n/toolsUx';

type ToolsNotice = {
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
} | null;

interface ToolsPageProps {
  context: EffectiveEcosystemContext;
  currentLang: LanguageCode;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ context, currentLang }) => {
  const t = toolsUxCatalog[currentLang] || toolsUxCatalog['pt-BR'];

  const [mobileState, dispatch] = useReducer(toolsMobileReducer, { view: 'catalog' });
  const [tools] = useState<ToolDefinition[]>(mockTools);
  
  // Initialize with a safe R1 tool if possible
  const initialSafeTool = tools.find((t) => t.riskLevel === 'R1_AUTH_READ' && t.name === 'listSchedules') || tools.find(t => t.riskLevel === 'R1_AUTH_READ') || null;
  const [selectedToolId, setSelectedToolId] = useState<string | null>(initialSafeTool ? initialSafeTool.id : null);
  
  const [executionResult, setExecutionResult] = useState<ToolGatewayInvocationResponse | null>(null);
  const [pendingTool, setPendingTool] = useState<PendingDemoToolInvocation | null>(null);
  const [notice, setNotice] = useState<ToolsNotice>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [appFilter, setAppFilter] = useState<ToolsAppFilter>('all');
  const [riskFilter, setRiskFilter] = useState<ToolsRiskFilter>('all');

  const selectedTool = selectToolById(tools, selectedToolId);
  const filteredTools = filterTools(tools, { query: searchQuery, appId: appFilter, risk: riskFilter });

  useEffect(() => {
    if (selectedToolId && !isToolVisibleInFilteredSet(filteredTools, selectedToolId)) {
      setPendingTool(null);
      setExecutionResult(null);
      setNotice(null);
      setSelectedToolId(null);
      dispatch({ type: 'OPEN_CATALOG' });
    }
  }, [filteredTools, selectedToolId]);

  useEffect(() => {
    setPendingTool(null);
    setExecutionResult(null);
    setNotice(null);
    dispatch({ type: 'CHANGE_ORG' });
  }, [context.activeOrganization.id]);

  const handleSelectTool = (id: string) => {
    setSelectedToolId(id);
    setExecutionResult(null);
    setPendingTool(null);
    setNotice(null);
    dispatch({ type: 'OPEN_DETAIL' });
  };

  const handleBackToCatalog = () => {
    dispatch({ type: 'OPEN_CATALOG' });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setAppFilter('all');
    setRiskFilter('all');
  };

  const handleTestInvocation = () => {
    setNotice(null);
    if (!selectedTool) return;

    const demoInput = buildDemoToolInput(selectedTool, context);
    const availability = describeDemoToolAvailability(selectedTool, context, demoInput !== null);

    if (availability.kind === 'blocked') {
      let blockReason = t.unknownStatus;
      if (availability.reason === 'missing_app_access') blockReason = t.blockedAppAccess;
      if (availability.reason === 'missing_demo_input') blockReason = t.blockedMissingInput;
      if (availability.reason === 'human_approval') blockReason = t.blockedHumanApproval;
      if (availability.reason === 'strong_confirmation') blockReason = t.blockedStrong;
      if (availability.reason === 'critical_risk') blockReason = t.blockedCritical;
      
      setNotice({ kind: 'error', message: blockReason });
      return;
    }

    const pending = prepareDemoToolInvocation(
      context,
      selectedTool,
      demoInput!,
      'inapp',
      `tools-lab:${context.activeOrganization.id}`
    );

    if (!pending) {
      setNotice({ kind: 'error', message: t.blockedAppAccess });
      return;
    }

    const resolution = classifyDemoToolFlow(selectedTool, pending);

    if (resolution.kind === 'execute_directly') {
      const invokeCtx = buildDemoToolInvocationContext(resolution.pending, context);
      // Ensure locale uses currentLang
      const finalCtx = { ...invokeCtx, locale: currentLang };
      const res = ToolGatewayService.invokeTool(context, selectedTool, resolution.pending.args, finalCtx);
      setExecutionResult(res);
      setNotice({ kind: 'info', message: t.localMemoryNotice });
    } else if (resolution.kind === 'confirmation_required') {
      setPendingTool(resolution.pending);
    } else {
      setNotice({ kind: 'error', message: resolution.reason });
    }
  };

  const handleConfirmTool = () => {
    if (!pendingTool || !selectedTool) return;

    if (!validateToolsPendingContext(pendingTool, selectedTool, context.activeOrganization.id)) {
      setPendingTool(null);
      setNotice({ kind: 'error', message: t.conflict });
      return;
    }
    
    const demoInput = buildDemoToolInput(selectedTool, context);
    const availability = describeDemoToolAvailability(selectedTool, context, demoInput !== null);
    
    if (availability.kind !== 'available' || !availability.requiresConfirmation) {
      setPendingTool(null);
      setNotice({ kind: 'error', message: t.conflict });
      return;
    }
    
    const evidence = createDemoConfirmationEvidence(
      pendingTool,
      pendingTool.tool.confirmationPolicy === 'explicit' ? 'explicit_click' : 'simple_click'
    );
    
    const invokeCtx = buildDemoToolInvocationContext(pendingTool, context, evidence);
    const finalCtx = { ...invokeCtx, locale: currentLang };
    const res = ToolGatewayService.invokeTool(context, pendingTool.tool, pendingTool.args, finalCtx);
    
    setExecutionResult(res);
    setPendingTool(null);
    setNotice({ kind: 'info', message: t.localMemoryNotice });
  };

  const handleCancelTool = () => {
    setPendingTool(null);
  };

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'R0_PUBLIC':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs border border-emerald-500/30 shrink-0">R0</span>;
      case 'R1_AUTH_READ':
        return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-xs border border-blue-500/30 shrink-0">R1</span>;
      case 'R2_REVERSIBLE_WRITE':
        return <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-xs border border-amber-500/30 shrink-0">R2</span>;
      case 'R3_PRIVILEGED':
        return <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-xs border border-rose-500/30 shrink-0">R3</span>;
      case 'R4_CRITICAL':
        return <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs border border-purple-500/30 shrink-0">R4</span>;
    }
  };

  // Visibility classes based on mobile state
  const catalogVisibility = mobileState.view === 'catalog' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col';
  const detailVisibility = mobileState.view === 'detail' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col';

  return (
    <div className="flex flex-col h-full bg-[#0B0F19] lg:p-6 lg:gap-6">
      {/* Ecosystem Apps Catalog (Always visible on desktop, hidden on detail in mobile) */}
      <div className={`shrink-0 space-y-4 p-4 lg:p-0 ${mobileState.view === 'catalog' ? 'block' : 'hidden lg:block'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
              {t.title}
            </h1>
            <p className="text-xs text-gray-400">
              {t.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {mockAppManifests.map((app) => (
            <div
              key={app.appId}
              className="p-4 bg-[#121824] border border-white/10 rounded-2xl space-y-3 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 shrink-0">
                    {app.appId === 'musicscale' ? <Music className="w-4 h-4" /> : app.appId === 'nestfinance' ? <Landmark className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{app.name}</h3>
                    <span className="text-xs text-gray-500 font-mono truncate block">ID: {app.appId}</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold uppercase font-mono shrink-0 ${
                    app.status === 'ativo'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {app.status === 'ativo' ? t.demoManifestAvailable : t.planned}
                </span>
              </div>
              <p className="text-xs text-gray-400 flex-1">{app.status === 'ativo' ? t.integrationNotConnected : t.noRemoteServiceActive}</p>
              <div className="pt-2 border-t border-white/5 text-xs text-indigo-400 font-mono flex items-center justify-between">
                <span>{app.status === 'ativo' && countToolsByApp(tools, app.appId) > 0 ? `${countToolsByApp(tools, app.appId)} ${t.registeredTools}` : t.noToolsRegistered}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 bg-[#0B0F19] lg:bg-transparent">
        
        {/* Left Column: Tools Catalog */}
        <div className={`lg:col-span-5 lg:bg-[#121824] lg:border lg:border-white/10 lg:rounded-2xl flex-col min-h-0 ${catalogVisibility}`}>
          <div className="p-4 space-y-3 shrink-0 lg:border-b lg:border-white/10">
            {/* Filters */}
            <div className="relative">
              <label htmlFor="searchQuery" className="sr-only">{t.searchLabel}</label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                id="searchQuery"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                autoComplete="off"
                className="w-full min-h-[44px] bg-[#1A2234] border border-white/10 rounded-xl pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
            <div className="flex gap-2">
              <label htmlFor="appFilter" className="sr-only">{t.appFilterLabel}</label>
              <select
                id="appFilter"
                value={appFilter}
                onChange={(e) => setAppFilter(e.target.value as ToolsAppFilter)}
                className="flex-1 min-h-[44px] bg-[#1A2234] border border-white/10 rounded-xl px-3 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{t.filterAllApps}</option>
                {Array.from(new Set(tools.map(t => t.appId))).map(appId => (
                  <option key={appId} value={appId}>{appId}</option>
                ))}
              </select>
              <label htmlFor="riskFilter" className="sr-only">{t.riskFilterLabel}</label>
              <select
                id="riskFilter"
                value={riskFilter}
                onChange={(e) => setRiskFilter(isToolsRiskFilter(e.target.value) ? e.target.value : 'all')}
                className="flex-1 min-h-[44px] bg-[#1A2234] border border-white/10 rounded-xl px-3 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">{t.filterAllRisks}</option>
                <option value="R0_PUBLIC">{t.publicRisk}</option>
                <option value="R1_AUTH_READ">{t.authReadRisk}</option>
                <option value="R2_REVERSIBLE_WRITE">{t.reversibleWriteRisk}</option>
                <option value="R3_PRIVILEGED">{t.privilegedRisk}</option>
                <option value="R4_CRITICAL">{t.criticalRisk}</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-0 lg:pt-4 space-y-2">
            {filteredTools.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#1A2234] flex items-center justify-center">
                  <Search className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t.emptyStateTitle}</h3>
                  <p className="text-xs text-gray-400 mt-1">{t.emptyStateDesc}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 min-h-[44px] text-indigo-400 text-sm font-semibold hover:bg-indigo-500/10 rounded-xl transition"
                >
                  {t.clearFilters}
                </button>
              </div>
            ) : (
              filteredTools.map((tool) => {
                const isSelected = selectedToolId === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleSelectTool(tool.id)}
                    aria-current={isSelected ? 'true' : 'false'}
                    className={`w-full min-h-[64px] p-3 rounded-xl text-left transition flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/40 shadow-sm'
                        : 'bg-[#1A2234] hover:bg-[#222C42] border border-white/5'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono truncate">{tool.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 block truncate">{tool.title}</span>
                    </div>
                    {getRiskBadge(tool.riskLevel)}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Tool Detail */}
        {selectedTool ? (
          <div className={`lg:col-span-7 bg-[#121824] border-t lg:border border-white/10 lg:rounded-2xl flex-col min-h-0 ${detailVisibility}`}>
            {/* Mobile Header */}
            <div className="lg:hidden shrink-0 flex items-center gap-2 p-4 border-b border-white/10">
              <button
                type="button"
                onClick={handleBackToCatalog}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#1A2234] text-gray-300 hover:text-white"
                aria-label={t.back}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-white">{t.toolDetails}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedTool.title}</h2>
                    <span className="text-sm text-gray-400 font-mono break-all">{selectedTool.name}</span>
                  </div>
                  {getRiskBadge(selectedTool.riskLevel)}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{selectedTool.description}</p>
              </div>

              {/* Notice Area */}
              {notice && (
                <div
                  role={notice.kind === 'error' || notice.kind === 'warning' ? 'alert' : 'status'}
                  className={`p-4 rounded-xl flex items-start gap-3 border ${
                    notice.kind === 'error' ? 'bg-rose-950/40 border-rose-500/30 text-rose-200' :
                    notice.kind === 'warning' ? 'bg-amber-950/40 border-amber-500/30 text-amber-200' :
                    notice.kind === 'success' ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' :
                    'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {notice.kind === 'error' ? <AlertTriangle className="w-4 h-4" /> :
                     notice.kind === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                     notice.kind === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                     <Info className="w-4 h-4" />}
                  </div>
                  <p className="text-sm flex-1">{notice.message}</p>
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    aria-label={t.closeNotice}
                    className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Tool Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1">
                  <span className="text-gray-500 text-xs uppercase font-mono block">{t.requiredPermissions}</span>
                  <span className="text-cyan-300 font-semibold font-mono break-words">
                    {selectedTool.requiredPermissions.length > 0 ? selectedTool.requiredPermissions.join(', ') : t.nonePublic}
                  </span>
                </div>
                <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1">
                  <span className="text-gray-500 text-xs uppercase font-mono block">{t.confirmationPolicy}</span>
                  <span className="text-amber-300 font-semibold font-mono break-words">{selectedTool.confirmationPolicy}</span>
                </div>
                <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1">
                  <span className="text-gray-500 text-xs uppercase font-mono block">{t.idempotencyPolicy}</span>
                  <span className="text-emerald-300 font-semibold font-mono break-words">{selectedTool.idempotencyPolicy}</span>
                </div>
                <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1">
                  <span className="text-gray-500 text-xs uppercase font-mono block">{t.organizationScoped}</span>
                  <span className="text-purple-300 font-semibold font-mono break-words">{selectedTool.organizationScoped ? t.yes : t.no}</span>
                  <span className="text-xs text-gray-500 block mt-1">
                    {selectedTool.organizationScoped ? t.activeOrganizationContext : t.globalScopeDeclared}
                  </span>
                </div>
              </div>

              {/* Payload Preview */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-400" />
                  {t.preview}
                </h3>
                <p className="text-xs text-gray-400">{t.payloadDesc}</p>
                <div className="bg-[#0B0F19] rounded-xl border border-white/10 p-3 overflow-x-auto">
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre">
                    {JSON.stringify(buildDemoToolInput(selectedTool, context), null, 2)}
                  </pre>
                </div>
              </div>

              {/* Test Execution Simulator */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                {(() => {
                  const demoInput = buildDemoToolInput(selectedTool, context);
                  const availability = describeDemoToolAvailability(selectedTool, context, demoInput !== null);
                  const isBlocked = availability.kind === 'blocked';
                  let blockReason = t.unknownStatus;
                  if (isBlocked) {
                    if (availability.reason === 'missing_app_access') blockReason = t.blockedAppAccess;
                    if (availability.reason === 'missing_demo_input') blockReason = t.blockedMissingInput;
                    if (availability.reason === 'human_approval') blockReason = t.blockedHumanApproval;
                    if (availability.reason === 'strong_confirmation') blockReason = t.blockedStrong;
                    if (availability.reason === 'critical_risk') blockReason = t.blockedCritical;
                  }
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleTestInvocation}
                        disabled={isBlocked}
                        aria-disabled={isBlocked ? "true" : "false"}
                        aria-describedby="simulate-status"
                        className={`w-full min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          isBlocked 
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {isBlocked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{t.simulate}</span>
                      </button>
                      <p id="simulate-status" className={`text-xs text-center ${isBlocked ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {isBlocked ? blockReason : (availability.kind === 'available' && availability.requiresConfirmation) ? t.simulateRequiresConfirmation : t.simulateDirect}
                      </p>
                    </div>
                  );
                })()}

                {executionResult && (
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t.resultTitle}</span>
                      <button
                        type="button"
                        onClick={() => setExecutionResult(null)}
                        className="min-h-[44px] px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition"
                      >
                        {t.clearResult}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-mono font-bold break-words">
                      {executionResult.result?.status === 'success' ? (
                        <span className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 shrink-0"/> {t.successSimulated}</span>
                      ) : executionResult.result?.status === 'needs_confirmation' ? (
                        <span className="text-amber-400 flex items-center gap-1.5"><Lock className="w-4 h-4 shrink-0"/> {t.needsConfirmation}</span>
                      ) : executionResult.result?.status === 'conflict' ? (
                        <span className="text-amber-400 flex items-center gap-1.5"><Lock className="w-4 h-4 shrink-0"/> {t.conflict}</span>
                      ) : executionResult.result?.status === 'denied' ? (
                        <span className="text-rose-400 flex items-center gap-1.5"><XCircle className="w-4 h-4 shrink-0"/> {t.denied}</span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0"/> {t.failed}</span>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-300 space-y-1 pt-2 border-t border-white/5">
                      <p><span className="text-gray-500">{t.requestId}:</span> <span className="font-mono">{executionResult.auditEvent?.requestId || t.unknownStatus}</span></p>
                      <p><span className="text-gray-500">{t.correlationId}:</span> <span className="font-mono">{executionResult.auditEvent?.correlationId || t.unknownStatus}</span></p>
                      <p><span className="text-gray-500">{t.toolName}:</span> <span className="font-mono">{executionResult.auditEvent?.toolName || selectedTool.name}</span></p>
                      <p><span className="text-gray-500">{t.appId}:</span> <span className="font-mono">{executionResult.auditEvent?.appId || selectedTool.appId}</span></p>
                      <p><span className="text-gray-500">{t.organization}:</span> <span className="font-mono">{executionResult.auditEvent?.organizationId || context.activeOrganization.id}</span></p>
                      <p><span className="text-gray-500">{t.risk}:</span> <span className="font-mono">{executionResult.auditEvent?.riskLevel || selectedTool.riskLevel}</span></p>
                      <p><span className="text-gray-500">{t.confirmation}:</span> <span className="font-mono">{executionResult.auditEvent?.confirmationState || t.unknownStatus}</span></p>
                      <p><span className="text-gray-500">{t.humanSummary}:</span> {executionResult.result?.humanSummary || t.unknownStatus}</p>
                    </div>

                    <p className="text-xs text-indigo-300 italic">{t.localMemoryNotice}</p>
                    
                    <details className="mt-2 group">
                      <summary className="min-h-[44px] flex items-center cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 font-mono select-none outline-none group-focus-visible:ring-2 group-focus-visible:ring-indigo-500 rounded px-1 -mx-1">
                        {t.rawJson}
                      </summary>
                      <div className="mt-1 bg-[#0B0F19] p-3 rounded-lg overflow-x-auto border border-white/5">
                        <pre className="text-xs font-mono text-gray-300 whitespace-pre">
                          {JSON.stringify(executionResult, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={`lg:col-span-7 bg-[#121824] border-t lg:border border-white/10 lg:rounded-2xl flex-col items-center justify-center p-6 text-center space-y-3 min-h-0 ${detailVisibility}`}>
             <div className="w-12 h-12 rounded-full bg-[#1A2234] flex items-center justify-center">
                <Code2 className="w-6 h-6 text-gray-500" />
              </div>
              <h3 className="text-sm font-bold text-white">{t.noToolSelectedTitle}</h3>
              <p className="text-xs text-gray-400">{t.noToolSelectedDescription}</p>
          </div>
        )}
      </div>

      <DemoToolConfirmationDialog
        pending={pendingTool}
        isOpen={!!pendingTool}
        onConfirm={handleConfirmTool}
        onCancel={handleCancelTool}
        currentLang={currentLang}
      />
    </div>
  );
};
