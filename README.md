# Financeiro CENGTEC

Sistema financeiro da CENGTEC para controle de entradas, saídas, saldo, fluxo de caixa e serviços.

## Modelo de acesso

- **Visão Geral privada:** lançamentos, contas, categorias, orçamentos, saldos, relatórios e backups pessoais são exclusivos de cada perfil.
- **Serviços compartilhados:** todos os perfis autenticados visualizam e gerenciam os mesmos serviços, clientes, receitas, custos, valores contratados e recebimentos.
- As informações de Serviços não entram no saldo nem nos relatórios da Visão Geral.

## Arquitetura

- frontend responsivo em HTML, CSS e JavaScript;
- PWA instalável em celular e computador;
- aplicativo Windows portátil em Electron;
- Cloudflare Worker servindo API e arquivos estáticos;
- Cloudflare D1 como banco persistente;
- autenticação própria com PBKDF2 e sessões armazenadas apenas como hash.

Fluxo principal:

`navegador / PWA / EXE -> HTTPS -> Cloudflare Worker -> D1`

## Funcionalidades

- cadastro e login de múltiplos perfis;
- dashboard mensal privado por perfil;
- entradas, saídas, contas, transferências e categorias;
- status de pagamento, recorrência e parcelamento;
- orçamentos e histórico financeiro;
- módulo compartilhado de Serviços;
- clientes, contratos, recebimentos, custos e status de serviço;
- exportação CSV, impressão e backup JSON;
- modo claro/noturno;
- PWA e executável Windows.

## Estrutura

- `src/index.js`: API, autenticação e regras de isolamento/compartilhamento;
- `public/`: interface web, PWA e identidade CENGTEC;
- `desktop/main.cjs`: shell Electron;
- `schema.sql`: estrutura do banco D1;
- `wrangler.toml.example`: configuração do Cloudflare;
- `.github/workflows/`: CI, deploy e release do EXE.

## Desenvolvimento local

1. Instale Node.js 22 ou superior.
2. Execute `npm install`.
3. Copie `wrangler.toml.example` para `wrangler.toml` e informe o ID do D1.
4. Execute `npm run db:local`.
5. Execute `npm run dev`.

## Publicação

O push em `main` executa CI, aplica a estrutura do D1, publica o Worker/PWA e gera o EXE Windows. A versão atual é `v0.4.1`.

Os identificadores internos legados do Worker e do banco (`financeiro-eduardo`) são mantidos para preservar URL, credenciais e dados existentes. A marca exibida e os novos artefatos usam **Financeiro CENGTEC**.
