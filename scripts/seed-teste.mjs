// Seed de TESTE (rastreável) para homologação — service_role, server-only.
// Cria um cenário completo na "[TESTE] Clínica Demo", com usuários de vários
// papéis para testar o fluxo inteiro. TUDO é rastreável: marca "[TESTE] " nos
// nomes E vínculo por clinica_id; usuários só no domínio @sigo.local.
//
//   node scripts/seed-teste.mjs            → limpa qualquer teste anterior + cria
//   node scripts/seed-teste.mjs --teardown → só limpa (equivale ao .sql de cleanup)
//
// ⚠️ DESTRÓI OS DADOS DE DEMONSTRAÇÃO. Este script é idempotente por
// teardown-and-recreate: ele APAGA a "[TESTE] Clínica Demo" e a recria com um
// clinica_id NOVO. Tudo que o scripts/seed-demo.mjs criou (agenda, prontuário,
// orçamentos, financeiro, comissões, marketing) vai junto no CASCADE.
// Se for rodar antes de uma demo, rode depois:  node scripts/seed-demo.mjs
// (o seed-demo reancora sozinho pelo slug, então funciona após o reset).
//
// Só INSERE dado de teste. NÃO toca no seed determinístico (66 especialidades,
// 4 segmentos) nem no schema. Lê URL/serviço do .env (projeto remoto).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function parseEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}
const env = parseEnv(".env");
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}
const db = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const SLUG = "teste-clinica-demo";
const CLINICA_NOME = "[TESTE] Clínica Demo";
const MARCA = "[TESTE]";
const DOMINIO = "@sigo.local";

// Usuários de STAFF (viram clinica_usuario com o papel indicado)
const STAFF = [
  { email: "demo@sigo.local", senha: "Demo@1234", papel: "proprietario" },
  { email: "gerente@sigo.local", senha: "Gerente@1234", papel: "gerente" },
  { email: "recep@sigo.local", senha: "Recep@1234", papel: "recepcionista" },
  { email: "assistente@sigo.local", senha: "Assist@1234", papel: "assistente" },
  { email: "profissional@sigo.local", senha: "Prof@1234", papel: "profissional" },
];
// Usuário PACIENTE (vinculado a um paciente via user_id — portal do paciente)
const PACIENTE_USER = { email: "paciente@sigo.local", senha: "Paciente@1234" };

const ok = (label, error) => {
  if (error) { console.error(`✗ ${label}:`, error.message || error); process.exit(1); }
  console.log(`  ✓ ${label}`);
};

async function listarUsuariosSigo() {
  const achados = [];
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    achados.push(...data.users.filter((u) => (u.email || "").endsWith(DOMINIO)));
    if (data.users.length < 200) break;
  }
  return achados;
}

async function teardown() {
  console.log("• Limpeza de qualquer teste anterior (idempotência)…");
  console.log("  ⚠ isto REMOVE também os dados de demonstração do seed-demo.mjs");
  console.log("    (recrie-os depois com: node scripts/seed-demo.mjs)");
  // clínicas de teste (por slug conhecido + por marca no nome), deduplicadas
  const alvo = new Map();
  const { data: porSlug } = await db.from("clinica").select("id,nome").in("slug", [SLUG, "clinica-demo"]);
  const { data: porNome } = await db.from("clinica").select("id,nome").ilike("nome", `${MARCA}%`);
  for (const c of [...(porSlug ?? []), ...(porNome ?? [])]) alvo.set(c.id, c.nome);
  const cids = [...alvo.keys()];

  // pacientes que estão vinculados a clínicas de teste (p/ apagar os órfãos depois)
  let pacTeste = [];
  if (cids.length) {
    const { data } = await db.from("paciente_clinica").select("paciente_id").in("clinica_id", cids);
    pacTeste = [...new Set((data ?? []).map((r) => r.paciente_id))];
  }

  for (const [cid, nome] of alvo) {
    // lead não cascateia (on delete set null) → apagar por clinica_id antes
    await db.from("lead").delete().eq("clinica_id", cid);
    // clinica cascateia TODO o resto (consulta/orcamento/venda/evolucao/etc.)
    const { error } = await db.from("clinica").delete().eq("id", cid);
    if (error) console.warn(`   (aviso clínica ${cid}: ${error.message})`);
    else console.log(`  ✓ clínica removida (cascade): ${nome} (${cid})`);
  }

  // pacientes globais: os marcados [TESTE]/[DEMO] + os que ficaram órfãos (só
  // estavam em clínica de teste) — nunca um paciente ainda vinculado a clínica real
  await db.from("paciente").delete().ilike("nome", "[TESTE]%");
  await db.from("paciente").delete().ilike("nome", "[DEMO]%");
  for (const pid of pacTeste) {
    const { count } = await db.from("paciente_clinica").select("*", { count: "exact", head: true }).eq("paciente_id", pid);
    if ((count ?? 0) === 0) await db.from("paciente").delete().eq("id", pid);
  }
  console.log("  ✓ pacientes de teste removidos (marcados + órfãos das clínicas de teste)");

  // usuários @sigo.local
  for (const u of await listarUsuariosSigo()) {
    await db.auth.admin.deleteUser(u.id);
    console.log(`  ✓ usuário ${u.email} removido`);
  }
}

async function seed() {
  console.log("\n• Criando cenário de teste…");

  // 0) usuários de auth (staff + paciente)
  const uid = {};
  for (const u of [...STAFF, PACIENTE_USER]) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password: u.senha, email_confirm: true });
    ok(`usuário ${u.email}`, error);
    uid[u.email] = data.user.id;
  }

  // 1) clínica de teste (estética → white-label)
  const { data: clinica, error: eClin } = await db.from("clinica").insert({
    nome: CLINICA_NOME, tipo: "estetica", slug: SLUG,
    ativo: true, exibir_marketplace: true, cidade: "São Paulo", uf: "SP",
    sobre: "Clínica de TESTE para homologação (remover antes do lançamento).",
  }).select("id").single();
  ok(`clínica '${CLINICA_NOME}' (estetica)`, eClin);
  const clinicaId = clinica.id;

  // 2) staff → clinica_usuario
  {
    const { error } = await db.from("clinica_usuario").insert(
      STAFF.map((u) => ({ clinica_id: clinicaId, user_id: uid[u.email], papel: u.papel, ativo: true }))
    );
    ok("vínculos de staff (proprietario/gerente/recepcionista/assistente/profissional)", error);
  }

  // 3) especialidade de estética (JÁ semeada — apenas lookup, não insere)
  const { data: esps } = await db.from("especialidade")
    .select("id,nome").ilike("nome", "Estética%").order("nome").limit(1);
  const especialidadeId = esps?.[0]?.id ?? null;
  console.log(`  · especialidade (existente): ${esps?.[0]?.nome ?? "(nenhuma)"}`);

  // 4) profissionais + especialidade + disponibilidade. O 1º é o login profissional@.
  const profs = [
    { nome: "[TESTE] Dra. Marina Alves", ini: "09:00", fim: "18:00", user: uid["profissional@sigo.local"] },
    { nome: "[TESTE] Dr. Rafael Costa", ini: "08:00", fim: "17:00", user: null },
  ];
  const profIds = [];
  for (const p of profs) {
    const { data, error } = await db.from("profissional").insert({
      clinica_id: clinicaId, nome: p.nome, ativo: true, user_id: p.user,
      dias_atendimento: [1, 2, 3, 4, 5], horario_inicio: p.ini, horario_fim: p.fim,
    }).select("id").single();
    ok(`profissional ${p.nome}`, error);
    profIds.push(data.id);
    if (especialidadeId) await db.from("profissional_especialidade").insert({
      clinica_id: clinicaId, profissional_id: data.id, especialidade_id: especialidadeId,
    });
  }

  // 5) serviços (públicos) + tabela particular + preços
  const servicos = [
    { nome: "[TESTE] Limpeza de Pele", dur: 60, valor: 150 },
    { nome: "[TESTE] Peeling Químico", dur: 45, valor: 220 },
    { nome: "[TESTE] Massagem Modeladora", dur: 50, valor: 180 },
  ];
  const servIds = [];
  for (const s of servicos) {
    const { data, error } = await db.from("servico").insert({
      clinica_id: clinicaId, nome: s.nome, duracao_minutos: s.dur,
      especialidade_id: especialidadeId, exibir_publico: true, ativo: true,
    }).select("id").single();
    ok(`serviço ${s.nome}`, error);
    servIds.push({ id: data.id, valor: s.valor });
  }
  const { data: tabela, error: eTab } = await db.from("tabela_preco").insert({
    clinica_id: clinicaId, nome: "[TESTE] Particular", convenio_id: null, exibir_publico: true, ativo: true,
  }).select("id").single();
  ok("tabela de preço '[TESTE] Particular'", eTab);
  for (const s of servIds) {
    await db.from("item_tabela_preco").insert({
      clinica_id: clinicaId, tabela_preco_id: tabela.id, servico_id: s.id, tipo_valor: "fixo", valor: s.valor,
    });
  }
  for (const pid of profIds) for (const s of servIds) {
    await db.from("profissional_servico").insert({
      clinica_id: clinicaId, profissional_id: pid, servico_id: s.id, tipo_comissao: "percentual", valor_comissao: 10,
    });
  }
  console.log("  ✓ preços particulares (R$150/220/180) + vínculos profissional↔serviço");

  // 6) pacientes globais [TESTE] + vínculo. O 1º é o login paciente@.
  const pacientes = [
    { nome: "[TESTE] Ana Souza", cpf: "10000000001", nasc: "1990-04-12", user: uid["paciente@sigo.local"] },
    { nome: "[TESTE] Bruno Lima", cpf: "10000000002", nasc: "1985-11-03", user: null },
    { nome: "[TESTE] Carla Dias", cpf: "10000000003", nasc: "1998-07-22", user: null },
  ];
  for (const p of pacientes) {
    const { data, error } = await db.from("paciente").insert({
      nome: p.nome, cpf: p.cpf, data_nascimento: p.nasc, ativo: true, user_id: p.user,
    }).select("id").single();
    ok(`paciente ${p.nome}`, error);
    await db.from("paciente_clinica").insert({ clinica_id: clinicaId, paciente_id: data.id, ativo: true });
  }

  // 7) item de estoque + entrada (lote/validade → saldo 20)
  const { data: item, error: eItem } = await db.from("item_estoque").insert({
    clinica_id: clinicaId, descricao: "[TESTE] Ampola Vitamina C",
    classificacao: "produto_venda", requer_validade: true, unidade: "un", ativo: true,
  }).select("id").single();
  ok("item de estoque '[TESTE] Ampola Vitamina C'", eItem);
  {
    const { error } = await db.from("movimentacao_estoque").insert({
      clinica_id: clinicaId, item_id: item.id, tipo: "entrada",
      quantidade: 20, lote: "LOTE-TESTE-001", validade: "2027-12-31",
    });
    ok("entrada de estoque (20 un, LOTE-TESTE-001, val. 2027-12-31)", error);
  }

  // 8) formulário de anamnese
  const perguntas = [
    { id: randomUUID(), texto: "Possui alguma alergia?", tipo: "sim_nao", opcoes: [], obrigatoria: true },
    { id: randomUUID(), texto: "Faz uso de medicação contínua? Qual?", tipo: "texto_longo", opcoes: [], obrigatoria: false },
    { id: randomUUID(), texto: "Tipo de pele", tipo: "multipla_escolha", opcoes: ["Oleosa", "Seca", "Mista", "Normal"], obrigatoria: true },
    { id: randomUUID(), texto: "Está gestante?", tipo: "sim_nao", opcoes: [], obrigatoria: true },
  ];
  {
    const { error } = await db.from("formulario_anamnese").insert({
      clinica_id: clinicaId, nome: "[TESTE] Anamnese Estética",
      descricao: "Formulário de teste.", perguntas, ativo: true,
    });
    ok("formulário '[TESTE] Anamnese Estética'", error);
  }

  return { clinicaId };
}

async function main() {
  console.log(`Alvo: ${URL}`);
  await teardown();
  if (process.argv.includes("--teardown")) {
    console.log("\n✔ Limpeza concluída. Nenhum dado de teste restante.");
    return;
  }
  const { clinicaId } = await seed();
  console.log("\n========================================================");
  console.log("✔ SEED DE TESTE CRIADO (rastreável)");
  console.log("--------------------------------------------------------");
  console.log(`Clínica:     ${CLINICA_NOME} (estetica)   slug: ${SLUG}`);
  console.log(`clinica_id:  ${clinicaId}`);
  console.log("Logins (todos @sigo.local):");
  console.log("  proprietario  demo@sigo.local        Demo@1234");
  console.log("  gerente       gerente@sigo.local     Gerente@1234");
  console.log("  recepcionista recep@sigo.local       Recep@1234");
  console.log("  assistente    assistente@sigo.local  Assist@1234");
  console.log("  profissional  profissional@sigo.local Prof@1234   (= Dra. Marina)");
  console.log("  paciente      paciente@sigo.local    Paciente@1234 (= Ana Souza)");
  console.log("Criados: 2 profissionais · 3 serviços (c/ preço) · 3 pacientes ·");
  console.log("         1 item de estoque (20 un) · 1 anamnese");
  console.log("Limpeza: node scripts/seed-teste.mjs --teardown   (ou o .sql)");
  console.log("========================================================");
}
main().catch((e) => { console.error(e); process.exit(1); });
