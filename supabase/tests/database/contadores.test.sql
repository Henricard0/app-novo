-- Testes da rede de contadores (Fase 6, início) por papel: psicóloga com contador,
-- contador ligado (com e sem cada autorização, com e sem duas etapas), contador sem
-- vínculo, supervisor, estagiária e psicólogo sem plano.
--
-- O principal: conta de contador nunca alcança dado clínico, agenda nem supervisão
-- (CLAUDE.md, regra 1), e só lê o financeiro que o psicólogo liberou.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;
delete from public.supervisor_profiles;
update public.accountant_profiles set listed = false;

select plan(74);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.plano@example.com',
    '{"full_name": "Sem Plano", "crp_region": "08", "crp_number": "999"}'),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'contador.teste@example.com',
    '{"full_name": "Contador Teste", "account_type": "contador", "crc_state": "PR", "crc_number": "12345", "crc_category": "contador",
      "crp_region": "08", "crp_number": "777"}'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'outro.contador@example.com',
    '{"full_name": "Outro Contador", "account_type": "contador", "crc_state": "SP", "crc_number": "54321", "crc_category": "tecnico"}');

-- Psicóloga no Essencial, com paciente, sessão paga, prontuário, despesa e dados fiscais.
update public.profiles set plan = 'essencial' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set trial_ends_at = now() - interval '1 day' where id = '44444444-4444-4444-8444-444444444444';
insert into public.patients (id, owner_id, full_name, cpf, payer_name, payer_cpf) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Paciente Fictícia', '12345678909',
   'Responsável Fictício', '98765432100');
insert into public.appointments (id, owner_id, patient_id, starts_at, ends_at, status, fee, payment_status, paid_on, payment_method) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
   '2026-10-05 12:00Z', '2026-10-05 12:50Z', 'realizada', 200, 'pago', '2026-10-05', 'pix'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
   '2026-10-12 12:00Z', '2026-10-12 12:50Z', 'realizada', 200, 'a_receber', null, null);
insert into public.clinical_records (owner_id, patient_id, author_id, updated_by, body) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Registro fictício.');
insert into public.expenses (owner_id, spent_on, category, amount) values
  ('11111111-1111-4111-8111-111111111111', '2026-10-10', 'aluguel', 800);
insert into public.fiscal_profiles (owner_id, regime, monthly_payroll) values
  ('11111111-1111-4111-8111-111111111111', 'simples_nacional', 3000);
insert into public.supervisor_profiles (id, offers_supervision) values ('22222222-2222-4222-8222-222222222222', true);
insert into public.supervision_invites (token, inviter_id, inviter_role) values
  ('convite-de-teste-contador', '22222222-2222-4222-8222-222222222222', 'supervisor');
update public.accountant_profiles set listed = true where id = '55555555-5555-4555-8555-555555555555';

-- ---------------------------------------------------------------------------
-- Estrutura e cadastro
-- ---------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.accountant_profiles'::regclass, 'public.accountant_requests'::regclass, 'public.accountant_links'::regclass,
  'public.accountant_documents'::regclass, 'public.accountant_tasks'::regclass, 'public.accountant_access_log'::regclass)),
  'RLS está ativada nas seis tabelas de contadores');
select is((select account_type from public.profiles where id = '55555555-5555-4555-8555-555555555555'), 'contador',
  'o cadastro pela área do contador cria conta de contador');
select is((select crp_number from public.profiles where id = '55555555-5555-4555-8555-555555555555'), null,
  'conta de contador não guarda CRP');
select is((select trial_ends_at from public.profiles where id = '55555555-5555-4555-8555-555555555555'), null,
  'conta de contador não ganha teste de plano de psicólogo');
select results_eq($$ select crc_state, crc_number, crc_category from public.accountant_profiles
  where id = '55555555-5555-4555-8555-555555555555' $$, $$ values ('PR'::text, '12345'::text, 'contador'::text) $$,
  'o CRC do cadastro vai para o perfil do contador');
select is((select account_type from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'psicologo',
  'cadastro comum continua criando conta de psicólogo');

-- ---------------------------------------------------------------------------
-- Contador (com duas etapas), antes de qualquer vínculo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "aal": "aal2"}';
select is_empty($$ select 1 from public.patients $$, 'contador não vê pacientes');
select is_empty($$ select 1 from public.appointments $$, 'contador não vê agenda');
select is_empty($$ select 1 from public.clinical_records $$, 'contador não vê prontuário');
select is_empty($$ select 1 from public.supervision_invites $$, 'contador não vê convites de supervisão');
select is_empty($$ select 1 from public.supervisor_profiles $$, 'contador não vê a rede de supervisores');
select is_empty($$ select 1 from public.expenses $$, 'contador não lê despesas direto da tabela');
select is_empty($$ select 1 from public.fiscal_profiles $$, 'contador não lê dados fiscais direto da tabela');
select throws_ok($$ insert into public.patients (full_name) values ('Paciente do contador') $$, '42501', null,
  'contador não cadastra paciente');
select throws_ok($$ insert into public.expenses (spent_on, category, amount) values (current_date, 'outros', 1) $$, '42501', null,
  'contador não lança despesas de consultório');
select throws_ok($$ insert into public.supervisor_profiles (id, offers_supervision) values ('55555555-5555-4555-8555-555555555555', true) $$,
  '42501', null, 'contador não entra na rede de supervisores');
select throws_ok($$ select public.aceitar_convite('convite-de-teste-contador') $$, '42501', null,
  'contador não aceita convite de supervisão');
select results_eq($$ select id from public.profiles $$, $$ values ('55555555-5555-4555-8555-555555555555'::uuid) $$,
  'contador vê só o próprio perfil');
select throws_ok($$ select public.pedir_contador('66666666-6666-4666-8666-666666666666', null) $$, '42501', null,
  'contador não pede contador');
select throws_ok($$ update public.profiles set account_type = 'psicologo' where id = '55555555-5555-4555-8555-555555555555' $$,
  '42501', null, 'contador não vira psicólogo pelo navegador');
select throws_ok($$ select public.contador_resumo('11111111-1111-4111-8111-111111111111', 2026) $$, '42501', null,
  'sem vínculo, contador não lê totais');
reset role;

-- ---------------------------------------------------------------------------
-- Psicólogos pedem
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select throws_ok($$ select public.pedir_contador('55555555-5555-4555-8555-555555555555', 'Olá') $$, 'P0001',
  'contador disponível nos planos Essencial e Profissional', 'no plano gratuito não dá para pedir contador');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select throws_ok($$ update public.profiles set account_type = 'contador' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'psicóloga não vira contadora pelo navegador');
select results_eq($$ select id from public.accountant_profiles $$, $$ values ('55555555-5555-4555-8555-555555555555'::uuid) $$,
  'psicóloga vê só os contadores listados na rede');
select is((select count(*)::int from public.profiles where id = '55555555-5555-4555-8555-555555555555'), 1,
  'psicóloga vê nome do contador da rede');
select lives_ok($$ select public.pedir_contador('55555555-5555-4555-8555-555555555555', 'Preciso de ajuda com o carnê-leão.') $$,
  'psicóloga no Essencial pede contador');
select throws_ok($$ select public.pedir_contador('55555555-5555-4555-8555-555555555555', 'De novo') $$, 'P0001', null,
  'não dá para repetir pedido pendente');
select throws_ok($$ select public.pedir_contador('66666666-6666-4666-8666-666666666666', null) $$, 'P0001', null,
  'não dá para pedir a contador fora da rede');
select throws_ok($$ insert into public.accountant_links (psychologist_id, accountant_id)
  values ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555') $$, '42501', null,
  'ninguém cria vínculo direto na tabela');
reset role;

-- ---------------------------------------------------------------------------
-- Contador responde (sem e com duas etapas)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "aal": "aal1"}';
select is_empty($$ select 1 from public.accountant_requests $$, 'sem duas etapas, contador não vê pedidos');
select throws_ok($$ select public.contador_clientes() $$, '42501', null, 'sem duas etapas, contador não lista clientes');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "aal": "aal2"}';
select is((select count(*)::int from public.accountant_requests where status = 'pendente'), 1, 'contador vê o pedido recebido');
select is((select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'Psicóloga Teste',
  'contador vê o nome de quem pediu');
select isnt((select public.responder_pedido_contador(id, true) from public.accountant_requests where status = 'pendente'), null,
  'contador aceita o pedido');
select results_eq($$ select share_totals, share_entries, share_expenses from public.accountant_links $$,
  $$ values (true, false, false) $$, 'vínculo nasce só com os totais liberados');
select is_empty($$ select 1 from public.patients $$, 'com vínculo, contador continua sem ver pacientes');
select is_empty($$ select 1 from public.appointments $$, 'com vínculo, contador continua sem ver a agenda');
select is_empty($$ select 1 from public.clinical_records $$, 'com vínculo, contador continua sem ver prontuário');
select is_empty($$ update public.accountant_links set share_entries = true returning 1 $$,
  'contador não muda as autorizações');
select results_eq($$ select regime, monthly_payroll, receita_12_meses from public.contador_clientes() $$,
  $$ values ('simples_nacional'::text, 3000::numeric, 200::numeric) $$, 'contador vê regime, pró-labore e receita de 12 meses');
select results_eq($$ select recebido, sessoes_pagas, a_receber, despesas from public.contador_resumo('11111111-1111-4111-8111-111111111111', 2026)
  where mes = '2026-10-01' $$, $$ values (200::numeric, 1, 200::numeric, null::numeric) $$,
  'contador vê os totais de outubro (sem despesas, que não foram liberadas)');
select throws_ok($$ select * from public.contador_lancamentos('11111111-1111-4111-8111-111111111111', '2026-10-01') $$,
  '42501', null, 'sem autorização, contador não vê lançamentos');
select throws_ok($$ select * from public.contador_despesas('11111111-1111-4111-8111-111111111111', '2026-10-01') $$,
  '42501', null, 'sem autorização, contador não vê despesas');
select is_empty($$ select 1 from public.accountant_access_log $$, 'contador não lê o registro de acessos');
-- Guias e pendências
select lives_ok($$ select public.enviar_guia('11111111-1111-4111-8111-111111111111', 'das', 'DAS outubro', '2026-10-15', '2026-11-20', 120.5,
  '11111111-1111-4111-8111-111111111111/cccccccc-0000-4000-8000-000000000001.pdf') $$, 'contador envia uma guia');
select throws_ok($$ select public.enviar_guia('11111111-1111-4111-8111-111111111111', 'das', 'Fora da pasta', '2026-10-01', null, null,
  '44444444-4444-4444-8444-444444444444/cccccccc-0000-4000-8000-000000000002.pdf') $$, '42501', null,
  'guia só vai para a pasta do próprio cliente');
select throws_ok($$ select public.enviar_guia('44444444-4444-4444-8444-444444444444', 'das', 'Sem vínculo', '2026-10-01', null, null,
  '44444444-4444-4444-8444-444444444444/cccccccc-0000-4000-8000-000000000003.pdf') $$, '42501', null,
  'contador não envia guia para quem não atende');
select lives_ok($$ select public.criar_pendencia('11111111-1111-4111-8111-111111111111', 'Envie o recibo do aluguel.') $$,
  'contador cria uma pendência');
select lives_ok($$ insert into storage.objects (bucket_id, name)
  values ('guias', '11111111-1111-4111-8111-111111111111/cccccccc-0000-4000-8000-000000000001.pdf') $$,
  'contador envia o PDF para a pasta do cliente');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('guias', '44444444-4444-4444-8444-444444444444/cccccccc-0000-4000-8000-000000000004.pdf') $$, '42501', null,
  'contador não envia PDF para a pasta de quem não atende');
reset role;

-- ---------------------------------------------------------------------------
-- Psicóloga controla
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.accountant_access_log where scope = 'totais'), 1, 'psicóloga vê o acesso do contador aos totais');
select lives_ok($$ update public.accountant_links set share_entries = true, share_expenses = true $$, 'psicóloga libera lançamentos e despesas');
select is((select count(*)::int from public.accountant_documents), 1, 'psicóloga vê a guia recebida');
select lives_ok($$ select public.marcar_guia_paga(id, true) from public.accountant_documents $$, 'psicóloga marca a guia como paga');
select lives_ok($$ select public.resolver_pendencia(id, true) from public.accountant_tasks $$, 'psicóloga resolve a pendência');
select is((select count(*)::int from storage.objects where bucket_id = 'guias'), 1, 'psicóloga lê o PDF da própria pasta');
select throws_ok($$ update public.accountant_links set status = 'encerrado' $$, '42501', null,
  'vínculo só termina pela função (com registro de quem encerrou)');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "aal": "aal2"}';
select results_eq($$ select pagador_nome, pagador_cpf, valor from public.contador_lancamentos('11111111-1111-4111-8111-111111111111', '2026-10-01') $$,
  $$ values ('Responsável Fictício'::text, '98765432100'::text, 200::numeric) $$, 'com autorização, contador vê os lançamentos e quem pagou');
select results_eq($$ select categoria, valor from public.contador_despesas('11111111-1111-4111-8111-111111111111', '2026-10-01') $$,
  $$ values ('aluguel'::text, 800::numeric) $$, 'com autorização, contador vê as despesas');
select throws_ok($$ select public.resolver_pendencia(id, false) from public.accountant_tasks $$, 'P0002', null,
  'só a psicóloga resolve pendências');
select throws_ok($$ select public.remover_guia(id) from public.accountant_documents $$, 'P0002', null,
  'guia paga não é removida');
reset role;

-- ---------------------------------------------------------------------------
-- Quem não tem vínculo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated", "aal": "aal2"}';
select throws_ok($$ select public.contador_resumo('11111111-1111-4111-8111-111111111111', 2026) $$, '42501', null,
  'outro contador não lê os totais da psicóloga');
select is_empty($$ select 1 from public.accountant_documents $$, 'outro contador não vê guias');
select is_empty($$ select 1 from storage.objects $$, 'outro contador não vê PDFs');
select results_eq($$ select id from public.profiles $$, $$ values ('66666666-6666-4666-8666-666666666666'::uuid) $$,
  'outro contador não vê nenhum psicólogo');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.accountant_links $$, 'supervisor não vê o vínculo contábil de outra pessoa');
select is_empty($$ select 1 from public.accountant_documents $$, 'supervisor não vê guias de outra pessoa');
select throws_ok($$ select public.contador_resumo('11111111-1111-4111-8111-111111111111', 2026) $$, '42501', null,
  'supervisor não usa as leituras do contador');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from public.accountant_access_log $$, 'estagiária não vê o registro de acessos de outra pessoa');
reset role;

-- ---------------------------------------------------------------------------
-- Plano vence e vínculo termina
-- ---------------------------------------------------------------------------
update public.profiles set plan = 'gratuito', trial_ends_at = now() - interval '1 day'
 where id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "aal": "aal2"}';
select throws_ok($$ select public.contador_resumo('11111111-1111-4111-8111-111111111111', 2026) $$, '42501', null,
  'se a psicóloga volta ao gratuito, o contador perde o acesso aos dados');
reset role;
update public.profiles set plan = 'essencial' where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select lives_ok($$ select public.encerrar_vinculo_contador(id) from public.accountant_links where status = 'ativo' $$,
  'psicóloga encerra o vínculo');
select is((select count(*)::int from public.accountant_documents), 1, 'depois de encerrar, a psicóloga continua com as guias');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated", "aal": "aal2"}';
select is_empty($$ select 1 from public.contador_clientes() $$, 'depois de encerrar, a psicóloga sai da lista do contador');
select throws_ok($$ select public.contador_resumo('11111111-1111-4111-8111-111111111111', 2026) $$, '42501', null,
  'depois de encerrar, o contador não lê mais nada');
reset role;

select * from finish();
rollback;
