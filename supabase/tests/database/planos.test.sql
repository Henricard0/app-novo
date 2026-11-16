-- Testes de planos e assinaturas por papel. Garante que ninguém se dá o plano
-- pago pelo navegador e que o limite do gratuito vale no banco.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;
delete from public.supervisor_profiles;

select plan(17);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com',
    '{"full_name": "Sem Vínculo"}');

-- Psicóloga com teste vencido (gratuito) e 10 pacientes ativos; supervisor no Essencial.
update public.profiles set trial_ends_at = now() - interval '1 day' where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set plan = 'essencial', trial_ends_at = null where id = '22222222-2222-4222-8222-222222222222';
insert into public.patients (owner_id, full_name)
  select '11111111-1111-4111-8111-111111111111', 'Paciente Fictício ' || n from generate_series(1, 10) n;
insert into public.patients (id, owner_id, full_name, archived_at) values
  ('aaaaaaaa-0000-4000-8000-000000000099', '11111111-1111-4111-8111-111111111111', 'Paciente Arquivado', now());
insert into public.subscriptions (user_id, provider_id, cycle, amount, status) values
  ('22222222-2222-4222-8222-222222222222', 'mp-fake-1', 'mensal', 38.30, 'ativa');

select ok((select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass), 'RLS está ativada em subscriptions');
select is((select trial_ends_at > now() + interval '29 days' from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  true, 'quem se cadastra ganha 30 dias de teste');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.subscriptions $$, '42501', null, 'anônimo não lê assinaturas');
select throws_ok($$ select public.meu_plano() $$, '42501', null, 'anônimo não consulta plano');
reset role;

-- Psicóloga no gratuito
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select results_eq($$ select plano, pacientes_ativos, limite_pacientes from public.meu_plano() $$,
  $$ values ('gratuito'::text, 10, 10) $$, 'psicóloga vê que está no gratuito com 10 de 10 pacientes');
select throws_ok($$ insert into public.patients (full_name) values ('Paciente 11') $$,
  'P0001', 'limite de pacientes do plano gratuito', 'no gratuito, o 11º paciente ativo é recusado');
select throws_ok($$ update public.patients set archived_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000099' $$,
  'P0001', 'limite de pacientes do plano gratuito', 'no gratuito, reativar além de 10 também é recusado');
select lives_ok($$ update public.patients set archived_at = now() where full_name = 'Paciente Fictício 1' $$,
  'arquivar continua permitido');
select lives_ok($$ insert into public.patients (full_name) values ('Paciente na vaga liberada') $$,
  'depois de arquivar, cabe outro paciente');
select throws_ok($$ update public.profiles set plan = 'essencial' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'ninguém se dá o plano pago pelo navegador');
select throws_ok($$ update public.profiles set trial_ends_at = now() + interval '10 years' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'ninguém estica o próprio teste grátis');
select throws_ok($$ insert into public.subscriptions (user_id, cycle, amount, status)
  values ('11111111-1111-4111-8111-111111111111', 'anual', 1, 'ativa') $$, '42501', null, 'ninguém cria assinatura pelo navegador');
select is_empty($$ select 1 from public.subscriptions $$, 'psicóloga não vê a assinatura do supervisor');
select throws_ok($$ select public.plano_efetivo('22222222-2222-4222-8222-222222222222') $$,
  '42501', null, 'ninguém consulta o plano de outra pessoa');
reset role;

-- Supervisor no Essencial
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is((select plano from public.meu_plano()), 'essencial', 'supervisor vê o Essencial');
select is((select count(*)::int from public.subscriptions), 1, 'supervisor vê a própria assinatura');
reset role;

-- Estagiária em teste: sem limite
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select lives_ok($$ insert into public.patients (full_name) select 'Paciente ' || n from generate_series(1, 11) n $$,
  'durante o teste grátis não há limite de pacientes');
reset role;

select * from finish();
rollback;
