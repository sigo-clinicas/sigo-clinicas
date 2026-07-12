-- =============================================================================
-- 1100 STORAGE — buckets por finalidade com policies escopadas por clínica
-- (CLAUDE.md §3/§5). Convenção de path OBRIGATÓRIA: <clinica_id>/<...>.
--   logos       (público)  — logotipo/fotos institucionais da clínica
--   prontuario  (privado)  — fotos antes/depois, avaliação, evolução
--   documentos  (privado)  — consentimentos, anexos de anamnese, uploads
-- Substitui o UploadFile do Base44 (A8).
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('logos',      'logos',      true),
  ('prontuario', 'prontuario', false),
  ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Helper: primeiro segmento do path = clinica_id
create or replace function app.clinica_do_objeto(nome text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select nullif((string_to_array(nome, '/'))[1], '')::uuid;
$$;

grant execute on function app.clinica_do_objeto to anon, authenticated, service_role;

-- LOGOS: leitura pública (bucket público já serve via CDN); escrita
-- proprietário/gerente da clínica dona do path.
create policy logos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'logos');

create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and app.tem_papel(app.clinica_do_objeto(name), array['proprietario','gerente'])
  );

create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and app.tem_papel(app.clinica_do_objeto(name), array['proprietario','gerente'])
  );

create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and app.tem_papel(app.clinica_do_objeto(name), array['proprietario','gerente'])
  );

-- PRONTUARIO: somente staff da clínica; escrita pelos papéis clínicos.
create policy prontuario_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prontuario'
    and app.tem_clinica(app.clinica_do_objeto(name))
  );

create policy prontuario_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prontuario'
    and app.tem_papel(app.clinica_do_objeto(name),
      array['proprietario','gerente','recepcionista','assistente','profissional'])
  );

create policy prontuario_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'prontuario'
    and app.tem_papel(app.clinica_do_objeto(name),
      array['proprietario','gerente','recepcionista','assistente'])
  );

-- DOCUMENTOS: idem prontuário.
create policy documentos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and app.tem_clinica(app.clinica_do_objeto(name))
  );

create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and app.tem_papel(app.clinica_do_objeto(name),
      array['proprietario','gerente','recepcionista','assistente','profissional'])
  );

create policy documentos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and app.tem_papel(app.clinica_do_objeto(name),
      array['proprietario','gerente','recepcionista','assistente'])
  );
