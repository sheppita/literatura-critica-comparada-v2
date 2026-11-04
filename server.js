import "dotenv/config";
import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const TIPOS_VALIDOS = ["eixo", "disciplina", "tema", "aula"];

const ROTULO_TIPO = {
  eixo: "Eixo",
  disciplina: "Disciplina",
  tema: "Tema",
  aula: "Aula"
};

const ROTULO_NOVO = {
  eixo: "Novo Eixo",
  disciplina: "Nova Disciplina",
  tema: "Novo Tema",
  aula: "Nova Aula"
};

const PROXIMO_NIVEL = {
  eixo: "disciplina",
  disciplina: "tema",
  tema: "aula",
  aula: null
};

const NOME_FILHO_PLURAL = {
  eixo: "disciplinas",
  disciplina: "temas",
  tema: "aulas",
  aula: null
};

const TIPOS_COM_DESCRICAO = ["eixo", "disciplina"];

const ROTULO_TIPO_MATERIAL = {
  livro: "Livro",
  artigo: "Artigo",
  ensaio: "Ensaio",
  revista: "Revista",
  outro: "Outro"
};

const ROTULO_PAPEL = {
  texto_base: "Texto-Base",
  texto_complementar: "Texto Complementar",
  ficcao_ancora: "Ficção-Âncora",
  ficcao_complementar: "Ficção Complementar"
};

const ROTULO_MODALIDADE = {
  integral: "Obra Integral",
  parcial: "Leitura Parcial"
};

const ROTULO_RECORTE_TIPO = {
  capitulo: "Capítulo",
  secao: "Seção",
  ensaio: "Ensaio",
  conto: "Conto",
  poema: "Poema",
  artigo: "Artigo",
  a_conferir: "A Conferir"
};

function aceitaDescricao(tipo) {
  return TIPOS_COM_DESCRICAO.includes(tipo);
}

function rotuloTipoOuOmissao(tipo, codigo) {
  const rotulo = ROTULO_TIPO[tipo] || tipo;
  if (!codigo) return rotulo;
  const codigoUpper = String(codigo).toUpperCase();
  const rotuloUpper = String(rotulo).toUpperCase();
  if (codigoUpper.startsWith(rotuloUpper)) return null;
  return rotulo;
}

async function cadeiaDeSuperiores(id) {
  const cadeia = [];
  let atual = id;
  while (atual) {
    const r = await pool.query(
      "SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1",
      [atual]
    );
    if (r.rows.length === 0) break;
    cadeia.unshift(r.rows[0]);
    atual = r.rows[0].superior_id;
  }
  return cadeia;
}

function nomeArquivoExportacao(prefixo) {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp = agora.getFullYear() + pad(agora.getMonth() + 1) + pad(agora.getDate()) + "-" + pad(agora.getHours()) + pad(agora.getMinutes());
  return `${prefixo}-${timestamp}.json`;
}

// ==========================================
// EMENTA (EIXO, DISCIPLINA, TEMA, AULA)
// ==========================================

app.get("/", async (req, res) => {
  try {
    const r = await pool.query("SELECT id, titulo, codigo FROM unidades WHERE tipo = 'eixo' AND arquivada = false ORDER BY id");
    res.render("inicio", {
      titulo: "Literatura Crítica Comparada",
      subtitulo: "Acervo pessoal de curadoria curricular e bibliográfica",
      eixos: r.rows
    });
  } catch (err) {
    console.error("Erro na página inicial:", err.message);
    res.status(500).type("text/plain").send("Erro ao carregar a página inicial.");
  }
});

app.get("/unidades/nova", async (req, res) => {
  const tipo = String(req.query.tipo || "eixo");
  const superiorId = req.query.superior_id ? Number(req.query.superior_id) : null;

  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).type("text/plain").send("Tipo inválido.");

  let superior = null;
  if (superiorId) {
    const r = await pool.query("SELECT id, tipo, titulo FROM unidades WHERE id = $1", [superiorId]);
    if (r.rows.length === 0) return res.status(404).type("text/plain").send("Unidade superior não encontrada.");
    superior = r.rows[0];
  }

  res.render("unidade-form", {
    titulo: ROTULO_NOVO[tipo], tipo, rotuloTipo: ROTULO_TIPO[tipo], rotuloNovo: ROTULO_NOVO[tipo], superior,
    valores: { titulo: "", codigo: "", descricao: "", pergunta_norteadora: "" }, erros: [], modo: "criar", acao: "/unidades/nova",
    cancelarUrl: superior ? `/unidades/${superior.id}` : "/", aceitaDescricao: aceitaDescricao(tipo)
  });
});

app.post("/unidades/nova", async (req, res) => {
  const tipo = String(req.body.tipo || "").trim();
  const superiorId = req.body.superior_id ? Number(req.body.superior_id) : null;
  const titulo = String(req.body.titulo || "").trim();
  const codigo = req.body.codigo ? String(req.body.codigo).trim() || null : undefined;
  const descricaoRaw = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;

  const descricao = aceitaDescricao(tipo) ? descricaoRaw : null;
  const erros = [];
  
  if (!TIPOS_VALIDOS.includes(tipo)) erros.push("Tipo inválido.");
  if (!titulo) erros.push("O título é obrigatório.");
  if (tipo !== "tema" && pergunta) erros.push("Pergunta norteadora só existe em tema.");
  if (!aceitaDescricao(tipo) && descricaoRaw) erros.push("Este nível não aceita descrição.");
  if (tipo === "eixo" && superiorId) erros.push("Eixo não tem unidade superior.");

  let superior = null;
  if (superiorId) {
    const r = await pool.query("SELECT id, tipo, titulo FROM unidades WHERE id = $1", [superiorId]);
    if (r.rows.length === 0) {
      erros.push("Unidade superior não encontrada.");
    } else {
      superior = r.rows[0];
      const esperado = { disciplina: "eixo", tema: "disciplina", aula: "tema" };
      if (esperado[tipo] && superior.tipo !== esperado[tipo]) {
        erros.push(`Uma ${ROTULO_TIPO[tipo]} deve pertencer a um(a) ${ROTULO_TIPO[esperado[tipo]]}.`);
      }
    }
  } else if (tipo !== "eixo") {
    erros.push(`${ROTULO_TIPO[tipo]} precisa de uma unidade superior.`);
  }

  if (erros.length > 0) {
    return res.status(400).render("unidade-form", {
      titulo: ROTULO_NOVO[tipo] || "Nova Unidade", tipo, rotuloTipo: ROTULO_TIPO[tipo] || "Unidade", rotuloNovo: ROTULO_NOVO[tipo] || "Nova Unidade", superior,
      valores: { titulo, codigo: codigo || "", descricao: descricaoRaw || "", pergunta_norteadora: pergunta || "" }, erros, modo: "criar", acao: "/unidades/nova",
      cancelarUrl: superior ? `/unidades/${superior.id}` : "/", aceitaDescricao: aceitaDescricao(tipo)
    });
  }

  const insertR = await pool.query(
    `INSERT INTO unidades (tipo, titulo, codigo, superior_id, descricao, pergunta_norteadora) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tipo, titulo, codigo, superiorId, descricao, pergunta]
  );

  if (tipo === "aula") {
    await pool.query("INSERT INTO fichas (aula_id, modelo) VALUES ($1, 'novo') ON CONFLICT (aula_id) DO NOTHING", [insertR.rows[0].id]);
  }

  res.redirect(superiorId ? `/unidades/${superiorId}` : "/");
});

app.get("/unidades/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).type("text/plain").send("Id inválido.");

  const r = await pool.query("SELECT id, tipo, titulo, codigo, superior_id, descricao, pergunta_norteadora FROM unidades WHERE id = $1", [id]);
  if (r.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const u = r.rows[0];

  let superior = null;
  if (u.superior_id) {
    const s = await pool.query("SELECT id, tipo, titulo FROM unidades WHERE id = $1", [u.superior_id]);
    if (s.rows.length > 0) superior = s.rows[0];
  }

  res.render("unidade-form", {
    titulo: `Editar ${ROTULO_TIPO[u.tipo]}`, tipo: u.tipo, rotuloTipo: ROTULO_TIPO[u.tipo], rotuloNovo: ROTULO_NOVO[u.tipo], superior,
    valores: { titulo: u.titulo, codigo: u.codigo || "", descricao: u.descricao || "", pergunta_norteadora: u.pergunta_norteadora || "" }, erros: [], modo: "editar",
    acao: `/unidades/${u.id}/editar`, cancelarUrl: `/unidades/${u.id}`, aceitaDescricao: aceitaDescricao(u.tipo)
  });
});

app.post("/unidades/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).type("text/plain").send("Id inválido.");

  const r = await pool.query("SELECT id, tipo, superior_id FROM unidades WHERE id = $1", [id]);
  if (r.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const atual = r.rows[0];

  const titulo = String(req.body.titulo || "").trim();
  const codigo = req.body.codigo ? String(req.body.codigo).trim() || null : undefined;
  const descricaoRaw = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;
  const descricao = aceitaDescricao(atual.tipo) ? descricaoRaw : null;

  const erros = [];
  if (!titulo) erros.push("O título é obrigatório.");
  if (atual.tipo !== "tema" && pergunta) erros.push("Pergunta norteadora só existe em tema.");
  if (!aceitaDescricao(atual.tipo) && descricaoRaw) erros.push("Este nível não aceita descrição.");

  let superior = null;
  if (atual.superior_id) {
    const s = await pool.query("SELECT id, tipo, titulo FROM unidades WHERE id = $1", [atual.superior_id]);
    if (s.rows.length > 0) superior = s.rows[0];
  }

  if (erros.length > 0) {
    return res.status(400).render("unidade-form", {
      titulo: `Editar ${ROTULO_TIPO[atual.tipo]}`, tipo: atual.tipo, rotuloTipo: ROTULO_TIPO[atual.tipo], rotuloNovo: ROTULO_NOVO[atual.tipo], superior,
      valores: { titulo, codigo: codigo || "", descricao: descricaoRaw || "", pergunta_norteadora: pergunta || "" }, erros, modo: "editar",
      acao: `/unidades/${id}/editar`, cancelarUrl: `/unidades/${id}`, aceitaDescricao: aceitaDescricao(atual.tipo)
    });
  }

  await pool.query(
    `UPDATE unidades SET titulo = $1, codigo = $2, descricao = $3, pergunta_norteadora = $4, atualizado_em = now() WHERE id = $5`,
    [titulo, codigo, descricao, pergunta, id]
  );

  res.redirect(`/unidades/${id}`);
});

app.get("/unidades/:id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).type("text/plain").send("Id inválido.");

  const r = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  if (r.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const u = r.rows[0];

  const filhosR = await pool.query("SELECT id, tipo, titulo, codigo FROM unidades WHERE superior_id = $1 AND arquivada = false", [id]);
  
  filhosR.rows.sort((a, b) => {
    function extrairNumeros(titulo) {
      const match = String(titulo).match(/^(\d+(?:\.\d+)*)/);
      if (!match) return [9999];
      return match[1].split('.').map(Number);
    }
    const numsA = extrairNumeros(a.titulo);
    const numsB = extrairNumeros(b.titulo);
    for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
      const numA = numsA[i] || 0;
      const numB = numsB[i] || 0;
      if (numA !== numB) return numA - numB;
    }
    return String(a.titulo).localeCompare(String(b.titulo));
  });

  let superior = null;
  if (u.superior_id) {
    const s = await pool.query("SELECT id, tipo, titulo FROM unidades WHERE id = $1", [u.superior_id]);
    if (s.rows.length > 0) superior = s.rows[0];
  }

  res.render("unidade-excluir", { titulo: `Excluir ${u.titulo}`, unidade: u, filhos: filhosR.rows, superior, rotuloTipo: ROTULO_TIPO[u.tipo] });
});

app.post("/unidades/:id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).type("text/plain").send("Id inválido.");

  const r = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  if (r.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const u = r.rows[0];

  const filhosR = await pool.query("SELECT id FROM unidades WHERE superior_id = $1 AND arquivada = false", [id]);
  if (filhosR.rows.length > 0) {
    return res.status(400).type("text/plain").send(`Esta unidade tem itens dentro. Remova os filhos antes de excluir.`);
  }

  await pool.query("DELETE FROM unidades WHERE id = $1", [id]);
  res.redirect(u.superior_id ? `/unidades/${u.superior_id}` : "/");
});

// ==========================================
// FICHAS DE AULA
// ==========================================

app.get("/unidades/:id/ficha/editar", async (req, res) => {
  const id = Number(req.params.id);
  const ur = await pool.query("SELECT id, tipo, titulo, codigo, superior_id FROM unidades WHERE id = $1", [id]);
  if (ur.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const unidade = ur.rows[0];
  if (unidade.tipo !== "aula") return res.status(400).type("text/plain").send("Só aulas têm ficha.");

  const fr = await pool.query(`SELECT id, conteudo_html, versao_atual, criado_em, atualizado_em, modelo, problema, apresentacao FROM fichas WHERE aula_id = $1`, [id]);
  if (fr.rows.length === 0) return res.status(404).type("text/plain").send("Ficha não encontrada.");
  const ficha = fr.rows[0];
  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  let conflito = req.query.conflito === "1" ? { versaoQueAbri: Number(req.query.versao_que_abri) || 0, versaoAtual: ficha.versao_atual } : null;

  if (ficha.modelo === "novo") {
    return res.render("ficha-editor-novo", {
      titulo: `Editar Ficha — ${unidade.titulo}`, unidade, ficha, cadeia,
      valores: { problema: ficha.problema || "", apresentacao: ficha.apresentacao || "" }, erros: []
    });
  }

  res.render("ficha-editor", { titulo: `Editar Ficha — ${unidade.titulo}`, unidade, ficha, cadeia, valores: { conteudo_html: ficha.conteudo_html || "" }, erros: [], conflito });
});

app.post("/unidades/:id/ficha/editar", async (req, res) => {
  const id = Number(req.params.id);
  const ur = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  if (ur.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const unidade = ur.rows[0];
  if (unidade.tipo !== "aula") return res.status(400).type("text/plain").send("Só aulas têm ficha.");

  const fr = await pool.query(`SELECT id, conteudo_html, versao_atual, modelo, problema, apresentacao FROM fichas WHERE aula_id = $1`, [id]);
  const ficha = fr.rows.length > 0 ? fr.rows[0] : null;
  if (!ficha) return res.status(404).type("text/plain").send("Ficha não encontrada.");

  if (ficha.modelo === "novo") {
    const problema = String(req.body.problema || "").trim();
    const apresentacao = String(req.body.apresentacao || "").trim();
    if (ficha.problema === problema && ficha.apresentacao === apresentacao) return res.redirect(`/unidades/${id}?salvo=0`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updateR = await client.query(
        `UPDATE fichas SET problema = $1, apresentacao = $2, versao_atual = versao_atual + 1, atualizado_em = now() WHERE id = $3 RETURNING versao_atual`,
        [problema, apresentacao, ficha.id]
      );
      const novaVersao = updateR.rows[0].versao_atual;
      const historicoJson = JSON.stringify({ problema, apresentacao });
      await client.query(
        `INSERT INTO fichas_versoes (ficha_id, numero_versao, conteudo_html, motivo, estado_texto, estado_bibliografia) VALUES ($1, $2, $3, $4, 'rascunho', 'pendente')`,
        [ficha.id, novaVersao, historicoJson, "Salvamento Manual"]
      );
      await client.query("COMMIT");
      res.redirect(`/unidades/${id}?salvo=1`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Erro ao salvar ficha:", err.message);
      res.status(500).type("text/plain").send("Erro interno ao salvar.");
    } finally {
      client.release();
    }
    return;
  }

  // Modelo antigo
  const conteudo_html = String(req.body.conteudo_html || "");
  const versaoQueAbri = Number(req.body.versao_que_abri) || 0;
  const forcar = String(req.body.forcar || "") === "1";

  if (!forcar && versaoQueAbri > 0 && versaoQueAbri !== ficha.versao_atual) {
    return res.status(400).render("ficha-editor", { titulo: `Editar Ficha — ${unidade.titulo}`, unidade, ficha, cadeia: await cadeiaDeSuperiores(unidade.superior_id), valores: { conteudo_html }, erros: [], conflito: { versaoQueAbri, versaoAtual: ficha.versao_atual } });
  }
  if (ficha.conteudo_html === conteudo_html) return res.redirect(`/unidades/${id}?salvo=0`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updateR = await client.query(
      `UPDATE fichas SET conteudo_html = $1, versao_atual = versao_atual + 1, atualizado_em = now() WHERE id = $2 AND ($3::boolean = true OR versao_atual = $4) RETURNING versao_atual`,
      [conteudo_html, ficha.id, forcar, ficha.versao_atual]
    );
    if (updateR.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).type("text/plain").send("Conflito de versão.");
    }
    await client.query(
      `INSERT INTO fichas_versoes (ficha_id, numero_versao, conteudo_html, motivo, estado_texto, estado_bibliografia) VALUES ($1, $2, $3, $4, 'rascunho', 'pendente')`,
      [ficha.id, updateR.rows[0].versao_atual, conteudo_html, forcar ? "Salvamento Forçado" : "Salvamento Manual"]
    );
    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro interno.");
  } finally {
    client.release();
  }
});

app.get("/unidades/:id/ficha/versoes", async (req, res) => {
  const id = Number(req.params.id);
  const ur = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  if (ur.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const unidade = ur.rows[0];
  if (unidade.tipo !== "aula") return res.status(400).type("text/plain").send("Só aulas têm ficha.");

  const fr = await pool.query("SELECT id, versao_atual FROM fichas WHERE aula_id = $1", [id]);
  if (fr.rows.length === 0) return res.status(404).type("text/plain").send("Ficha não encontrada.");
  const ficha = fr.rows[0];
  const versoesR = await pool.query(`SELECT id, numero_versao, motivo, criado_em, LENGTH(conteudo_html) AS tamanho FROM fichas_versoes WHERE ficha_id = $1 ORDER BY numero_versao DESC`, [ficha.id]);
  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  res.render("ficha-versoes", { titulo: `Histórico — ${unidade.titulo}`, unidade, ficha, cadeia, versoes: versoesR.rows });
});

app.get("/unidades/:id/ficha/versoes/:numero", async (req, res) => {
  const id = Number(req.params.id);
  const numero = Number(req.params.numero);
  const ur = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  if (ur.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const unidade = ur.rows[0];
  
  const fr = await pool.query("SELECT id, versao_atual FROM fichas WHERE aula_id = $1", [id]);
  const ficha = fr.rows[0];
  const vr = await pool.query(`SELECT id, numero_versao, conteudo_html, motivo, criado_em FROM fichas_versoes WHERE ficha_id = $1 AND numero_versao = $2`, [ficha.id, numero]);
  if (vr.rows.length === 0) return res.status(404).type("text/plain").send("Versão não encontrada.");
  
  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
  res.render("ficha-versao", { titulo: `Versão v${vr.rows[0].numero_versao} — ${unidade.titulo}`, unidade, ficha, cadeia, versao: vr.rows[0] });
});

app.post("/unidades/:id/ficha/versoes/:numero/restaurar", async (req, res) => {
  const id = Number(req.params.id);
  const numero = Number(req.params.numero);
  
  const fr = await pool.query("SELECT id, versao_atual, modelo FROM fichas WHERE aula_id = $1", [id]);
  const ficha = fr.rows[0];
  const vr = await pool.query(`SELECT numero_versao, conteudo_html FROM fichas_versoes WHERE ficha_id = $1 AND numero_versao = $2`, [ficha.id, numero]);
  const versao = vr.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (ficha.modelo === "novo") {
      let dados = { problema: "", apresentacao: "" };
      try { dados = JSON.parse(versao.conteudo_html); } catch (e) {}
      const up = await client.query(`UPDATE fichas SET problema = $1, apresentacao = $2, versao_atual = versao_atual + 1, atualizado_em = now() WHERE id = $3 RETURNING versao_atual`, [dados.problema, dados.apresentacao, ficha.id]);
      await client.query(`INSERT INTO fichas_versoes (ficha_id, numero_versao, conteudo_html, motivo, estado_texto, estado_bibliografia) VALUES ($1, $2, $3, $4, 'rascunho', 'pendente')`, [ficha.id, up.rows[0].versao_atual, versao.conteudo_html, `Restauração da v${numero}`]);
    } else {
      const up = await client.query(`UPDATE fichas SET conteudo_html = $1, versao_atual = versao_atual + 1, atualizado_em = now() WHERE id = $2 RETURNING versao_atual`, [versao.conteudo_html, ficha.id]);
      await client.query(`INSERT INTO fichas_versoes (ficha_id, numero_versao, conteudo_html, motivo, estado_texto, estado_bibliografia) VALUES ($1, $2, $3, $4, 'rascunho', 'pendente')`, [ficha.id, up.rows[0].versao_atual, versao.conteudo_html, `Restauração da v${numero}`]);
    }
    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro ao restaurar.");
  } finally {
    client.release();
  }
});

// ==========================================
// BIBLIOGRAFIA (OBRAS)
// ==========================================

app.get("/obras", async (req, res) => {
  try {
    const busca = String(req.query.q || "").trim();
    const tipoFiltro = String(req.query.tipo || "").trim();
    const avaliacaoFiltro = String(req.query.avaliacao || "").trim();

    const condicoes = [];
    const params = [];

    if (busca) {
      params.push(`%${busca}%`);
      const p = params.length;
      condicoes.push(`(
        o.titulo ILIKE $${p}
        OR o.titulo_original ILIKE $${p}
        OR EXISTS (SELECT 1 FROM obras_autores oa WHERE oa.obra_id = o.id AND oa.nome ILIKE $${p})
      )`);
    }

    if (tipoFiltro && ROTULO_TIPO_MATERIAL[tipoFiltro]) {
      params.push(tipoFiltro);
      condicoes.push(`o.tipo_material = $${params.length}`);
    }

    condicoes.push(`o.arquivada = false`);

    if (avaliacaoFiltro === "a_avaliar") {
      condicoes.push(`EXISTS (
        SELECT 1 FROM usos u WHERE u.obra_id = o.id
           AND (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id))
           AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))
      )`);
    }

    const where = `WHERE ${condicoes.join(" AND ")}`;

    const r = await pool.query(
      `SELECT o.id, o.titulo, o.tipo_material,
              COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores,
              (SELECT COUNT(DISTINCT u.aula_id) FROM usos u WHERE u.obra_id = o.id) AS total_aulas_distintas,
              o.capa_url,
              (SELECT COUNT(*)::int FROM usos u WHERE u.obra_id = o.id AND (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id)) AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))) AS usos_a_avaliar,
              (SELECT COUNT(*)::int FROM usos u WHERE u.obra_id = o.id) AS total_usos
         FROM obras o
         ${where}
        ORDER BY o.titulo`,
      params
    );

    const obras = r.rows.map((o) => ({
      ...o,
      rotuloTipoMaterial: ROTULO_TIPO_MATERIAL[o.tipo_material] || o.tipo_material
    }));

    res.render("obras-lista", {
      titulo: "Bibliografia", obras,
      filtros: { q: busca, tipo: tipoFiltro, avaliacao: avaliacaoFiltro },
      temFiltro: Boolean(busca || tipoFiltro || avaliacaoFiltro),
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL)
    });
  } catch (err) {
    console.error("Erro na lista de obras:", err.message);
    res.status(500).type("text/plain").send("Erro ao carregar a lista de obras.");
  }
});

app.get("/obras/nova", (req, res) => {
  res.render("obra-form", {
    titulo: "Nova Obra", modo: "criar", acao: "/obras/nova", cancelarUrl: "/obras", obraId: null,
    valores: { titulo: "", tipo_material: "livro", autores: "", pais_autor: "", editora: "", capa_url: "" },
    erros: [], tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL)
  });
});

app.post("/obras/nova", async (req, res) => {
  const titulo = String(req.body.titulo || "").trim();
  const tipo_material = String(req.body.tipo_material || "livro").trim();
  const autoresRaw = String(req.body.autores || "").trim();
  const paisAutor = String(req.body.pais_autor || "").trim() || null;
  const editora = String(req.body.editora || "").trim() || null;
  const capa_url = String(req.body.capa_url || "").trim() || null;

  const erros = [];
  if (!titulo) erros.push("O título da obra é obrigatório.");
  if (!ROTULO_TIPO_MATERIAL[tipo_material]) erros.push("Tipo de material inválido.");

  const autores = autoresRaw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  if (erros.length > 0) {
    return res.status(400).render("obra-form", {
      titulo: "Nova Obra", modo: "criar", acao: "/obras/nova", cancelarUrl: "/obras", obraId: null,
      valores: { titulo, tipo_material, autores: autoresRaw, pais_autor: paisAutor, editora, capa_url },
      erros, tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const obraR = await client.query(
      `INSERT INTO obras (titulo, tipo_material, editora, capa_url) VALUES ($1, $2, $3, $4) RETURNING id`,
      [titulo, tipo_material, editora, capa_url]
    );
    const obraId = obraR.rows[0].id;

    for (let i = 0; i < autores.length; i++) {
      await client.query(
        "INSERT INTO obras_autores (obra_id, nome, ordem, pais) VALUES ($1, $2, $3, $4)",
        [obraId, autores[i], i + 1, paisAutor]
      );
    }
    await client.query("COMMIT");
    res.redirect("/obras");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar obra:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao salvar.");
  } finally {
    client.release();
  }
});

app.get("/obras/buscar", async (req, res) => {
  try {
    const termo = String(req.query.q || "").trim();
    if (termo.length < 2) return res.json([]);
    const busca = `%${termo}%`;
    const r = await pool.query(
      `SELECT o.id, o.titulo, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores
         FROM obras o WHERE o.arquivada = false AND (o.titulo ILIKE $1 OR EXISTS (SELECT 1 FROM obras_autores oa WHERE oa.obra_id = o.id AND oa.nome ILIKE $1))
        ORDER BY o.titulo LIMIT 12`,
      [busca]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar obras." });
  }
});

app.get("/obras/mesclar", async (req, res) => {
  const or = await pool.query(`SELECT o.id, o.titulo, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores FROM obras o WHERE o.arquivada = false ORDER BY o.titulo`);
  res.render("obras-mesclar", { titulo: "Mesclar Obras Duplicadas", obras: or.rows, valores: { vencedora_id: "", perdedora_id: "", confirmacao: "" }, erros: [] });
});

app.post("/obras/mesclar", async (req, res) => {
  const vencedoraId = Number(req.body.vencedora_id) || null;
  const perdedoraId = Number(req.body.perdedora_id) || null;
  const confirmacao = String(req.body.confirmacao || "").trim();

  const erros = [];
  if (!vencedoraId || !perdedoraId) erros.push("Escolha as duas obras.");
  if (vencedoraId && perdedoraId && vencedoraId === perdedoraId) erros.push("A obra vencedora e a perdedora não podem ser a mesma.");

  let perdedora = null;
  if (perdedoraId) {
    const r = await pool.query("SELECT id, titulo, arquivada FROM obras WHERE id = $1", [perdedoraId]);
    if (r.rows.length === 0) erros.push("Obra perdedora não encontrada.");
    else if (r.rows[0].arquivada) erros.push("A obra perdedora já está arquivada.");
    else perdedora = r.rows[0];
  }
  if (perdedora && confirmacao !== perdedora.titulo) erros.push(`Digite exatamente o título da obra perdedora para confirmar.`);

  if (erros.length > 0) {
    const or = await pool.query(`SELECT o.id, o.titulo, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores FROM obras o WHERE o.arquivada = false ORDER BY o.titulo`);
    return res.status(400).render("obras-mesclar", { titulo: "Mesclar Obras Duplicadas", obras: or.rows, valores: { vencedora_id: String(vencedoraId || ''), perdedora_id: String(perdedoraId || ''), confirmacao }, erros });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE usos SET obra_id = $1, atualizado_em = now() WHERE obra_id = $2", [vencedoraId, perdedoraId]);
    
    const autoresPerdedora = await client.query("SELECT nome, ordem, pais FROM obras_autores WHERE obra_id = $1 ORDER BY ordem", [perdedoraId]);
    const maxOrdemR = await client.query("SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM obras_autores WHERE obra_id = $1", [vencedoraId]);
    let proximaOrdem = maxOrdemR.rows[0].max_ordem + 1;

    for (const a of autoresPerdedora.rows) {
      const existe = await client.query("SELECT 1 FROM obras_autores WHERE obra_id = $1 AND LOWER(nome) = LOWER($2)", [vencedoraId, a.nome]);
      if (existe.rows.length === 0) {
        await client.query("INSERT INTO obras_autores (obra_id, nome, ordem, pais) VALUES ($1, $2, $3, $4)", [vencedoraId, a.nome, proximaOrdem, a.pais]);
        proximaOrdem++;
      }
    }
    await client.query("UPDATE obras SET arquivada = true, atualizado_em = now() WHERE id = $1", [perdedoraId]);
    await client.query("DELETE FROM obras_autores WHERE obra_id = $1", [perdedoraId]);
    await client.query("COMMIT");
    res.redirect(`/obras/${vencedoraId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro interno ao mesclar. Nada foi alterado.");
  } finally {
    client.release();
  }
});

app.get("/obras/:id", async (req, res) => {
  const id = Number(req.params.id);
  const or = await pool.query(`SELECT id, titulo, titulo_original, idioma_original, tipo_material, observacoes, arquivada, criado_em, atualizado_em, editora, capa_url FROM obras WHERE id = $1`, [id]);
  if (or.rows.length === 0) return res.status(404).type("text/plain").send("Obra não encontrada.");
  const obra = or.rows[0];

  const autoresR = await pool.query("SELECT nome, ordem, pais FROM obras_autores WHERE obra_id = $1 ORDER BY ordem", [id]);
  const usosR = await pool.query(
    `SELECT u.id, u.papel, u.modalidade, u.orientacao, u.observacoes, u.validado_em, u.criado_em, u.atualizado_em, a.id AS aula_id, a.titulo AS aula_titulo, a.codigo AS aula_codigo,
            (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id) AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))) AS a_avaliar
       FROM usos u JOIN unidades a ON a.id = u.aula_id WHERE u.obra_id = $1
      ORDER BY CASE u.papel WHEN 'texto_base' THEN 1 WHEN 'texto_complementar' THEN 2 WHEN 'ficcao_ancora' THEN 3 WHEN 'ficcao_complementar' THEN 4 ELSE 5 END, a.titulo`, [id]);

  const aulasIds = [...new Set(usosR.rows.map((u) => u.aula_id))];
  const caminhosPorAula = {};
  if (aulasIds.length > 0) {
    const caminhosR = await pool.query(
      `WITH RECURSIVE arvore AS (
         SELECT id AS raiz_id, id, titulo, superior_id, 1 AS nivel FROM unidades WHERE id = ANY($1::bigint[])
         UNION ALL SELECT a.raiz_id, u.id, u.titulo, u.superior_id, a.nivel + 1 FROM unidades u JOIN arvore a ON u.id = a.superior_id
       ) SELECT raiz_id, STRING_AGG(titulo, ' › ' ORDER BY nivel DESC) AS caminho FROM arvore GROUP BY raiz_id`, [aulasIds]
    );
    for (const row of caminhosR.rows) caminhosPorAula[row.raiz_id] = row.caminho;
  }

  const usosIds = usosR.rows.map((u) => u.id);
  let recortesPorUso = {};
  if (usosIds.length > 0) {
    const rr = await pool.query(`SELECT id, uso_id, rotulo, tipo, observacao, ordem FROM usos_recortes WHERE uso_id = ANY($1::bigint[]) ORDER BY uso_id, ordem, id`, [usosIds]);
    for (const r of rr.rows) {
      if (!recortesPorUso[r.uso_id]) recortesPorUso[r.uso_id] = [];
      recortesPorUso[r.uso_id].push(r);
    }
  }

  const totalAulasDistintasR = await pool.query("SELECT COUNT(DISTINCT aula_id)::int AS total FROM usos WHERE obra_id = $1", [id]);
  
  obra.rotuloTipoMaterial = ROTULO_TIPO_MATERIAL[obra.tipo_material] || obra.tipo_material;

  const usos = usosR.rows.map((u) => ({
    ...u, recortes: recortesPorUso[u.id] || [], rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel,
    rotuloModalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade, caminho: caminhosPorAula[u.aula_id] || "",
    a_avaliar: u.a_avaliar, rotuloEstado: u.a_avaliar ? "A Avaliar" : "Validado"
  }));

  res.render("obra-detalhe", { titulo: obra.titulo, obra, autores: autoresR.rows, usos, totalAulasDistintas: totalAulasDistintasR.rows[0].total, salvo: req.query.salvo === "1" });
});

app.get("/obras/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const or = await pool.query(`SELECT id, titulo, tipo_material, editora, capa_url FROM obras WHERE id = $1`, [id]);
  if (or.rows.length === 0) return res.status(404).type("text/plain").send("Obra não encontrada.");
  const obra = or.rows[0];

  const autoresR = await pool.query("SELECT nome, pais FROM obras_autores WHERE obra_id = $1 ORDER BY ordem", [id]);
  const autoresTexto = autoresR.rows.map((a) => a.nome).join("\n");
  const paisAtual = autoresR.rows.length > 0 ? (autoresR.rows[0].pais || "") : "";

  res.render("obra-form", {
    titulo: `Editar Obra`, modo: "editar", acao: `/obras/${id}/editar`, cancelarUrl: `/obras/${id}`, obraId: id,
    valores: { titulo: obra.titulo, tipo_material: obra.tipo_material, autores: autoresTexto, pais_autor: paisAtual, editora: obra.editora || "", capa_url: obra.capa_url || "" },
    erros: [], tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL)
  });
});

app.post("/obras/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const or = await pool.query("SELECT id FROM obras WHERE id = $1", [id]);
  if (or.rows.length === 0) return res.status(404).type("text/plain").send("Obra não encontrada.");

  const titulo = String(req.body.titulo || "").trim();
  const tipo_material = String(req.body.tipo_material || "livro").trim();
  const autoresRaw = String(req.body.autores || "").trim();
  const paisAutor = String(req.body.pais_autor || "").trim() || null;
  const editora = String(req.body.editora || "").trim() || null;
  const capa_url = String(req.body.capa_url || "").trim() || null;

  const erros = [];
  if (!titulo) erros.push("O título da obra é obrigatório.");
  if (!ROTULO_TIPO_MATERIAL[tipo_material]) erros.push("Tipo de material inválido.");
  const autores = autoresRaw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  if (erros.length > 0) {
    return res.status(400).render("obra-form", {
      titulo: "Editar Obra", modo: "editar", acao: `/obras/${id}/editar`, cancelarUrl: `/obras/${id}`, obraId: id,
      valores: { titulo, tipo_material, autores: autoresRaw, pais_autor: paisAutor, editora, capa_url },
      erros, tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE obras SET titulo = $1, tipo_material = $2, editora = $3, capa_url = $4, atualizado_em = now() WHERE id = $5`, [titulo, tipo_material, editora, capa_url, id]);
    await client.query("DELETE FROM obras_autores WHERE obra_id = $1", [id]);
    for (let i = 0; i < autores.length; i++) {
      await client.query("INSERT INTO obras_autores (obra_id, nome, ordem, pais) VALUES ($1, $2, $3, $4)", [id, autores[i], i + 1, paisAutor]);
    }
    await client.query("COMMIT");
    res.redirect(`/obras/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro interno ao salvar.");
  } finally {
    client.release();
  }
});

app.post("/obras/:id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query("SELECT id, titulo, arquivada FROM obras WHERE id = $1", [id]);
  if (r.rows.length === 0) return res.status(404).type("text/plain").send("Obra não encontrada.");
  
  const usosR = await pool.query(`SELECT a.titulo FROM usos u JOIN unidades a ON a.id = u.aula_id WHERE u.obra_id = $1`, [id]);
  if (usosR.rows.length > 0) return res.status(400).type("text/plain").send("Esta obra está em uso em aulas. Remova os usos antes de excluir.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM obras_autores WHERE obra_id = $1", [id]);
    await client.query("DELETE FROM obras WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.redirect("/obras");
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro ao excluir.");
  } finally {
    client.release();
  }
});

// ==========================================
// USOS (OBRA EM AULA)
// ==========================================

app.get("/unidades/:id/usos/:uso_id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  const ur = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  const aula = ur.rows[0];
  
  const usoR = await pool.query(`SELECT id, obra_id, papel, modalidade, orientacao FROM usos WHERE id = $1 AND aula_id = $2`, [usoId, id]);
  const uso = usoR.rows[0];
  const or = await pool.query(`SELECT o.id, o.titulo, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores FROM obras o WHERE o.arquivada = false ORDER BY o.titulo`);
  const rr = await pool.query(`SELECT rotulo, tipo, observacao FROM usos_recortes WHERE uso_id = $1 ORDER BY ordem, id`, [usoId]);
  const recortes = rr.rows.length > 0 ? rr.rows : [{ rotulo: "", tipo: "capitulo", observacao: "" }];
  const cadeia = await cadeiaDeSuperiores(aula.superior_id);

  res.render("uso-form", {
    titulo: `Editar Obra — ${aula.titulo}`, aula, cadeia, obras: or.rows,
    valores: { obra_id: String(uso.obra_id), papel: uso.papel, modalidade: uso.modalidade, orientacao: uso.orientacao || "", recortes, uso_id: usoId },
    erros: [], modo: "editar", acao: `/unidades/${id}/usos/${usoId}/editar`, cancelarUrl: `/unidades/${id}`,
    papeis: Object.entries(ROTULO_PAPEL), modalidades: Object.entries(ROTULO_MODALIDADE), tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
  });
});

app.post("/unidades/:id/usos/:uso_id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  const ur = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  const aula = ur.rows[0];

  const obra_id = Number(req.body.obra_id) || null;
  const papel = String(req.body.papel || "").trim();
  const modalidade = String(req.body.modalidade || "").trim();
  const orientacao = String(req.body.orientacao || "").trim() || null;
  const rotulos = [].concat(req.body.recorte_rotulo || []);
  const observacoesRec = [].concat(req.body.recorte_observacao || []);

  const recortes = [];
  for (let i = 0; i < rotulos.length; i++) {
    const rotulo = String(rotulos[i] || "").trim() || null;
    const observacao = String(observacoesRec[i] || "").trim() || null;
    if (rotulo || observacao) recortes.push({ rotulo, tipo: 'a_conferir', observacao });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE usos SET obra_id = $1, papel = $2, modalidade = $3, orientacao = $4, atualizado_em = now() WHERE id = $5`, [obra_id, papel, modalidade, orientacao, usoId]);
    await client.query("DELETE FROM usos_recortes WHERE uso_id = $1", [usoId]);
    for (let i = 0; i < recortes.length; i++) {
      await client.query(`INSERT INTO usos_recortes (uso_id, rotulo, tipo, observacao, ordem) VALUES ($1, $2, $3, $4, $5)`, [usoId, recortes[i].rotulo, recortes[i].tipo, recortes[i].observacao, i + 1]);
    }
    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro interno ao salvar.");
  } finally {
    client.release();
  }
});

app.get("/unidades/:id/usos/novo", async (req, res) => {
  const id = Number(req.params.id);
  const ur = await pool.query("SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1", [id]);
  const aula = ur.rows[0];
  const or = await pool.query(`SELECT o.id, o.titulo, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores FROM obras o WHERE o.arquivada = false ORDER BY o.titulo`);
  const obraPre = req.query.obra_id ? Number(req.query.obra_id) : null;
  const cadeia = await cadeiaDeSuperiores(aula.superior_id);

  res.render("uso-form", {
    titulo: `Adicionar Obra — ${aula.titulo}`, aula, cadeia, obras: or.rows,
    valores: { obra_id: obraPre ? String(obraPre) : "", papel: "texto_base", modalidade: "parcial", orientacao: "", recortes: [{ rotulo: "", tipo: "capitulo", observacao: "" }] },
    erros: [], modo: "criar", acao: `/unidades/${id}/usos/novo`, cancelarUrl: `/unidades/${id}`,
    papeis: Object.entries(ROTULO_PAPEL), modalidades: Object.entries(ROTULO_MODALIDADE), tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
  });
});

app.post("/unidades/:id/usos/novo", async (req, res) => {
  const id = Number(req.params.id);
  const obra_id = Number(req.body.obra_id) || null;
  const papel = String(req.body.papel || "").trim();
  const modalidade = String(req.body.modalidade || "").trim();
  const orientacao = String(req.body.orientacao || "").trim() || null;
  const rotulos = [].concat(req.body.recorte_rotulo || []);
  const observacoesRec = [].concat(req.body.recorte_observacao || []);

  const recortes = [];
  for (let i = 0; i < rotulos.length; i++) {
    const rotulo = String(rotulos[i] || "").trim() || null;
    const observacao = String(observacoesRec[i] || "").trim() || null;
    if (rotulo || observacao) recortes.push({ rotulo, tipo: 'a_conferir', observacao });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO usos (aula_id, obra_id, papel, modalidade, orientacao) VALUES ($1, $2, $3, $4, $5)`, [id, obra_id, papel, modalidade, orientacao]);
    const usoR = await client.query("SELECT id FROM usos WHERE aula_id = $1 AND obra_id = $2 ORDER BY id DESC LIMIT 1", [id, obra_id]);
    const usoId = usoR.rows[0].id;
    for (let i = 0; i < recortes.length; i++) {
      await client.query(`INSERT INTO usos_recortes (uso_id, rotulo, tipo, observacao, ordem) VALUES ($1, $2, $3, $4, $5)`, [usoId, recortes[i].rotulo, recortes[i].tipo, recortes[i].observacao, i + 1]);
    }
    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro interno ao salvar.");
  } finally {
    client.release();
  }
});

app.post("/unidades/:id/usos/:uso_id/excluir", async (req, res) => {
  await pool.query("DELETE FROM usos WHERE id = $1 AND aula_id = $2", [req.params.uso_id, req.params.id]);
  res.redirect(`/unidades/${req.params.id}?salvo=1`);
});

app.post("/unidades/:id/usos/:uso_id/validar", async (req, res) => {
  await pool.query("UPDATE usos SET validado_em = now() WHERE id = $1", [req.params.uso_id]);
  res.redirect(`/unidades/${req.params.id}?salvo=1`);
});

app.post("/unidades/:id/usos/:uso_id/reabrir", async (req, res) => {
  await pool.query("UPDATE usos SET validado_em = NULL WHERE id = $1", [req.params.uso_id]);
  res.redirect(`/unidades/${req.params.id}?salvo=1`);
});

// ==========================================
// OUTRAS ROTAS
// ==========================================

app.get("/revisao", async (req, res) => {
  const r = await pool.query(
    `SELECT o.id, o.titulo, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores, (SELECT COUNT(*)::int FROM usos u WHERE u.obra_id = o.id) AS total_usos,
            (SELECT COUNT(*)::int FROM usos u WHERE u.obra_id = o.id AND (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id)) AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))) AS usos_a_avaliar
       FROM obras o WHERE o.arquivada = false AND EXISTS (SELECT 1 FROM usos u WHERE u.obra_id = o.id AND (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id)) AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))) ORDER BY o.titulo`, []
  );
  res.render("revisao", { titulo: "Revisão de Usos", obras: r.rows });
});

app.get("/buscar", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.render("buscar", { titulo: "Buscar", termo: "", resultados: [], total: 0, buscou: false });

  const padrao = `%${q}%`;
  try {
    const r = await pool.query(
      `WITH RECURSIVE arvore AS (SELECT id AS raiz_id, id, titulo, superior_id, 1 AS nivel FROM unidades WHERE arquivada = false UNION ALL SELECT a.raiz_id, u.id, u.titulo, u.superior_id, a.nivel + 1 FROM unidades u JOIN arvore a ON u.id = a.superior_id),
       caminhos AS (SELECT raiz_id, STRING_AGG(titulo, ' › ' ORDER BY nivel DESC) AS caminho FROM arvore GROUP BY raiz_id)
       SELECT u.id, u.tipo, u.titulo, u.codigo, u.descricao, u.pergunta_norteadora, f.modelo, f.problema, f.apresentacao, f.conteudo_html, c.caminho
         FROM unidades u LEFT JOIN fichas f ON f.aula_id = u.id LEFT JOIN caminhos c ON c.raiz_id = u.id
        WHERE u.arquivada = false AND (u.titulo ILIKE $1 OR u.descricao ILIKE $1 OR u.pergunta_norteadora ILIKE $1 OR f.problema ILIKE $1 OR f.apresentacao ILIKE $1 OR f.conteudo_html ILIKE $1)
        ORDER BY u.tipo, u.titulo LIMIT 200`, [padrao]
    );

    function extrairTrecho(texto, termo) {
      if (!texto) return null;
      const limpo = String(texto).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
      const idx = limpo.toLowerCase().indexOf(termo.toLowerCase());
      if (idx === -1) return null;
      const inicio = Math.max(0, idx - 60), fim = Math.min(limpo.length, idx + termo.length + 60);
      return (inicio > 0 ? "…" : "") + limpo.slice(inicio, fim) + (fim < limpo.length ? "…" : "");
    }

    const resultados = r.rows.map((u) => {
      let campo = null, trecho = null;
      if (u.titulo && u.titulo.toLowerCase().includes(q.toLowerCase())) campo = "Título";
      else if (u.descricao && u.descricao.toLowerCase().includes(q.toLowerCase())) { campo = "Descrição"; trecho = extrairTrecho(u.descricao, q); }
      else if (u.pergunta_norteadora && u.pergunta_norteadora.toLowerCase().includes(q.toLowerCase())) { campo = "Pergunta norteadora"; trecho = extrairTrecho(u.pergunta_norteadora, q); }
      else if (u.modelo === "novo") { for (const [k, rotulo] of [["problema", "Problema da aula"], ["apresentacao", "Apresentação"]]) { if (u[k] && u[k].toLowerCase().includes(q.toLowerCase())) { campo = rotulo; trecho = extrairTrecho(u[k], q); break; } } }
      else if (u.conteudo_html && u.conteudo_html.toLowerCase().includes(q.toLowerCase())) { campo = "Conteúdo da ficha"; trecho = extrairTrecho(u.conteudo_html, q); }
      return { ...u, campo, trecho, rotuloTipo: ROTULO_TIPO[u.tipo] || u.tipo };
    });

    res.render("buscar", { titulo: `Busca: ${q}`, termo: q, resultados, total: resultados.length, buscou: true });
  } catch (err) {
    res.status(500).type("text/plain").send("Erro ao buscar.");
  }
});

app.get("/unidades/:id", async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query("SELECT id, tipo, titulo, codigo, superior_id, descricao, pergunta_norteadora FROM unidades WHERE id = $1", [id]);
  if (r.rows.length === 0) return res.status(404).type("text/plain").send("Unidade não encontrada.");
  const unidade = r.rows[0];

  const filhosR = await pool.query("SELECT id, tipo, titulo, codigo FROM unidades WHERE superior_id = $1 AND arquivada = false", [id]);
  filhosR.rows.sort((a, b) => {
    function extrairNumeros(titulo) { const match = String(titulo).match(/^(\d+(?:\.\d+)*)/); return match ? match[1].split('.').map(Number) : [9999]; }
    const numsA = extrairNumeros(a.titulo), numsB = extrairNumeros(b.titulo);
    for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) { if ((numsA[i] || 0) !== (numsB[i] || 0)) return (numsA[i] || 0) - (numsB[i] || 0); }
    return String(a.titulo).localeCompare(String(b.titulo));
  });

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
  const proximo = PROXIMO_NIVEL[unidade.tipo];

  let ficha = null;
  if (unidade.tipo === "aula") {
    const fr = await pool.query(`SELECT id, conteudo_html, versao_atual, criado_em, atualizado_em, modelo, problema, apresentacao FROM fichas WHERE aula_id = $1`, [id]);
    if (fr.rows.length > 0) ficha = fr.rows[0];
  }

  let usosAula = [];
  if (unidade.tipo === "aula") {
    const ua = await pool.query(
      `SELECT u.id, u.obra_id, u.papel, u.modalidade, u.orientacao, u.observacoes, u.validado_em, u.atualizado_em, o.titulo AS obra_titulo, o.capa_url AS edicao_capa_url,
              COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS obra_autores,
              (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id) AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))) AS a_avaliar
         FROM usos u JOIN obras o ON o.id = u.obra_id WHERE u.aula_id = $1
        ORDER BY CASE u.papel WHEN 'texto_base' THEN 1 WHEN 'texto_complementar' THEN 2 WHEN 'ficcao_ancora' THEN 3 WHEN 'ficcao_complementar' THEN 4 ELSE 5 END, o.titulo`, [id]
    );

    const usoIds = ua.rows.map((u) => u.id);
    let recortesPorUso = {};
    if (usoIds.length > 0) {
      const rr = await pool.query(`SELECT id, uso_id, rotulo, tipo, observacao, ordem FROM usos_recortes WHERE uso_id = ANY($1::bigint[]) ORDER BY uso_id, ordem, id`, [usoIds]);
      for (const r of rr.rows) {
        if (!recortesPorUso[r.uso_id]) recortesPorUso[r.uso_id] = [];
        recortesPorUso[r.uso_id].push(r);
      }
    }

    usosAula = ua.rows.map((u) => ({
      ...u, recortes: recortesPorUso[u.id] || [], rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel, rotuloModalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade,
      a_avaliar: u.a_avaliar, rotuloEstado: u.a_avaliar ? "A Avaliar" : "Validado"
    }));
  }

  let caminhoCurricular = "";
  if (unidade.tipo === "aula") {
    caminhoCurricular = (await cadeiaDeSuperiores(id)).map((u) => u.titulo).join(" › ");
  }

  res.render("unidade-detalhe", {
    titulo: unidade.titulo, unidade, filhos: filhosR.rows, cadeia,
    rotuloTipo: ROTULO_TIPO[unidade.tipo], rotuloTipoExibido: rotuloTipoOuOmissao(unidade.tipo, unidade.codigo),
    proximoNivel: proximo, rotuloProximo: proximo ? ROTULO_TIPO[proximo] : null, rotuloNovoProximo: proximo ? ROTULO_NOVO[proximo] : null,
    nomeFilhoPlural: unidade.tipo === "aula" ? null : NOME_FILHO_PLURAL[unidade.tipo], ficha, usosAula, caminhoCurricular,
    salvo: req.query.salvo === "1", nadaMudou: req.query.salvo === "0"
  });
});

app.get("/exportar/livros", async (req, res) => {
  try {
    const obrasR = await pool.query(`SELECT o.id, o.titulo, o.tipo_material, COALESCE((SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem) FROM obras_autores oa WHERE oa.obra_id = o.id), '') AS autores FROM obras o WHERE o.arquivada = false ORDER BY o.titulo`);
    const usosR = await pool.query(`SELECT u.id AS uso_id, u.obra_id, u.papel, u.modalidade, u.orientacao, u.validado_em, a.id AS aula_id, a.titulo AS aula_titulo, (EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id) AND (u.validado_em IS NULL OR EXISTS (SELECT 1 FROM usos u3 WHERE u3.obra_id = u.obra_id AND u3.aula_id <> u.aula_id AND u3.atualizado_em > u.validado_em))) AS a_avaliar FROM usos u JOIN unidades a ON a.id = u.aula_id ORDER BY a.titulo`);
    const recortesR = await pool.query(`SELECT uso_id, rotulo, tipo, observacao, ordem FROM usos_recortes ORDER BY uso_id, ordem, id`);

    const recortesPorUso = {};
    for (const r of recortesR.rows) { if (!recortesPorUso[r.uso_id]) recortesPorUso[r.uso_id] = []; recortesPorUso[r.uso_id].push(r); }
    const aulasIds = [...new Set(usosR.rows.map((u) => u.aula_id))];
    const caminhosPorAula = {};
    if (aulasIds.length > 0) {
      const caminhosR = await pool.query(`WITH RECURSIVE arvore AS (SELECT id AS raiz_id, id, titulo, superior_id, 1 AS nivel FROM unidades WHERE id = ANY($1::bigint[]) UNION ALL SELECT a.raiz_id, u.id, u.titulo, u.superior_id, a.nivel + 1 FROM unidades u JOIN arvore a ON u.id = a.superior_id) SELECT raiz_id, STRING_AGG(titulo, ' › ' ORDER BY nivel DESC) AS caminho FROM arvore GROUP BY raiz_id`, [aulasIds]);
      for (const row of caminhosR.rows) caminhosPorAula[row.raiz_id] = row.caminho;
    }

    const obrasMap = new Map();
    for (const o of obrasR.rows) obrasMap.set(o.id, { titulo: o.titulo, autores: o.autores ? o.autores.split(", ") : [], tipo_material: o.tipo_material, usos: [] });
    for (const u of usosR.rows) {
      const obra = obrasMap.get(u.obra_id); if (!obra) continue;
      obra.usos.push({ aula_titulo: u.aula_titulo, aula_caminho: caminhosPorAula[u.aula_id] || "", papel: ROTULO_PAPEL[u.papel] || u.papel, modalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade, orientacao: u.orientacao || null, recortes: (recortesPorUso[u.uso_id] || []).map((r) => ({ tipo: r.tipo, rotulo: r.rotulo || null, observacao: r.observacao || null })), estado: u.a_avaliar ? "A Avaliar" : "Validado" });
    }

    const json = { versao_formato: 1, exportado_em: new Date().toISOString(), obras: Array.from(obrasMap.values()).map((o) => ({ ...o, tipo_material: ROTULO_TIPO_MATERIAL[o.tipo_material] || o.tipo_material })) };
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivoExportacao("livros")}"`);
    res.type("application/json").send(JSON.stringify(json, null, 2));
  } catch (err) { res.status(500).type("text/plain").send("Erro ao exportar livros."); }
});

app.get("/exportar/ementa", async (req, res) => {
  try {
    const unidadesR = await pool.query(`SELECT id, tipo, titulo, codigo, superior_id, descricao, pergunta_norteadora FROM unidades WHERE arquivada = false ORDER BY tipo, id`);
    const porId = new Map();
    for (const u of unidadesR.rows) porId.set(u.id, { id: u.id, titulo: u.titulo, codigo: u.codigo || null, descricao: u.descricao || null, pergunta_norteadora: u.pergunta_norteadora || null, tipo: u.tipo, filhos: [] });

    const raizes = [];
    for (const u of porId.values()) {
      if (u.tipo === "eixo") raizes.push(u);
      else {
        const pai = unidadesR.rows.find((x) => x.id === u.id);
        const paiId = pai ? pai.superior_id : null;
        const paiObj = paiId ? porId.get(paiId) : null;
        if (paiObj) paiObj.filhos.push(u);
      }
    }

    function ordenarArvore(no) { no.filhos.sort((a, b) => (a.id || 0) - (b.id || 0)); for (const f of no.filhos) ordenarArvore(f); }
    for (const r of raizes) ordenarArvore(r);

    function converter(no) { return no.tipo === "eixo" ? { id: no.id, titulo: no.titulo, codigo: no.codigo, descricao: no.descricao, disciplinas: no.filhos.filter((f) => f.tipo === "disciplina").map(converterDisciplina) } : null; }
    function converterDisciplina(no) { return { id: no.id, titulo: no.titulo, codigo: no.codigo, descricao: no.descricao, temas: no.filhos.filter((f) => f.tipo === "tema").map(converterTema) }; }
    function converterTema(no) { return { id: no.id, titulo: no.titulo, codigo: no.codigo, pergunta_norteadora: no.pergunta_norteadora, aulas: no.filhos.filter((f) => f.tipo === "aula").map(converterAula) }; }
    function converterAula(no) { return { id: no.id, titulo: no.titulo, codigo: no.codigo }; }

    const json = { versao_formato: 1, exportado_em: new Date().toISOString(), eixos: raizes.map(converter) };
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivoExportacao("ementa")}"`);
    res.type("application/json").send(JSON.stringify(json, null, 2));
  } catch (err) { res.status(500).type("text/plain").send("Erro ao exportar ementa."); }
});

app.get("/health", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS total FROM unidades WHERE arquivada = false");
    res.json({ status: "ok", service: "literatura-critica-comparada-v2", banco: "conectado", unidades: r.rows[0].total });
  } catch (err) { res.status(500).json({ status: "erro", banco: "falhou", mensagem: err.message }); }
});

app.post("/unidades/:id/temas/importar", express.json({ limit: "5mb" }), async (req, res) => {
  const id = Number(req.params.id);
  const dr = await pool.query("SELECT id, tipo, titulo FROM unidades WHERE id = $1 AND arquivada = false", [id]);
  if (dr.rows.length === 0 || dr.rows[0].tipo !== "disciplina") return res.status(400).type("text/plain").send("Disciplina inválida.");

  let entrada = typeof req.body.texto === "string" ? req.body.texto.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).map((linha) => { const m = linha.match(/^([0-9]+(?:\.[0-9]+)*)\s*[—–\-\.]\s*(.+)$/); return m ? { codigo: m[1].trim(), titulo: m[2].trim() } : { codigo: null, titulo: linha }; }) : (Array.isArray(req.body) ? req.body : req.body && req.body.temas);
  if (!Array.isArray(entrada) || entrada.length === 0) return res.status(400).type("text/plain").send("Nenhum tema encontrado.");

  const temas = [];
  const erros = [];
  entrada.forEach((t, i) => {
    const titulo = String((t && t.titulo) || "").trim();
    if (!titulo) { erros.push("Item " + (i + 1) + ": título obrigatório."); return; }
    temas.push({ titulo, codigo: String((t && t.codigo) || "").trim() || null, pergunta: String((t && t.pergunta_norteadora) || "").trim() || null });
  });
  if (erros.length > 0) return res.status(400).json({ erros });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const criados = [];
    for (const t of temas) {
      const r = await client.query("INSERT INTO unidades (tipo, titulo, codigo, superior_id, descricao, pergunta_norteadora) VALUES ('tema', $1, $2, $3, NULL, $4) RETURNING id, titulo", [t.titulo, t.codigo, id, t.pergunta]);
      criados.push(r.rows[0]);
    }
    await client.query("COMMIT");
    if (req.is("application/json")) return res.json({ ok: true, criados });
    res.redirect("/unidades/" + id + "?salvo=1");
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).type("text/plain").send("Erro ao importar.");
  } finally {
    client.release();
  }
});

app.get("/unidades/:id/temas/importar", async (req, res) => {
  const id = Number(req.params.id);
  const dr = await pool.query("SELECT id, tipo, titulo, codigo, superior_id FROM unidades WHERE id = $1 AND arquivada = false", [id]);
  if (dr.rows.length === 0 || dr.rows[0].tipo !== "disciplina") return res.status(400).type("text/plain").send("Disciplina inválida.");
  res.render("temas-importar", { titulo: "Importar Temas — " + dr.rows[0].titulo, disciplina: dr.rows[0], cadeia: await cadeiaDeSuperiores(dr.rows[0].superior_id), erros: [] });
});

app.get("/infos", async (req, res) => {
  try {
    const ementaR = await pool.query(`SELECT tipo, COUNT(*)::int AS total FROM unidades WHERE arquivada = false GROUP BY tipo`);
    const ementa = { eixo: 0, disciplina: 0, tema: 0, aula: 0 };
    ementaR.rows.forEach(row => { ementa[row.tipo] = row.total; });

    const obrasR = await pool.query("SELECT COUNT(*)::int AS total FROM obras WHERE arquivada = false");
    const autoresTotalR = await pool.query(`SELECT COUNT(DISTINCT oa.nome)::int AS total FROM obras_autores oa JOIN obras o ON o.id = oa.obra_id WHERE o.arquivada = false`);
    const usosR = await pool.query("SELECT COUNT(*)::int AS total FROM usos");
    const usosValidadosR = await pool.query("SELECT COUNT(*)::int AS total FROM usos WHERE validado_em IS NOT NULL");

    const topAutoresR = await pool.query(`SELECT oa.nome AS autor, COUNT(u.id)::int AS total_usos FROM obras_autores oa JOIN obras o ON o.id = oa.obra_id JOIN usos u ON u.obra_id = o.id WHERE o.arquivada = false GROUP BY oa.nome ORDER BY total_usos DESC, oa.nome ASC LIMIT 10`);
    const topPaisesR = await pool.query(`SELECT oa.pais, COUNT(u.id)::int AS total_usos FROM obras_autores oa JOIN obras o ON o.id = oa.obra_id JOIN usos u ON u.obra_id = o.id WHERE o.arquivada = false AND oa.pais IS NOT NULL AND oa.pais <> '' GROUP BY oa.pais ORDER BY total_usos DESC, oa.pais ASC LIMIT 10`);

    const dados = {
      ementa: { eixos: ementa.eixo, disciplinas: ementa.disciplina, temas: ementa.tema, aulas: ementa.aula, total: ementa.eixo + ementa.disciplina + ementa.tema + ementa.aula },
      bibliografia: { obras: obrasR.rows[0].total, autores: autoresTotalR.rows[0].total, usos: usosR.rows[0].total, usos_validados: usosValidadosR.rows[0].total },
      topAutores: topAutoresR.rows, topPaises: topPaisesR.rows
    };

    res.render("infos", { titulo: "Infos — Painel de Controle", dados });
  } catch (err) {
    res.status(500).type("text/plain").send("Erro ao carregar as estatísticas.");
  }
});

app.listen(PORT, () => { console.log(`Servidor ouvindo em http://localhost:${PORT}`); });