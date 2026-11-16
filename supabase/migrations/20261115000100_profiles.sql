-- Fase 0 — Base: perfil de cada usuário (1 linha por auth.users).
--
-- Regras:
--   * RLS ativada nesta mesma migration (CLAUDE.md, regra 2).
--   * Cada usuário lê e edita só o próprio perfil. Leitura por supervisor e
--     estagiário entra na Fase 2 (vínculos) e na Fase 4 (estágio).
--   * O perfil nasce pelo trigger em auth.users; o front não insere nem apaga.
--   * A coluna `plan` fica para a Fase 3 (planos).

-- Função genérica para manter updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_full_name_len check (char_length(btrim(full_name)) between 1 and 200),
  -- Região do CRP com dois dígitos ("08") e número de inscrição ("12345").
  -- Estagiários ainda não têm CRP: os dois ficam nulos.
  crp_region text
    constraint profiles_crp_region_format check (crp_region ~ '^(0[1-9]|[1-9][0-9])$'),
  crp_number text
    constraint profiles_crp_number_format check (crp_number ~ '^[0-9]{1,6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_crp_complete check ((crp_region is null) = (crp_number is null))
);

comment on table public.profiles is 'Perfil do usuário (psicólogo, supervisor ou estagiário). 1:1 com auth.users.';
comment on column public.profiles.crp_region is 'Região do CRP com dois dígitos, ex.: 08 (Paraná).';
comment on column public.profiles.crp_number is 'Número de inscrição no CRP, só dígitos.';

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Privilégios: ninguém do lado do cliente insere ou apaga; só alguns campos são editáveis.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, crp_region, crp_number) on table public.profiles to authenticated;

create policy "profiles: o dono lê o próprio perfil"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: o dono edita o próprio perfil"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Cria o perfil quando um usuário se cadastra. Os dados vêm de
-- raw_user_meta_data (options.data no signUp). Valores fora do formato
-- são descartados para não impedir o cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_region text := nullif(btrim(new.raw_user_meta_data ->> 'crp_region'), '');
  v_number text := nullif(btrim(new.raw_user_meta_data ->> 'crp_number'), '');
begin
  if v_region is not null and v_region !~ '^(0[1-9]|[1-9][0-9])$' then
    v_region := null;
  end if;
  if v_number is not null and v_number !~ '^[0-9]{1,6}$' then
    v_number := null;
  end if;
  if v_region is null or v_number is null then
    v_region := null;
    v_number := null;
  end if;

  insert into public.profiles (id, full_name, crp_region, crp_number)
  values (
    new.id,
    left(coalesce(v_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Sem nome'), 200),
    v_region,
    v_number
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
