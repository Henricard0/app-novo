-- Lumen: esquema da nuvem (sincronização + backup).
-- Cada registro do app (caderno, nota, flashcard, tarefa) vira uma linha com o JSON do registro.
-- RLS garante que cada usuário só lê e grava os próprios dados.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('notebook', 'note', 'flashcard', 'task')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  -- quando o registro foi alterado no aparelho (decide qual versão vence)
  updated_at timestamptz not null,
  -- quando a nuvem recebeu a alteração (usado para baixar só o que mudou)
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_server_updated_idx
  on public.records (user_id, server_updated_at);

-- Atualiza server_updated_at a cada gravação. clock_timestamp() (e não now())
-- garante valores distintos mesmo dentro de um único upsert em lote.
create or replace function public.records_touch()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.records_touch();

-- Uma versão mais antiga nunca sobrescreve uma mais nova (última gravação vence),
-- mesmo que dois aparelhos enviem ao mesmo tempo.
create or replace function public.records_keep_newest()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- ignora a gravação mais antiga
  end if;
  return new;
end;
$$;

drop trigger if exists records_keep_newest on public.records;
create trigger records_keep_newest
  before update on public.records
  for each row execute function public.records_keep_newest();

alter table public.records enable row level security;

drop policy if exists "records: dono lê" on public.records;
create policy "records: dono lê" on public.records
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "records: dono insere" on public.records;
create policy "records: dono insere" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "records: dono altera" on public.records;
create policy "records: dono altera" on public.records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "records: dono apaga" on public.records;
create policy "records: dono apaga" on public.records
  for delete to authenticated using (user_id = (select auth.uid()));

-- Fotos das notas: bucket privado, cada usuário só acessa a própria pasta (<user_id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "attachments: dono lê" on storage.objects;
create policy "attachments: dono lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: dono envia" on storage.objects;
create policy "attachments: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: dono altera" on storage.objects;
create policy "attachments: dono altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: dono apaga" on storage.objects;
create policy "attachments: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
