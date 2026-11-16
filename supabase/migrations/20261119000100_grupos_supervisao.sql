-- Fase 2b (complemento) — Grupos de supervisão.
--
-- Decisão do Henrique (opção B): em grupo, SÓ o supervisor lê os casos. Os colegas
-- do grupo veem o nome do grupo e os encontros, mas nunca os casos uns dos outros.
-- As policies de supervision_cases e supervision_case_excerpts não mudam.

create table public.supervision_groups (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  name text not null constraint supervision_groups_name_len check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index supervision_groups_supervisor_idx on public.supervision_groups (supervisor_id);

alter table public.supervision_groups enable row level security;

revoke all on table public.supervision_groups from anon, authenticated;
grant select on table public.supervision_groups to authenticated;
grant insert (name) on table public.supervision_groups to authenticated;
grant update (name, archived_at) on table public.supervision_groups to authenticated;

-- Vínculo passa a poder estar num grupo (definido pelo supervisor).
alter table public.supervision_links
  add column group_id uuid references public.supervision_groups (id) on delete set null;

create index supervision_links_group_idx on public.supervision_links (group_id);

create or replace function public.e_supervisor_do_grupo(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.supervision_groups g where g.id = p_group and g.supervisor_id = auth.uid());
$$;

create or replace function public.e_membro_do_grupo(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.supervision_links l
    where l.group_id = p_group and l.supervisee_id = auth.uid() and l.status = 'ativo'
  );
$$;

revoke execute on function public.e_supervisor_do_grupo(uuid) from public, anon;
revoke execute on function public.e_membro_do_grupo(uuid) from public, anon;
grant execute on function public.e_supervisor_do_grupo(uuid) to authenticated;
grant execute on function public.e_membro_do_grupo(uuid) to authenticated;

create policy "supervision_groups: supervisor e membros leem"
  on public.supervision_groups for select to authenticated
  using (supervisor_id = (select auth.uid()) or public.e_membro_do_grupo(id));

create policy "supervision_groups: o supervisor cria"
  on public.supervision_groups for insert to authenticated
  with check (supervisor_id = (select auth.uid()) and public.tem_crp((select auth.uid())));

create policy "supervision_groups: o supervisor edita"
  on public.supervision_groups for update to authenticated
  using (supervisor_id = (select auth.uid()))
  with check (supervisor_id = (select auth.uid()));

-- Coloca (ou tira) um supervisionando de um grupo. Só o supervisor do vínculo,
-- e só em grupo dele.
create or replace function public.definir_grupo(p_link uuid, p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_group is not null and not public.e_supervisor_do_grupo(p_group) then
    raise exception 'grupo não encontrado' using errcode = 'P0002';
  end if;
  update public.supervision_links
     set group_id = p_group,
         format = case when p_group is null then 'individual' else 'grupo' end
   where id = p_link and supervisor_id = auth.uid() and status = 'ativo';
  if not found then
    raise exception 'vínculo não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.definir_grupo(uuid, uuid) from public, anon;
grant execute on function public.definir_grupo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Encontros de grupo: link_id OU group_id.
-- ---------------------------------------------------------------------------
alter table public.supervision_meetings alter column link_id drop not null;
alter table public.supervision_meetings
  add column group_id uuid references public.supervision_groups (id) on delete restrict;
alter table public.supervision_meetings
  add constraint supervision_meetings_vinculo_ou_grupo check ((link_id is null) <> (group_id is null));

grant insert (group_id) on table public.supervision_meetings to authenticated;

drop policy "supervision_meetings: as pontas do vínculo leem" on public.supervision_meetings;
drop policy "supervision_meetings: as pontas de vínculo ativo marcam" on public.supervision_meetings;
drop policy "supervision_meetings: as pontas remarcam ou cancelam" on public.supervision_meetings;

create policy "meetings: vínculo ou grupo leem"
  on public.supervision_meetings for select to authenticated
  using (
    (link_id is not null and public.e_ponta_do_vinculo(link_id))
    or (group_id is not null and (public.e_supervisor_do_grupo(group_id) or public.e_membro_do_grupo(group_id)))
  );

create policy "meetings: vínculo ativo ou supervisor do grupo marcam"
  on public.supervision_meetings for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (link_id is not null and public.e_ponta_do_vinculo(link_id, true))
      or (group_id is not null and public.e_supervisor_do_grupo(group_id))
    )
  );

create policy "meetings: vínculo ou supervisor do grupo remarcam"
  on public.supervision_meetings for update to authenticated
  using (
    (link_id is not null and public.e_ponta_do_vinculo(link_id))
    or (group_id is not null and public.e_supervisor_do_grupo(group_id))
  )
  with check (
    (link_id is not null and public.e_ponta_do_vinculo(link_id))
    or (group_id is not null and public.e_supervisor_do_grupo(group_id))
  );

-- O caso pode ir para um encontro do próprio vínculo ou do grupo em que o vínculo está.
create or replace function public.encontro_do_vinculo(p_meeting uuid, p_link uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_meeting is null or exists (
    select 1 from public.supervision_meetings m
    left join public.supervision_links l on l.id = p_link
    where m.id = p_meeting
      and (m.link_id = p_link or (m.group_id is not null and m.group_id = l.group_id))
  );
$$;

-- Horas de um encontro de grupo: o supervisor registra para cada presente.
-- A policy de insert de supervision_hours já exige que seja o supervisor do vínculo.
