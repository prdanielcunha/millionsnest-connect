# CONNECT-CORE-MUSICSCALE-REAL-01

Status: **foundation / branch-only**

## Objetivo

Criar a primeira fatia auditável da Fase A do Master Product Blueprint v4 sem fingir que Hub, MusicScale ou WhatsApp já estão integrados em produção.

O alvo funcional continua sendo o Magic Moment:

> “Qual é minha próxima escala?” → Connect resolve identidade/contexto → Tool Gateway valida → MusicScale devolve a próxima escala real.

## O que esta fatia implementa

- contrato production-neutral do Connect Core para mensagens;
- resolução de intent determinística para `get_next_schedule` em PT-BR, EN e ES;
- porta explícita para contexto canônico vindo do Hub;
- porta explícita e read-only para consulta da próxima escala no MusicScale;
- enforcement local defensivo de `appAccess`, `organizationId` e `musicscale.schedules.view` antes da porta de ferramenta;
- auditoria obrigatória antes e depois da consulta;
- comportamento fail-closed para auth ausente, tenant divergente, capability ausente, intent não suportado e falha de auditoria;
- nenhum acesso direto às collections internas de MusicScale;
- nenhum secret, token ou PII gravado em auditoria;
- teste de domínio isolado em `src/tests/connectCoreRuntime.test.ts`.

## O que esta fatia NÃO declara pronto

Ainda **não** existe nesta alteração:

- adapter real do Hub para resolver sessão/membership/RBAC/appAccess;
- endpoint/ferramenta real do MusicScale para `get_next_schedule`;
- backend/persistência real do Connect;
- canal in-app conectado ao Core real;
- WhatsApp Business webhook;
- Radar/Cofre Pessoal.

Esses itens permanecem explicitamente não configurados até que o contrato real de cada sistema seja verificado no código e ligado sem criar bypass ou endpoint fictício.

## Próxima ação técnica

1. Localizar e provar no Hub o contrato canônico de sessão/contexto efetivo.
2. Localizar no MusicScale o ponto server-side correto para uma ferramenta read-only de próxima escala. Se não existir, criar a menor superfície explícita no domínio MusicScale, com autenticação e `organizationId` validados server-side.
3. Implementar adapters concretos para as duas portas desta fatia.
4. Montar o canal de teste in-app sobre o Core.
5. Somente considerar A1–A4 fechados quando o dado retornado vier do MusicScale real, da organização correta, com auditoria e casos de permission denied/tenant mismatch testados.

## Radar acelerado

Assim que a espinha dorsal A1–A4 estiver comprovada, abrir `CONNECT-RADAR-SALES-PILOT-01` como módulo privado/feature-flagged: Cofre Pessoal → import TXT/ZIP → deduplicação → busca/Pessoas → Radar v1 explicável → Composer → Click to Chat. O piloto não pode transformar participantes de grupos em leads automaticamente nem enviar mensagens sozinho.

## Validação exigida antes de merge

- executar `npx tsx src/tests/connectCoreRuntime.test.ts`;
- executar os testes existentes de fronteira/autoridade do Tool Gateway;
- executar `npm run lint`;
- executar `npm run build`;
- revisar diff para garantir ausência de segredo/PII e ausência de dependência direta de Firestore de outros apps;
- manter a PR em draft/rejeitada se qualquer gate falhar.

## Rollback

A alteração é aditiva e isolada. Rollback = remover os três arquivos desta fatia ou reverter o commit da branch antes de merge.
