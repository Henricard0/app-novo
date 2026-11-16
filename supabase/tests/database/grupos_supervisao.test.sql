-- Testes dos grupos de supervisão por papel. Decisão do Henrique (opção B):
-- em grupo, só o supervisor lê os casos; os colegas não veem os casos uns dos outros.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;
delete from public.supervisor_profiles;

select plan(22);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com',
    '{"full_name": "Sem Vínculo", "crp_region": "07", "crp_number": "777"}'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'colega.grupo@example.com',
    '{"full_name": "Colega de Grupo", "crp_region": "08", "crp_number": "666"}');

-- O supervisor supervisiona a psicóloga e o colega.
insert into public.supervision_links (id, supervisor_id, supervisee_id, origin) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'solicitacao'),
  ('bbbbbbbb-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 'convite');

select ok((select relrowsecurity from pg_class where oid = 'public.supervision_groups'::regclass), 'RLS está ativada em supervision_groups');

-- ---------------------------------------------------------------------------
-- Supervisor monta o grupo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select lives_ok($$ insert into public.supervision_groups (name) values ('Grupo TCC') $$, 'supervisor cria o grupo');
select lives_ok($$ select public.definir_grupo('bbbbbbbb-0000-4000-8000-000000000001', (select id from public.supervision_groups)) $$,
  'supervisor coloca a psicóloga no grupo');
select lives_ok($$ select public.definir_grupo('bbbbbbbb-0000-4000-8000-000000000006', (select id from public.supervision_groups)) $$,
  'supervisor coloca o colega no grupo');
select is((select format from public.supervision_links where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 'grupo',
  'o vínculo passa a ser em grupo');
select lives_ok($$ insert into public.supervision_meetings (group_id, starts_at)
  values ((select id from public.supervision_groups), now() + interval '2 days') $$, 'supervisor marca o encontro do grupo');

reset role;

-- ---------------------------------------------------------------------------
-- Psicóloga (membro) leva um caso ao encontro do grupo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is((select name from public.supervision_groups), 'Grupo TCC', 'membro vê o nome do grupo');
select is((select count(*)::int from public.supervision_meetings), 1, 'membro vê o encontro do grupo');
select lives_ok($$ insert into public.supervision_cases (link_id, meeting_id, case_label, question)
  values ('bbbbbbbb-0000-4000-8000-000000000001', (select id from public.supervision_meetings), 'Paciente F., 16 anos', 'Pergunta fictícia') $$,
  'membro leva caso para o encontro do grupo');
select lives_ok($$ insert into public.supervision_case_excerpts (case_id, anonymized_body)
  values ((select id from public.supervision_cases), 'O paciente relatou algo fictício.') $$, 'membro grava o trecho');
select lives_ok($$ select public.enviar_caso((select id from public.supervision_cases)) $$, 'membro envia o caso');
select throws_ok($$ insert into public.supervision_meetings (group_id, starts_at)
  values ((select id from public.supervision_groups), now()) $$, '42501', null, 'membro não marca encontro do grupo');
select throws_ok($$ select public.definir_grupo('bbbbbbbb-0000-4000-8000-000000000006', null) $$,
  'P0002', null, 'membro não mexe na composição do grupo');

reset role;

-- ---------------------------------------------------------------------------
-- Colega de grupo: vê o grupo e o encontro, mas NÃO o caso (opção B)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated"}';

select is((select count(*)::int from public.supervision_meetings), 1, 'colega vê o encontro do grupo');
select is_empty($$ select 1 from public.supervision_cases $$, 'colega NÃO vê o caso da psicóloga (opção B)');
select is_empty($$ select 1 from public.supervision_case_excerpts $$, 'colega NÃO vê os trechos do caso da psicóloga');
select is_empty($$ select 1 from public.supervision_case_sources $$, 'colega não vê a origem do caso');
reset role;

-- ---------------------------------------------------------------------------
-- Supervisor lê o caso e registra horas para cada presente
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select case_label from public.supervision_cases), 'Paciente F., 16 anos', 'supervisor lê o caso enviado ao grupo');
select lives_ok($$ insert into public.supervision_hours (link_id, meeting_id, supervisee_id, minutes)
  select l.id, (select id from public.supervision_meetings), l.supervisee_id, 90
  from public.supervision_links l where l.group_id is not null $$, 'supervisor registra 1h30 para os dois presentes');
reset role;

-- ---------------------------------------------------------------------------
-- Estagiária e usuário sem vínculo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok($$ insert into public.supervision_groups (name) values ('Grupo sem CRP') $$,
  '42501', null, 'sem CRP não cria grupo de supervisão');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select is_empty($$ select 1 from public.supervision_groups $$, 'quem não é do grupo não vê o grupo');
select is_empty($$ select 1 from public.supervision_meetings $$, 'quem não é do grupo não vê os encontros');
reset role;

select * from finish();
rollback;
