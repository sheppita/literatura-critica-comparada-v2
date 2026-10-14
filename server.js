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

const TIPOS_VALIDOS = ["eixo", "disciplina", "modulo", "tema", "aula"];

const ROTULO_TIPO = {
  eixo: "Eixo",
  disciplina: "Disciplina",
  modulo: "Módulo",
  tema: "Tema",
  aula: "Aula"
};

const PROXIMO_NIVEL = {
  eixo: "disciplina",
  disciplina: "modulo",
  modulo: "tema",
  tema: "aula",
  aula: null
};

const NOME_FILHO_PLURAL = {
  eixo: "disciplinas",
  disciplina: "módulos",
  modulo: "temas",
  tema: "aulas",
  aula: null
};

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

app.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, titulo, codigo FROM unidades WHERE tipo = 'eixo' ORDER BY ordem, id"
    );
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

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).type("text/plain").send("Tipo inválido.");
  }

  let superior = null;
  if (superiorId) {
    const r = await pool.query(
      "SELECT id, tipo, titulo FROM unidades WHERE id = $1",
      [superiorId]
    );
    if (r.rows.length === 0) {
      return res.status(404).type("text/plain").send("Unidade superior não encontrada.");
    }
    superior = r.rows[0];
  }

  res.render("unidade-form", {
    titulo: `Nova ${ROTULO_TIPO[tipo]}`,
    tipo,
    rotuloTipo: ROTULO_TIPO[tipo],
    superior,
    valores: { titulo: "", codigo: "", descricao: "", pergunta_norteadora: "" },
    erros: [],
    modo: "criar",
    acao: "/unidades/nova",
    cancelarUrl: superior ? `/unidades/${superior.id}` : "/"
  });
});

app.post("/unidades/nova", async (req, res) => {
  const tipo = String(req.body.tipo || "").trim();
  const superiorId = req.body.superior_id ? Number(req.body.superior_id) : null;
  const titulo = String(req.body.titulo || "").trim();
  const codigo = String(req.body.codigo || "").trim() || null;
  const descricao = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;

  const erros = [];
  if (!TIPOS_VALIDOS.includes(tipo)) erros.push("Tipo inválido.");
  if (!titulo) erros.push("O título é obrigatório.");
  if (tipo !== "tema" && pergunta) erros.push("Pergunta norteadora só existe em tema.");
  if (tipo === "eixo" && superiorId) erros.push("Eixo não tem unidade superior.");

  let superior = null;
  if (superiorId) {
    const r = await pool.query(
      "SELECT id, tipo, titulo FROM unidades WHERE id = $1",
      [superiorId]
    );
    if (r.rows.length === 0) {
      erros.push("Unidade superior não encontrada.");
    } else {
      superior = r.rows[0];
      const esperado = { disciplina: "eixo", modulo: "disciplina", tema: "modulo", aula: "tema" };
      if (esperado[tipo] && superior.tipo !== esperado[tipo]) {
        erros.push(`Uma ${ROTULO_TIPO[tipo]} deve pertencer a um(a) ${ROTULO_TIPO[esperado[tipo]]}.`);
      }
    }
  } else if (tipo !== "eixo") {
    erros.push(`${ROTULO_TIPO[tipo]} precisa de uma unidade superior.`);
  }

  if (erros.length > 0) {
    return res.status(400).render("unidade-form", {
      titulo: `Nova ${ROTULO_TIPO[tipo] || "Unidade"}`,
      tipo,
      rotuloTipo: ROTULO_TIPO[tipo] || "Unidade",
      superior,
      valores: { titulo, codigo: codigo || "", descricao: descricao || "", pergunta_norteadora: pergunta || "" },
      erros,
      modo: "criar",
      acao: "/unidades/nova",
      cancelarUrl: superior ? `/unidades/${superior.id}` : "/"
    });
  }

  const ordemR = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima
       FROM unidades
      WHERE tipo = $1
        AND superior_id IS NOT DISTINCT FROM $2`,
    [tipo, superiorId]
  );
  const ordem = ordemR.rows[0].proxima;

  await pool.query(
    `INSERT INTO unidades
       (tipo, titulo, codigo, superior_id, ordem, descricao, pergunta_norteadora)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tipo, titulo, codigo, superiorId, ordem, descricao, pergunta]
  );

  if (superiorId) {
    res.redirect(`/unidades/${superiorId}`);
  } else {
    res.redirect("/");
  }
});

app.get("/unidades/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id, tipo, titulo, codigo, superior_id, descricao, pergunta_norteadora FROM unidades WHERE id = $1",
    [id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const u = r.rows[0];

  let superior = null;
  if (u.superior_id) {
    const s = await pool.query(
      "SELECT id, tipo, titulo FROM unidades WHERE id = $1",
      [u.superior_id]
    );
    if (s.rows.length > 0) superior = s.rows[0];
  }

  res.render("unidade-form", {
    titulo: `Editar ${ROTULO_TIPO[u.tipo]}`,
    tipo: u.tipo,
    rotuloTipo: ROTULO_TIPO[u.tipo],
    superior,
    valores: {
      titulo: u.titulo,
      codigo: u.codigo || "",
      descricao: u.descricao || "",
      pergunta_norteadora: u.pergunta_norteadora || ""
    },
    erros: [],
    modo: "editar",
    acao: `/unidades/${u.id}/editar`,
    cancelarUrl: `/unidades/${u.id}`
  });
});

app.post("/unidades/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id, tipo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const atual = r.rows[0];

  const titulo = String(req.body.titulo || "").trim();
  const codigo = String(req.body.codigo || "").trim() || null;
  const descricao = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;

  const erros = [];
  if (!titulo) erros.push("O título é obrigatório.");
  if (atual.tipo !== "tema" && pergunta) {
    erros.push("Pergunta norteadora só existe em tema.");
  }

  let superior = null;
  if (atual.superior_id) {
    const s = await pool.query(
      "SELECT id, tipo, titulo FROM unidades WHERE id = $1",
      [atual.superior_id]
    );
    if (s.rows.length > 0) superior = s.rows[0];
  }

  if (erros.length > 0) {
    return res.status(400).render("unidade-form", {
      titulo: `Editar ${ROTULO_TIPO[atual.tipo]}`,
      tipo: atual.tipo,
      rotuloTipo: ROTULO_TIPO[atual.tipo],
      superior,
      valores: { titulo, codigo: codigo || "", descricao: descricao || "", pergunta_norteadora: pergunta || "" },
      erros,
      modo: "editar",
      acao: `/unidades/${id}/editar`,
      cancelarUrl: `/unidades/${id}`
    });
  }

  await pool.query(
    `UPDATE unidades
        SET titulo = $1,
            codigo = $2,
            descricao = $3,
            pergunta_norteadora = $4,
            atualizado_em = now()
      WHERE id = $5`,
    [titulo, codigo, descricao, pergunta, id]
  );

  res.redirect(`/unidades/${id}`);
});

// Rota: tela de confirmação de exclusão
app.get("/unidades/:id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const u = r.rows[0];

  const filhosR = await pool.query(
    "SELECT id, tipo, titulo FROM unidades WHERE superior_id = $1 ORDER BY ordem, id",
    [id]
  );

  let superior = null;
  if (u.superior_id) {
    const s = await pool.query(
      "SELECT id, tipo, titulo FROM unidades WHERE id = $1",
      [u.superior_id]
    );
    if (s.rows.length > 0) superior = s.rows[0];
  }

  res.render("unidade-excluir", {
    titulo: `Excluir ${u.titulo}`,
    unidade: u,
    filhos: filhosR.rows,
    superior,
    rotuloTipo: ROTULO_TIPO[u.tipo]
  });
});

// Rota: processar exclusão
app.post("/unidades/:id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const u = r.rows[0];

  const filhosR = await pool.query(
    "SELECT id, tipo, titulo FROM unidades WHERE superior_id = $1",
    [id]
  );
  if (filhosR.rows.length > 0) {
    return res.status(400).render("unidade-excluir", {
      titulo: `Excluir ${u.titulo}`,
      unidade: u,
      filhos: filhosR.rows,
      superior: null,
      rotuloTipo: ROTULO_TIPO[u.tipo],
      erro: `Esta unidade tem ${filhosR.rows.length} item(ns) dentro. Remova ou mova os filhos antes de excluir.`
    });
  }

  await pool.query("DELETE FROM unidades WHERE id = $1", [id]);

  if (u.superior_id) {
    res.redirect(`/unidades/${u.superior_id}`);
  } else {
    res.redirect("/");
  }
});

app.get("/unidades/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id, tipo, titulo, codigo, superior_id, ordem, descricao, pergunta_norteadora FROM unidades WHERE id = $1",
    [id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const unidade = r.rows[0];

  const filhosR = await pool.query(
    "SELECT id, tipo, titulo, codigo FROM unidades WHERE superior_id = $1 ORDER BY ordem, id",
    [id]
  );

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
  const proximo = PROXIMO_NIVEL[unidade.tipo];

  res.render("unidade-detalhe", {
    titulo: unidade.titulo,
    unidade,
    filhos: filhosR.rows,
    cadeia,
    rotuloTipo: ROTULO_TIPO[unidade.tipo],
    proximoNivel: proximo,
    rotuloProximo: proximo ? ROTULO_TIPO[proximo] : null,
    nomeFilhoPlural: unidade.tipo === "aula" ? null : NOME_FILHO_PLURAL[unidade.tipo]
  });
});

app.get("/health", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS total FROM unidades");
    res.json({
      status: "ok",
      service: "literatura-critica-comparada-v2",
      banco: "conectado",
      unidades: r.rows[0].total
    });
  } catch (err) {
    console.error("Erro ao consultar o banco:", err.message);
    res.status(500).json({
      status: "erro",
      service: "literatura-critica-comparada-v2",
      banco: "falhou",
      mensagem: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ouvindo em http://localhost:${PORT}`);
});