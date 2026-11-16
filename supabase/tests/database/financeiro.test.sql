-- Testes do financeiro mínimo (Fase 5a, início): só o dono acessa valores,
-- despesas e dados fiscais.
--
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com',
    '{"full_name": "Psicóloga Teste", "crp_region": "08", "crp_number": "12345"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com',
    '{"full_name": "Supervisor Teste", "crp_region": "06", "crp_number": "54321"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com',
    '{"full_name": "Estagiária Teste"}');

insert into public.patients (id, owner_id, full_name, default_fee) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Paciente Fictício', 200);
insert into public.expenses (owner_id, spent_on, category, amount) values
  ('11111111-1111-4111-8111-111111111111', current_date, 'aluguel', 800);
insert into public.fiscal_profiles (owner_id, regime, monthly_payroll) values
  ('11111111-1111-4111-8111-111111111111', 'simples_nacional', 3000);

select ok((select relrowsecurity from pg_class where oid = 'public.expenses'::regclass), 'RLS está ativada em expenses');
select ok((select relrowsecurity from pg_class where oid = 'public.fiscal_profiles'::regclass), 'RLS está ativada em fiscal_profiles');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from public.expenses $$, '42501', null, 'anônimo não lê despesas');
reset role;

-- Psicóloga (dona)
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.expenses), 1, 'a dona vê as próprias despesas');
select lives_ok($$ insert into public.expenses (spent_on, category, description, amount) values (current_date, 'material', 'Testes', 120) $$,
  'a dona lança uma despesa');
select throws_ok($$ insert into public.expenses (owner_id, spent_on, category, amount)
  values ('22222222-2222-4222-8222-222222222222', current_date, 'outros', 10) $$, '42501', null, 'ninguém lança despesa em nome de outro');
select lives_ok($$ insert into public.appointments (patient_id, starts_at, ends_at, fee, payment_status, paid_on, payment_method)
  values ('aaaaaaaa-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days' + interval '50 minutes',
    200, 'pago', current_date - 2, 'pix') $$, 'a dona registra sessão com valor e pagamento');
select throws_ok($$ insert into public.appointments (patient_id, starts_at, ends_at, fee, payment_status)
  values ('aaaaaaaa-0000-4000-8000-000000000001', now(), now() + interval '50 minutes', 200, 'pago') $$,
  '23514', null, 'pagamento sem data é recusado');
select lives_ok($$ update public.patients set cpf = '12345678909', payer_name = 'Responsável Fictício', payer_cpf = '98765432100'
  where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'a dona registra CPF e responsável financeiro');
select throws_ok($$ update public.patients set cpf = '123' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23514', null, 'CPF fora do formato é recusado');
select is((select regime from public.fiscal_profiles), 'simples_nacional', 'a dona vê o próprio regime');
select lives_ok($$ delete from public.expenses where category = 'material' $$, 'a dona remove uma despesa');
reset role;

-- Supervisor e estagiária: não veem nada do financeiro da psicóloga
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.expenses $$, 'supervisor não vê despesas de outra pessoa');
select is_empty($$ select 1 from public.fiscal_profiles $$, 'supervisor não vê dados fiscais de outra pessoa');
select is_empty($$ select 1 from public.appointments where fee is not null $$, 'supervisor não vê valores de sessões de outra pessoa');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is_empty($$ select 1 from public.expenses $$, 'estagiária não vê despesas de outra pessoa');
select is_empty($$ update public.fiscal_profiles set monthly_payroll = 0 where owner_id = '11111111-1111-4111-8111-111111111111'
  returning 1 $$, 'estagiária não mexe nos dados fiscais de outra pessoa');
reset role;

select * from finish();
rollback;
