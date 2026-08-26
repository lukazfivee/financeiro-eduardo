# Financeiro Eduardo

Sistema financeiro pessoal para controle de entradas, saídas, saldo e fluxo de caixa.

## Arquitetura

O projeto reutiliza o padrão cloud do Centro de Custos Construtec V3:

- frontend web responsivo em HTML/CSS/JavaScript;
- PWA instalável em celular/computador;
- Cloudflare Worker servindo API e arquivos estáticos;
- Cloudflare D1 como banco de dados;
- autenticação própria com senha derivada por PBKDF2 e sessões com token armazenado apenas em hash no banco.

Fluxo principal:

`navegador / PWA -> HTTPS -> Cloudflare Worker -> D1`

## Funcionalidades da V0.1

- primeiro acesso para criação do usuário administrador;
- login e logout;
- lançamento de entradas e saídas;
- data, descrição, valor, categoria, forma de pagamento e observações;
- categorias financeiras padrão;
- dashboard mensal com entradas, saídas, resultado do mês e saldo acumulado;
- resumo das despesas por categoria;
- filtro por mês;
- exclusão de lançamento;
- exportação CSV;
- trilha básica de auditoria;
- layout responsivo para desktop e celular;
- estrutura PWA.

## Estrutura

- `src/index.js`: API e autenticação do Worker;
- `public/`: interface web/PWA;
- `schema.sql`: estrutura do banco D1;
- `wrangler.toml.example`: modelo de configuração Cloudflare;
- `package.json`: scripts de desenvolvimento/deploy.

## Publicação no Cloudflare

1. Instale Node.js LTS.
2. Clone o repositório e execute `npm install`.
3. No Cloudflare, crie um banco D1 chamado `financeiro-eduardo`.
4. Copie `wrangler.toml.example` para `wrangler.toml`.
5. Substitua `__D1_DATABASE_ID__` pelo ID real do D1.
6. Execute `npm run db:remote` para aplicar `schema.sql`.
7. Execute `npm run deploy`.
8. Abra a URL do Worker e faça a configuração do primeiro acesso.

Para desenvolvimento local, aplique o banco com `npm run db:local` e rode `npm run dev`.

## Próximas evoluções previstas

- edição de lançamentos;
- contas a pagar/receber e status pendente/pago;
- lançamentos recorrentes;
- cartões e contas bancárias;
- metas e orçamento mensal;
- gráficos históricos;
- anexos/comprovantes;
- relatórios em PDF;
- backup/exportação completa.
