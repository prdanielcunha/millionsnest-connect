# Autonomous Engineering Policy

## Papéis
- OpenClaw: operador/orquestrador.
- Codex ou agente de código: executor de implementação.
- OpenAI Reviewer: autoridade final de engenharia independente de quem executou.
- Usuário: direção de produto e direito de pedir rollback/desfazer; não é gate rotineiro de aprovação técnica.

## Fluxo obrigatório
1. Revalidar repo/branch/SHA, código, testes e documentação.
2. Implementar somente a menor mudança auditável e reversível.
3. Executar lint/typecheck/build/testes e gates de segurança aplicáveis.
4. Se Firebase vier a integrar o projeto fora do DEMO_MODE, manter Rules/Functions/índices/configuração versionados e validar no Emulator ou gate equivalente antes de produção.
5. Entregar ao OpenAI Reviewer problema original, diff completo, arquivos alterados, testes, riscos, impactos GitHub/Vercel/Firebase quando aplicável e rollback.
6. REJECTED: corrigir automaticamente e repetir o ciclo.
7. APPROVED: merge/promoção/deploy podem seguir automaticamente conforme a política de branches, sem aprovação humana rotineira.
8. Fazer smoke test pós-deploy; em regressão atribuível, rollback para o último estado certificado.
9. Informar ao usuário o relatório final, evidências, estado e referência de rollback.

## Firebase
Não introduzir Firebase no Connect enquanto o repositório permanecer em DEMO_MODE sem necessidade arquitetural comprovada. Quando a integração real for aprovada no código, o OpenClaw poderá operar Firebase dentro da mesma política autônoma e não destrutiva. O Hub MillionsNest permanece autoridade canônica de identidade, organizações, memberships, RBAC global, billing, assinaturas e entitlements.

## Proibido automaticamente
- excluir projeto/banco de produção;
- exclusão em massa irreversível de tenants/dados;
- alterar billing, IAM, owners ou escopo de service accounts;
- expor/commitar secrets, tokens ou chaves privadas;
- desabilitar backups, retenção ou auditoria;
- reescrever Git de forma destrutiva;
- criar bypass de Auth/RBAC/membership/multi-tenancy;
- migração destrutiva irreversível sem preservação e rollback comprovados.
