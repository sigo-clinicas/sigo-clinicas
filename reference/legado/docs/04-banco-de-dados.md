# 04 — Banco de dados

**Fonte primária [FATO]**: `sigo-clinicas-api/assets/mysql/dump.sql` — schema
`sigoclinicas`, MySQL/InnoDB, `utf8_unicode_ci`. É um **script de bootstrap
manual** (CREATE + INSERT de sementes + ALTERs incrementais no fim), **não** um
snapshot de Doctrine migrations. Mapeamento ORM em
`module/*/config/yaml/*.dcm.yml` (Doctrine `YamlDriver`).

**[FATO]** O `dump.sql` contém **55 `CREATE TABLE`**. Não há um banco separado
por repositório — **um único schema** serve toda a aplicação. Painel, site e app
não têm banco próprio.

## 1. Grupos de tabelas

### Autenticação / OAuth2 (16)
`role`, `user`, `user_has_role`, `oauth2_accesstoken`,
`oauth2_accesstoken_to_scope`, `oauth2_authorizationcode`,
`oauth2_authorizationcode_to_scope`, `oauth2_client`, `oauth2_client_to_scope`,
`oauth2_jti`, `oauth2_jwt`, `oauth2_publickey`, `oauth2_refreshtoken`,
`oauth2_refreshtoken_to_scope`, `oauth2_scope`.
FKs `ON DELETE CASCADE` ligam tokens ao `oauth2_client` e ao `user`
(`dump.sql:8-43`).

### Cadastros base (2)
`endereco`, `telefone` (reutilizados por clínica, profissional, cliente,
usuário via tabelas `*_has_telefone`).

### Pessoas e vínculos (multi-tenant por clínica)
- `clinica` — o tenant central.
- `profissional`, `usuario`, `cliente` — cada um **OneToOne com `user`** (a
  identidade OAuth2). `usuario` = staff administrativo da clínica.
- Pivôs `clinica_has_profissional`, `clinica_has_usuario`,
  `clinica_has_cliente`, `clinica_has_telefone`, `clinica_has_especialidade`,
  `clinica_has_servico`.
- `profissional_has_telefone`, `profissional_has_intervalo` (janelas de
  atendimento), `profissional_has_servico`.
- `cliente_has_telefone`, `cliente_ficha_anamnese`.

### Catálogo (serviços/materiais/preços)
`servico`, `servico_categoria`, `servico_material`, `material`,
`grupo_material`, `tabela_preco`, `tabela_has_servico`, `especialidade`,
`segmento`, `ficha_anamnese`.

### Agenda
`agenda`, `agenda_has_servico`.

### Comercial / financeiro
`orcamento`, `orcamento_has_servico`, `orcamento_servico`, `venda`,
`venda_has_agenda`, `venda_has_pagamento`, `venda_categoria`,
`venda_has_categoria`, `financeiro`, `financeirocategoria`.

## 2. Relacionamentos principais (do mapeamento Doctrine)

- `clinica` **OneToOne** `endereco`; **OneToMany** `clinica_has_servico`,
  `agenda`, `tabela_preco`; **ManyToMany** `telefone`, `usuario`, `profissional`,
  `cliente`, `especialidade` (`Clinica.V1.Rest.Clinicas.ClinicasEntity.dcm.yml`).
- `agenda` **ManyToOne** clínica/profissional/cliente; **ManyToMany** `servico`
  (via `agenda_has_servico`); relação com `venda` (via `venda_has_agenda`).
- `profissional` **OneToOne** `user`; **OneToMany** serviços/intervalos/agendas.
- `especialidade` **ManyToOne** `segmento` (coluna `segmento_id`).
- `orcamento` → `orcamento_servico` → `venda` → `venda_pagamento` (funil
  comercial).

## 3. Sementes (dados iniciais no dump)

- **8 papéis** em `role` (`dump.sql:48-56`): guest, admin, proprietario,
  gerente, recepcionista, assistente, profissional, cliente — hierárquicos
  (self-reference `parent_id`).
- **Usuário e clientes OAuth semente** `addpix` / `addpix_mobile`
  (`dump.sql:64-93`) — ver §6.
- **66 especialidades médicas** (`dump.sql:171-238`).

## 4. Migrações inline (ALTERs ao final do dump)

Colunas adicionadas fora dos `CREATE TABLE` (`dump.sql:313-326`):
`agenda_has_servico.orcamento_servico_id`, `cliente.termosAceitos` +
`cliente.data_hora_aceite`, `profissional.foto` (JSON),
`clinica.somenteAgendamentosVendidos`, `orcamento.tipo_acrescimo_desconto`.

**[INFERÊNCIA]** Como o schema evolui por ALTERs manuais coladas no dump (sem
Doctrine Migrations), o arquivo tende a defasar do mapeamento ORM.

## 5. Enums / triggers / procedures / views / RLS

- **[NÃO ENCONTRADO]** triggers, stored procedures, views ou RLS. O dump só tem
  tabelas, FKs e inserts. Colunas de "status/tipo" são strings/inteiros
  aplicativos (ex.: `financeiro.tipoConta` = pagar/receber, status de agenda
  confirmado/aguardando/encaixe usados no repositório de agenda).
- Segurança de acesso a dados é 100% aplicacional (ACL na API), não no banco.

## 6. Divergências código ↔ banco (importante)

| # | Divergência | Evidência | Impacto |
|---|---|---|---|
| 1 | Entidade `ClientesStatusEntity` mapeia a tabela **`clinica_cliente_status`** (colunas cliente+clinica+`ativo`), que **não existe** no dump — lá só há `clinica_has_cliente` (sem `ativo`). | `Clinica.V1.Rest.Clientes.ClientesStatusEntity.dcm.yml:1-24` vs `dump.sql` | Consulta a status de cliente pode falhar se a tabela não for criada manualmente no ambiente real. **[FATO]** de divergência; a existência da tabela em produção **[NÃO CONFIRMADA]**. |
| 2 | O dump é bootstrap manual, não migrations — pode não refletir 100% do schema de produção. | ausência de `doctrine-migrations` | O schema real de prod **[NÃO CONFIRMADO]**; documentar a partir do dump é a melhor aproximação disponível. |
| 3 | Credenciais semente `addpix`/`addpix` (hash bcrypt no dump) — se aplicadas em produção, são credenciais triviais conhecidas. | `dump.sql:61-93` | Risco de segurança (ver `09`). |

## 7. Objetos de banco extraídos automaticamente

A lista completa de tabelas detectadas (via `CREATE TABLE` no SQL e `table:` no
mapeamento Doctrine) está em `inventory/database-objects.csv`.
