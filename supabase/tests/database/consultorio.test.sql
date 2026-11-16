-- Testes de acesso às tabelas da Fase 1 (pacientes, contatos, agenda, prontuário,
-- versões e auditoria) por papel: psicóloga, supervisor, estagiária, usuário sem
-- vínculo e anônimo. O supervisor também é psicólogo e tem um paciente seu, para
-- provar que um não enxerga o consultório do outro (CLAUDE.md, regra 1).
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;

select plan(58);

-- ---------------------------------------------------------------------------
-- Usuários e dados fictícios (criados como administrador)
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com', '{"full_name": "Psicóloga Teste"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com', '{"full_name": "Supervisor Teste"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com', '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com', '{"full_name": "Sem Vínculo"}');

-- Paciente da psicóloga, com contato, sessão e registro.
insert into public.patients (id, owner_id, full_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Paciente Fictício da Psicóloga'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Paciente Fictício do Supervisor');
insert into public.patient_contacts (id, owner_id, patient_id, name, relation) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Contato Fictício', 'Mãe');
insert into public.appointments (id, owner_id, patient_id, starts_at, ends_at) values
  ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', now(), now() + interval '50 minutes'),
  ('cccccccc-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000002', now(), now() + interval '50 minutes');
insert into public.clinical_records (id, owner_id, author_id, updated_by, patient_id, appointment_id, body) values
  ('dddddddd-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'Texto clínico fictício, versão 1.'),
  ('dddddddd-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002', 'Texto clínico fictício do supervisor.');

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.patients'::regclass, 'public.patient_contacts'::regclass, 'public.appointments'::regclass,
  'public.clinical_records'::regclass, 'public.clinical_record_versions'::regclass, 'public.audit_log'::regclass)),
  'RLS está ativada nas seis tabelas da Fase 1');
select has_trigger('public', 'clinical_records', 'clinical_records_versionar', 'prontuário gera versão ao editar');
select has_trigger('public', 'clinical_records', 'clinical_records_auditoria', 'prontuário registra auditoria');
select has_trigger('public', 'patients', 'patients_auditoria', 'pacientes registram auditoria');

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$ select * from public.patients $$, '42501', null, 'anônimo não lê pacientes');
select throws_ok($$ select * from public.clinical_records $$, '42501', null, 'anônimo não lê prontuários');
select throws_ok($$ select * from public.appointments $$, '42501', null, 'anônimo não lê a agenda');
select throws_ok($$ select public.excluir_registro_clinico('dddddddd-0000-4000-8000-000000000001') $$,
  '42501', null, 'anônimo não chama a exclusão de registro');

reset role;

-- ---------------------------------------------------------------------------
-- Psicóloga
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select results_eq($$ select id from public.patients $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid) $$, 'psicóloga vê só o próprio paciente');
select is_empty($$ select 1 from public.clinical_records where id = 'dddddddd-0000-4000-8000-000000000002' $$,
  'psicóloga não vê o prontuário do paciente do supervisor');

select lives_ok($$ insert into public.patients (full_name, nicknames) values ('Novo Paciente Fictício', '{Novo}') $$,
  'psicóloga cadastra paciente');
select is((select owner_id from public.patients where full_name = 'Novo Paciente Fictício'),
  '11111111-1111-4111-8111-111111111111'::uuid, 'o paciente novo fica no nome de quem cadastrou');
select throws_ok($$ insert into public.patients (owner_id, full_name) values ('22222222-2222-4222-8222-222222222222', 'Forjado') $$,
  '42501', null, 'psicóloga não cadastra paciente em nome de outra pessoa');
select lives_ok($$ update public.patients set full_name = 'Paciente Renomeado', archived_at = now()
  where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'psicóloga edita e arquiva o próprio paciente');
select lives_ok($$ update public.patients set archived_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'psicóloga reativa o paciente');
select throws_ok($$ delete from public.patients where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'paciente não é apagado de verdade');

select lives_ok($$ insert into public.patient_contacts (patient_id, name, relation)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'Outro Contato', 'Irmão') $$, 'psicóloga cadastra contato do seu paciente');
select throws_ok($$ insert into public.patient_contacts (patient_id, name)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'Intruso') $$,
  '42501', null, 'psicóloga não cadastra contato em paciente de outra pessoa');

select lives_ok($$ insert into public.appointments (patient_id, starts_at, ends_at, modality)
  values ('aaaaaaaa-0000-4000-8000-000000000001', now() + interval '1 day', now() + interval '1 day 50 minutes', 'online') $$,
  'psicóloga agenda sessão para o seu paciente');
select throws_ok($$ insert into public.appointments (patient_id, starts_at, ends_at)
  values ('aaaaaaaa-0000-4000-8000-000000000002', now(), now() + interval '50 minutes') $$,
  '42501', null, 'psicóloga não agenda para paciente de outra pessoa');
select throws_ok($$ insert into public.appointments (patient_id, starts_at, ends_at)
  values ('aaaaaaaa-0000-4000-8000-000000000001', now(), now() - interval '1 minute') $$,
  '23514', null, 'sessão precisa terminar depois de começar');
select lives_ok($$ update public.appointments set status = 'realizada' where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'psicóloga marca a sessão como realizada');
select throws_ok($$ delete from public.appointments where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '42501', null, 'sessão não é apagada (é cancelada)');

select lives_ok($$ insert into public.clinical_records (patient_id, appointment_id, body)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 'Outro registro fictício.') $$,
  'psicóloga escreve registro ligado à sessão do paciente');
select throws_ok($$ insert into public.clinical_records (patient_id, appointment_id, body)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000002', 'Ligado à sessão errada.') $$,
  '42501', null, 'registro não pode ser ligado à sessão de outro paciente');
select throws_ok($$ insert into public.clinical_records (patient_id, body)
  values ('aaaaaaaa-0000-4000-8000-000000000002', 'No prontuário alheio.') $$,
  '42501', null, 'psicóloga não escreve no prontuário de paciente de outra pessoa');

select lives_ok($$ update public.clinical_records set body = 'Texto clínico fictício, versão 2.'
  where id = 'dddddddd-0000-4000-8000-000000000001' $$, 'psicóloga edita o próprio registro');
select results_eq($$ select body from public.clinical_record_versions where record_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  $$ values ('Texto clínico fictício, versão 1.'::text) $$, 'a edição guardou a versão anterior');
select lives_ok($$ update public.clinical_records set body = body where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'salvar sem mudar o texto é permitido');
select is((select count(*)::int from public.clinical_record_versions where record_id = 'dddddddd-0000-4000-8000-000000000001'),
  1, 'salvar sem mudar o texto não cria versão nova');

select throws_ok($$ insert into public.clinical_record_versions (record_id, body, session_date, created_at)
  values ('dddddddd-0000-4000-8000-000000000001', 'Versão forjada', current_date, now()) $$,
  '42501', null, 'ninguém escreve versões à mão');
select throws_ok($$ update public.clinical_record_versions set body = 'Adulterado' $$,
  '42501', null, 'versões não podem ser alteradas');
select throws_ok($$ delete from public.clinical_record_versions $$,
  '42501', null, 'versões não podem ser apagadas');

select throws_ok($$ delete from public.clinical_records where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '42501', null, 'registro clínico não é apagado de verdade');
select throws_ok($$ update public.clinical_records set deleted_at = now() where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '42501', null, 'exclusão só pela função própria, não editando a coluna');
select throws_ok($$ update public.clinical_records set owner_id = '22222222-2222-4222-8222-222222222222'
  where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '42501', null, 'registro não muda de dono');

select lives_ok($$ select public.excluir_registro_clinico('dddddddd-0000-4000-8000-000000000001', 'Registrado no paciente errado') $$,
  'psicóloga exclui o próprio registro');
select is_empty($$ select 1 from public.clinical_records where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'registro excluído some das telas');
select throws_ok($$ select public.excluir_registro_clinico('dddddddd-0000-4000-8000-000000000001') $$,
  'P0002', null, 'registro já excluído não é excluído de novo');
select throws_ok($$ select public.excluir_registro_clinico('dddddddd-0000-4000-8000-000000000002') $$,
  'P0002', null, 'psicóloga não exclui registro de outra pessoa');

select ok((select count(*) from public.audit_log where entity = 'clinical_records' and action = 'excluiu'
  and entity_id = 'dddddddd-0000-4000-8000-000000000001') = 1, 'a exclusão ficou no registro de auditoria');
select is_empty($$ select 1 from public.audit_log where owner_id <> '11111111-1111-4111-8111-111111111111' $$,
  'psicóloga só vê a auditoria dos próprios dados');
select throws_ok($$ insert into public.audit_log (owner_id, action, entity, entity_id)
  values ('11111111-1111-4111-8111-111111111111', 'criou', 'patients', gen_random_uuid()) $$,
  '42501', null, 'ninguém escreve na auditoria à mão');

reset role;

-- ---------------------------------------------------------------------------
-- Supervisor (também psicólogo, com paciente próprio)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select results_eq($$ select id from public.patients $$,
  $$ values ('aaaaaaaa-0000-4000-8000-000000000002'::uuid) $$, 'supervisor vê só o próprio paciente');
select is_empty($$ select 1 from public.clinical_records where patient_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'supervisor não vê o prontuário dos pacientes da psicóloga');
select is_empty($$ select 1 from public.clinical_record_versions where record_id = 'dddddddd-0000-4000-8000-000000000001' $$,
  'supervisor não vê as versões do prontuário da psicóloga');
select is_empty($$ select 1 from public.appointments where owner_id = '11111111-1111-4111-8111-111111111111' $$,
  'supervisor não vê a agenda da psicóloga');
select is_empty($$ select 1 from public.patient_contacts where owner_id = '11111111-1111-4111-8111-111111111111' $$,
  'supervisor não vê os contatos dos pacientes da psicóloga');
select is_empty($$ select 1 from public.audit_log where owner_id = '11111111-1111-4111-8111-111111111111' $$,
  'supervisor não vê a auditoria da psicóloga');
select lives_ok($$ update public.patients set full_name = 'Alterado pelo supervisor'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'supervisor tentando editar paciente da psicóloga não afeta nada (conferido abaixo)');

reset role;

-- ---------------------------------------------------------------------------
-- Estagiária e usuário sem vínculo: nenhum dado de consultório
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select is_empty($$ select 1 from public.patients $$, 'estagiária não vê pacientes de ninguém');
select is_empty($$ select 1 from public.clinical_records $$, 'estagiária não vê prontuários de ninguém');
select is_empty($$ select 1 from public.appointments $$, 'estagiária não vê agendas de ninguém');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select is_empty($$ select 1 from public.patients $$, 'usuário sem vínculo não vê pacientes');
select is_empty($$ select 1 from public.clinical_records $$, 'usuário sem vínculo não vê prontuários');
select is_empty($$ select 1 from public.clinical_record_versions $$, 'usuário sem vínculo não vê versões');

reset role;

-- ---------------------------------------------------------------------------
-- Conferências finais como administrador
-- ---------------------------------------------------------------------------
select is((select full_name from public.patients where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'Paciente Renomeado', 'paciente da psicóloga continua intacto depois da tentativa do supervisor');
select results_eq(
  $$ select deleted_at is not null, deleted_by, deleted_reason, body from public.clinical_records
     where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  $$ values (true, '11111111-1111-4111-8111-111111111111'::uuid, 'Registrado no paciente errado'::text, 'Texto clínico fictício, versão 2.'::text) $$,
  'registro excluído continua guardado no banco, com quem excluiu e o motivo');

select * from finish();
rollback;
