-- Dados de exemplo para desenvolvimento local. TODOS FICTÍCIOS (CLAUDE.md, regra 5).
-- Rodado por `supabase db reset`. Senha de todos: senha-teste-123
--
--   marina.costa@example.com   Psicóloga, CRP 08/12345
--   paulo.andrade@example.com  Psicólogo e supervisor, CRP 08/04567
--   bianca.lima@example.com    Estagiária (sem CRP)

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
        '{"full_name": "Bianca Lima"}'::jsonb)
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
