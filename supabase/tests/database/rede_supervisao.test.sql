-- Testes da rede de supervisores (Fase 2a) por papel: psicóloga que procura
-- supervisão, supervisor que oferece, estagiária (sem CRP), usuário sem vínculo
-- e anônimo. Inclui a regra 1: o vínculo não dá acesso a pacientes.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;

-- Os testes montam a própria rede: tira o supervisor de exemplo do seed (desfeito no rollback).
delete from public.supervisor_profiles;
update public.accountant_profiles set listed = false;

select plan(38);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com',
    '{"full_name": "Sem Vínculo", "crp_region": "07", "crp_number": "777"}'),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'lotado.teste@example.com',
    '{"full_name": "Supervisor Lotado", "crp_region": "08", "crp_number": "999"}');

insert into public.supervisor_profiles (id, offers_supervision, accepting_new, bio, approaches) values
  ('22222222-2222-4222-8222-222222222222', true, true, 'Bio fictícia do supervisor.', '{TCC}'),
  ('33333333-3333-4333-8333-333333333333', true, true, 'Estagiária sem CRP tentando aparecer.', '{}'),
  ('55555555-5555-4555-8555-555555555555', true, false, 'Sem vagas.', '{Psicanálise}');

insert into public.patients (id, owner_id, full_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Paciente Fictício');

select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.supervisor_profiles'::regclass, 'public.supervision_links'::regclass,
  'public.supervision_requests'::regclass, 'public.supervision_invites'::regclass)),
  'RLS está ativada nas quatro tabelas da rede');

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.supervisor_profiles $$, '42501', null, 'anônimo não vê a rede');
select throws_ok($$ select public.ver_convite('qualquer') $$, '42501', null, 'anônimo não consulta convites');
select throws_ok($$ select public.aceitar_convite('qualquer') $$, '42501', null, 'anônimo não aceita convites');
reset role;

-- ---------------------------------------------------------------------------
-- Psicóloga procurando supervisão
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select results_eq($$ select id from public.supervisor_profiles order by id $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid), ('55555555-5555-4555-8555-555555555555'::uuid) $$,
  'a rede mostra só quem oferece supervisão e tem CRP');
select is((select full_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Supervisor Teste', 'psicóloga vê nome e CRP de quem está na rede');
select is_empty($$ select 1 from public.profiles where id = '44444444-4444-4444-8444-444444444444' $$,
  'psicóloga não vê o perfil de quem não está na rede nem tem vínculo com ela');
select is_empty($$ select 1 from public.profiles where id = '33333333-3333-4333-8333-333333333333' $$,
  'estagiária sem CRP não aparece, mesmo marcando que oferece supervisão');

select lives_ok($$ insert into public.supervisor_profiles (id, bio) values ('11111111-1111-4111-8111-111111111111', 'Minha bio') $$,
  'psicóloga cria o próprio perfil de supervisor');
select throws_ok($$ insert into public.supervisor_profiles (id, bio) values ('44444444-4444-4444-8444-444444444444', 'Forjado') $$,
  '42501', null, 'ninguém cria perfil de supervisor em nome de outra pessoa');
select lives_ok($$ update public.supervisor_profiles set bio = 'Alterado por outra pessoa' where id = '22222222-2222-4222-8222-222222222222' $$,
  'tentar editar o perfil do supervisor não afeta nada (conferido abaixo)');
select throws_ok($$ insert into public.supervisor_profiles (id, modalities) values ('11111111-1111-4111-8111-111111111111', '{telepatia}') $$,
  '23514', null, 'modalidade fora da lista é recusada');

select lives_ok($$ insert into public.supervision_requests (supervisor_id, message)
  values ('22222222-2222-4222-8222-222222222222', 'Gostaria de supervisão em TCC.') $$, 'psicóloga pede supervisão');
select throws_ok($$ insert into public.supervision_requests (supervisor_id) values ('22222222-2222-4222-8222-222222222222') $$,
  '23505', null, 'não dá para repetir o pedido enquanto o primeiro está pendente');
select throws_ok($$ insert into public.supervision_requests (supervisor_id) values ('55555555-5555-4555-8555-555555555555') $$,
  '42501', null, 'não dá para pedir a quem não está aceitando novos supervisionandos');
select throws_ok($$ insert into public.supervision_requests (supervisor_id) values ('33333333-3333-4333-8333-333333333333') $$,
  '42501', null, 'não dá para pedir a quem não tem CRP');
select throws_ok($$ select public.responder_solicitacao((select id from public.supervision_requests limit 1), true) $$,
  'P0002', null, 'quem pediu não aceita o próprio pedido');
select throws_ok($$ update public.supervision_requests set status = 'aceita' $$,
  '42501', null, 'o status do pedido só muda pelas funções');

select lives_ok($$ insert into public.supervision_invites (inviter_role) values ('supervisionando') $$,
  'psicóloga cria convite por link para o seu supervisor');

reset role;

-- ---------------------------------------------------------------------------
-- Supervisor
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select is((select count(*)::int from public.supervision_requests where status = 'pendente'), 1, 'supervisor vê o pedido recebido');
select is((select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Psicóloga Teste', 'supervisor vê nome e CRP de quem pediu');
select lives_ok($$ select public.responder_solicitacao((select id from public.supervision_requests limit 1), true) $$,
  'supervisor aceita o pedido');
select results_eq($$ select supervisor_id, supervisee_id, origin from public.supervision_links $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'solicitacao'::text) $$,
  'aceitar cria o vínculo de supervisão');
select is_empty($$ select 1 from public.patients $$, 'o vínculo não dá ao supervisor acesso aos pacientes (regra 1)');
select is_empty($$ select 1 from public.clinical_records $$, 'o vínculo não dá ao supervisor acesso ao prontuário (regra 1)');
select is_empty($$ select 1 from public.supervision_invites $$, 'supervisor não vê os convites da psicóloga');

reset role;

-- ---------------------------------------------------------------------------
-- Estagiária (sem CRP)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select is_empty($$ select 1 from public.supervision_requests $$, 'estagiária não vê pedidos alheios');
select is_empty($$ select 1 from public.supervision_links $$, 'estagiária não vê vínculos alheios');
select throws_ok($$ select public.aceitar_convite((select token from public.supervision_invites limit 1)) $$,
  'P0002', null, 'estagiária não acha o token sem recebê-lo');
select throws_ok($$ insert into public.supervision_invites (inviter_role) values ('supervisor') $$,
  '42501', null, 'sem CRP não dá para convidar como supervisor');

reset role;

-- Token do convite da psicóloga, como se tivesse sido enviado pelo WhatsApp.
create temporary table convite_teste as select token from public.supervision_invites limit 1;
grant select on convite_teste to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.aceitar_convite((select token from convite_teste)) $$,
  '42501', null, 'estagiária sem CRP não vira supervisora pelo convite');
reset role;

-- ---------------------------------------------------------------------------
-- Usuário sem vínculo, que recebe o convite
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select results_eq($$ select inviter_name, inviter_role, valido from public.ver_convite((select token from convite_teste)) $$,
  $$ values ('Psicóloga Teste'::text, 'supervisionando'::text, true) $$, 'quem recebe o link vê quem convidou antes de aceitar');
select lives_ok($$ select public.aceitar_convite((select token from convite_teste)) $$, 'aceitar o convite cria o vínculo');
select throws_ok($$ select public.aceitar_convite((select token from convite_teste)) $$,
  'P0002', null, 'o mesmo convite não vale duas vezes');
select throws_ok($$ select public.encerrar_vinculo((select id from public.supervision_links
  where supervisor_id = '22222222-2222-4222-8222-222222222222' limit 1)) $$,
  'P0002', null, 'ninguém encerra vínculo dos outros');

reset role;

-- ---------------------------------------------------------------------------
-- Psicóloga de novo: vínculos, cancelar e encerrar
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.supervision_links where status = 'ativo'), 2, 'psicóloga vê seus dois supervisores');
select lives_ok($$ select public.encerrar_vinculo((select id from public.supervision_links
  where supervisor_id = '22222222-2222-4222-8222-222222222222')) $$, 'psicóloga encerra um vínculo');

reset role;

select is((select bio from public.supervisor_profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Bio fictícia do supervisor.', 'o perfil do supervisor continua intacto');

select * from finish();
rollback;
