-- Dados de exemplo para desenvolvimento local. TODOS FICTÍCIOS (CLAUDE.md, regra 5).
-- Rodado por `supabase db reset`. Senha de todos: senha-teste-123
--
--   marina.costa@example.com   Psicóloga, CRP 08/12345
--   paulo.andrade@example.com  Psicólogo e supervisor, CRP 08/04567
--   bianca.lima@example.com    Estagiária (sem CRP)
--   carla.souza@example.com    Contadora, CRC-PR 12345 (área do contador; exige verificação em duas etapas)

do $$
declare
  u record;
begin
  for u in
    select *
    from (values
      ('a1b2c3d4-0000-4000-8000-000000000001'::uuid, 'marina.costa@example.com',
        '{"full_name": "Marina Costa", "crp_region": "08", "crp_number": "12345"}'::jsonb),
      ('a1b2c3d4-0000-4000-8000-000000000002'::uuid, 'paulo.andrade@example.com',
        '{"full_name": "Paulo Andrade", "crp_region": "08", "crp_number": "4567"}'::jsonb),
      ('a1b2c3d4-0000-4000-8000-000000000003'::uuid, 'bianca.lima@example.com',
        '{"full_name": "Bianca Lima"}'::jsonb),
      ('a1b2c3d4-0000-4000-8000-000000000004'::uuid, 'carla.souza@example.com',
        '{"full_name": "Carla Souza", "account_type": "contador", "crc_state": "PR", "crc_number": "12345", "crc_category": "contador"}'::jsonb)
    ) as t (id, email, meta)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('senha-teste-123', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', u.meta, now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      u.id::text, u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fase 1: pacientes, agenda e prontuário fictícios da Marina.
-- Datas relativas a hoje, no fuso de São Paulo, para a agenda sempre ter algo.
-- ---------------------------------------------------------------------------
do $$
declare
  v_marina constant uuid := 'a1b2c3d4-0000-4000-8000-000000000001';
  v_ana constant uuid := 'b2c3d4e5-0000-4000-8000-000000000001';
  v_joao constant uuid := 'b2c3d4e5-0000-4000-8000-000000000002';
  v_lucia constant uuid := 'b2c3d4e5-0000-4000-8000-000000000003';
  v_serie constant uuid := 'c3d4e5f6-0000-4000-8000-000000000001';
  v_semana int;
  v_inicio timestamptz;
  v_sessao uuid;
begin
  insert into public.patients (id, owner_id, full_name, nicknames, birth_date, phone, email) values
    (v_ana, v_marina, 'Ana Beatriz Fictícia', '{Bia}', date '1991-03-14', '(41) 90000-0001', 'ana.ficticia@example.com'),
    (v_joao, v_marina, 'João Pedro Exemplo', '{}', date '1985-07-02', '(41) 90000-0002', null),
    (v_lucia, v_marina, 'Lúcia Modelo', '{Lu}', date '1978-11-25', null, null);

  insert into public.patient_contacts (owner_id, patient_id, name, relation, phone) values
    (v_marina, v_ana, 'Carlos Fictício', 'Pai', '(41) 90000-0011'),
    (v_marina, v_lucia, 'Rita Modelo', 'Irmã', null);

  -- Ana: toda semana no mesmo horário, 3 semanas passadas e 4 futuras.
  for v_semana in -3..4 loop
    v_inicio := ((current_date + v_semana * 7) + time '09:00') at time zone 'America/Sao_Paulo';
    insert into public.appointments (owner_id, patient_id, series_id, starts_at, ends_at, modality, location, status)
    values (v_marina, v_ana, v_serie, v_inicio, v_inicio + interval '50 minutes', 'presencial', 'Sala 2',
            case when v_semana < 0 then 'realizada' else 'agendada' end)
    returning id into v_sessao;

    -- Registro nas sessões passadas, menos a da semana anterior (vira pendência no Início).
    if v_semana < -1 then
      insert into public.clinical_records (owner_id, patient_id, appointment_id, author_id, updated_by, session_date, body)
      values (v_marina, v_ana, v_sessao, v_marina, v_marina, current_date + v_semana * 7,
              'Registro fictício de exemplo. Paciente relatou semana mais tranquila no trabalho; seguimos com o foco combinado.');
    end if;
  end loop;

  v_inicio := (current_date + time '14:00') at time zone 'America/Sao_Paulo';
  insert into public.appointments (owner_id, patient_id, starts_at, ends_at, modality, location)
  values (v_marina, v_joao, v_inicio, v_inicio + interval '50 minutes', 'online', 'https://meet.example.com/sala-ficticia');

  v_inicio := ((current_date + 1) + time '16:30') at time zone 'America/Sao_Paulo';
  insert into public.appointments (owner_id, patient_id, starts_at, ends_at, modality, location)
  values (v_marina, v_lucia, v_inicio, v_inicio + interval '50 minutes', 'presencial', 'Sala 1');
end;
$$;

-- ---------------------------------------------------------------------------
-- Fase 2a: o Paulo (fictício) aparece na rede de supervisores.
-- ---------------------------------------------------------------------------
insert into public.supervisor_profiles (id, offers_supervision, accepting_new, bio, approaches, areas, years_experience, modalities, city, state)
values ('a1b2c3d4-0000-4000-8000-000000000002', true, true,
  'Supervisor fictício para testes. Supervisiono casos de ansiedade em TCC.',
  '{TCC,ACT}', '{Ansiedade}', 12, '{online,presencial}', 'Curitiba', 'PR');

-- ---------------------------------------------------------------------------
-- Financeiro (fictício): valor das sessões da Marina e algumas despesas.
-- ---------------------------------------------------------------------------
update public.patients set default_fee = 180 where owner_id = 'a1b2c3d4-0000-4000-8000-000000000001';
update public.appointments set fee = 180 where owner_id = 'a1b2c3d4-0000-4000-8000-000000000001';
update public.appointments
   set payment_status = 'pago', payment_method = 'pix',
       paid_on = (starts_at at time zone 'America/Sao_Paulo')::date
 where owner_id = 'a1b2c3d4-0000-4000-8000-000000000001' and status = 'realizada'
   and starts_at < now() - interval '8 days';
insert into public.expenses (owner_id, spent_on, category, description, amount) values
  ('a1b2c3d4-0000-4000-8000-000000000001', date_trunc('month', current_date)::date + 4, 'aluguel', 'Sala (fictício)', 900),
  ('a1b2c3d4-0000-4000-8000-000000000001', date_trunc('month', current_date)::date + 9, 'supervisao', 'Supervisão com Paulo (fictício)', 250);

-- Fase 6: a Carla (fictícia) aparece na rede de contadores.
update public.accountant_profiles
   set listed = true, firm_name = 'Souza Contabilidade (fictícia)',
       bio = 'Contadora fictícia para testes. Atendo psicólogos no carnê-leão e no Simples Nacional.',
       specialties = '{carne_leao,simples_nacional,abertura_empresa}', state = 'PR', city = 'Curitiba',
       serves_nationwide = true, price_info = 'A partir de R$ 150 por mês (fictício)'
 where id = 'a1b2c3d4-0000-4000-8000-000000000004';
