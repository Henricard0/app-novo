-- Fase 6 (início) — Rede de contadores com login separado (decisão do Henrique, 16/11/2026).
--
-- Regras:
--   * Tipo de conta ('psicologo' ou 'contador') gravado no cadastro; o navegador não muda.
--   * Mesmo banco, separação pela RLS: toda tabela do consultório e da supervisão ganha
--     uma policy RESTRITIVA que só deixa passar contas de psicólogo. Funções que criam
--     vínculos de supervisão também recusam contas de contador (gatilho).
--   * O contador nunca acessa pacientes, agenda, prontuário nem supervisão (CLAUDE.md, regra 1).
--     Ele lê dados financeiros só por funções que conferem: vínculo ativo, plano do
--     psicólogo, a autorização daquele tipo de dado e a verificação em duas etapas (aal2).
--     Cada leitura fica registrada em accountant_access_log, que o psicólogo vê.
--   * O psicólogo vê só o perfil do contador e o que ele enviou (guias e pendências).
--   * O valor do serviço é combinado entre os dois, fora da plataforma.

-- ---------------------------------------------------------------------------
-- Tipo de conta
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column account_type text not null default 'psicologo'
    constraint profiles_account_type check (account_type in ('psicologo', 'contador'));

alter table public.profiles
  add constraint profiles_crp_so_psicologo check (account_type = 'psicologo' or crp_number is null);

comment on column public.profiles.account_type is 'psicologo ou contador. Definido no cadastro; ninguém muda pelo app.';

create or replace function public.tipo_de_conta()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select account_type from public.profiles where id = auth.uid();
$$;

create or replace function public.e_psicologo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select account_type = 'psicologo' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.e_contador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select account_type = 'contador' from public.profiles where id = auth.uid()), false);
$$;

-- Sessão confirmada com a verificação em duas etapas (TOTP).
create or replace function public.duas_etapas_ok()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

revoke execute on function public.tipo_de_conta(), public.e_psicologo(), public.e_contador(), public.duas_etapas_ok()
  from public, anon;
grant execute on function public.tipo_de_conta(), public.e_psicologo(), public.e_contador(), public.duas_etapas_ok()
  to authenticated;

-- Policy restritiva em todas as tabelas do consultório e da supervisão.
do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'patient_contacts', 'appointments', 'clinical_records', 'clinical_record_versions', 'audit_log',
    'supervisor_profiles', 'supervision_links', 'supervision_requests', 'supervision_invites',
    'supervision_meetings', 'supervision_cases', 'supervision_case_sources', 'supervision_case_excerpts',
    'supervision_feedback', 'supervision_feedback_tasks', 'supervision_hours', 'supervision_groups',
    'subscriptions', 'expenses', 'fiscal_profiles'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.e_psicologo())) with check ((select public.e_psicologo()))',
      t || ': só contas de psicólogo', t);
  end loop;
end;
$$;

-- Funções security definer da supervisão ignoram a RLS: o gatilho garante que
-- vínculos, pedidos, convites e grupos só envolvem contas de psicólogo.
create or replace function public.exigir_contas_de_psicologo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna text;
  v_id uuid;
begin
  foreach v_coluna in array tg_argv loop
    v_id := (to_jsonb(new) ->> v_coluna)::uuid;
    if v_id is not null and not exists (
      select 1 from public.profiles where id = v_id and account_type = 'psicologo'
    ) then
      raise exception 'só contas de psicólogo participam da supervisão' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.exigir_contas_de_psicologo() from public, anon, authenticated;

create trigger supervision_links_so_psicologos
  before insert or update on public.supervision_links
  for each row execute function public.exigir_contas_de_psicologo('supervisor_id', 'supervisee_id');
create trigger supervision_requests_so_psicologos
  before insert on public.supervision_requests
  for each row execute function public.exigir_contas_de_psicologo('requester_id', 'supervisor_id');
create trigger supervision_invites_so_psicologos
  before insert or update on public.supervision_invites
  for each row execute function public.exigir_contas_de_psicologo('inviter_id', 'used_by');
create trigger supervision_groups_so_psicologos
  before insert on public.supervision_groups
  for each row execute function public.exigir_contas_de_psicologo('supervisor_id');
create trigger patients_so_psicologos
  before insert on public.patients
  for each row execute function public.exigir_contas_de_psicologo('owner_id');

-- ---------------------------------------------------------------------------
-- Perfil do contador
-- ---------------------------------------------------------------------------
create table public.accountant_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  crc_state text constraint accountant_profiles_crc_state check (crc_state in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
    'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  crc_number text constraint accountant_profiles_crc_number check (crc_number ~ '^[0-9]{1,6}$'),
  crc_category text constraint accountant_profiles_crc_category check (crc_category in ('contador', 'tecnico')),
  firm_name text constraint accountant_profiles_firm_len check (char_length(firm_name) <= 150),
  bio text constraint accountant_profiles_bio_len check (char_length(bio) <= 1500),
  specialties text[] not null default '{}'
    constraint accountant_profiles_specialties check (specialties <@ array[
      'carne_leao', 'simples_nacional', 'abertura_empresa', 'imposto_de_renda', 'folha_pro_labore', 'planejamento_tributario']),
  state text constraint accountant_profiles_state check (state in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
    'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  city text constraint accountant_profiles_city_len check (char_length(city) <= 100),
  serves_nationwide boolean not null default true,
  price_info text constraint accountant_profiles_price_len check (char_length(price_info) <= 200),
  listed boolean not null default false,
  accepting_new boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accountant_profiles_crc_completo check (
    (crc_state is null) = (crc_number is null) and (crc_number is null) = (crc_category is null))
);

comment on table public.accountant_profiles is
  'Perfil do contador. Aparece na rede (para psicólogos) se listed e com CRC. price_info é só informativo.';

alter table public.accountant_profiles enable row level security;

create trigger accountant_profiles_set_updated_at
  before update on public.accountant_profiles
  for each row execute function public.set_updated_at();

revoke all on table public.accountant_profiles from anon, authenticated;
grant select on table public.accountant_profiles to authenticated;
grant update (crc_state, crc_number, crc_category, firm_name, bio, specialties, state, city,
  serves_nationwide, price_info, listed, accepting_new) on table public.accountant_profiles to authenticated;

create or replace function public.e_contador_visivel(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.accountant_profiles a
    join public.profiles p on p.id = a.id
    where a.id = p_id and a.listed and a.crc_number is not null and p.account_type = 'contador'
  );
$$;

revoke execute on function public.e_contador_visivel(uuid) from public, anon;
grant execute on function public.e_contador_visivel(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pedidos e vínculos
-- ---------------------------------------------------------------------------
create table public.accountant_requests (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete cascade,
  accountant_id uuid not null references public.profiles (id) on delete cascade,
  message text constraint accountant_requests_message_len check (char_length(message) <= 1000),
  status text not null default 'pendente'
    constraint accountant_requests_status check (status in ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint accountant_requests_pessoas_diferentes check (psychologist_id <> accountant_id)
);

create unique index accountant_requests_um_pendente_por_par
  on public.accountant_requests (psychologist_id, accountant_id) where status = 'pendente';
create index accountant_requests_accountant_idx on public.accountant_requests (accountant_id, status);

alter table public.accountant_requests enable row level security;
revoke all on table public.accountant_requests from anon, authenticated;
grant select on table public.accountant_requests to authenticated;

create policy "accountant_requests: as duas pontas leem"
  on public.accountant_requests for select to authenticated
  using (
    psychologist_id = (select auth.uid())
    or (accountant_id = (select auth.uid()) and (select public.duas_etapas_ok()))
  );

create table public.accountant_links (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles (id) on delete restrict,
  accountant_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'ativo' constraint accountant_links_status check (status in ('ativo', 'encerrado')),
  -- Autorizações do psicólogo (pode mudar quando quiser).
  share_totals boolean not null default true,
  share_entries boolean not null default false,
  share_expenses boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete restrict,
  constraint accountant_links_pessoas_diferentes check (psychologist_id <> accountant_id)
);

comment on column public.accountant_links.share_entries is
  'Lançamentos detalhados: data, valor, forma e nome/CPF de quem pagou. Revela quem é paciente: só com autorização.';

-- Um contador por vez para cada psicólogo.
create unique index accountant_links_um_ativo_por_psicologo
  on public.accountant_links (psychologist_id) where status = 'ativo';
create index accountant_links_accountant_idx on public.accountant_links (accountant_id, status);

alter table public.accountant_links enable row level security;

create trigger accountant_links_set_updated_at
  before update on public.accountant_links
  for each row execute function public.set_updated_at();

revoke all on table public.accountant_links from anon, authenticated;
grant select on table public.accountant_links to authenticated;
grant update (share_totals, share_entries, share_expenses) on table public.accountant_links to authenticated;

create policy "accountant_links: as duas pontas leem"
  on public.accountant_links for select to authenticated
  using (
    psychologist_id = (select auth.uid())
    or (accountant_id = (select auth.uid()) and (select public.duas_etapas_ok()))
  );

create policy "accountant_links: o psicólogo muda as autorizações"
  on public.accountant_links for update to authenticated
  using (psychologist_id = (select auth.uid()) and status = 'ativo')
  with check (psychologist_id = (select auth.uid()) and status = 'ativo');

-- Planos com contador: Essencial, Profissional e o teste grátis.
create or replace function public.plano_permite_contador(p_psicologo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.plano_efetivo(p_psicologo) in ('essencial', 'profissional', 'teste'), false);
$$;

revoke execute on function public.plano_permite_contador(uuid) from public, anon, authenticated;

-- Vínculo ativo entre o contador logado e o psicólogo, com o plano em dia e 2 etapas.
create or replace function public.contador_atende(p_psicologo uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.accountant_links l
  where l.psychologist_id = p_psicologo
    and l.accountant_id = auth.uid()
    and l.status = 'ativo'
    and public.duas_etapas_ok()
    and public.plano_permite_contador(p_psicologo);
$$;

revoke execute on function public.contador_atende(uuid) from public, anon;
grant execute on function public.contador_atende(uuid) to authenticated;

create policy "accountant_profiles: o dono lê o próprio"
  on public.accountant_profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "accountant_profiles: psicólogos veem a rede"
  on public.accountant_profiles for select to authenticated
  using ((select public.e_psicologo()) and public.e_contador_visivel(id));

create policy "accountant_profiles: psicólogo vê quem já contatou"
  on public.accountant_profiles for select to authenticated
  using (
    exists (select 1 from public.accountant_requests r
             where r.accountant_id = accountant_profiles.id and r.psychologist_id = (select auth.uid()))
    or exists (select 1 from public.accountant_links l
                where l.accountant_id = accountant_profiles.id and l.psychologist_id = (select auth.uid()))
  );

create policy "accountant_profiles: o dono edita o próprio"
  on public.accountant_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- profiles: quem vê quem
-- ---------------------------------------------------------------------------
-- Contas de contador só veem o próprio perfil e o dos psicólogos que trocaram
-- pedido ou vínculo com elas (restritiva). Psicólogos veem também os contadores
-- da rede e os seus.
create or replace function public.contador_pode_ver_perfil(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.duas_etapas_ok() and (
    exists (select 1 from public.accountant_requests r where r.accountant_id = auth.uid() and r.psychologist_id = p_id)
    or exists (select 1 from public.accountant_links l where l.accountant_id = auth.uid() and l.psychologist_id = p_id));
$$;

create or replace function public.psicologo_pode_ver_contador(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_psicologo() and (
    public.e_contador_visivel(p_id)
    or exists (select 1 from public.accountant_requests r where r.psychologist_id = auth.uid() and r.accountant_id = p_id)
    or exists (select 1 from public.accountant_links l where l.psychologist_id = auth.uid() and l.accountant_id = p_id)
  );
$$;

revoke execute on function public.contador_pode_ver_perfil(uuid), public.psicologo_pode_ver_contador(uuid) from public, anon;
grant execute on function public.contador_pode_ver_perfil(uuid), public.psicologo_pode_ver_contador(uuid) to authenticated;

create policy "profiles: contas de contador só veem os seus"
  on public.profiles as restrictive for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.e_psicologo())
    or public.contador_pode_ver_perfil(id)
  );

create policy "profiles: contador vê seus clientes e pedidos"
  on public.profiles for select to authenticated
  using (public.contador_pode_ver_perfil(id));

create policy "profiles: psicólogo vê contadores da rede e os seus"
  on public.profiles for select to authenticated
  using (public.psicologo_pode_ver_contador(id));

-- ---------------------------------------------------------------------------
-- Pedir, responder, cancelar, encerrar
-- ---------------------------------------------------------------------------
create or replace function public.pedir_contador(p_contador uuid, p_mensagem text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := auth.uid();
  v_id uuid;
begin
  if not public.e_psicologo() then
    raise exception 'só contas de psicólogo pedem contador' using errcode = '42501';
  end if;
  if not public.plano_permite_contador(v_eu) then
    raise exception 'contador disponível nos planos Essencial e Profissional' using errcode = 'P0001', hint = 'plano_sem_contador';
  end if;
  if not public.e_contador_visivel(p_contador)
     or not exists (select 1 from public.accountant_profiles where id = p_contador and accepting_new) then
    raise exception 'contador indisponível' using errcode = 'P0001', hint = 'contador_indisponivel';
  end if;
  if exists (select 1 from public.accountant_links where psychologist_id = v_eu and status = 'ativo') then
    raise exception 'você já tem um contador' using errcode = 'P0001', hint = 'ja_tem_contador';
  end if;
  insert into public.accountant_requests (psychologist_id, accountant_id, message)
  values (v_eu, p_contador, nullif(btrim(p_mensagem), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'já existe um pedido pendente para este contador' using errcode = 'P0001', hint = 'pedido_repetido';
end;
$$;

create or replace function public.responder_pedido_contador(p_id uuid, p_aceitar boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.accountant_requests;
  v_link uuid;
begin
  select * into v_pedido from public.accountant_requests
   where id = p_id and accountant_id = auth.uid() and status = 'pendente'
   for update;
  if not found or not public.e_contador() then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if not p_aceitar then
    update public.accountant_requests set status = 'recusado', responded_at = now() where id = p_id;
    return null;
  end if;
  if not public.duas_etapas_ok() then
    raise exception 'confirme a verificação em duas etapas' using errcode = '42501', hint = 'exige_duas_etapas';
  end if;
  if exists (select 1 from public.accountant_links where psychologist_id = v_pedido.psychologist_id and status = 'ativo') then
    raise exception 'esse psicólogo já tem um contador' using errcode = 'P0001', hint = 'ja_tem_contador';
  end if;
  insert into public.accountant_links (psychologist_id, accountant_id)
  values (v_pedido.psychologist_id, v_pedido.accountant_id)
  returning id into v_link;
  update public.accountant_requests set status = 'aceito', responded_at = now() where id = p_id;
  -- Outros pedidos pendentes do mesmo psicólogo deixam de valer.
  update public.accountant_requests set status = 'cancelado', responded_at = now()
   where psychologist_id = v_pedido.psychologist_id and status = 'pendente';
  return v_link;
end;
$$;

create or replace function public.cancelar_pedido_contador(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accountant_requests set status = 'cancelado', responded_at = now()
   where id = p_id and psychologist_id = auth.uid() and status = 'pendente';
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.encerrar_vinculo_contador(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accountant_links set status = 'encerrado', ended_at = now(), ended_by = auth.uid()
   where id = p_id and status = 'ativo' and auth.uid() in (psychologist_id, accountant_id);
  if not found then
    raise exception 'vínculo não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.pedir_contador(uuid, text), public.responder_pedido_contador(uuid, boolean),
  public.cancelar_pedido_contador(uuid), public.encerrar_vinculo_contador(uuid) from public, anon;
grant execute on function public.pedir_contador(uuid, text), public.responder_pedido_contador(uuid, boolean),
  public.cancelar_pedido_contador(uuid), public.encerrar_vinculo_contador(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guias (DAS, DARF) e pendências enviadas pelo contador
-- ---------------------------------------------------------------------------
create table public.accountant_documents (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.accountant_links (id) on delete restrict,
  psychologist_id uuid not null references public.profiles (id) on delete restrict,
  accountant_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null constraint accountant_documents_kind check (kind in ('das', 'darf', 'outro')),
  title text not null constraint accountant_documents_title_len check (char_length(btrim(title)) between 1 and 150),
  competence date not null constraint accountant_documents_competence check (extract(day from competence) = 1),
  due_on date,
  amount numeric(12, 2) constraint accountant_documents_amount check (amount >= 0),
  file_path text not null unique constraint accountant_documents_file_path check (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  paid_on date,
  created_at timestamptz not null default now()
);

create index accountant_documents_psychologist_idx on public.accountant_documents (psychologist_id, due_on);

alter table public.accountant_documents enable row level security;
revoke all on table public.accountant_documents from anon, authenticated;
grant select on table public.accountant_documents to authenticated;

create policy "accountant_documents: o psicólogo lê as suas"
  on public.accountant_documents for select to authenticated
  using (psychologist_id = (select auth.uid()));

create policy "accountant_documents: o contador lê enquanto atende"
  on public.accountant_documents for select to authenticated
  using (accountant_id = (select auth.uid()) and public.contador_atende(psychologist_id) = link_id);

create table public.accountant_tasks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.accountant_links (id) on delete restrict,
  psychologist_id uuid not null references public.profiles (id) on delete restrict,
  accountant_id uuid not null references public.profiles (id) on delete restrict,
  body text not null constraint accountant_tasks_body_len check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index accountant_tasks_psychologist_idx on public.accountant_tasks (psychologist_id, created_at desc);

alter table public.accountant_tasks enable row level security;
revoke all on table public.accountant_tasks from anon, authenticated;
grant select on table public.accountant_tasks to authenticated;

create policy "accountant_tasks: o psicólogo lê as suas"
  on public.accountant_tasks for select to authenticated
  using (psychologist_id = (select auth.uid()));

create policy "accountant_tasks: o contador lê enquanto atende"
  on public.accountant_tasks for select to authenticated
  using (accountant_id = (select auth.uid()) and public.contador_atende(psychologist_id) = link_id);

create or replace function public.enviar_guia(
  p_psicologo uuid, p_tipo text, p_titulo text, p_competencia date, p_vencimento date, p_valor numeric, p_arquivo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link uuid := public.contador_atende(p_psicologo);
  v_id uuid;
begin
  if v_link is null then
    raise exception 'sem vínculo ativo com este psicólogo' using errcode = '42501';
  end if;
  if split_part(p_arquivo, '/', 1) <> p_psicologo::text then
    raise exception 'arquivo fora da pasta do psicólogo' using errcode = '42501';
  end if;
  insert into public.accountant_documents
    (link_id, psychologist_id, accountant_id, kind, title, competence, due_on, amount, file_path)
  values (v_link, p_psicologo, auth.uid(), p_tipo, btrim(p_titulo), date_trunc('month', p_competencia)::date,
    p_vencimento, p_valor, p_arquivo)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remover_guia(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_arquivo text;
begin
  delete from public.accountant_documents d
   where d.id = p_id and d.accountant_id = auth.uid() and d.paid_on is null
     and public.contador_atende(d.psychologist_id) = d.link_id
  returning d.file_path into v_arquivo;
  if v_arquivo is null then
    raise exception 'guia não encontrada' using errcode = 'P0002';
  end if;
  return v_arquivo;
end;
$$;

create or replace function public.marcar_guia_paga(p_id uuid, p_paga boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accountant_documents
     set paid_on = case when p_paga then (now() at time zone 'America/Sao_Paulo')::date else null end
   where id = p_id and psychologist_id = auth.uid();
  if not found then
    raise exception 'guia não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.criar_pendencia(p_psicologo uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link uuid := public.contador_atende(p_psicologo);
  v_id uuid;
begin
  if v_link is null then
    raise exception 'sem vínculo ativo com este psicólogo' using errcode = '42501';
  end if;
  insert into public.accountant_tasks (link_id, psychologist_id, accountant_id, body)
  values (v_link, p_psicologo, auth.uid(), btrim(p_texto))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolver_pendencia(p_id uuid, p_resolvida boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accountant_tasks
     set resolved_at = case when p_resolvida then now() else null end
   where id = p_id and psychologist_id = auth.uid();
  if not found then
    raise exception 'pendência não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.enviar_guia(uuid, text, text, date, date, numeric, text), public.remover_guia(uuid),
  public.marcar_guia_paga(uuid, boolean), public.criar_pendencia(uuid, text), public.resolver_pendencia(uuid, boolean)
  from public, anon;
grant execute on function public.enviar_guia(uuid, text, text, date, date, numeric, text), public.remover_guia(uuid),
  public.marcar_guia_paga(uuid, boolean), public.criar_pendencia(uuid, text), public.resolver_pendencia(uuid, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Registro de acessos do contador (o psicólogo vê)
-- ---------------------------------------------------------------------------
create table public.accountant_access_log (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.accountant_links (id) on delete restrict,
  psychologist_id uuid not null references public.profiles (id) on delete restrict,
  accountant_id uuid not null references public.profiles (id) on delete restrict,
  scope text not null constraint accountant_access_log_scope check (scope in ('totais', 'lancamentos', 'despesas')),
  period text not null,
  accessed_at timestamptz not null default now()
);

create index accountant_access_log_psychologist_idx on public.accountant_access_log (psychologist_id, accessed_at desc);

alter table public.accountant_access_log enable row level security;
revoke all on table public.accountant_access_log from anon, authenticated;
grant select on table public.accountant_access_log to authenticated;

create policy "accountant_access_log: o psicólogo lê os acessos"
  on public.accountant_access_log for select to authenticated
  using (psychologist_id = (select auth.uid()));

create or replace function public.registrar_acesso_contador(p_link uuid, p_psicologo uuid, p_escopo text, p_periodo text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.accountant_access_log (link_id, psychologist_id, accountant_id, scope, period)
  values (p_link, p_psicologo, auth.uid(), p_escopo, p_periodo);
$$;

revoke execute on function public.registrar_acesso_contador(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leituras do contador (só por estas funções)
-- ---------------------------------------------------------------------------
-- Clientes do contador logado. Regime, pró-labore e receita dos últimos 12 meses só
-- com a autorização "totais".
create or replace function public.contador_clientes()
returns table (
  link_id uuid, psychologist_id uuid, full_name text, crp_region text, crp_number text, since timestamptz,
  share_totals boolean, share_entries boolean, share_expenses boolean, plano_ok boolean,
  regime text, monthly_payroll numeric, receita_12_meses numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.e_contador() or not public.duas_etapas_ok() then
    raise exception 'acesso só para contador com verificação em duas etapas' using errcode = '42501', hint = 'exige_duas_etapas';
  end if;
  return query
  select l.id, l.psychologist_id, p.full_name, p.crp_region, p.crp_number, l.created_at,
         l.share_totals, l.share_entries, l.share_expenses,
         public.plano_permite_contador(l.psychologist_id),
         case when l.share_totals then coalesce(f.regime, 'pessoa_fisica') end,
         case when l.share_totals then f.monthly_payroll end,
         case when l.share_totals and public.plano_permite_contador(l.psychologist_id) then (
           select coalesce(sum(a.fee), 0) from public.appointments a
            where a.owner_id = l.psychologist_id and a.payment_status = 'pago'
              and a.paid_on > (now() at time zone 'America/Sao_Paulo')::date - interval '12 months')
         end
  from public.accountant_links l
  join public.profiles p on p.id = l.psychologist_id
  left join public.fiscal_profiles f on f.owner_id = l.psychologist_id
  where l.accountant_id = auth.uid() and l.status = 'ativo'
  order by p.full_name;
end;
$$;

-- Totais de cada mês do ano (regime de caixa: o que foi pago no mês).
create or replace function public.contador_resumo(p_psicologo uuid, p_ano integer)
returns table (mes date, recebido numeric, sessoes_pagas integer, a_receber numeric, despesas numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link uuid := public.contador_atende(p_psicologo);
  v_despesas boolean;
begin
  if v_link is null or not (select share_totals from public.accountant_links where id = v_link) then
    raise exception 'sem autorização para ver os totais' using errcode = '42501';
  end if;
  v_despesas := (select share_expenses from public.accountant_links where id = v_link);
  perform public.registrar_acesso_contador(v_link, p_psicologo, 'totais', p_ano::text);
  return query
  with meses as (
    select generate_series(make_date(p_ano, 1, 1), make_date(p_ano, 12, 1), interval '1 month')::date as m
  )
  select meses.m,
    (select coalesce(sum(a.fee), 0) from public.appointments a
      where a.owner_id = p_psicologo and a.payment_status = 'pago'
        and a.paid_on >= meses.m and a.paid_on < (meses.m + interval '1 month')::date),
    (select count(*)::int from public.appointments a
      where a.owner_id = p_psicologo and a.payment_status = 'pago'
        and a.paid_on >= meses.m and a.paid_on < (meses.m + interval '1 month')::date),
    (select coalesce(sum(a.fee), 0) from public.appointments a
      where a.owner_id = p_psicologo and a.payment_status = 'a_receber' and a.status in ('realizada', 'faltou')
        and (a.starts_at at time zone 'America/Sao_Paulo')::date >= meses.m
        and (a.starts_at at time zone 'America/Sao_Paulo')::date < (meses.m + interval '1 month')::date),
    case when v_despesas then
      (select coalesce(sum(e.amount), 0) from public.expenses e
        where e.owner_id = p_psicologo and e.spent_on >= meses.m and e.spent_on < (meses.m + interval '1 month')::date)
    end
  from meses
  order by meses.m;
end;
$$;

-- Lançamentos do mês: só com a autorização "lançamentos detalhados".
create or replace function public.contador_lancamentos(p_psicologo uuid, p_mes date)
returns table (pago_em date, valor numeric, forma text, pagador_nome text, pagador_cpf text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link uuid := public.contador_atende(p_psicologo);
  v_inicio date := date_trunc('month', p_mes)::date;
begin
  if v_link is null or not (select share_entries from public.accountant_links where id = v_link) then
    raise exception 'sem autorização para ver os lançamentos' using errcode = '42501';
  end if;
  perform public.registrar_acesso_contador(v_link, p_psicologo, 'lancamentos', to_char(v_inicio, 'YYYY-MM'));
  return query
  select a.paid_on, a.fee, a.payment_method,
         coalesce(p.payer_name, p.full_name),
         case when p.payer_name is not null then p.payer_cpf else p.cpf end
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.owner_id = p_psicologo and a.payment_status = 'pago'
    and a.paid_on >= v_inicio and a.paid_on < (v_inicio + interval '1 month')::date
  order by a.paid_on, 4;
end;
$$;

-- Despesas do mês: só com a autorização "despesas".
create or replace function public.contador_despesas(p_psicologo uuid, p_mes date)
returns table (data date, categoria text, descricao text, valor numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link uuid := public.contador_atende(p_psicologo);
  v_inicio date := date_trunc('month', p_mes)::date;
begin
  if v_link is null or not (select share_expenses from public.accountant_links where id = v_link) then
    raise exception 'sem autorização para ver as despesas' using errcode = '42501';
  end if;
  perform public.registrar_acesso_contador(v_link, p_psicologo, 'despesas', to_char(v_inicio, 'YYYY-MM'));
  return query
  select e.spent_on, e.category, e.description, e.amount
  from public.expenses e
  where e.owner_id = p_psicologo and e.spent_on >= v_inicio and e.spent_on < (v_inicio + interval '1 month')::date
  order by e.spent_on;
end;
$$;

revoke execute on function public.contador_clientes(), public.contador_resumo(uuid, integer),
  public.contador_lancamentos(uuid, date), public.contador_despesas(uuid, date) from public, anon;
grant execute on function public.contador_clientes(), public.contador_resumo(uuid, integer),
  public.contador_lancamentos(uuid, date), public.contador_despesas(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Cadastro: o tipo de conta vem do formulário de cadastro (área do contador)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_tipo text := coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'psicologo');
  v_region text := nullif(btrim(new.raw_user_meta_data ->> 'crp_region'), '');
  v_number text := nullif(btrim(new.raw_user_meta_data ->> 'crp_number'), '');
  v_crc_uf text := upper(nullif(btrim(new.raw_user_meta_data ->> 'crc_state'), ''));
  v_crc_num text := nullif(btrim(new.raw_user_meta_data ->> 'crc_number'), '');
  v_crc_cat text := nullif(btrim(new.raw_user_meta_data ->> 'crc_category'), '');
begin
  if v_tipo not in ('psicologo', 'contador') then
    v_tipo := 'psicologo';
  end if;
  if v_region is not null and v_region !~ '^(0[1-9]|[1-9][0-9])$' then
    v_region := null;
  end if;
  if v_number is not null and v_number !~ '^[0-9]{1,6}$' then
    v_number := null;
  end if;
  if v_region is null or v_number is null or v_tipo = 'contador' then
    v_region := null;
    v_number := null;
  end if;

  insert into public.profiles (id, full_name, crp_region, crp_number, account_type, trial_ends_at)
  values (
    new.id,
    left(coalesce(v_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Sem nome'), 200),
    v_region,
    v_number,
    v_tipo,
    case when v_tipo = 'contador' then null else now() + interval '30 days' end
  );

  if v_tipo = 'contador' then
    if v_crc_uf is null or v_crc_uf !~ '^[A-Z]{2}$' or v_crc_num is null or v_crc_num !~ '^[0-9]{1,6}$'
       or coalesce(v_crc_cat, '') not in ('contador', 'tecnico') then
      v_crc_uf := null;
      v_crc_num := null;
      v_crc_cat := null;
    end if;
    begin
      insert into public.accountant_profiles (id, crc_state, crc_number, crc_category)
      values (new.id, v_crc_uf, v_crc_num, v_crc_cat);
    exception when check_violation then
      insert into public.accountant_profiles (id) values (new.id);
    end;
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
