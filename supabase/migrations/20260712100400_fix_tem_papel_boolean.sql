-- =============================================================================
-- 1500 CORREÇÃO — app.tem_papel deve retornar BOOLEAN, nunca NULL
-- Bug pego por teste (S1-7): quando a clínica não está nos claims,
-- `(app.clinicas() ->> cid) = any(papeis)` é NULL, então `is_admin() OR NULL`
-- = NULL. Nas policies RLS o NULL nega (seguro), mas em contexto booleano
-- EXPLÍCITO (`IF NOT app.tem_papel(...) THEN raise`), `NOT NULL` = NULL e o IF
-- não dispara — a autorização de uma RPC SECURITY DEFINER ficava contornável.
-- coalesce(...) força false. Idem app.tem_clinica por robustez.
-- =============================================================================

create or replace function app.tem_papel(cid uuid, papeis text[])
returns boolean
language sql stable
set search_path = ''
as $$
  select app.is_admin()
      or coalesce((app.clinicas() ->> cid::text) = any (papeis), false);
$$;

create or replace function app.tem_clinica(cid uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select app.is_admin() or coalesce(app.clinicas() ? cid::text, false);
$$;
