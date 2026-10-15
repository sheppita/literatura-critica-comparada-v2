import "dotenv/config";
import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

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

const ROTULO_NOVO = {
  eixo: "Novo Eixo",
  disciplina: "Nova Disciplina",
  modulo: "Novo Módulo",
  tema: "Novo Tema",
  aula: "Nova Aula"
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

const TIPOS_COM_DESCRICAO = ["eixo", "disciplina", "modulo"];

const ROTULO_ESTADO_TEXTO = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  consolidada: "Consolidada"
};

const ROTULO_ESTADO_BIBLIOGRAFIA = {
  pendente: "Pendente",
  em_conferencia: "Em Conferência",
  conferida: "Conferida"
};

function aceitaDescricao(tipo) {
  return TIPOS_COM_DESCRICAO.includes(tipo);
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
    titulo: ROTULO_NOVO[tipo],
    tipo,
    rotuloTipo: ROTULO_TIPO[tipo],
    rotuloNovo: ROTULO_NOVO[tipo],
    superior,
    valores: { titulo: "", codigo: "", descricao: "", pergunta_norteadora: "" },
    erros: [],
    modo: "criar",
    acao: "/unidades/nova",
    cancelarUrl: superior ? `/unidades/${superior.id}` : "/",
    aceitaDescricao: aceitaDescricao(tipo)
  });
});

app.post("/unidades/nova", async (req, res) => {
  const tipo = String(req.body.tipo || "").trim();
  const superiorId = req.body.superior_id ? Number(req.body.superior_id) : null;
  const titulo = String(req.body.titulo || "").trim();
  const codigo = String(req.body.codigo || "").trim() || null;
  const descricaoRaw = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;

  const descricao = aceitaDescricao(tipo) ? descricaoRaw : null;

  const erros = [];
  if (!TIPOS_VALIDOS.includes(tipo)) erros.push("Tipo inválido.");
  if (!titulo) erros.push("O título é obrigatório.");
  if (tipo !== "tema" && pergunta) erros.push("Pergunta norteadora só existe em tema.");
  if (!aceitaDescricao(tipo) && descricaoRaw) {
    erros.push("Este nível não aceita descrição.");
  }
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
      titulo: ROTULO_NOVO[tipo] || "Nova Unidade",
      tipo,
      rotuloTipo: ROTULO_TIPO[tipo] || "Unidade",
      rotuloNovo: ROTULO_NOVO[tipo] || "Nova Unidade",
      superior,
      valores: { titulo, codigo: codigo || "", descricao: descricaoRaw || "", pergunta_norteadora: pergunta || "" },
      erros,
      modo: "criar",
      acao: "/unidades/nova",
      cancelarUrl: superior ? `/unidades/${superior.id}` : "/",
      aceitaDescricao: aceitaDescricao(tipo)
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

  const insertR = await pool.query(
    `INSERT INTO unidades
       (tipo, titulo, codigo, superior_id, ordem, descricao, pergunta_norteadora)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [tipo, titulo, codigo, superiorId, ordem, descricao, pergunta]
  );

  // Se criou uma aula, cria a ficha em branco automaticamente
  if (tipo === "aula") {
    await pool.query(
      "INSERT INTO fichas (aula_id) VALUES ($1) ON CONFLICT (aula_id) DO NOTHING",
      [insertR.rows[0].id]
    );
  }

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
    rotuloNovo: ROTULO_NOVO[u.tipo],
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
    cancelarUrl: `/unidades/${u.id}`,
    aceitaDescricao: aceitaDescricao(u.tipo)
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
  const descricaoRaw = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;

  const descricao = aceitaDescricao(atual.tipo) ? descricaoRaw : null;

  const erros = [];
  if (!titulo) erros.push("O título é obrigatório.");
  if (atual.tipo !== "tema" && pergunta) {
    erros.push("Pergunta norteadora só existe em tema.");
  }
  if (!aceitaDescricao(atual.tipo) && descricaoRaw) {
    erros.push("Este nível não aceita descrição.");
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
      rotuloNovo: ROTULO_NOVO[atual.tipo],
      superior,
      valores: { titulo, codigo: codigo || "", descricao: descricaoRaw || "", pergunta_norteadora: pergunta || "" },
      erros,
      modo: "editar",
      acao: `/unidades/${id}/editar`,
      cancelarUrl: `/unidades/${id}`,
      aceitaDescricao: aceitaDescricao(atual.tipo)
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

// Rota: formulário de edição da ficha
app.get("/unidades/:id/ficha/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const ur = await pool.query(
    "SELECT id, tipo, titulo, codigo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (ur.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const unidade = ur.rows[0];
  if (unidade.tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas têm ficha.");
  }

  const fr = await pool.query(
    `SELECT id, conteudo_markdown, estado_texto, estado_bibliografia, versao_atual
       FROM fichas WHERE aula_id = $1`,
    [id]
  );
  if (fr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Ficha não encontrada para esta aula.");
  }
  const ficha = fr.rows[0];

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  res.render("ficha-editor", {
    titulo: `Editar Ficha — ${unidade.titulo}`,
    unidade,
    ficha,
    cadeia,
    valores: {
      conteudo_markdown: ficha.conteudo_markdown,
      estado_texto: ficha.estado_texto,
      estado_bibliografia: ficha.estado_bibliografia
    },
    erros: [],
    estadosTexto: Object.entries(ROTULO_ESTADO_TEXTO),
    estadosBibliografia: Object.entries(ROTULO_ESTADO_BIBLIOGRAFIA)
  });
});

// Rota: processar salvamento da ficha
app.post("/unidades/:id/ficha/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const ur = await pool.query(
    "SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (ur.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const unidade = ur.rows[0];
  if (unidade.tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas têm ficha.");
  }

  const conteudo_markdown = String(req.body.conteudo_markdown || "");
  const estado_texto = String(req.body.estado_texto || "rascunho");
  const estado_bibliografia = String(req.body.estado_bibliografia || "pendente");

  const erros = [];
  if (!ROTULO_ESTADO_TEXTO[estado_texto]) erros.push("Estado do texto inválido.");
  if (!ROTULO_ESTADO_BIBLIOGRAFIA[estado_bibliografia]) erros.push("Estado da bibliografia inválido.");

  let ficha = null;
  const fr = await pool.query(
    `SELECT id, conteudo_markdown, estado_texto, estado_bibliografia, versao_atual
       FROM fichas WHERE aula_id = $1`,
    [id]
  );
  if (fr.rows.length === 0) {
    erros.push("Ficha não encontrada para esta aula.");
  } else {
    ficha = fr.rows[0];
  }

  if (erros.length > 0) {
    const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
    return res.status(400).render("ficha-editor", {
      titulo: `Editar Ficha — ${unidade.titulo}`,
      unidade,
      ficha: ficha || { versao_atual: 1 },
      cadeia,
      valores: { conteudo_markdown, estado_texto, estado_bibliografia },
      erros,
      estadosTexto: Object.entries(ROTULO_ESTADO_TEXTO),
      estadosBibliografia: Object.entries(ROTULO_ESTADO_BIBLIOGRAFIA)
    });
  }

  // Detecta se houve mudança real (conteúdo, estado do texto ou estado da bibliografia)
  const mudou =
    ficha.conteudo_markdown !== conteudo_markdown ||
    ficha.estado_texto !== estado_texto ||
    ficha.estado_bibliografia !== estado_bibliografia;

  if (mudou) {
    const novaVersao = ficha.versao_atual + 1;

    // Atualiza a ficha
    await pool.query(
      `UPDATE fichas
          SET conteudo_markdown = $1,
              estado_texto = $2,
              estado_bibliografia = $3,
              versao_atual = $4,
              atualizado_em = now()
        WHERE aula_id = $5`,
      [conteudo_markdown, estado_texto, estado_bibliografia, novaVersao, id]
    );

    // Registra no histórico
    await pool.query(
      `INSERT INTO fichas_versoes
         (ficha_id, numero_versao, conteudo_markdown, estado_texto, estado_bibliografia, motivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ficha.id, novaVersao, conteudo_markdown, estado_texto, estado_bibliografia, "Salvamento Manual"]
    );
  }

  res.redirect(`/unidades/${id}`);
});

// Rota: pré-visualização do Markdown (chamada via fetch do navegador)
app.post("/unidades/:id/ficha/preview", async (req, res) => {
  const conteudo = String(req.body.conteudo_markdown || "");
  const html = conteudo.trim() ? marked.parse(conteudo) : "<p><em>(vazio)</em></p>";
  res.type("text/html").send(html);
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

  // Se for aula, busca a ficha
  let ficha = null;
  if (unidade.tipo === "aula") {
    const fr = await pool.query(
      `SELECT id, conteudo_markdown, estado_texto, estado_bibliografia,
              versao_atual, criado_em, atualizado_em
         FROM fichas
        WHERE aula_id = $1`,
      [id]
    );
    if (fr.rows.length > 0) {
      const f = fr.rows[0];
      ficha = {
        ...f,
        conteudo_html: f.conteudo_markdown.trim()
          ? marked.parse(f.conteudo_markdown)
          : null,
        rotuloEstadoTexto: ROTULO_ESTADO_TEXTO[f.estado_texto],
        rotuloEstadoBibliografia: ROTULO_ESTADO_BIBLIOGRAFIA[f.estado_bibliografia]
      };
    }
  }

  res.render("unidade-detalhe", {
    titulo: unidade.titulo,
    unidade,
    filhos: filhosR.rows,
    cadeia,
    rotuloTipo: ROTULO_TIPO[unidade.tipo],
    proximoNivel: proximo,
    rotuloProximo: proximo ? ROTULO_TIPO[proximo] : null,
    rotuloNovoProximo: proximo ? ROTULO_NOVO[proximo] : null,
    nomeFilhoPlural: unidade.tipo === "aula" ? null : NOME_FILHO_PLURAL[unidade.tipo],
    ficha
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