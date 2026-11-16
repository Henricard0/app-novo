-- Fase 6 (início) — PDFs das guias (DAS, DARF) no Supabase Storage, numa pasta privada.
-- Caminho: guias/{id do psicólogo}/{uuid}.pdf
--   * O contador envia e apaga só enquanto atende aquele psicólogo (vínculo ativo,
--     plano em dia, verificação em duas etapas).
--   * O psicólogo lê os arquivos da própria pasta; o contador, enquanto atende.

-- Recebe o nome da pasta como texto (pode não ser um uuid) sem dar erro.
create or replace function public.contador_atende_pasta(p_pasta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_pasta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.contador_atende(p_pasta::uuid) is not null
    else false
  end;
$$;

revoke execute on function public.contador_atende_pasta(text) from public, anon;
grant execute on function public.contador_atende_pasta(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guias', 'guias', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "guias: contador envia para quem atende"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guias'
    and public.contador_atende_pasta((storage.foldername(name))[1])
  );

create policy "guias: psicólogo e contador leem"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'guias'
    and (
      ((storage.foldername(name))[1] = (select auth.uid())::text and (select public.e_psicologo()))
      or public.contador_atende_pasta((storage.foldername(name))[1])
    )
  );

create policy "guias: contador apaga enquanto atende"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'guias'
    and public.contador_atende_pasta((storage.foldername(name))[1])
  );
