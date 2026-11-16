-- Fase 3 — Planos e assinatura (Mercado Pago).
--
-- Decisões do Henrique (docs/especificacao.md, seção 3):
--   * Gratuito: supervisão completa e consultório com até 10 pacientes ativos
--     (arquivados não contam). Substitui o antigo "Supervisor grátis".
--   * Essencial: R$ 38,30/mês ou R$ 383/ano; 30 dias de teste sem cartão;
--     50% no primeiro ano para recém-formados.
--
-- Segurança:
--   * O plano NUNCA é escrito pelo navegador: profiles.plan e subscriptions só
--     mudam pelo servidor (Edge Functions com a chave de serviço), depois de
--     confirmar o pagamento direto na API do Mercado Pago.
--   * O limite de pacientes é aplicado no banco (gatilho), não só na tela.

alter table public.profiles
  add column plan text not null default 'gratuito' constraint profiles_plan check (plan in ('gratuito', 'essencial')),
  add column trial_ends_at timestamptz default now() + interval '30 days';

comment on column public.profiles.plan is 'Plano pago confirmado. Só o servidor muda (webhook do Mercado Pago).';
comment on column public.profiles.trial_ends_at is 'Fim do teste grátis do Essencial (30 dias a partir do cadastro).';

-- Quem já tinha conta ganha os 30 dias a partir de agora.
update public.profiles set trial_ends_at = now() + interval '30 days';

-- As colunas novas não entram no grant de update do usuário (que continua
-- limitado a full_name, crp_region e crp_number).

-- ---------------------------------------------------------------------------
-- Assinaturas
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  provider text not null default 'mercado_pago' constraint subscriptions_provider check (provider in ('mercado_pago')),
  provider_id text unique,
  cycle text not null constraint subscriptions_cycle check (cycle in ('mensal', 'anual')),
  amount numeric(10, 2) not null constraint subscriptions_amount check (amount > 0),
  new_graduate_discount boolean not null default false,
  discount_until timestamptz,
  status text not null default 'pendente'
    constraint subscriptions_status check (status in ('pendente', 'ativa', 'pausada', 'cancelada')),
  next_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);

alter table public.subscriptions enable row level security;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Só leitura para o dono. Escrita só pelo servidor (service_role ignora a RLS).
revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;

create policy "subscriptions: o dono lê as suas"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Plano efetivo e limites
-- ---------------------------------------------------------------------------
-- 'essencial' (pago e confirmado), 'teste' (dentro dos 30 dias) ou 'gratuito'.
create or replace function public.plano_efetivo(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.plan = 'essencial' then 'essencial'
    when p.trial_ends_at is not null and p.trial_ends_at > now() then 'teste'
    else 'gratuito'
  end
  from public.profiles p
  where p.id = p_user;
$$;

revoke execute on function public.plano_efetivo(uuid) from public, anon, authenticated;

-- Para a tela: o plano de quem está logado e quantos pacientes ativos tem.
create or replace function public.meu_plano()
returns table (plano text, trial_ends_at timestamptz, pacientes_ativos integer, limite_pacientes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select public.plano_efetivo(p.id),
         p.trial_ends_at,
         (select count(*)::int from public.patients x where x.owner_id = p.id and x.archived_at is null),
         case when public.plano_efetivo(p.id) = 'gratuito' then 10 else null end
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;

-- Limite do plano gratuito: 10 pacientes ativos (cadastrar ou reativar).
create or replace function public.limitar_pacientes_do_plano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativos integer;
begin
  if new.archived_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null then
    return new;
  end if;
  if public.plano_efetivo(new.owner_id) <> 'gratuito' then
    return new;
  end if;
  select count(*) into v_ativos from public.patients
   where owner_id = new.owner_id and archived_at is null and id <> new.id;
  if v_ativos >= 10 then
    raise exception 'limite de pacientes do plano gratuito'
      using errcode = 'P0001', hint = 'plano_gratuito_limite_pacientes';
  end if;
  return new;
end;
$$;

revoke execute on function public.limitar_pacientes_do_plano() from public, anon, authenticated;

create trigger patients_limite_do_plano
  before insert or update of archived_at on public.patients
  for each row execute function public.limitar_pacientes_do_plano();
