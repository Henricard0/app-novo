# Estado do projeto (16/11/2026)

Resumo para retomar o trabalho. Detalhes de produto em `docs/especificacao.md`; regras em `CLAUDE.md`; ambientes em `docs/ambientes.md`; comandos e regras do banco no `README.md`.

## Onde está

- **Código:** branch `claude/focused-wozniak-y9d9ps` (pull request #1 para `main`, ainda não mesclado).
- **Site de teste:** <https://triade-hazel.vercel.app> (Vercel, projeto `triade`). Publicar: `npx vercel deploy --prod`.
- **Banco de teste:** Supabase `fjadohwypqsarkyklsqh` (us-east-1, plano gratuito, só dados fictícios). Todas as migrations de `supabase/migrations/` estão aplicadas e registradas.
- **Edge Functions (Supabase de teste):** `assinatura` (com login) e `mercado-pago-webhook` (sem login, assinatura HMAC).
- **Segredos no Supabase de teste:** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PAYER_EMAIL_TESTE` (Mercado Pago em modo de teste). Valores nunca no código nem no chat.
- **Projeto de produção:** `llqunvzphflvrghvjmbb` ("triade-producao", São Paulo, organização "Tríade") só com a estrutura da Fase 0; ainda não recebeu as migrations seguintes nem tem site apontando para ele.

## Fases

| Fase | Situação |
|---|---|
| 0. Base | Concluída |
| 1. Consultório mínimo (pacientes, agenda em calendário com arrastar, prontuário com versões) | Concluída |
| 2a. Rede de supervisores (perfil, busca, pedido, convite por link) | Concluída |
| 2b. Supervisão (casos anonimizados, pauta, devolutivas, horas, grupos) | Concluída |
| 3. Planos e assinatura (Mercado Pago, modo de teste) | Concluída em modo de teste |
| 4. Estágio | Suspensa (exige contrato de estágio registrado ou convênio com cursos) |
| 5. Extras (financeiro, recibos, NFS-e, declarações, assinatura digital) | A fazer — próxima |
| 6. Fiscal (carnê-leão, DAS, Fator R, rede de contadores) | Proposta, modelo decidido |

Testes: 225 de acesso ao banco (pgTAP, `npm run db:test:sem-docker`) e 97 de tela (`npm test`), todos passando no último envio.

## Decisões do Henrique

- **Banco:** Supabase (o Firebase foi testado e descartado).
- **Planos:** Gratuito (supervisão completa + 10 pacientes ativos), Básico R$ 29,90/mês ou R$ 299/ano (30 pacientes), Essencial R$ 39,90 ou R$ 399 (ilimitado + NFS-e), Profissional R$ 49,90 ou R$ 499 (tudo). 30 dias grátis do Profissional; 50% no primeiro ano para recém-formados.
- **Supervisionando** não precisa de plano pago; a supervisão é cobrada pelo supervisor, fora da plataforma.
- **Pagamento** pelo Mercado Pago (só modo de teste até haver CNPJ).
- **Rede de supervisores:** só quem tem CRP aparece; CRP conferível pela consulta pública do CFP (selo "verificado" fica para depois); valor no perfil só informativo; sem feed, chat nem foto por enquanto.
- **Grupos de supervisão (opção B):** só o supervisor lê os casos; colegas do grupo não veem os casos uns dos outros.
- **Agenda:** sessões semanais perguntam "só esta" ou "esta e as seguintes" ao arrastar.
- **Paciente:** sem CPF até a Fase 5.
- **Fase 6 (fiscal):** para pessoa física e CNPJ, nos planos Essencial e Profissional.
- **Contadores (Fase 6):** rede de contadores com login e tipo de conta separados, no mesmo banco (jeito A). O contador só vê o que o psicólogo liberar, nunca dado clínico; o psicólogo só vê o perfil do contador e o que ele enviou. Valor combinado entre eles, sem porcentagem para a Tríade. Um e-mail = uma conta. Detalhes em `docs/especificacao.md`, Fase 6.

## Em aberto

- **Fase 6:** se o contador paga mensalidade fixa ou usa de graça; validar o modelo com advogado e CRC-PR antes de lançar.
- **Fase 5b:** escolher o intermediário de NFS-e (Focus NFe, Tecnospeed PlugNotas, NotaGateway…). A NFS-e Nacional é obrigatória para ME/EPP do Simples desde 01/11/2026.
- Provedor de assinatura digital; nome final do produto.
- Pendências técnicas da Fase 3: virada automática do desconto de recém-formado para o preço cheio depois de 12 meses; cancelamento hoje volta ao gratuito na hora (pode passar a valer só no fim do período pago).
- Antes de dados reais: plano pago do Supabase no projeto de São Paulo, aplicar todas as migrations nele, envio de e-mail próprio (SMTP) e domínio, termos de uso e política de privacidade, Vercel Pro, credenciais de produção do Mercado Pago (com CNPJ).

## Contas de teste (fictícias)

- `marina.costa@example.com` (psicóloga, CRP 08/12345), `paulo.andrade@example.com` (supervisor na rede, CRP 08/4567), `bianca.lima@example.com` (sem CRP) — senha `senha-teste-123`.
- Contas reais do Henrique e do pai foram criadas no projeto de teste (sem dados clínicos).
