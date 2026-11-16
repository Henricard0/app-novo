-- Testes da supervisão (Fase 2b) por papel: supervisionanda (psicóloga),
-- supervisor do vínculo, outro supervisor sem vínculo, estagiária, usuário sem
-- vínculo e anônimo. Foco na regra 1: o supervisor só vê a cópia anonimizada.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;
delete from public.supervisor_profiles;

select plan(50);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com',
    '{"full_name": "Sem Vínculo", "crp_region": "07", "crp_number": "777"}'),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'outro.supervisor@example.com',
    '{"full_name": "Outro Supervisor", "crp_region": "08", "crp_number": "999"}');

insert into public.supervision_links (id, supervisor_id, supervisee_id, origin) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'solicitacao'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', 'convite');

insert into public.patients (id, owner_id, full_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Ana Beatriz Fictícia'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Paciente do Supervisor');
insert into public.clinical_records (id, owner_id, author_id, updated_by, patient_id, body) values
  ('dddddddd-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Ana Beatriz faltou às duas últimas sessões.');

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.supervision_meetings'::regclass, 'public.supervision_cases'::regclass,
  'public.supervision_case_sources'::regclass, 'public.supervision_case_excerpts'::regclass,
  'public.supervision_feedback'::regclass, 'public.supervision_feedback_tasks'::regclass,
  'public.supervision_hours'::regclass)),
  'RLS está ativada nas sete tabelas da supervisão');
select is_empty($$ select 1 from pg_policies where tablename = 'supervision_case_sources'
  and (qual ilike '%supervisor%' or with_check ilike '%supervisor%') $$,
  'nenhuma policy de supervision_case_sources menciona o supervisor (regra 1)');

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.supervision_cases $$, '42501', null, 'anônimo não lê casos');
select throws_ok($$ select * from public.supervision_case_sources $$, '42501', null, 'anônimo não lê a origem dos casos');
select throws_ok($$ select * from public.supervision_case_excerpts $$, '42501', null, 'anônimo não lê trechos');
reset role;

-- ---------------------------------------------------------------------------
-- Supervisionanda prepara e envia o caso
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select lives_ok($$ insert into public.supervision_meetings (link_id, starts_at)
  values ('bbbbbbbb-0000-4000-8000-000000000001', now() + interval '3 days') $$, 'supervisionanda marca o encontro');
select lives_ok($$ insert into public.supervision_cases (link_id, meeting_id, case_label, question)
  values ('bbbbbbbb-0000-4000-8000-000000000001', (select id from public.supervision_meetings limit 1),
          'Paciente A., 34 anos', 'Como manejar as faltas?') $$, 'supervisionanda cria o caso');
select lives_ok($$ insert into public.supervision_cases (link_id, case_label)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'Rascunho B.') $$, 'supervisionanda cria um rascunho sem pergunta');
select throws_ok($$ insert into public.supervision_cases (link_id, case_label)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'Vínculo alheio') $$,
  '42501', null, 'não cria caso em vínculo de outras pessoas');

select lives_ok($$ insert into public.supervision_case_sources (case_id, patient_id, record_ids)
  values ((select id from public.supervision_cases where case_label = 'Paciente A., 34 anos'),
          'aaaaaaaa-0000-4000-8000-000000000001', '{dddddddd-0000-4000-8000-000000000001}') $$,
  'supervisionanda guarda de qual paciente saiu o caso');
select throws_ok($$ insert into public.supervision_case_sources (case_id, patient_id)
  values ((select id from public.supervision_cases where case_label = 'Rascunho B.'), 'aaaaaaaa-0000-4000-8000-000000000002') $$,
  '42501', null, 'a origem precisa ser paciente da própria supervisionanda');
select lives_ok($$ insert into public.supervision_case_excerpts (case_id, period_label, anonymized_body)
  values ((select id from public.supervision_cases where case_label = 'Paciente A., 34 anos'), 'Sessão · nov/2026',
          'A paciente faltou às duas últimas sessões.') $$, 'supervisionanda grava o trecho anonimizado');

select throws_ok($$ select public.enviar_caso((select id from public.supervision_cases where case_label = 'Rascunho B.')) $$,
  '23514', null, 'caso sem pergunta não vai para a pauta');
select lives_ok($$ select public.enviar_caso((select id from public.supervision_cases where case_label = 'Paciente A., 34 anos')) $$,
  'supervisionanda envia o caso para a pauta');
select is((select status from public.supervision_cases where case_label = 'Paciente A., 34 anos'), 'na_pauta', 'o caso está na pauta');
select ok(exists (select 1 from public.audit_log where action = 'compartilhou' and entity = 'supervision_cases'),
  'o compartilhamento ficou na auditoria');

select lives_ok($$ update public.supervision_case_excerpts set anonymized_body = 'Alterado depois de enviar' $$,
  'tentar mudar o trecho depois de enviado não afeta nada (conferido abaixo)');
select throws_ok($$ insert into public.supervision_case_excerpts (case_id, anonymized_body)
  values ((select id from public.supervision_cases where case_label = 'Paciente A., 34 anos'), 'Trecho a mais') $$,
  '42501', null, 'não acrescenta trechos depois de enviado');
select throws_ok($$ update public.supervision_cases set status = 'devolutiva_recebida' $$,
  '42501', null, 'a situação do caso só muda pelas funções');
select throws_ok($$ insert into public.supervision_feedback (case_id, observed)
  values ((select id from public.supervision_cases where case_label = 'Paciente A., 34 anos'), 'Autodevolutiva') $$,
  '42501', null, 'supervisionanda não escreve a devolutiva');
select throws_ok($$ insert into public.supervision_hours (link_id, supervisee_id, minutes)
  values ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 600) $$,
  '42501', null, 'supervisionanda não registra horas para si');

reset role;

-- ---------------------------------------------------------------------------
-- Supervisor do vínculo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select results_eq($$ select case_label, question from public.supervision_cases $$,
  $$ values ('Paciente A., 34 anos'::text, 'Como manejar as faltas?'::text) $$,
  'supervisor vê só o caso enviado (o rascunho não)');
select results_eq($$ select anonymized_body from public.supervision_case_excerpts $$,
  $$ values ('A paciente faltou às duas últimas sessões.'::text) $$, 'supervisor lê a cópia anonimizada, sem alterações');
select is_empty($$ select 1 from public.supervision_case_sources $$, 'supervisor NÃO vê de qual paciente saiu o caso (regra 1)');
select is_empty($$ select 1 from public.patients where owner_id = '11111111-1111-4111-8111-111111111111' $$,
  'supervisor não vê os pacientes da supervisionanda (regra 1)');
select is_empty($$ select 1 from public.clinical_records where owner_id = '11111111-1111-4111-8111-111111111111' $$,
  'supervisor não vê o prontuário da supervisionanda (regra 1)');
select is((select count(*)::int from public.supervision_meetings), 1, 'supervisor vê o encontro marcado');

select lives_ok($$ insert into public.supervision_feedback (case_id, observed, paths)
  values ((select id from public.supervision_cases limit 1), 'Observação fictícia.', 'Caminho fictício.') $$,
  'supervisor escreve a devolutiva');
select lives_ok($$ insert into public.supervision_feedback_tasks (feedback_id, text)
  values ((select id from public.supervision_feedback limit 1), 'Retomar o contrato de faltas') $$,
  'supervisor acrescenta um encaminhamento');
select throws_ok($$ select public.enviar_caso((select id from public.supervision_cases limit 1)) $$,
  'P0002', null, 'supervisor não envia caso em nome da supervisionanda');
select lives_ok($$ select public.enviar_devolutiva((select id from public.supervision_feedback limit 1), 60) $$,
  'supervisor envia a devolutiva e registra 1h');
select is((select sum(minutes)::int from public.supervision_hours), 60, 'a hora ficou registrada');
select lives_ok($$ update public.supervision_feedback set observed = 'Mudado depois de enviar' $$,
  'mudar a devolutiva depois de enviada não afeta nada (conferido abaixo)');
select throws_ok($$ insert into public.supervision_feedback_tasks (feedback_id, text)
  values ((select id from public.supervision_feedback limit 1), 'Tarde demais') $$,
  '42501', null, 'não acrescenta encaminhamento depois de enviada');

reset role;

-- ---------------------------------------------------------------------------
-- Supervisionanda recebe a devolutiva
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is((select status from public.supervision_cases where case_label = 'Paciente A., 34 anos'), 'devolutiva_recebida',
  'o caso aparece com devolutiva recebida');
select is((select observed from public.supervision_feedback), 'Observação fictícia.', 'supervisionanda lê a devolutiva enviada');
select lives_ok($$ select public.marcar_encaminhamento((select id from public.supervision_feedback_tasks limit 1), true) $$,
  'supervisionanda marca o encaminhamento como feito');
select isnt((select done_at from public.supervision_feedback_tasks limit 1), null, 'o encaminhamento ficou marcado');
select is((select sum(minutes)::int from public.supervision_hours), 60, 'supervisionanda vê suas horas');
select is((select count(*)::int from public.supervision_case_sources), 1, 'supervisionanda vê a origem do próprio caso');

reset role;

-- ---------------------------------------------------------------------------
-- Outro supervisor, estagiária e usuário sem vínculo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';
select is_empty($$ select 1 from public.supervision_cases $$, 'outro supervisor não vê casos de quem não supervisiona');
select is_empty($$ select 1 from public.supervision_case_excerpts $$, 'outro supervisor não vê trechos');
select throws_ok($$ insert into public.supervision_feedback (case_id, observed)
  values ((select id from public.supervision_cases limit 1), 'Intruso') $$,
  '42501', null, 'outro supervisor não consegue responder caso de quem não supervisiona');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from public.supervision_cases $$, 'estagiária não vê casos');
select is_empty($$ select 1 from public.supervision_feedback $$, 'estagiária não vê devolutivas');
select is_empty($$ select 1 from public.supervision_hours $$, 'estagiária não vê horas alheias');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is_empty($$ select 1 from public.supervision_meetings where link_id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'usuário sem vínculo com eles não vê o encontro');
select is_empty($$ select 1 from public.supervision_feedback_tasks $$, 'usuário sem vínculo não vê encaminhamentos');
reset role;

-- ---------------------------------------------------------------------------
-- Conferências finais
-- ---------------------------------------------------------------------------
select is((select anonymized_body from public.supervision_case_excerpts), 'A paciente faltou às duas últimas sessões.',
  'o trecho enviado continua igual (cópia congelada)');
select is((select observed from public.supervision_feedback), 'Observação fictícia.', 'a devolutiva enviada continua igual');

select * from finish();
rollback;
