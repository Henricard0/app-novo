-- Fase 5a (parte inicial) — Financeiro mínimo: valor e pagamento das sessões,
-- despesas e dados fiscais básicos. É a base que o contador (Fase 6) vai ler.
--
-- Regras:
--   * RLS ativada nesta mesma migration em toda tabela nova; só o dono acessa.
--   * Nada aqui é clínico. Mesmo assim, o contador só lê estes dados por funções
--     que conferem o vínculo e a autorização do psicólogo (migration seguinte).
--   * Valores em reais, numeric(10,2).

-- ---------------------------------------------------------------------------
-- Pacientes: valor padrão da sessão e dados de quem paga (para recibos e carnê-leão)
-- ---------------------------------------------------------------------------
alter table public.patients
  add column default_fee numeric(10, 2)
    constraint patients_default_fee check (default_fee >= 0 and default_fee <= 100000),
  add column cpf text constraint patients_cpf_format check (cpf ~ '^[0-9]{11}$'),
  add column payer_name text
    constraint patients_payer_name_len check (char_length(btrim(payer_name)) between 1 and 200),
  add column payer_cpf text constraint patients_payer_cpf_format check (payer_cpf ~ '^[0-9]{11}$');

comment on column public.patients.default_fee is 'Valor padrão da sessão; preenche o valor das sessões novas.';
comment on column public.patients.payer_name is 'Responsável financeiro, quando não é o próprio paciente (ex.: mãe de um adolescente).';

grant insert (default_fee, cpf, payer_name, payer_cpf) on table public.patients to authenticated;
grant update (default_fee, cpf, payer_name, payer_cpf) on table public.patients to authenticated;

-- ---------------------------------------------------------------------------
-- Sessões: valor e pagamento
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column fee numeric(10, 2) constraint appointments_fee check (fee >= 0 and fee <= 100000),
  add column payment_status text not null default 'a_receber'
    constraint appointments_payment_status check (payment_status in ('a_receber', 'pago', 'isento')),
  add column paid_on date,
  add column payment_method text
    constraint appointments_payment_method check (payment_method in ('pix', 'cartao', 'dinheiro', 'transferencia', 'outro')),
  add constraint appointments_pagamento_coerente check ((payment_status = 'pago') = (paid_on is not null));

comment on column public.appointments.paid_on is 'Data em que o pagamento foi recebido (regime de caixa, como no carnê-leão).';

grant insert (fee, payment_status, paid_on, payment_method) on table public.appointments to authenticated;
grant update (fee, payment_status, paid_on, payment_method) on table public.appointments to authenticated;

create index appointments_owner_paid_idx on public.appointments (owner_id, paid_on) where paid_on is not null;

-- ---------------------------------------------------------------------------
-- Despesas do consultório (livro-caixa)
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  spent_on date not null,
  category text not null constraint expenses_category check (category in
    ('aluguel', 'conselho', 'supervisao', 'material', 'formacao', 'impostos', 'outros')),
  description text constraint expenses_description_len check (char_length(description) <= 200),
  amount numeric(10, 2) not null constraint expenses_amount check (amount > 0 and amount <= 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expenses is 'Despesas do consultório (livro-caixa). Só o dono acessa; o contador lê por função, se autorizado.';

create index expenses_owner_idx on public.expenses (owner_id, spent_on);

alter table public.expenses enable row level security;

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

revoke all on table public.expenses from anon, authenticated;
grant select, delete on table public.expenses to authenticated;
grant insert (spent_on, category, description, amount) on table public.expenses to authenticated;
grant update (spent_on, category, description, amount) on table public.expenses to authenticated;

create policy "expenses: o dono lê"
  on public.expenses for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "expenses: o dono lança"
  on public.expenses for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "expenses: o dono edita"
  on public.expenses for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "expenses: o dono remove"
  on public.expenses for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Dados fiscais do psicólogo (regime e pró-labore, para o Fator R)
-- ---------------------------------------------------------------------------
create table public.fiscal_profiles (
  owner_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  regime text not null default 'pessoa_fisica'
    constraint fiscal_profiles_regime check (regime in ('pessoa_fisica', 'simples_nacional')),
  monthly_payroll numeric(10, 2)
    constraint fiscal_profiles_payroll check (monthly_payroll >= 0 and monthly_payroll <= 1000000),
  updated_at timestamptz not null default now()
);

comment on column public.fiscal_profiles.monthly_payroll is
  'Folha e pró-labore por mês (opcional). Usado só para estimar o Fator R do Simples Nacional.';

alter table public.fiscal_profiles enable row level security;

create trigger fiscal_profiles_set_updated_at
  before update on public.fiscal_profiles
  for each row execute function public.set_updated_at();

revoke all on table public.fiscal_profiles from anon, authenticated;
grant select on table public.fiscal_profiles to authenticated;
grant insert (regime, monthly_payroll) on table public.fiscal_profiles to authenticated;
grant update (regime, monthly_payroll) on table public.fiscal_profiles to authenticated;

create policy "fiscal_profiles: o dono lê"
  on public.fiscal_profiles for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "fiscal_profiles: o dono cria"
  on public.fiscal_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "fiscal_profiles: o dono edita"
  on public.fiscal_profiles for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
