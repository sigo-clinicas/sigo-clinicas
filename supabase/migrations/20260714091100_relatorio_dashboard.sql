-- =============================================================================
-- S4-4 — RPC de dashboard/relatórios: agrega no Postgres (não puxa entidades ao
-- browser). SECURITY DEFINER + gate proprietario/gerente. FATURAMENTO por regime
-- de CAIXA (movimentacao_conta/baixa) — reconcilia com o financeiro do S3
-- (corrige o bug do Base44 que somava `valor WHERE status='pago'`). Comissão já
-- entra como despesa via apurar_comissao — não somar de novo.
-- Invariante testável: Σ movimentacao_conta(entrada) == Σ baixa_lancamento
-- (lançamentos receita) no período.
-- =============================================================================

create or replace function public.relatorio_dashboard(
  p_clinica_id uuid,
  p_ini        date,
  p_fim        date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not app.tem_papel(p_clinica_id, array['proprietario','gerente']) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select jsonb_build_object(
    -- Financeiro (regime de caixa — reconcilia com o extrato)
    'faturamento_recebido', (
      select coalesce(sum(valor), 0) from public.movimentacao_conta
      where clinica_id = p_clinica_id and tipo = 'entrada' and data between p_ini and p_fim),
    'despesas_pagas', (
      select coalesce(sum(valor), 0) from public.movimentacao_conta
      where clinica_id = p_clinica_id and tipo = 'saida' and data between p_ini and p_fim),
    'a_receber', (
      select coalesce(sum(valor - valor_pago), 0) from public.lancamento_financeiro
      where clinica_id = p_clinica_id and tipo = 'receita' and status not in ('pago', 'cancelado')),
    'a_pagar', (
      select coalesce(sum(valor - valor_pago), 0) from public.lancamento_financeiro
      where clinica_id = p_clinica_id and tipo = 'despesa' and status not in ('pago', 'cancelado')),
    -- Produtividade
    'consultas_total', (
      select count(*) from public.consulta
      where clinica_id = p_clinica_id and data_hora::date between p_ini and p_fim),
    'consultas_concluidas', (
      select count(*) from public.consulta
      where clinica_id = p_clinica_id and data_hora::date between p_ini and p_fim and status = 'concluido'),
    'consultas_faltou', (
      select count(*) from public.consulta
      where clinica_id = p_clinica_id and data_hora::date between p_ini and p_fim and status = 'faltou'),
    'consultas_retorno', (
      select count(*) from public.consulta
      where clinica_id = p_clinica_id and data_hora::date between p_ini and p_fim and tipo = 'retorno'),
    'pacientes_unicos', (
      select count(distinct paciente_id) from public.consulta
      where clinica_id = p_clinica_id and data_hora::date between p_ini and p_fim),
    'por_profissional', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select profissional_id, count(*) as qtd
        from public.consulta
        where clinica_id = p_clinica_id and data_hora::date between p_ini and p_fim
        group by profissional_id order by qtd desc) x),
    'servicos_mais_vendidos', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select cs.servico_id, count(*) as qtd
        from public.consulta_servico cs
        join public.consulta c on c.id = cs.consulta_id
        where c.clinica_id = p_clinica_id and c.data_hora::date between p_ini and p_fim
        group by cs.servico_id order by qtd desc limit 10) x)
  ) into v;

  return v;
end;
$$;

revoke execute on function public.relatorio_dashboard(uuid, date, date) from public, anon;
grant execute on function public.relatorio_dashboard(uuid, date, date) to authenticated;
