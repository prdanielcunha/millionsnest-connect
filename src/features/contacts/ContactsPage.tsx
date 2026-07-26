/**
 * MillionsNest Connect - Contacts Page
 * Manages external identities and MillionsNest account linking statuses.
 */

import React, { useState } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Link2,
  ShieldCheck,
  Building,
  Globe,
  Tag,
} from 'lucide-react';
import { Contact } from '../../types';
import { mockContacts } from '../../demo/mockData';

export const ContactsPage: React.FC = () => {
  const [contacts] = useState<Contact[]>(mockContacts);
  const [selectedContactId, setSelectedContactId] = useState<string>('cnt_01');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const selectedContact = contacts.find((c) => c.id === selectedContactId) || contacts[0];

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.instagramHandle && c.instagramHandle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title Header */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Gestão de Contatos & Identidades Omnichannel</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Contatos e Vínculos
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Mapeamento de identidades por canal e status de vinculação à conta canônica MillionsNest.
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-950/30 border border-amber-500/20 p-3 rounded-xl max-w-md text-xs text-amber-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            Regra Canônica Não Negociável
          </div>
          <p className="text-[11px] text-amber-200/80">
            Telefone, Instagram ID ou e-mail informados no chat NUNCA constituem prova de autorização por si sós.
          </p>
        </div>
      </div>

      {/* Main Grid: Contacts List + Selected Contact Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Contacts List */}
        <div className="lg:col-span-5 bg-[#121824] border border-white/10 rounded-2xl p-4 shadow-xl space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, telefone ou Instagram..."
              className="w-full bg-[#1A2234] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto divide-y divide-white/5">
            {filteredContacts.map((c) => {
              const isSelected = c.id === selectedContact.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedContactId(c.id)}
                  className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-600/20 border border-indigo-500/40'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={c.avatarUrl}
                      alt={c.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">{c.name}</span>
                      <span className="text-[11px] text-gray-400 font-numeric">
                        {c.phone || c.instagramHandle}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                      c.linkingStatus === 'vinculado'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : c.linkingStatus === 'pendente'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}
                  >
                    {c.linkingStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (7 cols): Selected Contact Detail Pane */}
        <div className="lg:col-span-7 bg-[#121824] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Header info */}
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedContact.avatarUrl}
                alt={selectedContact.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500/50"
              />
              <div>
                <h2 className="text-lg font-bold text-white">{selectedContact.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400 font-numeric">{selectedContact.phone}</span>
                  <span className="text-xs text-gray-400 font-numeric">{selectedContact.instagramHandle}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-gray-500 block uppercase font-mono">Status de Vínculo</span>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase font-mono inline-block mt-1 ${
                  selectedContact.linkingStatus === 'vinculado'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {selectedContact.linkingStatus}
              </span>
            </div>
          </div>

          {/* Identities List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-400" />
              Identidades por Canal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedContact.identities.map((id, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#1A2234] border border-white/5 rounded-xl space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-indigo-300 uppercase font-bold">{id.channel}</span>
                    {id.isVerified ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verificado
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Não Verificado
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-white font-numeric">{id.channelUserId}</div>
                  {id.linkedAt && (
                    <div className="text-[10px] text-gray-500">
                      Vinculado em: {new Date(id.linkedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Consents & Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-gray-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Consentimentos (LGPD)
              </h4>
              <div className="space-y-1.5 text-gray-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Mensagens de Suporte:</span>
                  <span className="text-emerald-400 font-bold">Autorizado</span>
                </div>
                <div className="flex justify-between">
                  <span>Informativos do Louvor:</span>
                  <span className="text-emerald-400 font-bold">Autorizado</span>
                </div>
                <div className="flex justify-between">
                  <span>Retenção de Dados:</span>
                  <span className="text-emerald-400 font-bold">Autorizado</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#1A2234] border border-white/5 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-gray-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" /> Preferências
              </h4>
              <div className="space-y-1.5 text-gray-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Idioma Preferido:</span>
                  <span className="font-bold text-white font-mono">{selectedContact.preferredLanguage}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data de Cadastro:</span>
                  <span className="text-gray-400 font-numeric">{new Date(selectedContact.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Organization History */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-400" />
              Histórico de Organizações Autorizadas
            </h4>
            {selectedContact.authorizedOrgsHistory.length === 0 ? (
              <div className="p-3 bg-[#1A2234] border border-white/5 rounded-xl text-xs text-gray-500">
                Nenhuma organização autorizada até o momento.
              </div>
            ) : (
              selectedContact.authorizedOrgsHistory.map((org, i) => (
                <div
                  key={i}
                  className="p-3 bg-[#1A2234] border border-white/5 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-white">{org.organizationName}</span>
                  <span className="text-[11px] text-gray-400 font-numeric">
                    Autorizado em {new Date(org.grantedAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-400" />
              Etiquetas do Contato
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedContact.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
