-- Fase 2b — Supervisão: encontros, casos anonimizados, devolutivas e horas.
--
-- Sigilo (CLAUDE.md, regra 1):
--   * A anonimização acontece no navegador do psicólogo; o banco só recebe a cópia
--     revisada (supervision_case_excerpts), nunca uma referência que o supervisor
--     consiga seguir até o prontuário.
--   * supervision_case_sources (qual paciente e quais registros deram origem ao
--     caso) só o supervisionando lê. Nenhuma policy dá acesso ao supervisor.
--   * O supervisor vê o caso só depois de enviado para a pauta, e só se for o
--     supervisor do vínculo. Depois de enviado, o texto não muda mais.
--   * A devolutiva não entra no prontuário.

-- ---------------------------------------------------------------------------
-- Encontros de supervisão
-- ---------------------------------------------------------------------------
create table public.supervision_meetings (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.supervision_links (id) on delete restrict,
  starts_at timestamptz not null,
  duration_min integer not null default 60 constraint supervision_meetings_duracao check (duration_min between 15 and 480),
  status text not null default 'agendado' constraint supervision_meetings_status check (status in ('agendado', 'concluido', 'cancelado')),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index supervision_meetings_link_idx on public.supervision_meetings (link_id, starts_at);

alter table public.supervision_meetings enable row level security;

revoke all on table public.supervision_meetings from anon, authenticated;
grant select on table public.supervision_meetings to authenticated;
grant insert (link_id, starts_at, duration_min) on table public.supervision_meetings to authenticated;
grant update (starts_at, duration_min, status) on table public.supervision_meetings to authenticated;

-- Ponta de um vínculo (qualquer status) ou de um vínculo ativo.
create or replace function public.e_ponta_do_vinculo(p_link uuid, p_so_ativo boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.supervision_links l
    where l.id = p_link
      and auth.uid() in (l.supervisor_id, l.supervisee_id)
      and (not p_so_ativo or l.status = 'ativo')
  );
$$;

revoke execute on function public.e_ponta_do_vinculo(uuid, boolean) from public, anon;
grant execute on function public.e_ponta_do_vinculo(uuid, boolean) to authenticated;

create policy "supervision_meetings: as pontas do vínculo leem"
  on public.supervision_meetings for select to authenticated
  using (public.e_ponta_do_vinculo(link_id));

create policy "supervision_meetings: as pontas de vínculo ativo marcam"
  on public.supervision_meetings for insert to authenticated
  with check (created_by = (select auth.uid()) and public.e_ponta_do_vinculo(link_id, true));

create policy "supervision_meetings: as pontas remarcam ou cancelam"
  on public.supervision_meetings for update to authenticated
  using (public.e_ponta_do_vinculo(link_id))
  with check (public.e_ponta_do_vinculo(link_id));

-- ---------------------------------------------------------------------------
-- Casos levados à supervisão
-- ---------------------------------------------------------------------------
create table public.supervision_cases (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.supervision_links (id) on delete restrict,
  supervisee_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  meeting_id uuid references public.supervision_meetings (id) on delete set null,
  -- Rótulo anonimizado, ex.: "Paciente A., 34 anos".
  case_label text not null constraint supervision_cases_label_len check (char_length(btrim(case_label)) between 1 and 80),
  question text constraint supervision_cases_question_len check (char_length(question) <= 2000),
  status text not null default 'rascunho'
    constraint supervision_cases_status check (status in ('rascunho', 'na_pauta', 'discutido', 'devolutiva_recebida')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index supervision_cases_link_idx on public.supervision_cases (link_id, status);
create index supervision_cases_supervisee_idx on public.supervision_cases (supervisee_id, created_at desc);

alter table public.supervision_cases enable row level security;

revoke all on table public.supervision_cases from anon, authenticated;
grant select, delete on table public.supervision_cases to authenticated;
grant insert (link_id, meeting_id, case_label, question) on table public.supervision_cases to authenticated;
grant update (meeting_id, case_label, question) on table public.supervision_cases to authenticated;

create or replace function public.e_supervisor_do_vinculo(p_link uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.supervision_links l where l.id = p_link and l.supervisor_id = auth.uid());
$$;

revoke execute on function public.e_supervisor_do_vinculo(uuid) from public, anon;
grant execute on function public.e_supervisor_do_vinculo(uuid) to authenticated;

-- O encontro escolhido precisa ser do mesmo vínculo.
create or replace function public.encontro_do_vinculo(p_meeting uuid, p_link uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_meeting is null or exists (select 1 from public.supervision_meetings m where m.id = p_meeting and m.link_id = p_link);
$$;

revoke execute on function public.encontro_do_vinculo(uuid, uuid) from public, anon;
grant execute on function public.encontro_do_vinculo(uuid, uuid) to authenticated;

create policy "supervision_cases: o supervisionando lê os seus"
  on public.supervision_cases for select to authenticated
  using (supervisee_id = (select auth.uid()));

create policy "supervision_cases: o supervisor do vínculo lê os enviados"
  on public.supervision_cases for select to authenticated
  using (status <> 'rascunho' and public.e_supervisor_do_vinculo(link_id));

create policy "supervision_cases: o supervisionando cria em vínculo ativo seu"
  on public.supervision_cases for insert to authenticated
  with check (
    supervisee_id = (select auth.uid())
    and exists (
      select 1 from public.supervision_links l
      where l.id = link_id and l.supervisee_id = (select auth.uid()) and l.status = 'ativo'
    )
    and public.encontro_do_vinculo(meeting_id, link_id)
  );

create policy "supervision_cases: o supervisionando edita o rascunho"
  on public.supervision_cases for update to authenticated
  using (supervisee_id = (select auth.uid()) and status = 'rascunho')
  with check (supervisee_id = (select auth.uid()) and status = 'rascunho' and public.encontro_do_vinculo(meeting_id, link_id));

create policy "supervision_cases: o supervisionando apaga o rascunho"
  on public.supervision_cases for delete to authenticated
  using (supervisee_id = (select auth.uid()) and status = 'rascunho');

-- ---------------------------------------------------------------------------
-- Origem do caso: SÓ o supervisionando. Nenhuma policy para o supervisor.
-- ---------------------------------------------------------------------------
create table public.supervision_case_sources (
  case_id uuid primary key references public.supervision_cases (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  record_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.supervision_case_sources is
  'De qual paciente e de quais registros saiu o caso. Só o supervisionando lê (CLAUDE.md, regra 1).';

alter table public.supervision_case_sources enable row level security;

revoke all on table public.supervision_case_sources from anon, authenticated;
grant select, delete on table public.supervision_case_sources to authenticated;
grant insert (case_id, patient_id, record_ids) on table public.supervision_case_sources to authenticated;

create policy "case_sources: só o supervisionando lê"
  on public.supervision_case_sources for select to authenticated
  using (exists (select 1 from public.supervision_cases c where c.id = case_id and c.supervisee_id = (select auth.uid())));

create policy "case_sources: só o supervisionando grava, paciente seu"
  on public.supervision_case_sources for insert to authenticated
  with check (
    exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.supervisee_id = (select auth.uid()) and c.status = 'rascunho'
    )
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );

create policy "case_sources: só o supervisionando apaga no rascunho"
  on public.supervision_case_sources for delete to authenticated
  using (
    exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.supervisee_id = (select auth.uid()) and c.status = 'rascunho'
    )
  );

-- ---------------------------------------------------------------------------
-- Trechos anonimizados: o que o supervisor lê. Cópia, não referência.
-- ---------------------------------------------------------------------------
create table public.supervision_case_excerpts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.supervision_cases (id) on delete cascade,
  position integer not null default 0,
  -- Ex.: "Sessão · nov/2026"
  period_label text constraint supervision_case_excerpts_period_len check (char_length(period_label) <= 60),
  anonymized_body text not null
    constraint supervision_case_excerpts_body_len check (char_length(btrim(anonymized_body)) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index supervision_case_excerpts_case_idx on public.supervision_case_excerpts (case_id, position);

alter table public.supervision_case_excerpts enable row level security;

revoke all on table public.supervision_case_excerpts from anon, authenticated;
grant select, delete on table public.supervision_case_excerpts to authenticated;
grant insert (case_id, position, period_label, anonymized_body) on table public.supervision_case_excerpts to authenticated;
grant update (position, period_label, anonymized_body) on table public.supervision_case_excerpts to authenticated;

-- Quem vê o caso (pelas policies de supervision_cases) vê os trechos.
create policy "case_excerpts: quem vê o caso lê"
  on public.supervision_case_excerpts for select to authenticated
  using (exists (select 1 from public.supervision_cases c where c.id = case_id));

create policy "case_excerpts: o supervisionando escreve no rascunho"
  on public.supervision_case_excerpts for insert to authenticated
  with check (
    exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.supervisee_id = (select auth.uid()) and c.status = 'rascunho'
    )
  );

create policy "case_excerpts: o supervisionando edita no rascunho"
  on public.supervision_case_excerpts for update to authenticated
  using (
    exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.supervisee_id = (select auth.uid()) and c.status = 'rascunho'
    )
  )
  with check (
    exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.supervisee_id = (select auth.uid()) and c.status = 'rascunho'
    )
  );

create policy "case_excerpts: o supervisionando apaga no rascunho"
  on public.supervision_case_excerpts for delete to authenticated
  using (
    exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.supervisee_id = (select auth.uid()) and c.status = 'rascunho'
    )
  );

-- ---------------------------------------------------------------------------
-- Devolutiva do supervisor e encaminhamentos
-- ---------------------------------------------------------------------------
create table public.supervision_feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.supervision_cases (id) on delete restrict,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  observed text constraint supervision_feedback_observed_len check (char_length(observed) <= 10000),
  paths text constraint supervision_feedback_paths_len check (char_length(paths) <= 10000),
  status text not null default 'rascunho' constraint supervision_feedback_status check (status in ('rascunho', 'enviada')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.supervision_feedback is 'Devolutiva do supervisor. Não entra no prontuário do paciente.';

alter table public.supervision_feedback enable row level security;

revoke all on table public.supervision_feedback from anon, authenticated;
grant select on table public.supervision_feedback to authenticated;
grant insert (case_id, observed, paths) on table public.supervision_feedback to authenticated;
grant update (observed, paths) on table public.supervision_feedback to authenticated;

create policy "supervision_feedback: o supervisor lê as suas"
  on public.supervision_feedback for select to authenticated
  using (author_id = (select auth.uid()));

create policy "supervision_feedback: o supervisionando lê as enviadas"
  on public.supervision_feedback for select to authenticated
  using (
    status = 'enviada'
    and exists (select 1 from public.supervision_cases c where c.id = case_id and c.supervisee_id = (select auth.uid()))
  );

create policy "supervision_feedback: o supervisor do vínculo escreve"
  on public.supervision_feedback for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.supervision_cases c
      where c.id = case_id and c.status <> 'rascunho' and public.e_supervisor_do_vinculo(c.link_id)
    )
  );

create policy "supervision_feedback: o supervisor edita o rascunho"
  on public.supervision_feedback for update to authenticated
  using (author_id = (select auth.uid()) and status = 'rascunho')
  with check (author_id = (select auth.uid()) and status = 'rascunho');

create table public.supervision_feedback_tasks (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.supervision_feedback (id) on delete cascade,
  text text not null constraint supervision_feedback_tasks_text_len check (char_length(btrim(text)) between 1 and 500),
  position integer not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index supervision_feedback_tasks_feedback_idx on public.supervision_feedback_tasks (feedback_id, position);

alter table public.supervision_feedback_tasks enable row level security;

revoke all on table public.supervision_feedback_tasks from anon, authenticated;
grant select, delete on table public.supervision_feedback_tasks to authenticated;
grant insert (feedback_id, text, position) on table public.supervision_feedback_tasks to authenticated;
grant update (text, position) on table public.supervision_feedback_tasks to authenticated;

create policy "supervision_feedback_tasks: quem vê a devolutiva lê"
  on public.supervision_feedback_tasks for select to authenticated
  using (exists (select 1 from public.supervision_feedback f where f.id = feedback_id));

create policy "supervision_feedback_tasks: o supervisor escreve no rascunho"
  on public.supervision_feedback_tasks for insert to authenticated
  with check (
    exists (
      select 1 from public.supervision_feedback f
      where f.id = feedback_id and f.author_id = (select auth.uid()) and f.status = 'rascunho'
    )
  );

create policy "supervision_feedback_tasks: o supervisor edita no rascunho"
  on public.supervision_feedback_tasks for update to authenticated
  using (
    exists (
      select 1 from public.supervision_feedback f
      where f.id = feedback_id and f.author_id = (select auth.uid()) and f.status = 'rascunho'
    )
  )
  with check (
    exists (
      select 1 from public.supervision_feedback f
      where f.id = feedback_id and f.author_id = (select auth.uid()) and f.status = 'rascunho'
    )
  );

create policy "supervision_feedback_tasks: o supervisor apaga no rascunho"
  on public.supervision_feedback_tasks for delete to authenticated
  using (
    exists (
      select 1 from public.supervision_feedback f
      where f.id = feedback_id and f.author_id = (select auth.uid()) and f.status = 'rascunho'
    )
  );

-- ---------------------------------------------------------------------------
-- Horas de supervisão
-- ---------------------------------------------------------------------------
create table public.supervision_hours (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.supervision_links (id) on delete restrict,
  meeting_id uuid references public.supervision_meetings (id) on delete set null,
  supervisee_id uuid not null references public.profiles (id) on delete restrict,
  minutes integer not null constraint supervision_hours_minutes check (minutes between 1 and 600),
  occurred_on date not null default current_date,
  registered_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index supervision_hours_supervisee_idx on public.supervision_hours (supervisee_id, occurred_on);

alter table public.supervision_hours enable row level security;

revoke all on table public.supervision_hours from anon, authenticated;
grant select, delete on table public.supervision_hours to authenticated;
grant insert (link_id, meeting_id, supervisee_id, minutes, occurred_on) on table public.supervision_hours to authenticated;

create policy "supervision_hours: supervisionando e quem registrou leem"
  on public.supervision_hours for select to authenticated
  using ((select auth.uid()) in (supervisee_id, registered_by));

create policy "supervision_hours: só o supervisor do vínculo registra"
  on public.supervision_hours for insert to authenticated
  with check (
    registered_by = (select auth.uid())
    and exists (
      select 1 from public.supervision_links l
      where l.id = link_id and l.supervisor_id = (select auth.uid()) and l.supervisee_id = supervisee_id
    )
  );

create policy "supervision_hours: quem registrou apaga"
  on public.supervision_hours for delete to authenticated
  using (registered_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Mudanças de situação (só pelas funções)
-- ---------------------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_action;
alter table public.audit_log add constraint audit_log_action
  check (action in ('criou', 'editou', 'excluiu', 'arquivou', 'reativou', 'compartilhou'));

-- O supervisionando envia o caso para a pauta. Depois disso o texto não muda.
create or replace function public.enviar_caso(p_case uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caso public.supervision_cases%rowtype;
begin
  select c.* into v_caso from public.supervision_cases c
   join public.supervision_links l on l.id = c.link_id
   where c.id = p_case and c.supervisee_id = auth.uid() and c.status = 'rascunho' and l.status = 'ativo'
   for update of c;
  if not found then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if coalesce(btrim(v_caso.question), '') = '' then
    raise exception 'escreva o que quer discutir' using errcode = '23514';
  end if;
  if not exists (select 1 from public.supervision_case_excerpts e where e.case_id = p_case) then
    raise exception 'inclua pelo menos um trecho' using errcode = '23514';
  end if;

  update public.supervision_cases set status = 'na_pauta', sent_at = now() where id = p_case;

  insert into public.audit_log (owner_id, actor_id, action, entity, entity_id)
  values (auth.uid(), auth.uid(), 'compartilhou', 'supervision_cases', p_case);
end;
$$;

-- O supervisor marca o caso como discutido (sem devolutiva escrita).
create or replace function public.marcar_caso_discutido(p_case uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.supervision_cases c
     set status = 'discutido'
   where c.id = p_case and c.status = 'na_pauta' and public.e_supervisor_do_vinculo(c.link_id);
  if not found then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- O supervisor envia a devolutiva e, se quiser, registra as horas.
create or replace function public.enviar_devolutiva(p_feedback uuid, p_minutos integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_devolutiva public.supervision_feedback%rowtype;
  v_caso public.supervision_cases%rowtype;
  v_data date;
begin
  select * into v_devolutiva from public.supervision_feedback
   where id = p_feedback and author_id = auth.uid() and status = 'rascunho'
   for update;
  if not found then
    raise exception 'devolutiva não encontrada' using errcode = 'P0002';
  end if;
  if coalesce(btrim(v_devolutiva.observed), '') = '' and coalesce(btrim(v_devolutiva.paths), '') = '' then
    raise exception 'escreva a devolutiva antes de enviar' using errcode = '23514';
  end if;
  if p_minutos < 0 or p_minutos > 600 then
    raise exception 'minutos fora do intervalo' using errcode = '23514';
  end if;

  select * into v_caso from public.supervision_cases where id = v_devolutiva.case_id;

  update public.supervision_feedback set status = 'enviada', sent_at = now() where id = p_feedback;
  update public.supervision_cases set status = 'devolutiva_recebida' where id = v_caso.id;

  if p_minutos > 0 then
    select (m.starts_at at time zone 'America/Sao_Paulo')::date into v_data
      from public.supervision_meetings m where m.id = v_caso.meeting_id;
    insert into public.supervision_hours (link_id, meeting_id, supervisee_id, minutes, occurred_on, registered_by)
    values (v_caso.link_id, v_caso.meeting_id, v_caso.supervisee_id, p_minutos,
            least(coalesce(v_data, current_date), current_date), auth.uid());
  end if;

  if v_caso.meeting_id is not null then
    update public.supervision_meetings set status = 'concluido'
     where id = v_caso.meeting_id
       and not exists (
         select 1 from public.supervision_cases c2
         where c2.meeting_id = v_caso.meeting_id and c2.status = 'na_pauta'
       );
  end if;
end;
$$;

-- O supervisionando marca um encaminhamento como feito (ou desfaz).
create or replace function public.marcar_encaminhamento(p_task uuid, p_feito boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.supervision_feedback_tasks t
     set done_at = case when p_feito then now() else null end
    from public.supervision_feedback f
    join public.supervision_cases c on c.id = f.case_id
   where t.id = p_task and f.id = t.feedback_id and f.status = 'enviada' and c.supervisee_id = auth.uid();
  if not found then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.enviar_caso(uuid) from public, anon;
revoke execute on function public.marcar_caso_discutido(uuid) from public, anon;
revoke execute on function public.enviar_devolutiva(uuid, integer) from public, anon;
revoke execute on function public.marcar_encaminhamento(uuid, boolean) from public, anon;
grant execute on function public.enviar_caso(uuid) to authenticated;
grant execute on function public.marcar_caso_discutido(uuid) to authenticated;
grant execute on function public.enviar_devolutiva(uuid, integer) to authenticated;
grant execute on function public.marcar_encaminhamento(uuid, boolean) to authenticated;
