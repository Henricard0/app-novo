# Tríade (nome provisório)

Plataforma web de gestão de consultório para psicólogos, com supervisão clínica integrada.

- Produto, papéis, fluxos e modelo de dados: [`docs/especificacao.md`](docs/especificacao.md)
- Cores, fontes e componentes: [`docs/design.md`](docs/design.md)
- Telas de referência (protótipos): [`docs/referencia-telas/`](docs/referencia-telas/)
- Regras de trabalho: [`CLAUDE.md`](CLAUDE.md)
- Onde paramos, decisões e pendências: [`docs/estado-do-projeto.md`](docs/estado-do-projeto.md)
- Ambientes de teste e produção, e o que falta para receber dados reais: [`docs/ambientes.md`](docs/ambientes.md)

## Andamento

| Fase | Situação |
|---|---|
| 0. Base (projeto, Supabase, login, layout, tokens) | Concluída |
| 1. Consultório mínimo (pacientes, agenda, prontuário) | Concluída |
| 2a. Rede de supervisores (perfil, busca, pedido, convite por link) | Concluída |
| 2b. Supervisão (casos anonimizados, pauta, devolutivas, horas, grupos) | Concluída |
| 3. Planos e assinatura (Mercado Pago, modo de teste) | Concluída em modo de teste |
| 4. Estágio | Suspensa (exige contrato de estágio registrado ou convênio com cursos) |
| 5. Extras (financeiro, recibos, NFS-e, declarações) | Financeiro mínimo feito (valores, pagamentos, despesas); o resto a fazer |
| 6. Fiscal (carnê-leão, DAS, Fator R, rede de contadores com login separado) | Rede de contadores feita (modo de teste); cálculos fiscais a fazer |

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
| `carla.souza@example.com` | Contadora, CRC-PR 12345 (entra por `/contador/entrar` e ativa a verificação em duas etapas no primeiro acesso) |

### E-mails de cadastro e senha

O cadastro exige confirmar o e-mail. Localmente nenhum e-mail sai de verdade: eles aparecem no Mailpit, em <http://127.0.0.1:54324>. Os textos dos e-mails estão em `supabase/templates/`. No projeto hospedado, copie esses textos no painel do Supabase (Authentication → Emails).

O painel do banco local (Supabase Studio) fica em <http://127.0.0.1:54323>.

### Ambiente de teste hospedado

Há um projeto no Supabase usado só para testes, **com dados fictícios** (região us-east-1). A migration já foi aplicada e os mesmos usuários de exemplo existem lá. Para apontar o app para ele, coloque no `.env.local` a URL do projeto e a "Publishable key" (painel do Supabase → Project Settings → API Keys).

- Login: senha mínima de 8 caracteres com letras e números; redirecionamentos liberados para `http://localhost:5173`.
- E-mails: o servidor de e-mail padrão do Supabase só entrega para membros da equipe do projeto, e no plano gratuito não deixa trocar os textos (continuam em inglês). Os textos em português de `supabase/templates/` entram quando houver um SMTP próprio.
- **Não use para dados reais.** Para produção, criar um projeto na região São Paulo (LGPD).

### Site publicado (teste)

O app está publicado na Vercel em <https://triade-hazel.vercel.app>, ligado ao projeto Supabase de teste (projeto `triade` na Vercel; as variáveis `VITE_SUPABASE_*` estão configuradas lá). Para publicar de novo a partir da sua máquina: `npx vercel deploy --prod`. A configuração do site (rotas, cabeçalhos e `noindex`) fica em `vercel.json`.

## Pagamento (Mercado Pago)

As Edge Functions ficam em `supabase/functions/`. Segredos, no painel do Supabase (Edge Functions → Secrets), nunca no código nem no chat:

| Segredo | O que é |
|---|---|
| `MP_ACCESS_TOKEN` | Access Token das credenciais (de teste, por enquanto) da aplicação no Mercado Pago |
| `MP_WEBHOOK_SECRET` | Assinatura secreta dos Webhooks da aplicação no Mercado Pago |
| `MP_PAYER_EMAIL_TESTE` | Só no modo de teste: e-mail da conta de teste "Comprador" |
| `SITE_ORIGINS` | Opcional: endereços do site aceitos como retorno do pagamento (separados por vírgula) |

Webhook a cadastrar no Mercado Pago (evento "Planos e assinaturas"): `https://<projeto>.supabase.co/functions/v1/mercado-pago-webhook`.

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
- `patients`, `patient_contacts`, `appointments`: só o dono (`owner_id`) acessa. Paciente é arquivado, nunca apagado; sessão é cancelada, nunca apagada. Só os contatos podem ser removidos.
- `clinical_records`: só o dono acessa. Não existe `delete`: a exclusão passa pela função `excluir_registro_clinico`, que marca `deleted_at`, quem excluiu e o motivo; o registro some das telas, mas fica guardado (Res. CFP 01/2009).
- `clinical_record_versions`: cada edição do texto, da data ou da sessão guarda a versão anterior, gravada pelo próprio banco. Ninguém escreve, altera ou apaga versões.
- `mover_sessao(id, início, fim, seguintes)`: usada pelo calendário ao arrastar. Respeita a RLS (só move sessões suas) e, se pedido, aplica o mesmo deslocamento às sessões seguintes da série que ainda estão agendadas.
- `audit_log`: o banco registra quem criou, editou, excluiu, arquivou ou reativou pacientes e registros. Só leitura.
- `supervisor_profiles`: cada um edita o próprio; qualquer usuário logado vê os perfis de quem ligou "Ofereço supervisão" **e** tem CRP.
- `profiles`: além do próprio, cada um vê nome e CRP de quem está na rede, de quem trocou pedido de supervisão com ele e das pontas dos seus vínculos.
- `supervision_requests`: quem pediu e quem recebeu leem. Só dá para pedir a quem está na rede e aceitando novos. Aceitar, recusar e cancelar só pelas funções `responder_solicitacao` e `cancelar_solicitacao`.
- `supervision_invites`: só quem criou vê. Aceitar só por `aceitar_convite(token)`, que confere validade, uso único e CRP de quem vai ser supervisor; `ver_convite(token)` mostra quem convidou antes de aceitar.
- `supervision_links`: as duas pontas leem; nascem só pelas funções acima e terminam por `encerrar_vinculo`. Vínculo **não** dá acesso a pacientes, agenda ou prontuário (testado).
- `supervision_case_sources` (de qual paciente e de quais registros saiu o caso): **só o supervisionando**. Nenhuma policy menciona o supervisor, e um teste confere isso (CLAUDE.md, regra 1).
- `supervision_cases` e `supervision_case_excerpts`: o supervisionando escreve enquanto é rascunho; o supervisor do vínculo só lê depois de enviado (`enviar_caso`), e aí o texto fica congelado. O envio entra na auditoria como "compartilhou".
- `supervision_feedback` e `supervision_feedback_tasks`: o supervisor escreve; o supervisionando lê depois de enviada (`enviar_devolutiva`) e marca encaminhamentos (`marcar_encaminhamento`). A devolutiva não entra no prontuário.
- `supervision_meetings` e `supervision_hours`: as pontas do vínculo veem; só o supervisor registra horas.
- `supervision_groups`: o supervisor (com CRP) cria e monta (`definir_grupo`); os membros veem o nome e os encontros do grupo, mas **não os casos uns dos outros** (opção B).
- A anonimização (`src/lib/supervisao/anonimizar.ts`) roda no navegador, sem API externa, e a revisão do psicólogo é obrigatória antes de enviar.
- `profiles.account_type` (`psicologo` ou `contador`): definido no cadastro e sem grant para mudar. Toda tabela do consultório e da supervisão tem uma policy **restritiva** que só deixa passar contas de psicólogo; gatilhos impedem contas de contador em vínculos, pedidos, convites e grupos de supervisão, e em pacientes.
- `appointments.fee`, `payment_status`, `paid_on`, `payment_method`; `patients.default_fee`, `cpf`, `payer_name`, `payer_cpf`; `expenses`; `fiscal_profiles`: só o dono.
- `accountant_profiles`: o contador edita o próprio; psicólogos veem os que estão na rede (com CRC) e os que já contataram.
- `accountant_requests` e `accountant_links`: as duas pontas leem (o contador só com duas etapas). Pedir, responder, cancelar e encerrar só por funções. Um contador por vez por psicólogo, só nos planos Essencial, Profissional e no teste grátis. O psicólogo muda as autorizações (`share_totals`, `share_entries`, `share_expenses`).
- O contador **não lê nenhuma tabela financeira direto**: só pelas funções `contador_clientes`, `contador_resumo`, `contador_lancamentos` e `contador_despesas`, que conferem vínculo ativo, plano, autorização e duas etapas (`aal2`), e registram cada leitura em `accountant_access_log` (o psicólogo vê).
- `accountant_documents` (guias) e `accountant_tasks` (pedidos do contador): o psicólogo lê as suas sempre; o contador só enquanto atende. PDFs no bucket privado `guias/{psicólogo}/…`.
- `profiles.plan` e `profiles.trial_ends_at`: o navegador não consegue mudar (não há grant); só o servidor, depois de confirmar o pagamento na API do Mercado Pago.
- `subscriptions`: o dono só lê; quem escreve são as Edge Functions `assinatura` (criar, sincronizar, cancelar) e `mercado-pago-webhook` (avisos assinados com `MP_WEBHOOK_SECRET`, conferidos direto na API do Mercado Pago).
- Limites: Gratuito 10 e Básico 30 pacientes ativos; Essencial e Profissional sem limite. Aplicados por gatilho no banco (`limitar_pacientes_do_plano`). Teste grátis de 30 dias do Profissional.
- O seed traz pacientes, sessões (com valores) e registros fictícios da Marina, o Paulo como supervisor de exemplo na rede e a Carla como contadora de exemplo na rede de contadores.
- Dados de exemplo sempre fictícios.
