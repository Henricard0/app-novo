-- Fase 3 — Três planos pagos (decisão do Henrique em 16/11/2026):
--   Gratuito     R$ 0                      supervisão completa, até 10 pacientes ativos
--   Básico       R$ 29,90/mês · R$ 299/ano  até 30 pacientes ativos
--   Essencial    R$ 39,90/mês · R$ 399/ano  pacientes ilimitados + emissão de NFS-e
--   Profissional R$ 49,90/mês · R$ 499/ano  Essencial + financeiro, recibos, declarações, assinatura digital
-- Teste grátis de 30 dias do Profissional; 50% no primeiro ano para recém-formados em qualquer plano pago.

alter table public.profiles drop constraint profiles_plan;
alter table public.profiles add constraint profiles_plan
  check (plan in ('gratuito', 'basico', 'essencial', 'profissional'));

alter table public.subscriptions
  add column plan text not null default 'essencial'
    constraint subscriptions_plan check (plan in ('basico', 'essencial', 'profissional'));
alter table public.subscriptions alter column plan drop default;

-- 'teste' = dentro dos 30 dias (vale como Profissional); senão o plano pago confirmado ou 'gratuito'.
create or replace function public.plano_efetivo(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.plan <> 'gratuito' then p.plan
    when p.trial_ends_at is not null and p.trial_ends_at > now() then 'teste'
    else 'gratuito'
  end
  from public.profiles p
  where p.id = p_user;
$$;

-- Limite de pacientes ativos de cada plano (null = sem limite).
create or replace function public.limite_de_pacientes(p_plano text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plano when 'gratuito' then 10 when 'basico' then 30 else null end;
$$;

revoke execute on function public.limite_de_pacientes(text) from public, anon;
grant execute on function public.limite_de_pacientes(text) to authenticated;

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
         public.limite_de_pacientes(public.plano_efetivo(p.id))
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.limitar_pacientes_do_plano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite integer;
  v_ativos integer;
begin
  if new.archived_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null then
    return new;
  end if;
  v_limite := public.limite_de_pacientes(public.plano_efetivo(new.owner_id));
  if v_limite is null then
    return new;
  end if;
  select count(*) into v_ativos from public.patients
   where owner_id = new.owner_id and archived_at is null and id <> new.id;
  if v_ativos >= v_limite then
    raise exception 'limite de pacientes do plano: %', v_limite
      using errcode = 'P0001', hint = 'plano_limite_pacientes';
  end if;
  return new;
end;
$$;
