# Tríade (nome provisório)

Plataforma web de gestão de consultório para psicólogos, com **supervisão clínica integrada** como diferencial: o psicólogo leva casos anonimizados para o supervisor, recebe devolutivas e acumula horas de supervisão; o supervisor pode usar essas ferramentas de graça.

## Antes de qualquer tarefa

- Leia `docs/especificacao.md` (produto, papéis, planos, fluxos, modelo de dados, regras) e `docs/design.md` (cores, fontes, componentes).
- As telas de referência estão em `docs/referencia-telas/`. São protótipos feitos num editor de design: use como referência de layout, textos e estilo. **Não copie o código de script delas** (`DCLogic`, `<sc-for>`, `<sc-if>`, `{{...}}`, `support.js` são do editor e não existem em React). Os estilos estão inline: traduza para classes do Tailwind usando os tokens de `docs/design.md`.

## Stack

- React + TypeScript + Vite + Tailwind CSS
- Supabase: Auth, Postgres com RLS, Storage, Edge Functions se precisar
- Supabase CLI para rodar localmente; migrations em `supabase/migrations/`
- Tipos gerados do banco em `src/types/database.ts`
- React Router para as rotas

## Regras inegociáveis

1. **Sigilo.** Dado clínico nunca sai do consultório do psicólogo sem passar pela anonimização e pela revisão dele. O supervisor só enxerga cópias anonimizadas (`supervision_case_excerpts`). Nenhuma policy de RLS pode dar ao supervisor de casos acesso a `patients`, `clinical_records` ou `supervision_case_sources`.
2. **RLS em toda tabela**, ativada na mesma migration que cria a tabela. Para cada tabela nova, escreva testes de acesso por papel (psicólogo, supervisor, estagiário, usuário sem vínculo).
3. **Registro clínico não é apagado de verdade** (soft delete com `deleted_at`): guarda mínima de 5 anos (Res. CFP 01/2009). Alterações em registros geram versão.
4. **Interface 100% em português do Brasil.**
5. **Dados de exemplo e seeds sempre fictícios.** Nunca use dados reais de pacientes.
6. **Nenhum texto clínico vai para API externa** (IA, analytics, logs de terceiros) sem decisão explícita do Henrique.
7. **Acessibilidade:** botões e links reais, `label` em todo campo, alvos de toque de no mínimo 44 px, contraste AA. Layouts funcionam a partir de 375 px de largura.

## Como trabalhar

- Siga o roadmap em `docs/especificacao.md` (seção 8), **uma fase por vez**. Antes de codar uma fase, mostre o plano e espere aprovação.
- Ao terminar uma tarefa: rode lint, typecheck e testes, e resuma o que mudou.
- Pergunte antes de: adicionar uma dependência grande, mudar o modelo de dados de uma fase já concluída, ou mexer em qualquer coisa de pagamento.

## Decisões em aberto (não decida sozinho)

- O supervisionando precisa de plano pago para enviar casos?
- Em clínica-escola, quem paga as contas dos estagiários (a instituição?) e a quem pertencem os pacientes do serviço?
- Provedor de pagamentos e de assinatura digital.
- Preços dos planos e nome final do produto.
