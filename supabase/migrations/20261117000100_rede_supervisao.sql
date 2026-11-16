-- Fase 2a — Rede de supervisores: perfil de supervisor, busca, solicitação,
-- convite por link e vínculo de supervisão.
--
-- Regras:
--   * RLS ativada nesta mesma migration em toda tabela nova.
--   * Perfil de supervisor é opcional e só aparece para usuários logados, e só se
--     a pessoa ligou "Ofereço supervisão" e tem CRP cadastrado.
--   * Solicitações, respostas, convites e vínculos mudam só por funções do banco,
--     que conferem quem pode fazer o quê.
--   * Nada aqui dá acesso a pacientes, prontuários ou agenda (CLAUDE.md, regra 1).

-- ---------------------------------------------------------------------------
-- Perfil de supervisor
-- ---------------------------------------------------------------------------
create table public.supervisor_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  offers_supervision boolean not null default false,
  accepting_new boolean not null default true,
  bio text constraint supervisor_profiles_bio_len check (char_length(bio) <= 1500),
  education text constraint supervisor_profiles_education_len check (char_length(education) <= 1500),
  approaches text[] not null default '{}'
    constraint supervisor_profiles_approaches_max check (cardinality(approaches) <= 10),
  areas text[] not null default '{}'
    constraint supervisor_profiles_areas_max check (cardinality(areas) <= 15),
  years_experience integer
    constraint supervisor_profiles_years check (years_experience between 0 and 70),
  modalities text[] not null default '{online}'
    constraint supervisor_profiles_modalities check (modalities <@ array['presencial', 'online'] and cardinality(modalities) >= 1),
  formats text[] not null default '{individual}'
    constraint supervisor_profiles_formats check (formats <@ array['individual', 'grupo'] and cardinality(formats) >= 1),
  city text constraint supervisor_profiles_city_len check (char_length(city) <= 100),
  state text constraint supervisor_profiles_state check (state in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
    'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  price_info text constraint supervisor_profiles_price_len check (char_length(price_info) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.supervisor_profiles is
  'Perfil público (só para usuários logados) de quem oferece supervisão. price_info é só informativo.';

alter table public.supervisor_profiles enable row level security;

create trigger supervisor_profiles_set_updated_at
  before update on public.supervisor_profiles
  for each row execute function public.set_updated_at();

revoke all on table public.supervisor_profiles from anon, authenticated;
grant select on table public.supervisor_profiles to authenticated;
grant insert (id, offers_supervision, accepting_new, bio, education, approaches, areas, years_experience,
  modalities, formats, city, state, price_info) on table public.supervisor_profiles to authenticated;
grant update (offers_supervision, accepting_new, bio, education, approaches, areas, years_experience,
  modalities, formats, city, state, price_info) on table public.supervisor_profiles to authenticated;

-- Aparece na rede: ligou "Ofereço supervisão" e tem CRP. Security definer para
-- ler o CRP em profiles sem abrir profiles para todo mundo.
create or replace function public.e_supervisor_visivel(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.supervisor_profiles sp
    join public.profiles p on p.id = sp.id
    where sp.id = p_id and sp.offers_supervision and p.crp_number is not null
  );
$$;

revoke execute on function public.e_supervisor_visivel(uuid) from public, anon;
grant execute on function public.e_supervisor_visivel(uuid) to authenticated;

create policy "supervisor_profiles: o dono lê o próprio"
  on public.supervisor_profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "supervisor_profiles: logados veem quem oferece supervisão"
  on public.supervisor_profiles for select to authenticated
  using (public.e_supervisor_visivel(id));

create policy "supervisor_profiles: o dono cria o próprio"
  on public.supervisor_profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "supervisor_profiles: o dono edita o próprio"
  on public.supervisor_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Vínculo de supervisão
-- ---------------------------------------------------------------------------
create table public.supervision_links (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references public.profiles (id) on delete restrict,
  supervisee_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'ativo' constraint supervision_links_status check (status in ('ativo', 'encerrado')),
  format text not null default 'individual' constraint supervision_links_format check (format in ('individual', 'grupo')),
  origin text not null constraint supervision_links_origin check (origin in ('solicitacao', 'convite')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete restrict,
  constraint supervision_links_pessoas_diferentes check (supervisor_id <> supervisee_id)
);

create unique index supervision_links_um_ativo_por_par
  on public.supervision_links (supervisor_id, supervisee_id) where status = 'ativo';
create index supervision_links_supervisee_idx on public.supervision_links (supervisee_id);

alter table public.supervision_links enable row level security;

revoke all on table public.supervision_links from anon, authenticated;
grant select on table public.supervision_links to authenticated;

create policy "supervision_links: as duas pontas leem"
  on public.supervision_links for select to authenticated
  using ((select auth.uid()) in (supervisor_id, supervisee_id));

-- ---------------------------------------------------------------------------
-- Solicitações de supervisão (pela rede)
-- ---------------------------------------------------------------------------
create table public.supervision_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  supervisor_id uuid not null references public.profiles (id) on delete cascade,
  message text constraint supervision_requests_message_len check (char_length(message) <= 1000),
  status text not null default 'pendente'
    constraint supervision_requests_status check (status in ('pendente', 'aceita', 'recusada', 'cancelada')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  link_id uuid references public.supervision_links (id) on delete set null,
  constraint supervision_requests_pessoas_diferentes check (requester_id <> supervisor_id)
);

create unique index supervision_requests_uma_pendente_por_par
  on public.supervision_requests (requester_id, supervisor_id) where status = 'pendente';
create index supervision_requests_supervisor_idx on public.supervision_requests (supervisor_id, status);

alter table public.supervision_requests enable row level security;

revoke all on table public.supervision_requests from anon, authenticated;
grant select on table public.supervision_requests to authenticated;
grant insert (supervisor_id, message) on table public.supervision_requests to authenticated;

create policy "supervision_requests: quem pediu e quem recebeu leem"
  on public.supervision_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, supervisor_id));

create policy "supervision_requests: pedir a quem oferece e aceita novos"
  on public.supervision_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and public.e_supervisor_visivel(supervisor_id)
    and exists (select 1 from public.supervisor_profiles sp where sp.id = supervisor_id and sp.accepting_new)
  );

-- Aceitar ou recusar (só quem recebeu o pedido, só se pendente).
create or replace function public.responder_solicitacao(p_id uuid, p_aceitar boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.supervision_requests%rowtype;
  v_vinculo uuid;
begin
  select * into v_pedido from public.supervision_requests
   where id = p_id and supervisor_id = auth.uid() and status = 'pendente'
   for update;
  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;

  if p_aceitar then
    select id into v_vinculo from public.supervision_links
     where supervisor_id = v_pedido.supervisor_id and supervisee_id = v_pedido.requester_id and status = 'ativo';
    if v_vinculo is null then
      insert into public.supervision_links (supervisor_id, supervisee_id, origin)
      values (v_pedido.supervisor_id, v_pedido.requester_id, 'solicitacao')
      returning id into v_vinculo;
    end if;
  end if;

  update public.supervision_requests
     set status = case when p_aceitar then 'aceita' else 'recusada' end,
         responded_at = now(),
         link_id = v_vinculo
   where id = p_id;
  return v_vinculo;
end;
$$;

-- Desistir de um pedido ainda não respondido (só quem pediu).
create or replace function public.cancelar_solicitacao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.supervision_requests
     set status = 'cancelada', responded_at = now()
   where id = p_id and requester_id = auth.uid() and status = 'pendente';
  if not found then
    raise exception 'solicitação não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Encerrar um vínculo ativo (qualquer uma das pontas).
create or replace function public.encerrar_vinculo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.supervision_links
     set status = 'encerrado', ended_at = now(), ended_by = auth.uid()
   where id = p_id and status = 'ativo' and auth.uid() in (supervisor_id, supervisee_id);
  if not found then
    raise exception 'vínculo não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convite por link (para quem já tem supervisor fora da plataforma)
-- ---------------------------------------------------------------------------
create table public.supervision_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  inviter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Papel de quem convida: 'supervisor' convida um supervisionando; 'supervisionando' convida o supervisor.
  inviter_role text not null constraint supervision_invites_role check (inviter_role in ('supervisor', 'supervisionando')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  link_id uuid references public.supervision_links (id) on delete set null
);

alter table public.supervision_invites enable row level security;

revoke all on table public.supervision_invites from anon, authenticated;
grant select on table public.supervision_invites to authenticated;
grant insert (inviter_role) on table public.supervision_invites to authenticated;
grant delete on table public.supervision_invites to authenticated;

create policy "supervision_invites: quem convidou lê"
  on public.supervision_invites for select to authenticated
  using (inviter_id = (select auth.uid()));

create or replace function public.tem_crp(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = p_id and crp_number is not null);
$$;

revoke execute on function public.tem_crp(uuid) from public, anon;
grant execute on function public.tem_crp(uuid) to authenticated;

-- Quem convida como supervisor precisa ter CRP.
create policy "supervision_invites: cria em nome próprio"
  on public.supervision_invites for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and (inviter_role = 'supervisionando' or public.tem_crp((select auth.uid())))
  );

create policy "supervision_invites: quem convidou apaga o não usado"
  on public.supervision_invites for delete to authenticated
  using (inviter_id = (select auth.uid()) and used_at is null);

-- Mostra quem convidou, antes de aceitar. Não revela nada se o convite não vale.
create or replace function public.ver_convite(p_token text)
returns table (inviter_name text, inviter_crp_region text, inviter_crp_number text, inviter_role text, valido boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.crp_region, p.crp_number, i.inviter_role,
         (i.used_at is null and i.expires_at > now() and i.inviter_id <> auth.uid())
  from public.supervision_invites i
  join public.profiles p on p.id = i.inviter_id
  where i.token = p_token and auth.uid() is not null;
$$;

create or replace function public.aceitar_convite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.supervision_invites%rowtype;
  v_supervisor uuid;
  v_supervisionando uuid;
  v_vinculo uuid;
begin
  if auth.uid() is null then
    raise exception 'entre na sua conta' using errcode = '42501';
  end if;

  select * into v_convite from public.supervision_invites
   where token = p_token and used_at is null and expires_at > now() and inviter_id <> auth.uid()
   for update;
  if not found then
    raise exception 'convite inválido ou expirado' using errcode = 'P0002';
  end if;

  if v_convite.inviter_role = 'supervisor' then
    v_supervisor := v_convite.inviter_id;
    v_supervisionando := auth.uid();
  else
    v_supervisor := auth.uid();
    v_supervisionando := v_convite.inviter_id;
  end if;

  if not public.tem_crp(v_supervisor) then
    raise exception 'para ser supervisor é preciso ter CRP cadastrado' using errcode = '42501';
  end if;

  select id into v_vinculo from public.supervision_links
   where supervisor_id = v_supervisor and supervisee_id = v_supervisionando and status = 'ativo';
  if v_vinculo is null then
    insert into public.supervision_links (supervisor_id, supervisee_id, origin)
    values (v_supervisor, v_supervisionando, 'convite')
    returning id into v_vinculo;
  end if;

  update public.supervision_invites
     set used_at = now(), used_by = auth.uid(), link_id = v_vinculo
   where id = v_convite.id;
  return v_vinculo;
end;
$$;

revoke execute on function public.responder_solicitacao(uuid, boolean) from public, anon;
revoke execute on function public.cancelar_solicitacao(uuid) from public, anon;
revoke execute on function public.encerrar_vinculo(uuid) from public, anon;
revoke execute on function public.ver_convite(text) from public, anon;
revoke execute on function public.aceitar_convite(text) from public, anon;
grant execute on function public.responder_solicitacao(uuid, boolean) to authenticated;
grant execute on function public.cancelar_solicitacao(uuid) to authenticated;
grant execute on function public.encerrar_vinculo(uuid) to authenticated;
grant execute on function public.ver_convite(text) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- profiles: quem pode ver nome e CRP de quem
-- ---------------------------------------------------------------------------
-- Até aqui cada um via só o próprio perfil. Agora também:
--   * qualquer logado vê o nome e o CRP de quem aparece na rede de supervisores;
--   * quem recebeu uma solicitação vê quem pediu (e vice-versa);
--   * as duas pontas de um vínculo veem uma à outra.
create or replace function public.pode_ver_perfil(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_supervisor_visivel(p_id)
    or exists (
      select 1 from public.supervision_requests r
      where (r.requester_id = p_id and r.supervisor_id = auth.uid())
         or (r.supervisor_id = p_id and r.requester_id = auth.uid())
    )
    or exists (
      select 1 from public.supervision_links l
      where (l.supervisor_id = p_id and l.supervisee_id = auth.uid())
         or (l.supervisee_id = p_id and l.supervisor_id = auth.uid())
    );
$$;

revoke execute on function public.pode_ver_perfil(uuid) from public, anon;
grant execute on function public.pode_ver_perfil(uuid) to authenticated;

create policy "profiles: rede e vínculos de supervisão"
  on public.profiles for select to authenticated
  using (public.pode_ver_perfil(id));
