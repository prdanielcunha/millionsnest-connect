/**
 * MillionsNest Connect - Conversational Menu Simulator
 * Interactive WhatsApp / Instagram Menu Preview
 */

import React, { useState } from 'react';
import {
  Radio,
  Smartphone,
  CheckCircle2,
  Lock,
  Send,
  Sparkles,
  Bot,
  UserCheck,
  Building,
} from 'lucide-react';
import { ConversationalMenuService, ConversationalMenuResponse } from '../../core/services/conversationalMenu';

export const ConversationalMenuPage: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('menu');
  const [isLinked, setIsLinked] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [menuResponse, setMenuResponse] = useState<ConversationalMenuResponse>(
    ConversationalMenuService.getMenu('menu', true)
  );

  const handleTestTrigger = (kw?: string) => {
    const textToTest = kw || userInput;
    const res = ConversationalMenuService.getMenu(textToTest, isLinked);
    setMenuResponse(res);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
            <Radio className="w-3.5 h-3.5" />
            <span>Preview de Menu Conversacional Omnichannel</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Menu Interativo do WhatsApp & Instagram
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Simulador de gatilhos e menu dinâmico sincronizado com a autenticação MillionsNest.
          </p>
        </div>

        {/* Toggle Account Status */}
        <div className="flex items-center gap-3 bg-[#1A2234] border border-white/10 p-2 rounded-xl text-xs">
          <span className="text-gray-400 font-medium">Status do Contato:</span>
          <button
            onClick={() => {
              setIsLinked(!isLinked);
              setMenuResponse(ConversationalMenuService.getMenu(userInput, !isLinked));
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              isLinked
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-amber-600 text-white shadow'
            }`}
          >
            {isLinked ? (
              <>
                <UserCheck className="w-3.5 h-3.5" /> Conta Vinculada
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" /> Visitante / Não Vinculado
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Simulator Controls & Phone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Trigger Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Gatilhos Normalizados
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Palavras-chave aceitas em qualquer idioma ou acentuação: <code className="text-cyan-300 font-mono">menu</code>, <code className="text-cyan-300 font-mono">ajuda</code>, <code className="text-cyan-300 font-mono">opções</code>, <code className="text-cyan-300 font-mono">começar</code>, <code className="text-cyan-300 font-mono">início</code>, <code className="text-cyan-300 font-mono">help</code>, <code className="text-cyan-300 font-mono">ayuda</code>.
            </p>

            <div className="flex flex-wrap gap-2">
              {['menu', 'ajuda', 'opções', 'começar', 'help', 'ayuda'].map((kw) => (
                <button
                  key={kw}
                  onClick={() => {
                    setUserInput(kw);
                    handleTestTrigger(kw);
                  }}
                  className="px-3 py-1.5 bg-[#1A2234] hover:bg-[#222C42] border border-white/10 rounded-lg text-xs font-mono text-cyan-300 transition"
                >
                  {kw}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <label className="text-xs text-gray-300 font-medium">Testar entrada do usuário:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Digite uma palavra..."
                  className="flex-1 bg-[#1A2234] border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
                />
                <button
                  onClick={() => handleTestTrigger()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1 transition"
                >
                  <span>Disparar</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Explanation Card */}
          <div className="bg-[#121824] border border-white/10 rounded-xl p-5 shadow-lg space-y-3 text-xs">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-400" />
              Regra de Autoridade de Permissões
            </h3>
            <p className="text-gray-300 leading-relaxed">
              O menu autenticado do MusicScale só é disponibilizado para usuários que possuem membership ativa na organização identificada pelo ecossistema MillionsNest.
            </p>
            <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-indigo-200 text-[11px]">
              <strong>Observação do DEMO_MODE:</strong> Em produção, o número de telefone e Instagram ID passam por verificação de token assinado no servidor.
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Smartphone Mock Preview */}
        <div className="lg:col-span-7">
          <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold text-white">Visualização no Canal</span>
              </div>

              {/* Channel Selector */}
              <div className="flex bg-[#1A2234] border border-white/10 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setSelectedChannel('whatsapp')}
                  className={`px-3 py-1 rounded font-semibold transition ${
                    selectedChannel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-gray-400'
                  }`}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => setSelectedChannel('instagram')}
                  className={`px-3 py-1 rounded font-semibold transition ${
                    selectedChannel === 'instagram' ? 'bg-pink-600 text-white' : 'text-gray-400'
                  }`}
                >
                  Instagram
                </button>
              </div>
            </div>

            {/* Smartphone Layout Mock */}
            <div className="max-w-md mx-auto bg-[#0B0E14] border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3 font-sans">
              {/* Phone Top Status */}
              <div className="flex items-center justify-between text-[10px] text-gray-500 pb-2 border-b border-white/5 font-mono">
                <span>14:07</span>
                <span>{selectedChannel === 'whatsapp' ? 'WhatsApp Business' : 'Instagram Direct'}</span>
                <span>100% 🔋</span>
              </div>

              {/* Bot Header */}
              <div className="p-2.5 bg-[#1A2234] rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                  MN
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    MillionsNest Connect
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Conta Oficial Verificada
                  </span>
                </div>
              </div>

              {/* Message Bubble: Incoming User Trigger */}
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-none max-w-xs shadow">
                  {userInput}
                </div>
              </div>

              {/* Message Bubble: Bot Interactive Menu Response */}
              <div className="flex justify-start">
                <div className="bg-[#1A2234] border border-white/10 text-gray-200 text-xs p-3.5 rounded-2xl rounded-tl-none max-w-sm space-y-3 shadow-lg">
                  <div>
                    <h4 className="font-bold text-indigo-300 text-sm">
                      {menuResponse.menuTitle}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {menuResponse.subtitle}
                    </p>
                  </div>

                  {/* Public Options Section */}
                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      📌 Opções Públicas
                    </span>
                    {menuResponse.publicOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className="p-2 bg-[#121824] hover:bg-[#222C42] rounded-lg border border-white/5 flex items-start gap-2 cursor-pointer transition"
                      >
                        <span className="w-5 h-5 rounded bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                          {opt.numberKey}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-white text-[11px] block">
                            {opt.title}
                          </span>
                          <span className="text-[10px] text-gray-400 leading-tight block">
                            {opt.description}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Authenticated MusicScale Options Section if linked */}
                  {isLinked && menuResponse.musicscaleAuthOptions.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-cyan-500/20">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block flex items-center gap-1">
                        🎵 MusicScale (Menu do Membro Vinculado)
                      </span>
                      {menuResponse.musicscaleAuthOptions.map((opt) => (
                        <div
                          key={opt.id}
                          className="p-2 bg-indigo-950/30 hover:bg-indigo-950/50 rounded-lg border border-indigo-500/20 flex items-start gap-2 cursor-pointer transition"
                        >
                          <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                            {opt.numberKey}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white text-[11px]">
                                {opt.title}
                              </span>
                              {opt.badge && (
                                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded font-mono">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight block">
                              {opt.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-500 pt-2 border-t border-white/5 font-mono text-center">
                    {menuResponse.footerNote}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
