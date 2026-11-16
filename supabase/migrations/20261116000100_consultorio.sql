-- Fase 1 — Consultório mínimo: pacientes, contatos, agenda e prontuário.
--
-- Regras (CLAUDE.md):
--   * RLS ativada nesta mesma migration, em toda tabela.
--   * Cada psicólogo só acessa o que é dele (owner_id = auth.uid()). Nenhuma policy
--     dá acesso a supervisor, estagiário ou qualquer outra pessoa (regra 1).
--   * Paciente não é apagado: é arquivado (archived_at).
--   * Registro clínico não é apagado de verdade: a exclusão marca deleted_at, pela
--     função excluir_registro_clinico. Toda alteração de texto gera uma versão em
--     clinical_record_versions, gravada pelo banco (regra 3).
--   * audit_log guarda quem criou, editou, excluiu ou arquivou.

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  full_name text not null
    constraint patients_full_name_len check (char_length(btrim(full_name)) between 1 and 200),
  nicknames text[] not null default '{}'
    constraint patients_nicknames_max check (cardinality(nicknames) <= 10),
  birth_date date
    constraint patients_birth_date_min check (birth_date >= date '1900-01-01'),
  phone text constraint patients_phone_len check (char_length(phone) <= 40),
  email text constraint patients_email_len check (char_length(email) <= 254),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patients is 'Pacientes do psicólogo (owner_id). Nunca apagados: arquivados com archived_at.';
comment on column public.patients.nicknames is 'Apelidos e formas de chamar o paciente; usados na anonimização (Fase 2).';

create index patients_owner_idx on public.patients (owner_id, full_name);

alter table public.patients enable row level security;

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

revoke all on table public.patients from anon, authenticated;
grant select on table public.patients to authenticated;
grant insert (full_name, nicknames, birth_date, phone, email) on table public.patients to authenticated;
grant update (full_name, nicknames, birth_date, phone, email, archived_at) on table public.patients to authenticated;

create policy "patients: o dono lê"
  on public.patients for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "patients: o dono cadastra"
  on public.patients for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "patients: o dono edita"
  on public.patients for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Contatos do paciente (familiares e outros). Também usados na anonimização.
-- ---------------------------------------------------------------------------
create table public.patient_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  name text not null
    constraint patient_contacts_name_len check (char_length(btrim(name)) between 1 and 200),
  relation text constraint patient_contacts_relation_len check (char_length(relation) <= 60),
  phone text constraint patient_contacts_phone_len check (char_length(phone) <= 40),
  created_at timestamptz not null default now()
);

create index patient_contacts_patient_idx on public.patient_contacts (patient_id);

alter table public.patient_contacts enable row level security;

revoke all on table public.patient_contacts from anon, authenticated;
grant select, delete on table public.patient_contacts to authenticated;
grant insert (patient_id, name, relation, phone) on table public.patient_contacts to authenticated;
grant update (name, relation, phone) on table public.patient_contacts to authenticated;

create policy "patient_contacts: o dono lê"
  on public.patient_contacts for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "patient_contacts: o dono cadastra para paciente seu"
  on public.patient_contacts for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );

create policy "patient_contacts: o dono edita"
  on public.patient_contacts for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "patient_contacts: o dono remove"
  on public.patient_contacts for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  -- Sessões criadas juntas pelo "repetir toda semana" compartilham o mesmo series_id.
  series_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  modality text not null default 'presencial'
    constraint appointments_modality check (modality in ('presencial', 'online')),
  location text constraint appointments_location_len check (char_length(location) <= 500),
  status text not null default 'agendada'
    constraint appointments_status check (status in ('agendada', 'realizada', 'faltou', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_duracao check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours')
);

comment on column public.appointments.location is 'Sala (presencial) ou link da chamada (online).';

create index appointments_owner_starts_idx on public.appointments (owner_id, starts_at);
create index appointments_patient_idx on public.appointments (patient_id, starts_at);

alter table public.appointments enable row level security;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Sessão não é apagada: é cancelada (status).
revoke all on table public.appointments from anon, authenticated;
grant select on table public.appointments to authenticated;
grant insert (patient_id, series_id, starts_at, ends_at, modality, location, status) on table public.appointments to authenticated;
grant update (starts_at, ends_at, modality, location, status) on table public.appointments to authenticated;

create policy "appointments: o dono lê"
  on public.appointments for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "appointments: o dono agenda para paciente seu"
  on public.appointments for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
  );

create policy "appointments: o dono edita"
  on public.appointments for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Prontuário
-- ---------------------------------------------------------------------------
create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete restrict,
  author_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  session_date date not null default current_date,
  body text not null
    constraint clinical_records_body_len check (char_length(btrim(body)) between 1 and 100000),
  -- 'final' para o psicólogo; os demais entram com o estágio (Fase 4).
  status text not null default 'final'
    constraint clinical_records_status check (status in ('final', 'pendente', 'ajuste_pedido', 'validado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete restrict,
  deleted_reason text constraint clinical_records_deleted_reason_len check (char_length(deleted_reason) <= 500)
);

comment on table public.clinical_records is
  'Registros do prontuário. Nunca apagados (Res. CFP 01/2009, guarda mínima de 5 anos): exclusão marca deleted_at.';

create index clinical_records_patient_idx on public.clinical_records (patient_id, session_date desc);
create index clinical_records_appointment_idx on public.clinical_records (appointment_id);

alter table public.clinical_records enable row level security;

revoke all on table public.clinical_records from anon, authenticated;
grant select on table public.clinical_records to authenticated;
grant insert (patient_id, appointment_id, session_date, body) on table public.clinical_records to authenticated;
grant update (appointment_id, session_date, body) on table public.clinical_records to authenticated;

-- A sessão vinculada, se houver, precisa ser do mesmo dono e do mesmo paciente.
create or replace function public.sessao_combina_com_paciente(p_appointment uuid, p_patient uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_appointment is null or exists (
    select 1 from public.appointments a
    where a.id = p_appointment and a.patient_id = p_patient and a.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.sessao_combina_com_paciente(uuid, uuid) from public, anon;
grant execute on function public.sessao_combina_com_paciente(uuid, uuid) to authenticated;

create policy "clinical_records: o dono lê os não excluídos"
  on public.clinical_records for select to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null);

create policy "clinical_records: o dono escreve para paciente seu"
  on public.clinical_records for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and author_id = (select auth.uid())
    and exists (select 1 from public.patients p where p.id = patient_id and p.owner_id = (select auth.uid()))
    and public.sessao_combina_com_paciente(appointment_id, patient_id)
  );

create policy "clinical_records: o dono edita os não excluídos"
  on public.clinical_records for update to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null)
  with check (
    owner_id = (select auth.uid())
    and deleted_at is null
    and public.sessao_combina_com_paciente(appointment_id, patient_id)
  );

-- Versões anteriores de cada registro. Só o banco escreve aqui.
create table public.clinical_record_versions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.clinical_records (id) on delete restrict,
  body text not null,
  session_date date not null,
  appointment_id uuid,
  -- Quando e por quem esta versão foi escrita (antes de ser substituída).
  created_at timestamptz not null,
  created_by uuid references auth.users (id) on delete restrict,
  replaced_at timestamptz not null default now()
);

comment on table public.clinical_record_versions is 'Histórico do prontuário: cada edição guarda aqui a versão anterior.';

create index clinical_record_versions_record_idx on public.clinical_record_versions (record_id, created_at);

alter table public.clinical_record_versions enable row level security;

revoke all on table public.clinical_record_versions from anon, authenticated;
grant select on table public.clinical_record_versions to authenticated;

create policy "clinical_record_versions: o dono do registro lê"
  on public.clinical_record_versions for select to authenticated
  using (
    exists (select 1 from public.clinical_records r where r.id = record_id and r.owner_id = (select auth.uid()))
  );

create or replace function public.clinical_records_antes_de_alterar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.body is distinct from old.body
     or new.session_date is distinct from old.session_date
     or new.appointment_id is distinct from old.appointment_id then
    insert into public.clinical_record_versions (record_id, body, session_date, appointment_id, created_at, created_by)
    values (old.id, old.body, old.session_date, old.appointment_id, old.updated_at, old.updated_by);
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

revoke execute on function public.clinical_records_antes_de_alterar() from public, anon, authenticated;

create trigger clinical_records_versionar
  before update on public.clinical_records
  for each row execute function public.clinical_records_antes_de_alterar();

-- Exclusão lógica: o registro some das telas, mas fica guardado.
create or replace function public.excluir_registro_clinico(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_motivo is not null and char_length(p_motivo) > 500 then
    raise exception 'motivo muito longo' using errcode = '22001';
  end if;

  update public.clinical_records
     set deleted_at = now(),
         deleted_by = auth.uid(),
         deleted_reason = nullif(btrim(p_motivo), '')
   where id = p_id
     and owner_id = auth.uid()
     and deleted_at is null;

  if not found then
    raise exception 'registro não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.excluir_registro_clinico(uuid, text) from public, anon;
grant execute on function public.excluir_registro_clinico(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Registro de auditoria
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete restrict,
  actor_id uuid references auth.users (id) on delete restrict,
  action text not null
    constraint audit_log_action check (action in ('criou', 'editou', 'excluiu', 'arquivou', 'reativou')),
  entity text not null,
  entity_id uuid not null,
  at timestamptz not null default now()
);

create index audit_log_owner_idx on public.audit_log (owner_id, at desc);

alter table public.audit_log enable row level security;

revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

create policy "audit_log: o dono lê o que aconteceu nos seus dados"
  on public.audit_log for select to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acao text;
begin
  -- Cada tabela tem colunas diferentes: as conferências ficam em blocos separados.
  v_acao := 'editou';
  if tg_op = 'INSERT' then
    v_acao := 'criou';
  elsif tg_table_name = 'clinical_records' then
    if new.deleted_at is not null and old.deleted_at is null then
      v_acao := 'excluiu';
    end if;
  elsif tg_table_name = 'patients' then
    if new.archived_at is not null and old.archived_at is null then
      v_acao := 'arquivou';
    elsif new.archived_at is null and old.archived_at is not null then
      v_acao := 'reativou';
    end if;
  end if;

  insert into public.audit_log (owner_id, actor_id, action, entity, entity_id)
  values (new.owner_id, auth.uid(), v_acao, tg_table_name, new.id);
  return null;
end;
$$;

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

create trigger clinical_records_auditoria
  after insert or update on public.clinical_records
  for each row execute function public.registrar_auditoria();

create trigger patients_auditoria
  after insert or update on public.patients
  for each row execute function public.registrar_auditoria();
