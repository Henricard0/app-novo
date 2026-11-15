# Tríade (nome provisório)

Plataforma web de gestão de consultório para psicólogos, com supervisão clínica integrada.

- Produto, papéis, fluxos e modelo de dados: [`docs/especificacao.md`](docs/especificacao.md)
- Cores, fontes e componentes: [`docs/design.md`](docs/design.md)
- Telas de referência (protótipos): [`docs/referencia-telas/`](docs/referencia-telas/)
- Regras de trabalho: [`CLAUDE.md`](CLAUDE.md)
- Ambientes de teste e produção, e o que falta para receber dados reais: [`docs/ambientes.md`](docs/ambientes.md)

## Andamento

| Fase | Situação |
|---|---|
| 0. Base (projeto, Firebase, login, layout, tokens) | Concluída |
| 1. Consultório mínimo | A fazer |
| 2. Supervisão | A fazer |
| 3. Planos | A fazer |
| 4. Estágio | A fazer |
| 5. Extras | A fazer |

## Como rodar na sua máquina

Requisitos: **Node 20.19 ou mais novo** e **Java 21** (os emuladores do Firebase rodam em Java). Não precisa de conta no Firebase para desenvolver.

```bash
npm install
cp .env.example .env.local     # já vem pronto para os emuladores
npm run emuladores            # terminal 1: Authentication e Firestore locais (painel em http://127.0.0.1:4000)
npm run emuladores:semear     # terminal 2: cria os usuários de exemplo
npm run dev                   # terminal 2: http://localhost:5173
```

### Usuários de exemplo (fictícios, só nos emuladores)

Todos com a senha `senha-teste-123`:

| E-mail | Quem é |
|---|---|
| `marina.costa@example.com` | Psicóloga, CRP 08/12345 |
| `paulo.andrade@example.com` | Psicólogo e supervisor, CRP 08/4567 |
| `bianca.lima@example.com` | Estagiária, sem CRP |

Os emuladores começam vazios toda vez que são ligados: rode `npm run emuladores:semear` de novo.

### E-mails de confirmação e de nova senha

O cadastro exige confirmar o e-mail antes de entrar. Nos emuladores nenhum e-mail sai de verdade: os links aparecem no painel (<http://127.0.0.1:4000>, aba Authentication) e no terminal dos emuladores. No projeto real, o Firebase envia os e-mails em português para qualquer endereço.

Os links dos e-mails abrem a rota `/acao` do app (confirmar e-mail e criar nova senha). Para isso, no console do Firebase: Authentication → Templates → editar cada modelo → "Customize action URL" → `https://<endereço do site>/acao`. Sem essa configuração, os links abrem a página padrão do Firebase, que também funciona.

### Site publicado (teste)

O app está publicado na Vercel em <https://triade-hazel.vercel.app> (projeto `triade`), ligado ao projeto de teste do Firebase. As variáveis `VITE_FIREBASE_*` estão configuradas lá. Para publicar de novo: `npx vercel deploy --prod`. A configuração do site (rotas, cabeçalhos e `noindex`) fica em `vercel.json`. Ambientes e o que falta para dados reais: [`docs/ambientes.md`](docs/ambientes.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verifica os tipos e gera a versão de produção em `dist/` |
| `npm run lint` | ESLint (inclui regras de acessibilidade) |
| `npm run typecheck` | Verificação de tipos do TypeScript |
| `npm test` | Testes do front (Vitest + Testing Library) |
| `npm run test:regras` | Testes das regras de segurança do Firestore, por papel (sobe o emulador sozinho) |
| `npm run emuladores` | Liga Authentication e Firestore locais |
| `npm run emuladores:semear` | Cria os usuários de exemplo nos emuladores |
| `npm run regras:publicar` | Publica `firestore.rules` no projeto do Firebase (precisa de `npx firebase login`) |

## Estrutura

```
src/
  auth/            sessão (AuthProvider), chamadas de login/cadastro, guardas de rota
  components/ui/   botões, cartão, etiqueta, campos, avisos, logo
  components/layout/  moldura do app (menu lateral) e das telas de entrada
  lib/             Firebase, validações, datas, CRP, tradução de erros
  pages/           telas (uma por rota); pages/auth/AcaoConta trata os links dos e-mails
  rotas.tsx        mapa de rotas
  types/modelo.ts  formato dos documentos do Firestore
firestore.rules    regras de segurança (tudo negado por padrão)
tests/regras/      testes das regras por papel, no emulador
scripts/           usuários de exemplo para os emuladores
```

## Regras do banco

- Toda coleção tem regras em `firestore.rules`, escritas junto com ela, e testes de acesso por papel (psicólogo, supervisor, estagiário e usuário sem vínculo) em `tests/regras/`. O que não está liberado é negado.
- `profiles/{uid}`: cada usuário lê e edita só o próprio perfil (nome e CRP). O perfil é criado no cadastro, com os campos validados pelas regras. Ninguém apaga perfis pelo app.
- Dados de exemplo sempre fictícios.
