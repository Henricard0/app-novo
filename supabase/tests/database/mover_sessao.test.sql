-- Testes de mover_sessao (calendário) por papel.
-- Rodar: npm run db:test (Supabase CLI) ou npm run db:test:sem-docker.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'psicologa.teste@example.com', '{"full_name": "Psicóloga Teste"}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'supervisor.teste@example.com', '{"full_name": "Supervisor Teste"}'),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'estagiaria.teste@example.com', '{"full_name": "Estagiária Teste"}'),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'sem.vinculo@example.com', '{"full_name": "Sem Vínculo"}');

insert into public.patients (id, owner_id, full_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Paciente Fictício');

-- Série semanal: 3 sessões às 09:00 (a 1ª já realizada) e uma avulsa.
insert into public.appointments (id, owner_id, patient_id, series_id, starts_at, ends_at, status) values
  ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
    'eeeeeeee-0000-4000-8000-000000000001', '2030-01-07 12:00+00', '2030-01-07 12:50+00', 'realizada'),
  ('cccccccc-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
    'eeeeeeee-0000-4000-8000-000000000001', '2030-01-14 12:00+00', '2030-01-14 12:50+00', 'agendada'),
  ('cccccccc-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
    'eeeeeeee-0000-4000-8000-000000000001', '2030-01-21 12:00+00', '2030-01-21 12:50+00', 'agendada'),
  ('cccccccc-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001',
    'eeeeeeee-0000-4000-8000-000000000001', '2030-01-28 12:00+00', '2030-01-28 12:50+00', 'cancelada');

-- Anônimo
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select public.mover_sessao('cccccccc-0000-4000-8000-000000000002', now(), now() + interval '1 hour') $$,
  '42501', null, 'anônimo não move sessões');
reset role;

-- Supervisor, estagiária e sem vínculo não enxergam a sessão: nada é movido
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}';
select throws_ok($$ select public.mover_sessao('cccccccc-0000-4000-8000-000000000002', '2030-01-15 12:00+00', '2030-01-15 12:50+00') $$,
  'P0002', null, 'supervisor não move sessão da psicóloga');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select throws_ok($$ select public.mover_sessao('cccccccc-0000-4000-8000-000000000002', '2030-01-15 12:00+00', '2030-01-15 12:50+00') $$,
  'P0002', null, 'estagiária não move sessão da psicóloga');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
select throws_ok($$ select public.mover_sessao('cccccccc-0000-4000-8000-000000000002', '2030-01-15 12:00+00', '2030-01-15 12:50+00') $$,
  'P0002', null, 'usuário sem vínculo não move sessão da psicóloga');
reset role;

select is((select starts_at from public.appointments where id = 'cccccccc-0000-4000-8000-000000000002'),
  '2030-01-14 12:00+00'::timestamptz, 'a sessão continua no horário original depois das tentativas alheias');

-- Psicóloga
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is(public.mover_sessao('cccccccc-0000-4000-8000-000000000002', '2030-01-14 13:00+00', '2030-01-14 13:50+00'),
  1, 'mover só esta sessão afeta uma sessão');
select is((select starts_at from public.appointments where id = 'cccccccc-0000-4000-8000-000000000003'),
  '2030-01-21 12:00+00'::timestamptz, 'a seguinte da série fica onde estava');

select is(public.mover_sessao('cccccccc-0000-4000-8000-000000000002', '2030-01-15 14:00+00', '2030-01-15 15:00+00', true),
  2, 'mover esta e as seguintes afeta só as agendadas seguintes');
select results_eq(
  $$ select starts_at, ends_at from public.appointments where id = 'cccccccc-0000-4000-8000-000000000003' $$,
  $$ values ('2030-01-22 13:00+00'::timestamptz, '2030-01-22 14:00+00'::timestamptz) $$,
  'a seguinte recebe o mesmo deslocamento e a nova duração');
select is((select starts_at from public.appointments where id = 'cccccccc-0000-4000-8000-000000000001'),
  '2030-01-07 12:00+00'::timestamptz, 'sessão anterior (realizada) não muda');
select is((select starts_at from public.appointments where id = 'cccccccc-0000-4000-8000-000000000004'),
  '2030-01-28 12:00+00'::timestamptz, 'sessão cancelada da série não muda');
select throws_ok($$ select public.mover_sessao('cccccccc-0000-4000-8000-000000000002', '2030-01-15 14:00+00', '2030-01-15 13:00+00') $$,
  '23514', null, 'fim antes do início é recusado');

reset role;

select * from finish();
rollback;
