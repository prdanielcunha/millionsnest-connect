# MillionsNest Connect - Visão Geral do Produto

## 1. O que é o Connect?
O **MillionsNest Connect** é a camada omnichannel de atendimento, relacionamento, agentes de IA e execução segura de ações nos aplicativos do ecossistema MillionsNest.

Ele não é um chatbot simples e não é um CRM genérico. O Connect atua como o ponto focal de entrada para conversas originadas do WhatsApp, Instagram Direct e widgets in-app, oferecendo suporte humano, automação conversacional com agentes de IA e invocações auditadas de ferramentas através do **Tool Gateway**.

## 2. Proposta de Valor
> "Conecte conversas, equipes e ações em todo o ecossistema MillionsNest."

O Connect transforma conversas em suporte ágil, contexto integrado e ações seguras nos aplicativos do ministério (como MusicScale e NestFinance).

## 3. Regras Canônicas Não Negociáveis
1. **Autoridade do MillionsNest:** O MillionsNest é a fonte canônica para identidade, autenticação, organizações, memberships e RBAC. O Connect não duplica nem cria tabelas paralelas de autenticação.
2. **Tool Gateway:** Toda e qualquer alteração nos bancos de dados dos aplicativos parceiros ocorre obrigatoriamente por ferramentas explícitas, autorizadas, autenticadas e auditadas.
3. **Biblioteca Viva:** A homologação de músicas no acervo global exige expressamente a capability `livingLibrary.manage`. Administradores de organizações locais não possuem esse privilégio por padrão.
4. **Validação Server-Side:** Telefone, Instagram ID, e-mail ou dados informados no cliente nunca constituem prova de permissão.
