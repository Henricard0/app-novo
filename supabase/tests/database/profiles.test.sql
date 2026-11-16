-- Testes de acesso a public.profiles por papel.
-- Na Fase 0 ainda não existem vínculos de supervisão nem de estágio, então
-- psicólogo, supervisor, estagiário e usuário sem vínculo têm o mesmo acesso:
-- só ao próprio perfil. Quando os vínculos chegarem (Fases 2 e 4), este
-- arquivo ganha os casos de leitura entre supervisor e supervisionando.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;

-- Os testes montam a própria rede: tira o supervisor de exemplo do seed (desfeito no rollback).
delete from public.supervisor_profiles;

select plan(25);

-- ---------------------------------------------------------------------------
-- Usuários fictícios de teste
-- ---------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com',
    '{"full_name": "   ", "crp_region": "8", "crp_number": "12a"}');

-- ---------------------------------------------------------------------------
-- Estrutura e criação automática do perfil
-- ---------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS está ativada em profiles'
);
select has_trigger('public', 'profiles', 'profiles_set_updated_at', 'profiles mantém updated_at');
select has_trigger('auth', 'users', 'on_auth_user_created', 'cadastro cria o perfil automaticamente');

select results_eq(
  $$ select full_name, crp_region, crp_number from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('Psicóloga Teste'::text, '08'::text, '12345'::text) $$,
  'perfil da psicóloga nasce com nome e CRP do cadastro'
);
select results_eq(
  $$ select crp_region, crp_number from public.profiles where id = '33333333-3333-4333-8333-333333333333' $$,
  $$ values (null::text, null::text) $$,
  'estagiária fica sem CRP'
);
select results_eq(
  $$ select full_name, crp_region, crp_number from public.profiles where id = '44444444-4444-4444-8444-444444444444' $$,
  $$ values ('sem.vinculo'::text, null::text, null::text) $$,
  'nome vazio usa o e-mail e CRP fora do formato é descartado sem impedir o cadastro'
);

-- ---------------------------------------------------------------------------
-- Usuário não logado (anon)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null,
  'anônimo não lê perfis'
);
select throws_ok(
  $$ update public.profiles set full_name = 'Invasor' $$,
  '42501', null,
  'anônimo não edita perfis'
);

reset role;

-- ---------------------------------------------------------------------------
-- Psicóloga
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'psicóloga vê só o próprio perfil'
);
select is_empty(
  $$ select 1 from public.profiles where id = '22222222-2222-4222-8222-222222222222' $$,
  'psicóloga não vê o perfil do supervisor'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Psicóloga Renomeada' where id = '11111111-1111-4111-8111-111111111111' $$,
  'psicóloga edita o próprio nome'
);
select is(
  (select full_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Psicóloga Renomeada',
  'a edição do próprio nome foi gravada'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Alterado por outra pessoa' where id = '22222222-2222-4222-8222-222222222222' $$,
  'tentar editar o perfil de outra pessoa não dá erro, mas não afeta nada (conferido abaixo)'
);
select throws_ok(
  $$ update public.profiles set id = '55555555-5555-4555-8555-555555555555' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'psicóloga não troca o id do perfil'
);
select throws_ok(
  $$ update public.profiles set created_at = now() - interval '1 year' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'psicóloga não altera created_at'
);
select throws_ok(
  $$ insert into public.profiles (id, full_name) values ('55555555-5555-4555-8555-555555555555', 'Perfil Forjado') $$,
  '42501', null,
  'psicóloga não cria perfis direto na tabela'
);
select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null,
  'psicóloga não apaga perfis'
);
select throws_ok(
  $$ update public.profiles set crp_number = null where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null,
  'CRP pela metade é recusado (região sem número)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Supervisor
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid) $$,
  'supervisor vê só o próprio perfil (sem vínculos na Fase 0)'
);
select is_empty(
  $$ select 1 from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  'supervisor não vê o perfil da psicóloga'
);

reset role;

-- ---------------------------------------------------------------------------
-- Estagiária
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('33333333-3333-4333-8333-333333333333'::uuid) $$,
  'estagiária vê só o próprio perfil'
);
select lives_ok(
  $$ update public.profiles set crp_region = '08', crp_number = '99999' where id = '22222222-2222-4222-8222-222222222222' $$,
  'estagiária tentando editar o supervisor não afeta nada (conferido abaixo)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Usuário sem vínculo
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('44444444-4444-4444-8444-444444444444'::uuid) $$,
  'usuário sem vínculo vê só o próprio perfil'
);

reset role;

-- ---------------------------------------------------------------------------
-- Sessão com token de outro usuário inexistente
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-4999-8999-999999999999", "role": "authenticated"}';

select is_empty(
  $$ select 1 from public.profiles $$,
  'token de usuário sem perfil não enxerga nenhum perfil'
);

reset role;

-- ---------------------------------------------------------------------------
-- Conferências finais como administrador
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select full_name, crp_region, crp_number from public.profiles where id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values ('Supervisor Teste'::text, '06'::text, '54321'::text) $$,
  'perfil do supervisor continua intacto depois das tentativas de outros usuários'
);

select * from finish();
rollback;
