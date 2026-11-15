# Tríade (nome provisório)

Plataforma web de gestão de consultório para psicólogos, com supervisão clínica integrada.

- Produto, papéis, fluxos e modelo de dados: [`docs/especificacao.md`](docs/especificacao.md)
- Cores, fontes e componentes: [`docs/design.md`](docs/design.md)
- Telas de referência (protótipos): [`docs/referencia-telas/`](docs/referencia-telas/)
- Regras de trabalho: [`CLAUDE.md`](CLAUDE.md)

## Andamento

| Fase | Situação |
|---|---|
| 0. Base (projeto, Supabase, login, layout, tokens) | Concluída |
| 1. Consultório mínimo | A fazer |
| 2. Supervisão | A fazer |
| 3. Planos | A fazer |
| 4. Estágio | A fazer |
| 5. Extras | A fazer |

## Como rodar na sua máquina

Requisitos: **Node 20.19 ou mais novo** e **Docker** (o Supabase local roda em contêineres).

```bash
npm install
npm run db:start          # sobe o Supabase local, aplica as migrations e o seed
cp .env.example .env.local
npx supabase status       # copie "API URL" e "Publishable key" para o .env.local
npm run dev               # http://localhost:5173
```

### Usuários de exemplo (fictícios)

Todos com a senha `senha-teste-123`:

| E-mail | Quem é |
|---|---|
| `marina.costa@example.com` | Psicóloga, CRP 08/12345 |
| `paulo.andrade@example.com` | Psicólogo e supervisor, CRP 08/4567 |
| `bianca.lima@example.com` | Estagiária, sem CRP |

### E-mails de cadastro e senha

O cadastro exige confirmar o e-mail. Localmente nenhum e-mail sai de verdade: eles aparecem no Mailpit, em <http://127.0.0.1:54324>. Os textos dos e-mails estão em `supabase/templates/`. No projeto hospedado, copie esses textos no painel do Supabase (Authentication → Emails).

O painel do banco local (Supabase Studio) fica em <http://127.0.0.1:54323>.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verifica os tipos e gera a versão de produção em `dist/` |
| `npm run lint` | ESLint (inclui regras de acessibilidade) |
| `npm run typecheck` | Verificação de tipos do TypeScript |
| `npm test` | Testes do front (Vitest + Testing Library) |
| `npm run db:start` / `db:stop` | Liga e desliga o Supabase local |
| `npm run db:reset` | Recria o banco local do zero (migrations + seed) |
| `npm run db:test` | Testes de acesso ao banco (pgTAP), com o Supabase local ligado |
| `npm run db:test:sem-docker` | Os mesmos testes num Postgres comum, sem Docker (ver o script) |
| `npm run db:types` | Regenera `src/types/database.ts` a partir do banco local |

## Estrutura

```
src/
  auth/            sessão (AuthProvider), chamadas de login/cadastro, guardas de rota
  components/ui/   botões, cartão, etiqueta, campos, avisos, logo
  components/layout/  moldura do app (menu lateral) e das telas de entrada
  lib/             cliente Supabase, validações, datas, CRP, tradução de erros
  pages/           telas (uma por rota)
  rotas.tsx        mapa de rotas
  types/database.ts  tipos do banco (gerados)
supabase/
  migrations/      uma migration por mudança; RLS na mesma migration da tabela
  tests/database/  testes de acesso por papel (pgTAP)
  seed.sql         dados de exemplo fictícios
  templates/       e-mails de autenticação em português
scripts/           teste do banco sem Docker
```

## Regras do banco

- RLS ativada em toda tabela, na mesma migration que a cria, com testes de acesso por papel (psicólogo, supervisor, estagiário e usuário sem vínculo).
- `profiles`: cada usuário lê e edita só o próprio perfil (nome e CRP). O perfil é criado automaticamente no cadastro. Ninguém insere ou apaga perfis pelo app.
- Dados de exemplo sempre fictícios.
