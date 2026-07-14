-- =============================================================================
-- S4-3 — Segmentação de campanha: contagem de público-alvo por filtros jsonb,
-- ISOLADA por clínica. security invoker → a RLS de paciente_clinica/consulta/
-- venda reforça o isolamento (um gestor só conta os pacientes VINCULADOS à sua
-- clínica via paciente_clinica; paciente é global N:N — nunca contar sem o join
-- de tenant). O disparo real (WhatsApp) é F2 — aqui só a segmentação.
-- Estrutura de `filtros` (campanha.filtros jsonb):
--   demograficos {idade_minima, idade_maxima, generos[], localizacoes[]}
--   temporais    {data_cadastro_inicio, data_cadastro_fim, aniversario_mes}
--   status_paciente {sem_visita_dias}
--   compra       {sem_compra}
-- =============================================================================

create or replace function public.campanha_publico_alvo(
  p_clinica_id uuid,
  p_filtros    jsonb
)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.paciente_clinica pc
  join public.paciente p on p.id = pc.paciente_id
  where pc.clinica_id = p_clinica_id
    and pc.ativo
    and p.ativo
    -- Demográficos
    and (
      (p_filtros -> 'demograficos' ->> 'idade_minima') is null
      or (p.data_nascimento is not null
          and extract(year from age(p.data_nascimento)) >= (p_filtros -> 'demograficos' ->> 'idade_minima')::int)
    )
    and (
      (p_filtros -> 'demograficos' ->> 'idade_maxima') is null
      or (p.data_nascimento is not null
          and extract(year from age(p.data_nascimento)) <= (p_filtros -> 'demograficos' ->> 'idade_maxima')::int)
    )
    and (
      jsonb_array_length(coalesce(p_filtros -> 'demograficos' -> 'generos', '[]'::jsonb)) = 0
      or p.sexo::text in (select jsonb_array_elements_text(p_filtros -> 'demograficos' -> 'generos'))
    )
    and (
      jsonb_array_length(coalesce(p_filtros -> 'demograficos' -> 'localizacoes', '[]'::jsonb)) = 0
      or p.cidade in (select jsonb_array_elements_text(p_filtros -> 'demograficos' -> 'localizacoes'))
    )
    -- Temporais
    and (
      (p_filtros -> 'temporais' ->> 'aniversario_mes') is null
      or (p.data_nascimento is not null
          and extract(month from p.data_nascimento) = (p_filtros -> 'temporais' ->> 'aniversario_mes')::int)
    )
    and (
      (p_filtros -> 'temporais' ->> 'data_cadastro_inicio') is null
      or p.created_at >= (p_filtros -> 'temporais' ->> 'data_cadastro_inicio')::timestamptz
    )
    and (
      (p_filtros -> 'temporais' ->> 'data_cadastro_fim') is null
      or p.created_at <= (p_filtros -> 'temporais' ->> 'data_cadastro_fim')::timestamptz
    )
    -- Sem visita nos últimos N dias (consulta concluída)
    and (
      (p_filtros -> 'status_paciente' ->> 'sem_visita_dias') is null
      or not exists (
        select 1 from public.consulta c
        where c.clinica_id = p_clinica_id and c.paciente_id = p.id
          and c.status = 'concluido'
          and c.data_hora >= now() - (((p_filtros -> 'status_paciente' ->> 'sem_visita_dias')::int) || ' days')::interval
      )
    )
    -- Sem compra (nenhuma venda não-cancelada)
    and (
      coalesce((p_filtros -> 'compra' ->> 'sem_compra')::boolean, false) = false
      or not exists (
        select 1 from public.venda v
        join public.orcamento o on o.id = v.orcamento_id
        where o.clinica_id = p_clinica_id and o.paciente_id = p.id and v.cancelada = false
      )
    );
$$;

revoke execute on function public.campanha_publico_alvo(uuid, jsonb) from public, anon;
grant execute on function public.campanha_publico_alvo(uuid, jsonb) to authenticated;
