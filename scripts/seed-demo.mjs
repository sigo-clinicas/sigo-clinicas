// =============================================================================
// SEED DE DEMONSTRAÇÃO — enriquece a "Clínica Bem-Estar" que JÁ EXISTE.
//
//   node scripts/seed-demo.mjs                  → cria/atualiza o cenário de demo
//   node scripts/seed-demo.mjs --resumo         → só imprime o resumo (não escreve)
//   node scripts/seed-demo.mjs --limpar-storage → remove as fotos do Storage
//        (rodar ANTES do seed-teste-cleanup.sql: só a API do Storage apaga o
//         arquivo de fato; deletar storage.objects por SQL deixa o binário órfão)
//
// PRINCÍPIOS (não quebrar nada):
//   • REUSA a clínica existente (lookup por slug). NUNCA cria outra clínica.
//   • IDEMPOTENTE: todo registro tem id determinístico (UUIDv5 de um namespace
//     fixo + clinica_id + chave lógica) ou chave natural. Rodar 2x não duplica.
//   • SÓ dados: nenhum DDL, nenhuma migration, não toca nas 66 especialidades
//     nem nos 4 segmentos (apenas LÊ).
//   • service_role só server-side (lido do .env). Nunca vai ao browser.
//   • COERENTE: vendas→lançamentos→baixas→movimentações e evoluções→baixa de
//     estoque saem das RPCs REAIS do app (vender_orcamento, apurar_comissao,
//     registrar_baixa_lancamento, baixar_insumos_evolucao). Os números batem
//     entre telas porque são gerados pela mesma lógica que a UI usa.
//
// NOTA DE ARQUITETURA — por que dois clients:
//   As RPCs acima checam app.tem_papel(), que lê auth.jwt(). A service_role NÃO
//   tem claim de clínica → as RPCs respondem 'sem_permissao'. Por isso o script
//   também autentica como o proprietário de teste (demo@sigo.local) e usa esse
//   JWT para as RPCs. Dados simples entram via service_role.
//
// ⚠️ NUNCA roda em build/deploy. É manual, sob demanda. Ver scripts/README.md.
// =============================================================================
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────── env ────────────────────────────────────────
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
const env = { ...parseEnv(".env"), ...process.env };
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !SERVICE || !ANON) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY no .env"
  );
  process.exit(1);
}

const SLUG = "clinica-bem-estar";
const PROPRIETARIO = { email: "demo@sigo.local", senha: "Demo@1234" };

const db = createClient(URL_SB, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ────────────────────── id determinístico (UUIDv5) ──────────────────────────
// Namespace fixo do seed de demo. uuid5(NS, chave) → mesmo id em toda execução,
// então o upsert por id é um no-op na 2ª rodada (idempotência real, sem depender
// de heurística de texto).
const NS_DEMO = "9f1d2c3b-4a5e-5f60-8b71-2c3d4e5f6a7b";
function uuid5(chave) {
  const nsBytes = Buffer.from(NS_DEMO.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(Buffer.concat([nsBytes, Buffer.from(chave, "utf8")]))
    .digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // versão 5
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
let CLINICA_ID = null;
const id = (chave) => uuid5(`${CLINICA_ID}:${chave}`); // escopado no tenant

// ───────────────────────────── datas ────────────────────────────────────────
// Tudo relativo ao dia da execução → a agenda sempre "parece usada" na demo.
// Reexecutar atualiza as datas nos MESMOS ids (não duplica).
const TZ = "-03:00"; // America/Sao_Paulo
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);
function dia(offset) {
  const d = new Date(hoje);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const ts = (offset, hora) => `${dia(offset)}T${hora}:00${TZ}`;
const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

// ───────────────────────────── helpers ──────────────────────────────────────
const stats = {};
const conta = (k, n = 1) => (stats[k] = (stats[k] ?? 0) + n);
const avisos = [];

function erro(label, error) {
  if (error) {
    console.error(`✗ ${label}: ${error.message || error}`);
    process.exit(1);
  }
}

/** upsert por id determinístico — a 2ª rodada atualiza a MESMA linha. */
async function porId(tabela, chave, row, label) {
  const rid = id(chave);
  const { error } = await db
    .from(tabela)
    .upsert({ id: rid, clinica_id: CLINICA_ID, ...row }, { onConflict: "id" });
  erro(label ?? `${tabela}/${chave}`, error);
  conta(tabela);
  return rid;
}

/** Linhas que já podem existir do seed-teste (id aleatório): casa por chave
 *  natural, insere se faltar, atualiza se houver. Nunca duplica. */
async function porChaveNatural(tabela, match, row, label) {
  let q = db.from(tabela).select("id");
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { data: achado, error: eSel } = await q.maybeSingle();
  erro(`select ${tabela}`, eSel);
  if (achado) {
    const { error } = await db.from(tabela).update(row).eq("id", achado.id);
    erro(label ?? `update ${tabela}`, error);
    conta(tabela);
    return achado.id;
  }
  const novo = id(`${tabela}:${Object.values(match).join("|")}`);
  const { error } = await db.from(tabela).insert({ id: novo, ...match, ...row });
  erro(label ?? `insert ${tabela}`, error);
  conta(tabela);
  return novo;
}

// PNG sólido gerado em código (sem baixar nada externo) p/ foto antes/depois.
function crc32(buf) {
  let c,
    tabela = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = tabela[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}
function pngSolido(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const linhas = [];
  for (let y = 0; y < h; y++) {
    const linha = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      linha[1 + x * 3] = r;
      linha[2 + x * 3] = g;
      linha[3 + x * 3] = b;
    }
    linhas.push(linha);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(linhas))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ═══════════════════════════════ seed ═══════════════════════════════════════
async function main() {
  console.log(`Alvo: ${URL_SB}`);

  // ── 0) Âncora: a clínica de teste que JÁ existe ────────────────────────────
  const { data: clinica, error: eClin } = await db
    .from("clinica")
    .select("id,nome,slug")
    .eq("slug", SLUG)
    .maybeSingle();
  erro("lookup da clínica", eClin);
  if (!clinica) {
    console.error(
      `✗ Clínica '${SLUG}' não existe. Este script ENRIQUECE a clínica de teste;\n` +
        `  crie a base antes com:  node scripts/seed-teste.mjs`
    );
    process.exit(1);
  }
  CLINICA_ID = clinica.id;
  console.log(`Clínica: ${clinica.nome}\nclinica_id: ${CLINICA_ID}\n`);

  if (process.argv.includes("--resumo")) return resumo();
  if (process.argv.includes("--limpar-storage")) return limparStorage();

  // ── 0.1) Sessão de proprietário para as RPCs (service_role não passa no
  //         app.tem_papel). Garante a senha conhecida antes de logar. ────────
  const { data: usuarios } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const dono = usuarios.users.find((u) => u.email === PROPRIETARIO.email);
  if (!dono) {
    console.error(
      `✗ Usuário ${PROPRIETARIO.email} não existe. Rode antes: node scripts/seed-teste.mjs`
    );
    process.exit(1);
  }
  await db.auth.admin.updateUserById(dono.id, { password: PROPRIETARIO.senha });
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { data: sessao, error: eLogin } = await anon.auth.signInWithPassword({
    email: PROPRIETARIO.email,
    password: PROPRIETARIO.senha,
  });
  erro(`login ${PROPRIETARIO.email}`, eLogin);
  const rpc = createClient(URL_SB, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sessao.session.access_token}` } },
  });
  console.log("  ✓ sessão de proprietário obtida (RPCs habilitadas)");

  // ── 1) Clínica: perfil público completo ───────────────────────────────────
  {
    const { error } = await db
      .from("clinica")
      .update({
        exibir_marketplace: true,
        ativo: true,
        telefone: "(11) 4002-8922",
        email: "contato@sigo.local",
        bairro: "Jardins",
        logradouro: "Alameda Santos",
        numero: "1200",
        cep: "01418-100",
        sobre:
          "Clínica de TESTE para demonstração. Estética avançada em São Paulo: " +
          "protocolos faciais e corporais, toxina botulínica, preenchimentos e " +
          "cuidados com a pele. (Dados fictícios — remover antes do lançamento.)",
        // S2 — formas de pagamento (vitrine pública) e fotos do carrossel.
        formas_pagamento: ["pix", "dinheiro", "cartao_credito", "cartao_debito", "convenio"],
      })
      .eq("id", CLINICA_ID);
    erro("perfil da clínica", error);
    console.log("  ✓ perfil público da clínica atualizado");
  }

  // ── 1.1) Carrossel de fotos (Storage bucket 'logos', PÚBLICO) ──────────────
  {
    const CORES = [
      [0, 169, 176], [30, 135, 240], [16, 185, 129],
    ];
    const fotos = [];
    for (let i = 0; i < CORES.length; i++) {
      const path = `${CLINICA_ID}/demo/foto-${i + 1}.png`;
      const { error } = await db.storage
        .from("logos")
        .upload(path, pngSolido(640, 420, CORES[i]), { contentType: "image/png", upsert: true });
      if (error) { avisos.push(`upload ${path}: ${error.message}`); continue; }
      fotos.push(path);
    }
    if (fotos.length > 0) {
      const { error } = await db.from("clinica").update({ fotos }).eq("id", CLINICA_ID);
      erro("fotos do carrossel", error);
      console.log(`  ✓ ${fotos.length} fotos no carrossel (bucket público 'logos')`);
    }
  }

  // ── 1.2) Horário de funcionamento (S5, tabela clinica_horario; dia 0-6=dom-sáb)
  {
    const HORARIOS = [
      { dia_semana: 1, abertura: "09:00", fechamento: "18:00" },
      { dia_semana: 2, abertura: "09:00", fechamento: "18:00" },
      { dia_semana: 3, abertura: "09:00", fechamento: "18:00" },
      { dia_semana: 4, abertura: "09:00", fechamento: "18:00" },
      { dia_semana: 5, abertura: "09:00", fechamento: "17:00" },
      { dia_semana: 6, abertura: "09:00", fechamento: "13:00" },
      // domingo (0) ausente = fechado
    ];
    await db.from("clinica_horario").delete().eq("clinica_id", CLINICA_ID);
    const { error } = await db
      .from("clinica_horario")
      .insert(HORARIOS.map((h) => ({ clinica_id: CLINICA_ID, ...h })));
    erro("horário de funcionamento", error);
    console.log("  ✓ horário de funcionamento (seg-sáb)");
  }

  // Especialidades do marketplace (LÊ as 66; NÃO altera). Sem estas linhas o
  // filtro por especialidade em /buscar não retorna a clínica.
  const { data: espSegmento } = await db
    .from("especialidade")
    .select("id,nome,segmento!inner(nome)")
    .ilike("segmento.nome", "%stétic%");
  const ESP = (espSegmento ?? []).map((e) => e.id);
  const ESP_GERAL =
    espSegmento?.find((e) => e.nome.includes("Estética em geral"))?.id ?? ESP[0];
  for (const eid of ESP) {
    const { error } = await db
      .from("clinica_especialidade")
      .upsert(
        { id: id(`ce:${eid}`), clinica_id: CLINICA_ID, especialidade_id: eid },
        { onConflict: "clinica_id,especialidade_id" }
      );
    erro("clinica_especialidade", error);
    conta("clinica_especialidade");
  }
  console.log(`  ✓ ${ESP.length} especialidade(s) vinculadas (busca do marketplace)`);

  // Destaque no marketplace
  {
    const { error } = await db.from("clinica_destaque").upsert(
      {
        clinica_id: CLINICA_ID, nivel: "premium", score_manual: 80,
        ativo: true, vigencia_inicio: dia(-30), vigencia_fim: dia(180),
      },
      { onConflict: "clinica_id" }
    );
    erro("clinica_destaque", error);
    conta("clinica_destaque");
  }

  // ── 2) Profissionais ──────────────────────────────────────────────────────
  const PROFS = [
    { k: "marina", nome: "Dra. Marina Alves", cor: "#6366f1",
      conselho: "CRBM", reg: "12345-SP", ini: "09:00", fim: "18:00" },
    { k: "rafael", nome: "Dr. Rafael Costa", cor: "#10b981",
      conselho: "CRM", reg: "98765-SP", ini: "08:00", fim: "17:00" },
    { k: "juliana", nome: "Dra. Juliana Prado", cor: "#f59e0b",
      conselho: "CRBM", reg: "55512-SP", ini: "10:00", fim: "19:00" },
  ];
  const P = {};
  for (const p of PROFS) {
    P[p.k] = await porChaveNatural(
      "profissional",
      { clinica_id: CLINICA_ID, nome: p.nome },
      {
        ativo: true, cor: p.cor, nome_conselho: p.conselho, numero_registro: p.reg,
        horario_inicio: p.ini, horario_fim: p.fim, dias_atendimento: [1, 2, 3, 4, 5],
        telefone: "(11) 99999-0000",
        email: `${p.k}@sigo.local`,
      },
      `profissional ${p.nome}`
    );
    if (ESP_GERAL) {
      await db.from("profissional_especialidade").upsert(
        { id: id(`pe:${p.k}`), clinica_id: CLINICA_ID, profissional_id: P[p.k], especialidade_id: ESP_GERAL },
        { onConflict: "profissional_id,especialidade_id" }
      );
    }
  }
  // Intervalo de almoço (agenda "usada")
  for (const p of PROFS) {
    for (const d of [1, 2, 3, 4, 5]) {
      await db.from("profissional_intervalo").upsert(
        {
          id: id(`int:${p.k}:${d}`), clinica_id: CLINICA_ID, profissional_id: P[p.k],
          tipo: "fixo", motivo: "Almoço", dia_semana: d,
          hora_inicio: "12:00", hora_fim: "13:00",
        },
        { onConflict: "id" }
      );
    }
  }
  console.log(`  ✓ ${PROFS.length} profissionais (+ especialidade + intervalo de almoço)`);

  // ── 3) Serviços + preços ──────────────────────────────────────────────────
  const SERVS = [
    { k: "limpeza", nome: "Limpeza de Pele", dur: 60, valor: 150 },
    { k: "peeling", nome: "Peeling Químico", dur: 45, valor: 220 },
    { k: "massagem", nome: "Massagem Modeladora", dur: 50, valor: 180 },
    { k: "botox", nome: "Toxina Botulínica (Botox)", dur: 40, valor: 890 },
    { k: "preenchimento", nome: "Preenchimento Labial", dur: 45, valor: 1200 },
    { k: "drenagem", nome: "Drenagem Linfática", dur: 60, valor: 130 },
    { k: "microagulhamento", nome: "Microagulhamento", dur: 50, valor: 450 },
  ];
  const S = {};
  for (const s of SERVS) {
    S[s.k] = await porChaveNatural(
      "servico",
      { clinica_id: CLINICA_ID, nome: s.nome },
      {
        duracao_minutos: s.dur, especialidade_id: ESP_GERAL,
        exibir_publico: true, ativo: true,
        descricao: `Procedimento de demonstração — ${s.nome}.`,
      },
      `serviço ${s.nome}`
    );
  }
  // Tabela particular
  const TAB_PART = await porChaveNatural(
    "tabela_preco",
    { clinica_id: CLINICA_ID, nome: "Particular" },
    { convenio_id: null, exibir_publico: true, ativo: true },
    "tabela Particular"
  );
  for (const s of SERVS) {
    const { error } = await db.from("item_tabela_preco").upsert(
      {
        id: id(`itp:part:${s.k}`), clinica_id: CLINICA_ID, tabela_preco_id: TAB_PART,
        servico_id: S[s.k], tipo_valor: "fixo", valor: s.valor, ativo: true,
      },
      { onConflict: "tabela_preco_id,servico_id" }
    );
    erro(`preço particular ${s.k}`, error);
    conta("item_tabela_preco");
  }
  // profissional ↔ serviço (+ comissão 10%)
  for (const p of PROFS)
    for (const s of SERVS) {
      await db.from("profissional_servico").upsert(
        {
          id: id(`ps:${p.k}:${s.k}`), clinica_id: CLINICA_ID, profissional_id: P[p.k],
          servico_id: S[s.k], tipo_comissao: "percentual", valor_comissao: 10,
        },
        { onConflict: "profissional_id,servico_id" }
      );
    }
  console.log(`  ✓ ${SERVS.length} serviços públicos + preços + vínculos`);

  // ── 4) Convênios + tabelas de preço ───────────────────────────────────────
  const CONVS = [
    { k: "unimed", nome: "Unimed Demo", cod: "UNI-001", prazo: 30, fator: 0.7 },
    { k: "bradesco", nome: "Bradesco Saúde Demo", cod: "BRA-002", prazo: 45, fator: 0.65 },
    { k: "sulamerica", nome: "SulAmérica Demo", cod: "SUL-003", prazo: 60, fator: 0.6 },
  ];
  const CV = {};
  for (const c of CONVS) {
    CV[c.k] = await porChaveNatural(
      "convenio",
      { clinica_id: CLINICA_ID, nome: c.nome },
      {
        codigo: c.cod, tipo: "plano_saude", prazo_pagamento_dias: c.prazo,
        contato: "(11) 3000-0000", ativo: true,
        observacoes: "Convênio fictício de demonstração.",
      },
      `convênio ${c.nome}`
    );
    const tab = await porChaveNatural(
      "tabela_preco",
      { clinica_id: CLINICA_ID, nome: `Tabela ${c.nome}` },
      { convenio_id: CV[c.k], exibir_publico: false, ativo: true },
      `tabela ${c.k}`
    );
    for (const s of SERVS.slice(0, 4)) {
      await db.from("item_tabela_preco").upsert(
        {
          id: id(`itp:${c.k}:${s.k}`), clinica_id: CLINICA_ID, tabela_preco_id: tab,
          servico_id: S[s.k], tipo_valor: "fixo",
          valor: Math.round(s.valor * c.fator * 100) / 100, ativo: true,
        },
        { onConflict: "tabela_preco_id,servico_id" }
      );
      conta("item_tabela_preco");
    }
    for (const p of PROFS) {
      await db.from("profissional_convenio").upsert(
        { id: id(`pc:${p.k}:${c.k}`), clinica_id: CLINICA_ID, profissional_id: P[p.k], convenio_id: CV[c.k] },
        { onConflict: "profissional_id,convenio_id" }
      );
    }
  }
  console.log(`  ✓ ${CONVS.length} convênios + tabelas de preço próprias`);

  // ── 5) Pacientes (12) ─────────────────────────────────────────────────────
  const PACS = [
    { k: "ana", nome: "Ana Souza", cpf: "10000000001", nasc: "1990-04-12", sexo: "feminino", conv: "unimed" },
    { k: "bruno", nome: "Bruno Lima", cpf: "10000000002", nasc: "1985-11-03", sexo: "masculino", conv: null },
    { k: "carla", nome: "Carla Dias", cpf: "10000000003", nasc: "1998-07-22", sexo: "feminino", conv: "bradesco" },
    { k: "daniela", nome: "Daniela Rocha", cpf: "10000000004", nasc: "1992-02-18", sexo: "feminino", conv: null },
    { k: "eduardo", nome: "Eduardo Martins", cpf: "10000000005", nasc: "1979-09-30", sexo: "masculino", conv: "unimed" },
    { k: "fernanda", nome: "Fernanda Vieira", cpf: "10000000006", nasc: "1995-12-05", sexo: "feminino", conv: null },
    { k: "gabriel", nome: "Gabriel Nunes", cpf: "10000000007", nasc: "1988-06-14", sexo: "masculino", conv: "sulamerica" },
    { k: "helena", nome: "Helena Castro", cpf: "10000000008", nasc: "2000-03-27", sexo: "feminino", conv: null },
    { k: "igor", nome: "Igor Ramalho", cpf: "10000000009", nasc: "1983-08-09", sexo: "masculino", conv: null },
    { k: "juliana", nome: "Juliana Freitas", cpf: "10000000010", nasc: "1997-01-21", sexo: "feminino", conv: "bradesco" },
    { k: "lucas", nome: "Lucas Andrade", cpf: "10000000011", nasc: "1991-05-16", sexo: "masculino", conv: null },
    { k: "mariana", nome: "Mariana Teixeira", cpf: "10000000012", nasc: "1986-10-02", sexo: "feminino", conv: "unimed" },
  ];
  const PA = {};
  for (const [i, p] of PACS.entries()) {
    PA[p.k] = await porChaveNatural(
      "paciente",
      { cpf: p.cpf },
      {
        nome: p.nome, data_nascimento: p.nasc, sexo: p.sexo, ativo: true, is_seed_demo: true,
        telefone: `(11) 9${String(80000000 + i * 1111).padStart(8, "0")}`,
        email: `${p.k}.paciente@sigo.local`,
        cidade: "São Paulo", uf: "SP", bairro: ["Jardins", "Pinheiros", "Moema"][i % 3],
        logradouro: "Rua das Demonstrações", numero: String(100 + i),
        cep: "01310-000", termos_aceitos: true,
        contato_emergencia_nome: "Contato Emergência",
        contato_emergencia_telefone: "(11) 90000-0000",
        contato_emergencia_parentesco: "Familiar",
        observacoes: "Paciente fictício de demonstração.",
      },
      `paciente ${p.nome}`
    );
    const { error } = await db.from("paciente_clinica").upsert(
      {
        id: id(`pcl:${p.k}`), clinica_id: CLINICA_ID, paciente_id: PA[p.k], ativo: true,
        origem: p.conv ? "convenio" : "particular",
        convenio_id: p.conv ? CV[p.conv] : null,
        numero_carteirinha: p.conv ? `CART-${p.cpf.slice(-6)}` : null,
      },
      { onConflict: "clinica_id,paciente_id" }
    );
    erro(`vínculo paciente ${p.k}`, error);
    conta("paciente_clinica");
  }
  console.log(`  ✓ ${PACS.length} pacientes (${PACS.filter((p) => p.conv).length} convênio / ${PACS.filter((p) => !p.conv).length} particular)`);

  // ── 6) Estoque (8 itens; 1 propositalmente abaixo do mínimo) ──────────────
  const ITENS = [
    { k: "vitc", desc: "Ampola Vitamina C", cls: "material_consumo", un: "un", ent: 20, min: 5, custo: 18, lote: "LOTE-TESTE-001", val: 400 },
    { k: "hialuronico", desc: "Ácido Hialurônico 1ml", cls: "medicamento", un: "un", ent: 15, min: 3, custo: 320, lote: "LOTE-AH-2201", val: 300 },
    { k: "toxina", desc: "Toxina Botulínica 50UI", cls: "medicamento", un: "fr", ent: 10, min: 2, custo: 480, lote: "LOTE-TX-9910", val: 240 },
    { k: "argila", desc: "Máscara de Argila", cls: "material_consumo", un: "un", ent: 30, min: 8, custo: 12, lote: "LOTE-AR-0450", val: 500 },
    { k: "luvas", desc: "Luvas Descartáveis (cx 100)", cls: "descartavel", un: "cx", ent: 40, min: 10, custo: 35, lote: "LOTE-LV-7788", val: 900 },
    { k: "gaze", desc: "Gaze Estéril (pct)", cls: "descartavel", un: "pct", ent: 25, min: 5, custo: 8, lote: "LOTE-GZ-3321", val: 700 },
    { k: "glicolico", desc: "Ácido Glicólico 70%", cls: "material_consumo", un: "fr", ent: 6, min: 10, custo: 95, lote: "LOTE-GL-1102", val: 120 }, // ← saldo baixo
    { k: "serum", desc: "Sérum Reparador", cls: "produto_venda", un: "un", ent: 12, min: 4, custo: 60, lote: "LOTE-SR-6655", val: 365 },
  ];
  const IT = {};
  for (const it of ITENS) {
    IT[it.k] = await porChaveNatural(
      "item_estoque",
      { clinica_id: CLINICA_ID, descricao: it.desc },
      {
        classificacao: it.cls, requer_validade: true, unidade: it.un,
        preco_custo: it.custo, preco_venda: Math.round(it.custo * 2.2 * 100) / 100,
        para_venda: it.cls === "produto_venda", estoque_minimo: it.min,
        fornecedor: "Distribuidora Demo", ativo: true,
        codigo: `DEMO-${it.k.toUpperCase().slice(0, 6)}`,
      },
      `item ${it.desc}`
    );
    const { error } = await db.from("movimentacao_estoque").upsert(
      {
        id: id(`me:ent:${it.k}`), clinica_id: CLINICA_ID, item_id: IT[it.k],
        tipo: "entrada", quantidade: it.ent, preco_unitario: it.custo,
        valor_total: Math.round(it.ent * it.custo * 100) / 100,
        data: dia(-20), fornecedor: "Distribuidora Demo",
        lote: it.lote, validade: dia(it.val),
        observacao: "Entrada de demonstração (nota fictícia).",
      },
      { onConflict: "id" }
    );
    erro(`entrada ${it.k}`, error);
    conta("movimentacao_estoque");
  }
  // Composição: qual insumo cada serviço consome
  const COMP = [
    ["limpeza", "argila", 1], ["peeling", "glicolico", 1], ["botox", "toxina", 1],
    ["preenchimento", "hialuronico", 1], ["microagulhamento", "serum", 1],
    ["massagem", "luvas", 1], ["drenagem", "luvas", 1],
  ];
  for (const [sk, ik, qtd] of COMP) {
    await db.from("composicao_servico").upsert(
      {
        id: id(`comp:${sk}:${ik}`), clinica_id: CLINICA_ID, servico_id: S[sk],
        item_estoque_id: IT[ik], quantidade: qtd,
      },
      { onConflict: "servico_id,item_estoque_id" }
    );
    conta("composicao_servico");
  }
  console.log(`  ✓ ${ITENS.length} itens de estoque c/ entrada (lote+validade) — 'Ácido Glicólico 70%' abaixo do mínimo (alerta)`);

  // ── 7) Agenda — 18 consultas ──────────────────────────────────────────────
  // (offset, hora, paciente, profissional, serviço, status, tipo)
  const AGENDA = [
    // passado → alimentam prontuário/relatórios
    ["c01", -14, "09:00", "ana", "marina", "limpeza", "concluido", "procedimento"],
    ["c02", -10, "10:00", "bruno", "rafael", "botox", "concluido", "procedimento"],
    ["c03", -7, "14:00", "carla", "marina", "peeling", "concluido", "procedimento"],
    ["c04", -6, "11:00", "daniela", "juliana", "drenagem", "cancelado", "procedimento"],
    ["c05", -5, "15:00", "daniela", "juliana", "massagem", "concluido", "procedimento"],
    ["c06", -4, "09:30", "eduardo", "rafael", "microagulhamento", "faltou", "procedimento"],
    ["c07", -3, "16:00", "eduardo", "rafael", "microagulhamento", "concluido", "procedimento"],
    ["c08", -2, "10:30", "fernanda", "marina", "limpeza", "concluido", "procedimento"],
    // hoje → a agenda do dia "parece usada"
    ["c09", 0, "09:00", "gabriel", "marina", "limpeza", "concluido", "procedimento"],
    ["c10", 0, "10:00", "helena", "rafael", "peeling", "concluido", "procedimento"],
    ["c11", 0, "11:00", "igor", "juliana", "drenagem", "em_atendimento", "procedimento"],
    ["c12", 0, "14:00", "juliana", "marina", "botox", "confirmado", "procedimento"],
    ["c13", 0, "16:00", "lucas", "rafael", "massagem", "agendado", "consulta"],
    // futuro
    ["c14", 1, "09:00", "mariana", "juliana", "preenchimento", "confirmado", "procedimento"],
    ["c15", 2, "10:30", "ana", "marina", "peeling", "agendado", "retorno"],
    ["c16", 3, "15:00", "carla", "rafael", "microagulhamento", "agendado", "procedimento"],
    ["c17", 5, "11:00", "bruno", "marina", "limpeza", "confirmado", "retorno"],
    ["c18", 7, "14:30", "fernanda", "juliana", "drenagem", "agendado", "procedimento"],
  ];
  const C = {};
  for (const [k, off, hora, pk, prk, sk, status, tipo] of AGENDA) {
    const pac = PACS.find((p) => p.k === pk);
    const serv = SERVS.find((s) => s.k === sk);
    C[k] = await porId(
      "consulta",
      k,
      {
        paciente_id: PA[pk], profissional_id: P[prk], data_hora: ts(off, hora),
        duracao_minutos: serv.dur, tipo, status,
        valor: serv.valor,
        convenio_id: pac.conv ? CV[pac.conv] : null,
        forma_pagamento: pac.conv ? "convenio" : "pix",
        numero_guia: pac.conv ? `GUIA-${k.toUpperCase()}-${dia(off).replace(/-/g, "")}` : null,
        motivo_cancelamento: status === "cancelado" ? "Paciente remarcou (demonstração)." : null,
        observacoes: `Agendamento de demonstração (${k}).`,
      },
      `consulta ${k}`
    );
    await db.from("consulta_servico").upsert(
      { id: id(`cs:${k}`), clinica_id: CLINICA_ID, consulta_id: C[k], servico_id: S[sk] },
      { onConflict: "consulta_id,servico_id" }
    );
    conta("consulta_servico");
  }
  console.log(`  ✓ ${AGENDA.length} agendamentos (3 profissionais · status variados · hoje/semana)`);

  // ── 8) Prontuário (5 pacientes) ───────────────────────────────────────────
  const PRONT = [
    { k: "ana", cons: "c01", serv: "limpeza", insumo: "argila", qtd: "1 un", sess: 1 },
    { k: "bruno", cons: "c02", serv: "botox", insumo: "toxina", qtd: "1 fr", sess: 1 },
    { k: "carla", cons: "c03", serv: "peeling", insumo: "glicolico", qtd: "1 fr", sess: 2 },
    { k: "daniela", cons: "c05", serv: "massagem", insumo: "luvas", qtd: "1 cx", sess: 3 },
    { k: "eduardo", cons: "c07", serv: "microagulhamento", insumo: "serum", qtd: "1 un", sess: 1 },
  ];
  for (const pr of PRONT) {
    const linha = AGENDA.find((a) => a[0] === pr.cons);
    const off = linha[1];
    const prof = linha[4];
    await porId(
      "avaliacao_clinica",
      `av:${pr.k}`,
      {
        paciente_id: PA[pr.k], profissional_id: P[prof], data: dia(off),
        queixa_principal: "Paciente relata insatisfação estética e busca melhora do aspecto da pele.",
        historia_doenca_atual: "Quadro estável, sem intercorrências. Sem uso de isotretinoína nos últimos 6 meses.",
        historico_familiar: "Sem histórico relevante para o procedimento.",
        revisao_sistemas: "Sem alterações sistêmicas dignas de nota.",
        pressao_arterial: "120/80 mmHg", frequencia_cardiaca: "72 bpm",
        peso: 68.5, altura: 1.68,
        exame_especifico: "Pele fototipo III, sem lesões ativas. Hidratação preservada.",
        resultados_exames: "Exames laboratoriais dentro da normalidade.",
        hipotese_diagnostica: "Envelhecimento cutâneo leve / demanda estética.",
        plano_terapeutico: "Protocolo em sessões seriadas conforme orçamento aprovado.",
      },
      `avaliação ${pr.k}`
    );

    const evoId = await porId(
      "evolucao_sessao",
      `ev:${pr.k}`,
      {
        paciente_id: PA[pr.k], profissional_id: P[prof], consulta_id: C[pr.cons],
        data_hora: ts(off, "17:30"), numero_sessao: pr.sess,
        descricao_atendimento:
          "Procedimento realizado conforme protocolo. Assepsia prévia, aplicação em " +
          "áreas demarcadas e finalização com fotoproteção.",
        reacao_paciente: "Boa tolerância, sem dor significativa (EVA 2/10).",
        intercorrencias: "Sem intercorrências.",
        orientacoes_pos:
          "Evitar exposição solar por 72h; usar FPS 50 a cada 3h; não manipular a área; " +
          "retorno em 30 dias.",
        prescricao:
          "RECEITUÁRIO\n1) Protetor solar FPS 50 — aplicar a cada 3 horas.\n" +
          "2) Sérum reparador — 2x/dia por 15 dias.\n3) Hidratante facial — uso contínuo.\n" +
          "(Documento fictício de demonstração.)",
        proxima_sessao_sugerida: dia(off + 30),
        descricao_origem: "manual",
      },
      `evolução ${pr.k}`
    );

    // insumo do prontuário → vira baixa REAL de estoque via RPC
    const { error: eIns } = await db.from("evolucao_insumo").upsert(
      {
        id: id(`evi:${pr.k}`), clinica_id: CLINICA_ID, evolucao_id: evoId,
        item_estoque_id: IT[pr.insumo], produto_nome: ITENS.find((i) => i.k === pr.insumo).desc,
        fabricante: "Fabricante Demo",
        lote: ITENS.find((i) => i.k === pr.insumo).lote,
        validade: dia(ITENS.find((i) => i.k === pr.insumo).val),
        quantidade: pr.qtd,
      },
      { onConflict: "id" }
    );
    erro(`insumo ${pr.k}`, eIns);
    conta("evolucao_insumo");

    // TCLE assinado
    await porId(
      "documento_consentimento",
      `doc:${pr.k}`,
      {
        paciente_id: PA[pr.k], profissional_id: P[prof], tipo: "tcle",
        titulo: "Termo de Consentimento Livre e Esclarecido",
        conteudo:
          "Declaro ter sido esclarecido(a) sobre o procedimento, riscos, benefícios e " +
          "alternativas, e consinto com sua realização. (Documento fictício.)",
        status: "assinado", data_assinatura: ts(off, "08:45"), versao: "1.0",
      },
      `TCLE ${pr.k}`
    );
    await porId(
      "consentimento_evento",
      `cev:${pr.k}`,
      { paciente_id: PA[pr.k], tipo: "concessao", origem: "staff", detalhe: "Aceite de TCLE na recepção (demo)." },
      `consentimento ${pr.k}`
    );
  }
  // Atestado (1)
  await porId(
    "documento_consentimento",
    "doc:atestado:ana",
    {
      paciente_id: PA["ana"], profissional_id: P["marina"], tipo: "atestado",
      titulo: "Atestado de Comparecimento",
      conteudo: "Atesto, para os devidos fins, o comparecimento da paciente. (Fictício.)",
      status: "assinado", data_assinatura: ts(-14, "10:15"), versao: "1.0",
    },
    "atestado"
  );

  // Baixa dos insumos → movimentacao_estoque 'saida' (RPC real, idempotente:
  // só processa insumo sem movimentacao_estoque_id)
  let baixados = 0;
  for (const pr of PRONT) {
    const { data, error } = await rpc.rpc("baixar_insumos_evolucao", {
      p_evolucao_id: id(`ev:${pr.k}`),
    });
    if (error) {
      avisos.push(`baixa de insumo (${pr.k}): ${error.message}`);
    } else baixados += data ?? 0;
  }
  console.log(`  ✓ prontuário de ${PRONT.length} pacientes (avaliação + evolução + receituário + TCLE) · ${baixados} insumo(s) baixados do estoque`);

  // Anamneses respondidas
  const { data: form } = await db
    .from("formulario_anamnese")
    .select("id,perguntas")
    .eq("clinica_id", CLINICA_ID)
    .eq("nome", "Anamnese Estética")
    .maybeSingle();
  if (form) {
    const perg = form.perguntas ?? [];
    const resp = (idx) => {
      const r = {};
      for (const [i, p] of perg.entries()) {
        r[p.id] =
          p.tipo === "sim_nao" ? (i + idx) % 2 === 0 ? "nao" : "sim"
          : p.tipo === "multipla_escolha" ? p.opcoes?.[idx % (p.opcoes.length || 1)] ?? ""
          : "Resposta de demonstração preenchida pelo paciente.";
      }
      return r;
    };
    for (const [i, pk] of ["ana", "bruno", "carla", "daniela", "eduardo"].entries()) {
      await porId(
        "resposta_anamnese",
        `ra:${pk}`,
        {
          paciente_id: PA[pk], formulario_id: form.id, respostas: resp(i),
          status: "preenchido", token: uuid5(`token:${CLINICA_ID}:${pk}`),
          data_preenchimento: ts(-15 + i, "19:00"), expira_em: ts(30, "23:59"),
        },
        `anamnese ${pk}`
      );
    }
    // 1 pendente (para demonstrar o link público de anamnese)
    await porId(
      "resposta_anamnese",
      "ra:pendente:mariana",
      {
        paciente_id: PA["mariana"], formulario_id: form.id, respostas: {},
        status: "pendente", token: uuid5(`token:${CLINICA_ID}:mariana`),
        expira_em: ts(15, "23:59"),
      },
      "anamnese pendente"
    );
    console.log(`  ✓ 5 anamneses respondidas + 1 pendente (link público)`);
  } else avisos.push("formulário 'Anamnese Estética' não encontrado — anamneses puladas");

  // Fotos antes/depois (Storage bucket 'prontuario', privado)
  const FOTOS = [
    { k: "antes", cat: "antes", cor: [203, 213, 225], off: -14 },
    { k: "depois", cat: "depois", cor: [167, 243, 208], off: -1 },
  ];
  const paths = [];
  for (const f of FOTOS) {
    const path = `${CLINICA_ID}/demo/ana-${f.k}.png`;
    const { error } = await db.storage
      .from("prontuario")
      .upload(path, pngSolido(320, 320, f.cor), { contentType: "image/png", upsert: true });
    if (error) {
      avisos.push(`upload ${path}: ${error.message}`);
      continue;
    }
    paths.push(path);
    await porId(
      "galeria_foto",
      `gf:${f.k}`,
      {
        paciente_id: PA["ana"], profissional_id: P["marina"], path, categoria: f.cat,
        origem: "evolucao", data: dia(f.off),
        descricao: `Registro ${f.cat} — placeholder de demonstração.`,
      },
      `galeria ${f.k}`
    );
  }
  if (paths.length)
    console.log(`  ✓ ${paths.length} fotos antes/depois no Storage (bucket 'prontuario', prefixo ${CLINICA_ID}/demo/)`);

  // ── 9) Financeiro: contas, categorias, centros de custo ───────────────────
  const CONTAS = [
    { k: "caixa", nome: "Caixa da Recepção", tipo: "caixa", saldo: 500 },
    { k: "cc", nome: "Banco Demo — Conta Corrente", tipo: "conta_corrente", saldo: 10000, banco: "Banco Demo S/A", ag: "0001", num: "12345-6" },
  ];
  const CT = {};
  for (const c of CONTAS)
    CT[c.k] = await porChaveNatural(
      "conta_bancaria",
      { clinica_id: CLINICA_ID, nome: c.nome },
      { tipo: c.tipo, saldo_inicial: c.saldo, banco: c.banco ?? null, agencia: c.ag ?? null, numero_conta: c.num ?? null, ativo: true },
      `conta ${c.nome}`
    );

  const CATS = [
    { k: "rec_serv", nome: "Vendas de Serviços", tipo: "receita" },
    { k: "rec_conv", nome: "Repasse de Convênios", tipo: "receita" },
    { k: "rec_prod", nome: "Venda de Produtos", tipo: "receita" },
    { k: "des_aluguel", nome: "Aluguel", tipo: "despesa" },
    { k: "des_insumos", nome: "Insumos e Materiais", tipo: "despesa" },
    { k: "des_comissao", nome: "Comissões", tipo: "despesa" },
    { k: "des_util", nome: "Utilidades", tipo: "despesa" },
    { k: "des_mkt", nome: "Marketing", tipo: "despesa" },
  ];
  const CA = {};
  for (const [i, c] of CATS.entries())
    CA[c.k] = await porChaveNatural(
      "categoria_lancamento",
      { clinica_id: CLINICA_ID, nome: c.nome, tipo: c.tipo },
      { ativo: true, ordem: i + 1, descricao: "Categoria de demonstração." },
      `categoria ${c.nome}`
    );

  const CCS = [
    { k: "facial", nome: "Estética Facial", cor: "#6366f1" },
    { k: "corporal", nome: "Estética Corporal", cor: "#10b981" },
    { k: "admin", nome: "Administrativo", cor: "#94a3b8" },
  ];
  const CC = {};
  for (const c of CCS)
    CC[c.k] = await porChaveNatural(
      "centro_custo",
      { clinica_id: CLINICA_ID, nome: c.nome },
      { cor: c.cor, ativo: true, descricao: "Centro de custo de demonstração." },
      `centro de custo ${c.nome}`
    );
  console.log(`  ✓ ${CONTAS.length} contas bancárias · ${CATS.length} categorias · ${CCS.length} centros de custo`);

  // ── 10) Orçamentos (kanban) ───────────────────────────────────────────────
  // status: rascunho | enviado | aprovado | recusado | expirado
  const ORCS = [
    { k: "o01", pac: "ana", prof: "marina", status: "aprovado", vender: true,
      itens: [["botox", 1, 890], ["limpeza", 1, 150]], tipo_desc: "percentual", desc: 5, off: -12 },
    { k: "o02", pac: "bruno", prof: "rafael", status: "aprovado", vender: true,
      itens: [["preenchimento", 1, 1200]], tipo_desc: null, desc: 0, off: -9 },
    { k: "o03", pac: "carla", prof: "marina", status: "rascunho", vender: false,
      itens: [["peeling", 3, 220]], tipo_desc: null, desc: 0, off: -2 },
    { k: "o04", pac: "daniela", prof: "juliana", status: "rascunho", vender: false,
      itens: [["massagem", 10, 180]], tipo_desc: "percentual", desc: 10, off: -1 },
    { k: "o05", pac: "eduardo", prof: "rafael", status: "enviado", vender: false,
      itens: [["microagulhamento", 4, 450]], tipo_desc: "valor", desc: 200, off: -5 },
    { k: "o06", pac: "fernanda", prof: "marina", status: "enviado", vender: false,
      itens: [["limpeza", 6, 150]], tipo_desc: null, desc: 0, off: -3 },
    { k: "o07", pac: "gabriel", prof: "juliana", status: "aprovado", vender: false,
      itens: [["drenagem", 8, 130]], tipo_desc: "percentual", desc: 8, off: -4 },
    { k: "o08", pac: "helena", prof: "rafael", status: "recusado", vender: false,
      itens: [["botox", 2, 890]], tipo_desc: null, desc: 0, off: -8 },
    { k: "o09", pac: "igor", prof: "marina", status: "recusado", vender: false,
      itens: [["preenchimento", 1, 1200], ["peeling", 1, 220]], tipo_desc: null, desc: 0, off: -11 },
    { k: "o10", pac: "juliana", prof: "juliana", status: "expirado", vender: false,
      itens: [["microagulhamento", 2, 450]], tipo_desc: null, desc: 0, off: -45 },
  ];
  const O = {};
  for (const o of ORCS) {
    const total = o.itens.reduce((s, [, q, v]) => s + q * v, 0);
    const valorDesc =
      o.tipo_desc === "percentual" ? Math.round(total * (o.desc / 100) * 100) / 100
      : o.tipo_desc === "valor" ? o.desc : 0;
    const final = Math.round((total - valorDesc) * 100) / 100;
    O[o.k] = await porId(
      "orcamento",
      o.k,
      {
        paciente_id: PA[o.pac], profissional_id: P[o.prof], tabela_preco_id: TAB_PART,
        status: o.status, validade_dias: 30, valor_total: total,
        // tipo_desconto é NOT NULL → 'percentual' com desconto 0 = sem desconto
        tipo_desconto: o.tipo_desc ?? "percentual",
        desconto: o.tipo_desc ? o.desc : 0,
        valor_final: final,
        cliente_nome: PACS.find((p) => p.k === o.pac).nome,
        observacoes: "Orçamento de demonstração.",
        anotacoes_internas: `Card de kanban (${o.status}).`,
      },
      `orçamento ${o.k}`
    );
    for (const [sk, q, v] of o.itens) {
      await db.from("item_orcamento").upsert(
        {
          id: id(`io:${o.k}:${sk}`), clinica_id: CLINICA_ID, orcamento_id: O[o.k],
          servico_id: S[sk], quantidade: q, valor_unitario: v,
          valor_total: Math.round(q * v * 100) / 100, tipo_valor: "fixo",
          sessoes_realizadas: o.status === "aprovado" ? 1 : 0,
        },
        { onConflict: "id" }
      );
      conta("item_orcamento");
    }
    o._final = final;
  }
  console.log(`  ✓ ${ORCS.length} orçamentos no kanban (rascunho 2 · enviado 2 · aprovado 3 · recusado 2 · expirado 1)`);

  // ── 11) Vendas (RPC real: gera venda + lançamentos + parcelas) ────────────
  const PARCELAS = {
    o01: (f) => [
      { numero: 1, valor: Math.round((f / 2) * 100) / 100, vencimento: dia(-12) },
      { numero: 2, valor: Math.round((f - Math.round((f / 2) * 100) / 100) * 100) / 100, vencimento: dia(18) },
    ],
    o02: (f) => {
      const p = Math.round((f / 3) * 100) / 100;
      return [
        { numero: 1, valor: p, vencimento: dia(-9) },
        { numero: 2, valor: p, vencimento: dia(21) },
        { numero: 3, valor: Math.round((f - 2 * p) * 100) / 100, vencimento: dia(51) },
      ];
    },
  };
  const vendasFeitas = [];
  for (const o of ORCS.filter((x) => x.vender)) {
    const { data: jaVendido } = await db
      .from("venda").select("id").eq("orcamento_id", O[o.k]).maybeSingle();
    if (jaVendido) {
      vendasFeitas.push(jaVendido.id);
      continue; // idempotente: venda.orcamento_id é UNIQUE
    }
    const { data: vid, error } = await rpc.rpc("vender_orcamento", {
      p_clinica_id: CLINICA_ID, p_orcamento_id: O[o.k],
      p_forma_pagamento: o.k === "o01" ? "cartao_credito" : "pix",
      p_data_venda: dia(o.off), p_parcelas: PARCELAS[o.k](o._final),
    });
    if (error) {
      avisos.push(`venda ${o.k}: ${error.message}`);
      continue;
    }
    vendasFeitas.push(vid);
    conta("venda");
    conta("lancamento_financeiro", PARCELAS[o.k](o._final).length);
    conta("pagamento", PARCELAS[o.k](o._final).length);
  }
  console.log(`  ✓ ${vendasFeitas.length} vendas geradas via RPC vender_orcamento (→ lançamentos + parcelas)`);

  // ── 12) Despesas ─────────────────────────────────────────────────
  // ATENÇÃO: quem recebe baixa NÃO tem 'status' no upsert — a RPC é a dona do
  // status/valor_pago. Reexecutar não reverte a baixa.
  const DESP = [
    { k: "d01", desc: "Aluguel da unidade", valor: 3500, venc: -10, cat: "des_aluguel", cc: "admin", baixar: true, conta: "cc", forma: "transferencia" },
    { k: "d02", desc: "Energia elétrica", valor: 680.45, venc: -8, cat: "des_util", cc: "admin", baixar: true, conta: "cc", forma: "boleto" },
    { k: "d03", desc: "Compra de insumos — Distribuidora Demo", valor: 1250, venc: -12, cat: "des_insumos", cc: "facial", baixar: true, conta: "cc", forma: "pix" },
    { k: "d04", desc: "Campanha de mídia paga", valor: 900, venc: 5, cat: "des_mkt", cc: "admin", baixar: false, status: "pendente" },
    { k: "d05", desc: "Internet e telefonia", valor: 220, venc: 10, cat: "des_util", cc: "admin", baixar: false, status: "pendente" },
    { k: "d06", desc: "Material de limpeza", valor: 180.9, venc: -3, cat: "des_insumos", cc: "corporal", baixar: false, status: "atrasado" },
  ];
  for (const d of DESP) {
    const row = {
      tipo: "despesa", descricao: d.desc, valor: d.valor, data_vencimento: dia(d.venc),
      categoria_id: CA[d.cat], centro_custo_id: CC[d.cc],
      observacoes: "Despesa fictícia de demonstração.",
    };
    if (!d.baixar) row.status = d.status; // só quem não recebe baixa tem status fixo
    await porId("lancamento_financeiro", `lanc:${d.k}`, row, `despesa ${d.k}`);
  }
  // Receita avulsa de produto (venda de balcão)
  await porId(
    "lancamento_financeiro",
    "lanc:r01",
    {
      tipo: "receita", descricao: "Venda de produto — Sérum Reparador",
      valor: 132, data_vencimento: dia(-6), categoria_id: CA["rec_prod"],
      centro_custo_id: CC["facial"], forma_pagamento: "dinheiro",
      observacoes: "Receita fictícia de demonstração.",
    },
    "receita avulsa"
  );

  // ── 13) Baixas (RPC real → movimentacao_conta + conciliação) ─────────────
  async function baixar(lancId, contaK, valor, dataOff, forma, obs) {
    const { data: l } = await db
      .from("lancamento_financeiro").select("valor,valor_pago").eq("id", lancId).maybeSingle();
    if (!l) return false;
    if (Number(l.valor_pago) > 0) return false; // já baixado → idempotente
    const { error } = await rpc.rpc("registrar_baixa_lancamento", {
      p_clinica_id: CLINICA_ID, p_lancamento_id: lancId, p_conta_id: CT[contaK],
      p_valor: valor ?? Number(l.valor), p_data: dia(dataOff), p_forma: forma, p_obs: obs,
    });
    if (error) {
      avisos.push(`baixa ${lancId}: ${error.message}`);
      return false;
    }
    conta("baixa_lancamento");
    conta("movimentacao_conta");
    return true;
  }
  for (const d of DESP.filter((x) => x.baixar))
    await baixar(id(`lanc:${d.k}`), d.conta, null, d.venc, d.forma, "Baixa de demonstração.");
  await baixar(id("lanc:r01"), "caixa", null, -6, "dinheiro", "Recebimento em dinheiro (demo).");

  // 1ª parcela de cada venda recebida
  for (const vid of vendasFeitas) {
    const { data: parc } = await db
      .from("lancamento_financeiro")
      .select("id,valor,valor_pago,data_vencimento")
      .eq("venda_id", vid)
      .order("data_vencimento", { ascending: true })
      .limit(1);
    const p = parc?.[0];
    if (p && Number(p.valor_pago) === 0)
      await baixar(p.id, "cc", Number(p.valor), 0, "pix", "Recebimento da 1ª parcela (demo).");
  }

  // Conciliação: metade das movimentações conciliadas, metade em aberto
  {
    const { data: movs } = await db
      .from("movimentacao_conta").select("id").eq("clinica_id", CLINICA_ID)
      .order("data", { ascending: true });
    const metade = Math.ceil((movs?.length ?? 0) / 2);
    const conciliar = (movs ?? []).slice(0, metade).map((m) => m.id);
    if (conciliar.length) {
      await db.from("movimentacao_conta").update({ conciliada: true }).in("id", conciliar);
      await db.from("movimentacao_conta").update({ conciliada: false })
        .in("id", (movs ?? []).slice(metade).map((m) => m.id));
    }
    console.log(`  ✓ financeiro: ${stats["baixa_lancamento"] ?? 0} baixas · ${movs?.length ?? 0} movimentações (${conciliar.length} conciliadas / ${(movs?.length ?? 0) - conciliar.length} em aberto)`);
  }

  // ── 14) Comissões (RPC real: comissao + lançamento de despesa) ───────────
  let comissoes = 0;
  for (const pk of ["marina", "rafael", "juliana"]) {
    const { count } = await db
      .from("comissao").select("*", { count: "exact", head: true })
      .eq("clinica_id", CLINICA_ID).eq("profissional_id", P[pk]).eq("competencia", competencia);
    if ((count ?? 0) > 0) continue; // já apurado nesta competência → idempotente

    // itens = serviços concluídos do profissional (10% do valor do serviço)
    const { data: feitas } = await db
      .from("consulta").select("id,valor,status,consulta_servico(id)")
      .eq("clinica_id", CLINICA_ID).eq("profissional_id", P[pk]).eq("status", "concluido");
    const itens = [];
    for (const c of feitas ?? [])
      for (const cs of c.consulta_servico ?? [])
        itens.push({
          consulta_id: c.id, consulta_servico_id: cs.id, tipo_comissao: "percentual",
          base_calculo: Number(c.valor ?? 0),
          valor: Math.round(Number(c.valor ?? 0) * 0.1 * 100) / 100,
        });
    if (!itens.length) continue;
    const { error } = await rpc.rpc("apurar_comissao", {
      p_clinica_id: CLINICA_ID, p_profissional_id: P[pk], p_competencia: competencia,
      p_vencimento: dia(10), p_categoria_id: CA["des_comissao"], p_itens: itens,
    });
    if (error) {
      avisos.push(`comissão ${pk}: ${error.message}`);
      continue;
    }
    comissoes += itens.length;
    conta("comissao", itens.length);
    conta("lancamento_financeiro");
  }
  console.log(`  ✓ comissões apuradas via RPC apurar_comissao (competência ${competencia})`);

  // ── 15) Marketing ────────────────────────────────────────────────────────
  const CUPONS = [
    { k: "bemvindo", cod: "BEMVINDO10", tipo: "percentual", v: 10, status: "ativo", ini: -30, fim: 60, usos: 14, d: "10% na primeira sessão" },
    { k: "verao", cod: "VERAO50", tipo: "valor", v: 50, status: "ativo", ini: -10, fim: 45, usos: 6, d: "R$50 off em protocolos corporais" },
    { k: "black", cod: "BLACK20", tipo: "percentual", v: 20, status: "expirado", ini: -120, fim: -60, usos: 31, d: "Campanha encerrada (histórico)" },
  ];
  const CU = {};
  for (const c of CUPONS)
    CU[c.k] = await porChaveNatural(
      "cupom",
      { clinica_id: CLINICA_ID, codigo: c.cod },
      {
        tipo_desconto: c.tipo, valor_desconto: c.v, status: c.status,
        validade_inicio: dia(c.ini), validade_fim: dia(c.fim),
        quantidade_usos: c.usos, descricao: c.d,
        regras_uso: "Não cumulativo. Válido para pagamento à vista. (Fictício.)",
      },
      `cupom ${c.cod}`
    );

  const LEADS = [
    { k: "l1", nome: "Patrícia Gomes", tel: "(11) 98111-0001", origem: "cupom", cupom: "bemvindo", status: "novo" },
    { k: "l2", nome: "Roberto Silva", tel: "(11) 98111-0002", origem: "marketplace", cupom: null, status: "novo" },
    { k: "l3", nome: "Camila Ferraz", tel: "(11) 98111-0003", origem: "cupom", cupom: "verao", status: "publicado" },
    { k: "l4", nome: "Thiago Moreira", tel: "(11) 98111-0004", origem: "lista_vip", cupom: null, status: "novo" },
    { k: "l5", nome: "Aline Barros", tel: "(11) 98111-0005", origem: "marketplace", cupom: null, status: "publicado" },
    { k: "l6", nome: "Marcelo Pinto", tel: "(11) 98111-0006", origem: "cupom", cupom: "bemvindo", status: "novo" },
  ];
  for (const l of LEADS)
    await porId(
      "lead", `lead:${l.k}`,
      { nome: l.nome, telefone: l.tel, origem: l.origem, status: l.status, cupom_id: l.cupom ? CU[l.cupom] : null },
      `lead ${l.nome}`
    );

  const DEPS = [
    { k: "dep1", pac: "ana", prof: "marina", serv: "limpeza", nota: 5, destaque: true,
      txt: "Atendimento impecável! A pele mudou completamente depois do protocolo. Recomendo muito." },
    { k: "dep2", pac: "bruno", prof: "rafael", serv: "botox", nota: 5, destaque: false,
      txt: "Resultado super natural e sem dor. Equipe muito atenciosa do começo ao fim." },
    { k: "dep3", pac: "carla", prof: "marina", serv: "peeling", nota: 4, destaque: false,
      txt: "Ambiente agradável e profissionais excelentes. Voltarei com certeza." },
  ];
  for (const d of DEPS)
    await porId(
      "depoimento", `dep:${d.k}`,
      {
        paciente_id: PA[d.pac], paciente_nome: PACS.find((p) => p.k === d.pac).nome,
        profissional_id: P[d.prof], servico_id: S[d.serv], texto: d.txt, nota: d.nota,
        status: "aprovado", publicar_no_site: true, destaque: d.destaque, origem: "solicitado",
        token_solicitacao: uuid5(`dep-token:${CLINICA_ID}:${d.k}`),
      },
      `depoimento ${d.k}`
    );

  // Campanha com segmentação real (quantidade via RPC campanha_publico_alvo)
  const filtros = {
    demograficos: { idade_minima: 25, idade_maxima: 45, generos: ["feminino"], localizacoes: ["São Paulo"] },
    temporais: {}, status_paciente: {}, compra: {},
  };
  const { data: alvo } = await db.rpc("campanha_publico_alvo", {
    p_clinica_id: CLINICA_ID, p_filtros: filtros,
  });
  await porId(
    "campanha", "camp:1",
    {
      nome: "Reativação — Mulheres 25-45 (SP)", status: "ativa",
      descricao: "Campanha de demonstração com segmentação por idade, gênero e cidade.",
      filtros, canais: ["email", "whatsapp"],
      conteudo: {
        assunto: "Sentimos sua falta! 10% na sua próxima sessão",
        corpo: "Use o cupom BEMVINDO10 e agende seu horário. (Mensagem fictícia.)",
      },
      data_agendado: ts(2, "09:00"), quantidade_destinatarios: alvo ?? 0, quantidade_enviados: 0,
    },
    "campanha"
  );

  const SALA = await porChaveNatural(
    "sala_vip",
    { clinica_id: CLINICA_ID, nome: "Sala VIP — Protocolo Premium" },
    {
      descricao: "Lista exclusiva com condições especiais para procedimentos premium.",
      beneficios: "Prioridade na agenda · 15% em protocolos · Brinde de boas-vindas",
      quantidade_vagas: 20, status: "aprovada", ativa: true,
    },
    "sala VIP"
  );
  const MEMBROS = [
    { k: "m1", nome: "Vanessa Duarte", tel: "(11) 97222-0001", status: "aprovado" },
    { k: "m2", nome: "Rodrigo Alencar", tel: "(11) 97222-0002", status: "contatado" },
    { k: "m3", nome: "Beatriz Nogueira", tel: "(11) 97222-0003", status: "novo" },
  ];
  for (const m of MEMBROS)
    await porId(
      "lead_sala_vip", `vip:${m.k}`,
      {
        sala_vip_id: SALA, nome: m.nome, telefone: m.tel,
        email: `${m.k}.vip@sigo.local`, status: m.status, data_interesse: ts(-5, "12:00"),
      },
      `membro VIP ${m.nome}`
    );
  console.log(`  ✓ marketing: ${CUPONS.length} cupons · ${LEADS.length} leads · ${DEPS.length} depoimentos · 1 campanha (${alvo ?? 0} destinatários) · sala VIP c/ ${MEMBROS.length} membros`);

  await resumo();
  if (avisos.length) {
    console.log("\n⚠ Avisos (não bloqueantes):");
    for (const a of avisos) console.log(`   · ${a}`);
  }
}

// ──────────────────── limpeza do Storage (API, não SQL) ─────────────────────
// Apagar linhas de storage.objects por SQL NÃO remove o arquivo do backend —
// deixa binário órfão. Só a API do Storage apaga os dois. Por isso este passo
// existe e deve rodar ANTES do seed-teste-cleanup.sql.
async function limparStorage() {
  let total = 0;
  for (const bucket of ["prontuario", "documentos", "logos"]) {
    const prefixos = [`${CLINICA_ID}/demo`, `${CLINICA_ID}`];
    for (const prefixo of prefixos) {
      const { data: itens, error } = await db.storage.from(bucket).list(prefixo);
      if (error || !itens?.length) continue;
      const alvos = itens.filter((i) => i.id).map((i) => `${prefixo}/${i.name}`);
      if (!alvos.length) continue;
      const { error: eDel } = await db.storage.from(bucket).remove(alvos);
      if (eDel) {
        console.warn(`   (aviso ${bucket}/${prefixo}: ${eDel.message})`);
        continue;
      }
      total += alvos.length;
      for (const a of alvos) console.log(`  ✓ removido ${bucket}/${a}`);
    }
  }
  console.log(
    total
      ? `\n✔ ${total} arquivo(s) de teste removidos do Storage.`
      : "\n✔ Nenhum arquivo de teste no Storage (nada a fazer)."
  );
}

// ─────────────────────────── resumo por tela ────────────────────────────────
async function resumo() {
  const q = async (tabela, filtro = {}) => {
    let s = db.from(tabela).select("*", { count: "exact", head: true }).eq("clinica_id", CLINICA_ID);
    for (const [k, v] of Object.entries(filtro)) s = s.eq(k, v);
    const { count } = await s;
    return count ?? 0;
  };
  const { data: saldos } = await db
    .from("saldo_item_estoque").select("descricao,saldo_atual,estoque_minimo").eq("clinica_id", CLINICA_ID);
  const baixos = (saldos ?? []).filter((s) => Number(s.saldo_atual) < Number(s.estoque_minimo));
  const { data: contas } = await db
    .from("saldo_conta_bancaria").select("nome,saldo_atual").eq("clinica_id", CLINICA_ID);

  const linhas = [
    ["AGENDA            /painel/agenda", await q("consulta") + " consultas"],
    ["PACIENTES         /painel/pacientes", (await q("paciente_clinica")) + " vínculos"],
    ["PRONTUÁRIO        /painel/prontuarios", `${await q("avaliacao_clinica")} avaliações · ${await q("evolucao_sessao")} evoluções · ${await q("galeria_foto")} fotos`],
    ["ANAMNESE          /painel/anamnese", `${await q("formulario_anamnese")} formulário(s) · ${await q("resposta_anamnese")} respostas`],
    ["ORÇAMENTOS        /painel/orcamentos", `${await q("orcamento")} cards · ${await q("venda")} vendidos`],
    ["FINANCEIRO        /painel/financeiro", `${await q("lancamento_financeiro")} lançamentos · ${await q("baixa_lancamento")} baixas`],
    ["FLUXO DE CAIXA    /painel/financeiro/fluxo-caixa", `${await q("movimentacao_conta")} movimentações`],
    ["CONTAS            /painel/financeiro/contas", (contas ?? []).map((c) => `${c.nome}: R$ ${Number(c.saldo_atual).toFixed(2)}`).join(" · ")],
    ["COMISSÕES         /painel/financeiro/comissoes", (await q("comissao")) + " comissões"],
    ["CONVÊNIOS         /painel/financeiro/convenios", (await q("convenio")) + " convênios"],
    ["ESTOQUE           /painel/estoque", `${await q("item_estoque")} itens · ${await q("movimentacao_estoque")} movimentações · ${baixos.length} abaixo do mínimo`],
    ["SERVIÇOS          /painel/servicos", (await q("servico")) + " serviços"],
    ["PROFISSIONAIS     /painel/profissionais", (await q("profissional")) + " profissionais"],
    ["CUPONS            /painel/marketing/cupons", (await q("cupom")) + " cupons"],
    ["DEPOIMENTOS       /painel/marketing/depoimentos", (await q("depoimento")) + " depoimentos"],
    ["CAMPANHAS         /painel/marketing/campanhas", (await q("campanha")) + " campanha(s)"],
    ["SALA VIP          /painel/marketing/sala-vip", `${await q("sala_vip")} sala(s) · ${await q("lead_sala_vip")} membros`],
    ["RELATÓRIOS        /painel/relatorios", "derivado do encadeamento acima"],
    ["BUSCA PÚBLICA     /buscar?cidade=São Paulo", `${await q("clinica_especialidade")} especialidade(s) vinculadas`],
    ["PÁGINA PÚBLICA    /clinica/teste-clinica-demo", `${await q("servico", { exibir_publico: true })} serviços públicos`],
  ];
  console.log("\n════════════════ RESUMO POR TELA ════════════════");
  for (const [tela, dado] of linhas) console.log(`  ${tela.padEnd(48)} ${dado}`);
  if (baixos.length)
    console.log(`\n  ⚠ alerta de estoque: ${baixos.map((b) => `${b.descricao} (${b.saldo_atual}/${b.estoque_minimo})`).join(", ")}`);
  console.log("═════════════════════════════════════════════════");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
