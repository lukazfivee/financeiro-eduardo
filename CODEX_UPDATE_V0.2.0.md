# Tarefa para Codex — Financeiro Eduardo v0.2.0

## Objetivo
Concluir e estabilizar a atualização do Financeiro Eduardo para a versão 0.2.0, mantendo compatibilidade com Windows (Electron), PWA, Cloudflare Worker e Cloudflare D1.

## Estado atual
O sistema já possui:
- dashboard financeiro pessoal;
- lançamentos de entradas e saídas;
- categorias;
- exportação CSV;
- modo claro/noturno persistente;
- Electron desktop carregando a aplicação hospedada no Cloudflare;
- módulo de Serviços separado do financeiro pessoal;
- backend Worker + D1;
- workflows de deploy Cloudflare, CI, build Windows e release.

## O que o Codex deve fazer
1. Revisar todo o repositório antes de alterar arquivos.
2. Validar e corrigir o módulo **Serviços** para garantir que apareça no menu e funcione no desktop, navegador e PWA.
3. Garantir que lançamentos de Serviços sejam totalmente separados do financeiro pessoal, inclusive saldo, dashboard e relatórios.
4. Revisar os endpoints `/api/services`, `/api/services/dashboard` e exclusão de lançamentos de serviços.
5. Revisar `schema.sql` e garantir que a tabela `service_transactions` seja criada de forma idempotente no D1.
6. Corrigir qualquer problema de carregamento/cache da PWA que impeça a interface nova de aparecer no EXE.
7. Revisar `public/services.js`, `public/services.css`, `public/app.js`, `public/theme.js`, `public/theme-dark.css` e `public/sw.js`.
8. Garantir que o modo noturno funcione em todas as telas, inclusive Serviços e modais.
9. Revisar o workflow `.github/workflows/deploy-cloudflare.yml` e garantir que o deploy rode em alterações dos novos arquivos de Serviços.
10. Revisar `.github/workflows/build-windows.yml` e fazer o build gerar `Financeiro-Eduardo-0.2.0.exe` de forma confiável.
11. Revisar o workflow de release e fazer com que a release `v0.2.0` receba o executável automaticamente quando o build concluir.
12. Rodar validações de sintaxe e evitar regressões na autenticação e no financeiro pessoal.

## Melhorias funcionais desejadas nesta mesma atualização
Se a base estiver estável, implementar também:
- editar lançamentos pessoais;
- editar lançamentos de Serviços;
- status de pagamento: Pendente / Pago / Recebido / Atrasado;
- lançamentos recorrentes;
- parcelamento;
- categorias editáveis;
- filtros por período, tipo, categoria e status;
- no módulo Serviços: status do serviço, valor contratado, valor recebido, valor a receber e custos previstos x realizados.

## Regras
- Não remover dados existentes.
- Não recriar o banco do zero.
- Migrações devem ser compatíveis com o D1 já em produção.
- Não expor segredos do GitHub ou Cloudflare.
- Manter o Worker como backend principal.
- Manter o Electron como shell para a URL hospedada.
- Interface em português do Brasil.
- Preservar identidade visual atual, com modo claro e noturno.

## Critérios de aceite
A atualização só deve ser considerada pronta quando:
- CI passar;
- deploy Cloudflare passar;
- módulo Serviços aparecer e funcionar;
- modo noturno funcionar em todas as telas;
- build Windows concluir;
- `Financeiro-Eduardo-0.2.0.exe` for gerado;
- release `v0.2.0` contiver o executável;
- nenhuma função atual do financeiro pessoal deixar de funcionar.

## Entrega esperada
Implemente as alterações nesta branch e atualize esta pull request com um resumo claro do que foi corrigido, arquivos alterados, validações executadas e eventuais pendências.
