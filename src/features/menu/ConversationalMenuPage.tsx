import React, { useState, useReducer, useEffect } from 'react';
import {
  Smartphone,
  Lock,
  Send,
  Sparkles,
  Bot,
  UserCheck,
  Building,
  ArrowLeft,
  Info,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { EffectiveEcosystemContext, LanguageCode } from '../../types';
import { BrandLogo } from '../../components/common/BrandLogo';
import { ConversationalMenuService, ConversationalMenuResponse } from '../../core/services/conversationalMenu';
import { menuUxCatalog } from '../../i18n/menuUx';
import { mockTools } from '../../demo/mockData';
import {
  DemoIdentityScenario,
  staticOptionDefinitions,
  optionsLocalizedCatalog,
  resolveDemoMenuProjection,
  ProjectedMenuOption,
  getProjectionReasonText,
  MenuProjectionReason
} from './menuDomain';
import {
  menuMobileReducer,
  initialMobileState
} from './menuMobileState';

interface ConversationalMenuPageProps {
  context: EffectiveEcosystemContext;
  currentLang: LanguageCode;
}

export const ConversationalMenuPage: React.FC<ConversationalMenuPageProps> = ({
  context,
  currentLang,
}) => {
  const strings = menuUxCatalog[currentLang] || menuUxCatalog['pt-BR'];

  // State
  const [scenario, setScenario] = useState<DemoIdentityScenario>('linked_demo');
  const [channel, setChannel] = useState<'whatsapp' | 'instagram' | 'inapp'>('whatsapp');
  const [userInput, setUserInput] = useState<string>('menu');
  const [selectedAction, setSelectedAction] = useState<ProjectedMenuOption | null>(null);

  // Mobile navigation state
  const [mobileState, dispatchMobile] = useReducer(menuMobileReducer, initialMobileState);

  // Derive menu response
  const menuResponse: ConversationalMenuResponse = ConversationalMenuService.getMenu({
    input: userInput,
    locale: currentLang,
     
    scenario,
    context,
    tools: mockTools,
  });

  // Recalculate or reset state when organization changes
  useEffect(() => {
    dispatchMobile({ type: 'CHANGE_ORG' });
  }, [context.activeOrganization.id]);

  // Limpar selectedAction obsoleto quando o contexto base ou input mudar
  useEffect(() => {
    setSelectedAction(null);
  }, [userInput, currentLang, scenario, context.activeOrganization.id, channel]);

  const handleTestTrigger = (triggerText: string) => {
    setUserInput(triggerText);
    setSelectedAction(null);
    dispatchMobile({ type: 'OPEN_PREVIEW' });
  };

  const handleOptionClick = (opt: ProjectedMenuOption) => {
    setSelectedAction(opt);
  };

  // Pre-calculated diagnostic projection for all option definitions
  const diagnosticProjection = resolveDemoMenuProjection(
    context,
    scenario,
    staticOptionDefinitions,
    mockTools
  );

  const localizedMap = optionsLocalizedCatalog[currentLang] || optionsLocalizedCatalog['pt-BR'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-gray-200">
      {/* Header Banner */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
              <Bot className="w-4 h-4" />
              <span>{strings.demoMode}</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {strings.pageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {strings.pageDesc}
            </p>
          </div>

          {/* Quick Active Org Badge */}
          <div className="flex items-center gap-2 bg-[#1A2234] border border-white/10 px-4 py-2.5 rounded-xl text-xs">
            <Building className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-gray-400 block font-mono">{strings.organizationLabel}:</span>
              <span className="font-bold text-white">{context.activeOrganization.name}</span>
            </div>
          </div>
        </div>

        {/* Identity Notice */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-normal">{strings.authNotice}</p>
        </div>
      </div>

      {/* Mobile view toggle switcher tabs (only below lg) */}
      <div className="flex lg:hidden bg-[#121824] p-1 border border-white/10 rounded-xl">
        <button
          type="button"
          onClick={() => dispatchMobile({ type: 'OPEN_CONFIGURE' })}
          className={`flex-1 py-3 min-h-[44px] text-xs font-semibold rounded-lg transition-all ${
            mobileState.activeView === 'configure'
              ? 'bg-indigo-600 text-white font-bold shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {strings.tabConfigure}
        </button>
        <button
          type="button"
          onClick={() => dispatchMobile({ type: 'OPEN_PREVIEW' })}
          className={`flex-1 py-3 min-h-[44px] text-xs font-semibold rounded-lg transition-all ${
            mobileState.activeView === 'preview'
              ? 'bg-indigo-600 text-white font-bold shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {strings.tabPreview}
        </button>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left pane: Configuration (visible on lg OR when mobileState is 'configure') */}
        <div
          className={`space-y-6 lg:col-span-5 ${
            mobileState.activeView === 'configure' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Identity Scenario Panel */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                👤 {strings.scenarioLegend}
              </legend>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 bg-[#1A2234] border border-white/10 hover:border-white/20 rounded-xl transition min-h-[44px] cursor-pointer">
                  <input
                    type="radio"
                    name="identityScenario"
                    value="linked_demo"
                    checked={scenario === 'linked_demo'}
                    onChange={() => {
                      setScenario('linked_demo');
                      setSelectedAction(null);
                    }}
                    className="mt-1 w-4 h-4 text-indigo-600 border-white/10 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {strings.scenarioLinked}
                    </span>
                    <span className="text-gray-400 mt-0.5 block leading-normal">
                      {strings.scenarioLinkedDesc}
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-[#1A2234] border border-white/10 hover:border-white/20 rounded-xl transition min-h-[44px] cursor-pointer">
                  <input
                    type="radio"
                    name="identityScenario"
                    value="unlinked_demo"
                    checked={scenario === 'unlinked_demo'}
                    onChange={() => {
                      setScenario('unlinked_demo');
                      setSelectedAction(null);
                    }}
                    className="mt-1 w-4 h-4 text-indigo-600 border-white/10 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      {strings.scenarioUnlinked}
                    </span>
                    <span className="text-gray-400 mt-0.5 block leading-normal">
                      {strings.scenarioUnlinkedDesc}
                    </span>
                  </div>
                </label>
              </div>
            </fieldset>
          </div>

          {/* Trigger Inputs Panel */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              {strings.triggersTitle}
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              {strings.triggersDesc}
            </p>

            <div className="flex flex-wrap gap-2">
              {strings.triggerExamples.map((kw) => (
                <button
                  type="button"
                  key={kw}
                  onClick={() => handleTestTrigger(kw)}
                  className="px-3.5 py-2.5 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 rounded-lg text-xs font-mono text-cyan-300 min-h-[44px] transition"
                >
                  {kw}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-3 border-t border-white/5">
              <label htmlFor="user-trigger-input" className="text-xs text-gray-300 font-medium block">
                {strings.inputLabel}
              </label>
              <div className="flex gap-2">
                <input
                  id="user-trigger-input"
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      dispatchMobile({ type: 'OPEN_PREVIEW' });
                    }
                  }}
                  autoComplete="off"
                  placeholder={strings.inputPlaceholder}
                  className="flex-1 bg-[#1A2234] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => dispatchMobile({ type: 'OPEN_PREVIEW' })}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition min-h-[44px]"
                >
                  <span>{strings.triggerBtn}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Diagnostic Projection Panel */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {strings.projectionStatusTitle}
            </h3>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {staticOptionDefinitions.map((opt) => {
                const loc = localizedMap[opt.id];
                const proj = diagnosticProjection[opt.id] || { allowed: false, reason: undefined };
                return (
                  <div
                    key={opt.id}
                    className="p-3 bg-[#1A2234] border border-white/5 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        [{opt.numberKey}] {loc ? loc.title : opt.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          proj.allowed
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        }`}
                      >
                        {proj.allowed ? strings.projectionStatusAllowed : strings.projectionStatusBlocked}
                      </span>
                    </div>
                    {opt.category === 'protected' && (
                      <div className="text-xs text-gray-400 space-y-0.5">
                        <span className="block">
                          {strings.appLabel}: <code className="text-gray-300">{opt.appId}</code> | {strings.toolLabel}:{' '}
                          <code className="text-gray-300">{opt.toolName || strings.notApplicable}</code>
                        </span>
                        {!proj.allowed && proj.reason && (
                          <span className="text-rose-300 font-medium block">
                            {proj.reason === 'unlinked' ? strings.reasonUnlinked
                             : proj.reason === 'membership_missing' ? strings.reasonMembershipMissing
                             : proj.reason === 'membership_inactive' ? strings.reasonMembershipInactive
                             : proj.reason === 'app_access_missing' ? strings.reasonAppAccessMissing
                             : proj.reason === 'app_access_disabled' ? strings.reasonAppAccessDisabled
                             : proj.reason === 'tool_missing' ? strings.reasonToolMissing
                             : proj.reason === 'permission_missing' ? strings.reasonPermissionMissing
                             : proj.reason === 'context_incomplete' ? strings.reasonContextIncomplete
                             : proj.reason === 'contract_missing' ? strings.contractMissingReason
                             : proj.reason === 'global_policy_unavailable' ? strings.reasonGlobalPolicyUnavailable
                             : getProjectionReasonText(proj.reason, strings)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right pane: Preview (visible on lg OR when mobileState is 'preview') */}
        <section
          aria-label={strings.menuPreviewLabel}
          className={`space-y-6 lg:col-span-7 ${
            mobileState.activeView === 'preview' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="bg-[#121824] border border-white/10 rounded-2xl p-5 shadow-xl space-y-5">
            
            {/* Header of Preview Panel */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {strings.channelLegend}
                </span>
              </div>

              {/* Selector of channel */}
              <fieldset className="flex bg-[#1A2234] border border-white/10 rounded-xl p-1 text-xs">
                <legend className="sr-only">{strings.channelSelectorLabel}</legend>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('whatsapp');
                    setSelectedAction(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white' }`}
                >
                  {strings.channelWhatsapp}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('instagram');
                    setSelectedAction(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${
                      channel === 'instagram' ? 'bg-[#D10E65] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {strings.channelInstagram}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('inapp');
                    setSelectedAction(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${
                      channel === 'inapp' ? 'bg-[#5145CD] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {strings.channelInapp}
                </button>
              </fieldset>
            </div>

            {/* Warning that channel is not connected */}
            <div className="p-3 bg-[#1A2234]/60 border border-white/5 rounded-xl text-xs text-gray-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-gray-300">{strings.channelNotConnected}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{strings.localPreviewNote}</p>
              </div>
            </div>

            {/* Simulated Smartphone Screen Wrapper */}
            <div className="max-w-md mx-auto bg-[#07090E] border-4 border-[#1A2234] rounded-[36px] overflow-hidden shadow-2xl relative">
              
              {/* Simulated Preview Header */}
              <div className="bg-[#121824] flex flex-col items-center justify-center p-3 text-xs text-gray-400 font-mono select-none border-b border-white/5">
                <span className="font-bold text-gray-300">{strings.localPreviewHeader}</span>
                <span className="opacity-70 mt-1">{strings.demoMode}</span>
              </div>

              {/* Chat Canvas area */}
              <div className="p-4 space-y-4 min-h-[460px] max-h-[520px] overflow-y-auto bg-[#0B0E14] relative">
                
                {/* Back button (only visible on mobile layout in preview mode) */}
                <button
                  type="button"
                  onClick={() => dispatchMobile({ type: 'OPEN_CONFIGURE' })}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-[#1A2234] text-xs text-gray-300 rounded-lg border border-white/15 mb-3 min-h-[44px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{strings.btnBack}</span>
                </button>

                {/* Sender Title Identity */}
                <div className="p-3 bg-[#121824] border border-white/10 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 flex items-center justify-center">
                    <BrandLogo layout="mark" surface="dark" className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      MillionsNest Connect
                    </span>
                    <span className="text-[12px] text-indigo-300 block">
                      {strings.demoMode}
                    </span>
                  </div>
                </div>

                {/* User Input Bubble */}
                <div className="flex justify-end">
                  <div className="bg-indigo-600 text-white text-xs px-4 py-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-lg leading-relaxed">
                    {userInput}
                  </div>
                </div>

                {/* Bot Interactive Menu Bubble */}
                <div className="flex justify-start">
                  <div className="bg-[#121824] border border-white/10 text-gray-200 text-xs p-4 rounded-2xl rounded-tl-none max-w-[90%] space-y-4 shadow-xl">
                    
                    {/* Bot header info inside bubble */}
                    <div>
                      <h4 className="font-bold text-indigo-300 text-sm flex items-center gap-1.5">
                        <Bot className="w-4 h-4" />
                        {menuResponse.menuTitle}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                        {menuResponse.subtitle}
                      </p>
                    </div>

                    {/* Render menu response if trigger matched */}
                    {menuResponse.isTriggerMatch ? (
                      <div className="space-y-4">
                        {/* Public Options */}
                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">
                            {strings.publicOptionsHeader}
                          </span>
                          <div className="space-y-2">
                            {menuResponse.publicOptions.map((opt) => (
                              <button
                                type="button"
                                key={opt.id}
                                onClick={() => handleOptionClick(opt)}
                                aria-current={selectedAction?.id === opt.id ? 'true' : undefined}
                                className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 min-h-[44px] ${
                                  selectedAction?.id === opt.id
                                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow'
                                    : 'bg-[#1A2234] hover:bg-[#222C42] border-white/5 text-gray-300'
                                }`}
                              >
                                <span className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                                  {opt.numberKey}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-white text-xs block truncate">
                                      {opt.title}
                                    </span>
                                    {opt.badge && (
                                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                        {opt.badge}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-400 leading-normal block mt-0.5">
                                    {opt.description}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Protected Options (only if linked) */}
                        {scenario === 'linked_demo' && menuResponse.musicscaleAuthOptions.length > 0 && (
                          <div className="space-y-2 pt-3 border-t border-cyan-500/20">
                            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                              {strings.protectedOptionsHeader}
                            </span>
                            <div className="space-y-2">
                              {menuResponse.musicscaleAuthOptions.map((opt) => (
                                <button
                                  type="button"
                                  key={opt.id}
                                  onClick={() => handleOptionClick(opt)}
                                  aria-current={selectedAction?.id === opt.id ? 'true' : undefined}
                                  className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 min-h-[44px] ${
                                    selectedAction?.id === opt.id
                                      ? 'bg-cyan-500/20 border-cyan-500 text-white shadow'
                                      : 'bg-[#1A2234] hover:bg-[#222C42] border-white/5 text-gray-300'
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs shrink-0 font-mono mt-0.5">
                                    {opt.numberKey}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-white text-xs block truncate">
                                        {opt.title}
                                      </span>
                                      {opt.badge && (
                                        <span className="text-xs bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                          {opt.badge}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-400 leading-normal block mt-0.5">
                                      {opt.description}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2">
                        <p className="text-xs text-rose-300 font-medium">
                          {strings.noMatchDesc}
                        </p>
                      </div>
                    )}

                    {/* Footer note of menu */}
                    {menuResponse.isTriggerMatch && menuResponse.footerNote && (
                      <div className="text-xs text-gray-500 pt-3 border-t border-white/5 font-mono text-center">
                        {menuResponse.footerNote}
                      </div>
                    )}

                  </div>
                </div>

              </div>
            </div>

            {/* Selected Action detail pane */}
            <div className="bg-[#1A2234] border border-white/10 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">
                ⚡ {strings.selectedActionTitle}
              </span>
              {selectedAction ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white px-2.5 py-1 bg-indigo-600/30 border border-indigo-500/20 rounded-lg">
                      {selectedAction.title}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {strings.technicalIdLabel}: {selectedAction.id}
                    </span>
                  </div>

                  <div className="text-xs text-gray-300 space-y-1 bg-[#121824] p-3 rounded-lg border border-white/5">
                    <span className="block font-semibold text-white mb-1">
                      {strings.selectedActionPayload}
                    </span>
                    <code className="text-cyan-300 font-mono block break-all text-xs bg-black/30 p-1.5 rounded border border-white/5">
                      {selectedAction.actionPayload}
                    </code>
                    {selectedAction.toolName && (
                      <span className="block text-xs text-gray-400 mt-1">
                        {strings.toolLabel}: <code className="text-gray-200">{selectedAction.toolName}</code> | {strings.appLabel}:{' '}
                        <code className="text-gray-200">{selectedAction.appId}</code>
                      </span>
                    )}
                  </div>

                  {/* Specialized Warning for Human Support */}
                  {selectedAction.actionPayload === 'ACTION_TRANSFER_HUMAN' && (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 space-y-1">
                      <span className="font-bold block flex items-center gap-1">
                        <Info className="w-4 h-4 text-indigo-400" />
                        {strings.humanTransferTitle}
                      </span>
                      <p className="leading-normal text-gray-400">
                        {strings.humanTransferDesc}
                      </p>
                    </div>
                  )}

                  {/* Specialized Warning for Worship Lead Support */}
                  {selectedAction.actionPayload === 'ACTION_TRANSFER_WORSHIP_LEAD' && (
                    <div className="p-3 bg-cyan-950/40 border border-cyan-500/20 rounded-xl text-xs text-cyan-300 space-y-1">
                      <span className="font-bold block flex items-center gap-1">
                        <Info className="w-4 h-4 text-cyan-400" />
                        {strings.worshipLeadTransferTitle}
                      </span>
                      <p className="leading-normal text-gray-400">
                        {strings.worshipLeadTransferDesc}
                      </p>
                    </div>
                  )}

                  <span className="text-xs text-amber-300/80 block leading-normal italic">
                    ⚠️ {strings.noExternalAction}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-500 block italic">
                  {strings.actionNotExecuted}
                </span>
              )}
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};
