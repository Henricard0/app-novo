-- Mover sessões pelo calendário (arrastar e soltar).
--
-- mover_sessao muda o horário de uma sessão. Com p_seguintes = true, aplica o
-- mesmo deslocamento e a mesma duração às sessões seguintes da mesma série
-- semanal que ainda estão agendadas. Roda com as permissões de quem chama
-- (security invoker): a RLS de appointments continua valendo, então ninguém
-- move sessão de outra pessoa.

create or replace function public.mover_sessao(
  p_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_seguintes boolean default false
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_atual public.appointments%rowtype;
  v_deslocamento interval;
  v_duracao interval;
  v_total integer;
begin
  select * into v_atual from public.appointments where id = p_id;
  if not found then
    raise exception 'sessão não encontrada' using errcode = 'P0002';
  end if;

  v_deslocamento := p_inicio - v_atual.starts_at;
  v_duracao := p_fim - p_inicio;

  update public.appointments
     set starts_at = p_inicio, ends_at = p_fim
   where id = p_id;
  v_total := 1;

  if p_seguintes and v_atual.series_id is not null then
    update public.appointments
       set starts_at = starts_at + v_deslocamento,
           ends_at = starts_at + v_deslocamento + v_duracao
     where series_id = v_atual.series_id
       and id <> p_id
       and starts_at > v_atual.starts_at
       and status = 'agendada';
    get diagnostics v_total = row_count;
    v_total := v_total + 1;
  end if;

  return v_total;
end;
$$;

revoke execute on function public.mover_sessao(uuid, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.mover_sessao(uuid, timestamptz, timestamptz, boolean) to authenticated;
