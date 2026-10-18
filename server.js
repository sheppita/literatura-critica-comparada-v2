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

const ROTULO_TIPO_MATERIAL = {
  livro: "Livro",
  artigo: "Artigo",
  ensaio: "Ensaio",
  revista: "Revista",
  outro: "Outro"
};

const ROTULO_ESTADO_VERIFICACAO = {
  pendente: "Pendente",
  verificada: "Verificada",
  incompleta: "Incompleta"
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
  if (codigoUpper.startsWith(rotuloUpper)) {
    return null;
  }
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

// Exportação: helper para gerar o nome do arquivo com timestamp
function nomeArquivoExportacao(prefixo) {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    agora.getFullYear() +
    pad(agora.getMonth() + 1) +
    pad(agora.getDate()) +
    "-" +
    pad(agora.getHours()) +
    pad(agora.getMinutes());
  return `${prefixo}-${timestamp}.json`;
}

app.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, titulo, codigo FROM unidades WHERE tipo = 'eixo' AND arquivada = false ORDER BY ordem, id"
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
        AND superior_id IS NOT DISTINCT FROM $2
        AND arquivada = false`,
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
    "SELECT id, tipo, titulo FROM unidades WHERE superior_id = $1 AND arquivada = false ORDER BY ordem, id",
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
    "SELECT id, tipo, titulo FROM unidades WHERE superior_id = $1 AND arquivada = false",
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

// ----- Rotas de ficha -----

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
    `SELECT id, conteudo_html, versao_atual, criado_em, atualizado_em
       FROM fichas WHERE aula_id = $1`,
    [id]
  );
  if (fr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Ficha não encontrada para esta aula.");
  }
  const ficha = fr.rows[0];

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  let conflito = null;
  if (req.query.conflito === "1") {
    conflito = {
      versaoQueAbri: Number(req.query.versao_que_abri) || 0,
      versaoAtual: ficha.versao_atual
    };
  }

  res.render("ficha-editor", {
    titulo: `Editar Ficha — ${unidade.titulo}`,
    unidade,
    ficha,
    cadeia,
    valores: {
      conteudo_html: ficha.conteudo_html || ""
    },
    erros: [],
    conflito
  });
});

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

  const conteudo_html = String(req.body.conteudo_html || "");
  const versaoQueAbri = Number(req.body.versao_que_abri) || 0;
  const forcar = String(req.body.forcar || "") === "1";

  const erros = [];

  const fr = await pool.query(
    `SELECT id, conteudo_html, versao_atual
       FROM fichas WHERE aula_id = $1`,
    [id]
  );
  const ficha = fr.rows.length > 0 ? fr.rows[0] : null;
  if (!ficha) {
    erros.push("Ficha não encontrada para esta aula.");
  }

  async function renderizarEditorComErros(mensagens, conflitoAtivo) {
    const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
    return res.status(400).render("ficha-editor", {
      titulo: `Editar Ficha — ${unidade.titulo}`,
      unidade,
      ficha: ficha || { versao_atual: 1 },
      cadeia,
      valores: {
        conteudo_html
      },
      erros: mensagens,
      conflito: conflitoAtivo
    });
  }

  if (erros.length > 0) {
    return renderizarEditorComErros(erros, null);
  }

  if (!forcar && versaoQueAbri > 0 && versaoQueAbri !== ficha.versao_atual) {
    return renderizarEditorComErros([], {
      versaoQueAbri,
      versaoAtual: ficha.versao_atual
    });
  }

  const mudou = ficha.conteudo_html !== conteudo_html;

  if (!mudou) {
    return res.redirect(`/unidades/${id}?salvo=0`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateR = await client.query(
      `UPDATE fichas
          SET conteudo_html = $1,
              versao_atual = versao_atual + 1,
              atualizado_em = now()
        WHERE id = $2
          AND ($3::boolean = true OR versao_atual = $4)
        RETURNING versao_atual`,
      [conteudo_html, ficha.id, forcar, ficha.versao_atual]
    );

    if (updateR.rows.length === 0) {
      await client.query("ROLLBACK");
      const frAtual = await pool.query(
        "SELECT versao_atual FROM fichas WHERE id = $1",
        [ficha.id]
      );
      const versaoAtualAgora = frAtual.rows[0].versao_atual;
      return renderizarEditorComErros([], {
        versaoQueAbri,
        versaoAtual: versaoAtualAgora
      });
    }

    const novaVersao = updateR.rows[0].versao_atual;
    const motivo = forcar ? "Salvamento Forçado (conflito)" : "Salvamento Manual";

    await client.query(
      `INSERT INTO fichas_versoes
         (ficha_id, numero_versao, conteudo_html, motivo, estado_texto, estado_bibliografia)
       VALUES ($1, $2, $3, $4, 'rascunho', 'pendente')`,
      [ficha.id, novaVersao, conteudo_html, motivo]
    );

    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao salvar ficha:", err.message);
    return renderizarEditorComErros(
      ["Erro interno ao salvar. Nada foi gravado."],
      null
    );
  } finally {
    client.release();
  }
});

app.get("/unidades/:id/ficha/versoes", async (req, res) => {
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

  const fr = await pool.query(
    "SELECT id, versao_atual FROM fichas WHERE aula_id = $1",
    [id]
  );
  if (fr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Ficha não encontrada.");
  }
  const ficha = fr.rows[0];

  const versoesR = await pool.query(
    `SELECT id, numero_versao, motivo, criado_em,
            LENGTH(conteudo_html) AS tamanho
       FROM fichas_versoes
      WHERE ficha_id = $1
      ORDER BY numero_versao DESC`,
    [ficha.id]
  );

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  res.render("ficha-versoes", {
    titulo: `Histórico — ${unidade.titulo}`,
    unidade,
    ficha,
    cadeia,
    versoes: versoesR.rows
  });
});

app.get("/unidades/:id/ficha/versoes/:numero", async (req, res) => {
  const id = Number(req.params.id);
  const numero = Number(req.params.numero);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(numero) || numero <= 0) {
    return res.status(400).type("text/plain").send("Id ou número inválido.");
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

  const fr = await pool.query(
    "SELECT id, versao_atual FROM fichas WHERE aula_id = $1",
    [id]
  );
  if (fr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Ficha não encontrada.");
  }
  const ficha = fr.rows[0];

  const vr = await pool.query(
    `SELECT id, numero_versao, conteudo_html, motivo, criado_em
       FROM fichas_versoes
      WHERE ficha_id = $1 AND numero_versao = $2`,
    [ficha.id, numero]
  );
  if (vr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Versão não encontrada.");
  }
  const versao = vr.rows[0];

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  res.render("ficha-versao", {
    titulo: `Versão v${versao.numero_versao} — ${unidade.titulo}`,
    unidade,
    ficha,
    cadeia,
    versao
  });
});

app.post("/unidades/:id/ficha/versoes/:numero/restaurar", async (req, res) => {
  const id = Number(req.params.id);
  const numero = Number(req.params.numero);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(numero) || numero <= 0) {
    return res.status(400).type("text/plain").send("Id ou número inválido.");
  }

  const ur = await pool.query(
    "SELECT id, tipo, titulo FROM unidades WHERE id = $1",
    [id]
  );
  if (ur.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  if (ur.rows[0].tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas têm ficha.");
  }

  const fr = await pool.query(
    "SELECT id, versao_atual FROM fichas WHERE aula_id = $1",
    [id]
  );
  if (fr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Ficha não encontrada.");
  }
  const ficha = fr.rows[0];

  const vr = await pool.query(
    `SELECT numero_versao, conteudo_html
       FROM fichas_versoes
      WHERE ficha_id = $1 AND numero_versao = $2`,
    [ficha.id, numero]
  );
  if (vr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Versão não encontrada.");
  }
  const versao = vr.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateR = await client.query(
      `UPDATE fichas
          SET conteudo_html = $1,
              versao_atual = versao_atual + 1,
              atualizado_em = now()
        WHERE id = $2
        RETURNING versao_atual`,
      [versao.conteudo_html, ficha.id]
    );

    const novaVersao = updateR.rows[0].versao_atual;

    await client.query(
      `INSERT INTO fichas_versoes
         (ficha_id, numero_versao, conteudo_html, motivo, estado_texto, estado_bibliografia)
       VALUES ($1, $2, $3, $4, 'rascunho', 'pendente')`,
      [
        ficha.id,
        novaVersao,
        versao.conteudo_html,
        `Restauração da v${versao.numero_versao}`
      ]
    );

    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao restaurar versão:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao restaurar. Nada foi alterado.");
  } finally {
    client.release();
  }
});

// ----- Fim das rotas de ficha -----

// ----- Rotas de bibliografia -----

app.get("/obras", async (req, res) => {
  try {
    const busca = String(req.query.q || "").trim();
    const tipoFiltro = String(req.query.tipo || "").trim();
    const estadoFiltro = String(req.query.estado || "").trim();
    const avaliacaoFiltro = String(req.query.avaliacao || "").trim();

    const condicoes = [];
    const params = [];

    if (busca) {
      params.push(`%${busca}%`);
      const p = params.length;
      condicoes.push(`(
        o.titulo ILIKE $${p}
        OR o.titulo_original ILIKE $${p}
        OR EXISTS (
          SELECT 1 FROM obras_autores oa
           WHERE oa.obra_id = o.id AND oa.nome ILIKE $${p}
        )
      )`);
    }

    if (tipoFiltro && ROTULO_TIPO_MATERIAL[tipoFiltro]) {
      params.push(tipoFiltro);
      condicoes.push(`o.tipo_material = $${params.length}`);
    }

    if (estadoFiltro && ROTULO_ESTADO_VERIFICACAO[estadoFiltro]) {
      params.push(estadoFiltro);
      condicoes.push(`o.estado_verificacao = $${params.length}`);
    }

    condicoes.push(`o.arquivada = false`);

    if (avaliacaoFiltro === "a_avaliar") {
      condicoes.push(`EXISTS (
        SELECT 1
          FROM usos u
         WHERE u.obra_id = o.id
           AND (
             EXISTS (
               SELECT 1 FROM usos u2
                WHERE u2.obra_id = u.obra_id
                  AND u2.aula_id <> u.aula_id
             )
           )
           AND (
             u.validado_em IS NULL
             OR EXISTS (
               SELECT 1 FROM usos u3
                WHERE u3.obra_id = u.obra_id
                  AND u3.aula_id <> u.aula_id
                  AND u3.atualizado_em > u.validado_em
             )
           )
      )`);
    }

    const where = `WHERE ${condicoes.join(" AND ")}`;

    const r = await pool.query(
      `SELECT o.id, o.titulo, o.tipo_material, o.estado_verificacao,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS autores,
              (SELECT COUNT(*) FROM edicoes e WHERE e.obra_id = o.id) AS total_edicoes,
              (SELECT COUNT(DISTINCT u.aula_id) FROM usos u WHERE u.obra_id = o.id) AS total_aulas_distintas,
              (
                SELECT e.capa_url
                  FROM edicoes e
                 WHERE e.obra_id = o.id AND e.capa_url IS NOT NULL
                 ORDER BY e.ano DESC NULLS LAST, e.id DESC
                 LIMIT 1
              ) AS capa_url,
              (
                SELECT COUNT(*)::int
                  FROM usos u
                 WHERE u.obra_id = o.id
                   AND (
                     EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id)
                   )
                   AND (
                     u.validado_em IS NULL
                     OR EXISTS (
                       SELECT 1 FROM usos u3
                        WHERE u3.obra_id = u.obra_id
                          AND u3.aula_id <> u.aula_id
                          AND u3.atualizado_em > u.validado_em
                     )
                   )
              ) AS usos_a_avaliar,
              (
                SELECT COUNT(*)::int
                  FROM usos u
                 WHERE u.obra_id = o.id
              ) AS total_usos,
              EXISTS (
                SELECT 1
                  FROM usos u
                 WHERE u.obra_id = o.id
                   AND (
                     u.edicao_id IS NULL
                     OR EXISTS (
                       SELECT 1 FROM usos_recortes r
                        WHERE r.uso_id = u.id AND r.tipo = 'a_conferir'
                     )
                     OR (
                       u.modalidade = 'parcial'
                       AND NOT EXISTS (
                         SELECT 1 FROM usos_recortes r2 WHERE r2.uso_id = u.id
                       )
                     )
                   )
              ) AS tem_pendencia
         FROM obras o
         ${where}
        ORDER BY o.titulo`,
      params
    );

    const obras = r.rows.map((o) => ({
      ...o,
      rotuloTipoMaterial: ROTULO_TIPO_MATERIAL[o.tipo_material] || o.tipo_material,
      rotuloEstadoVerificacao: ROTULO_ESTADO_VERIFICACAO[o.estado_verificacao] || o.estado_verificacao
    }));

    res.render("obras-lista", {
      titulo: "Bibliografia",
      obras,
      filtros: {
        q: busca,
        tipo: tipoFiltro,
        estado: estadoFiltro,
        avaliacao: avaliacaoFiltro
      },
      temFiltro: Boolean(busca || tipoFiltro || estadoFiltro || avaliacaoFiltro),
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  } catch (err) {
    console.error("Erro na lista de obras:", err.message);
    res.status(500).type("text/plain").send("Erro ao carregar a lista de obras.");
  }
});

app.get("/obras/nova", (req, res) => {
  res.render("obra-form", {
    titulo: "Nova Obra",
    modo: "criar",
    acao: "/obras/nova",
    cancelarUrl: "/obras",
    obraId: null,
    valores: {
      titulo: "",
      titulo_original: "",
      idioma_original: "",
      tipo_material: "livro",
      autores: "",
      observacoes: "",
      estado_verificacao: "pendente",
      edicao_editora: "",
      edicao_ano: "",
      edicao_numero: "",
      edicao_traducao: "",
      edicao_idioma: "",
      edicao_isbn: "",
      edicao_link: "",
      edicao_capa_url: "",
      edicao_observacoes: "",
      edicao_estado: "pendente",
      incluir_edicao: true
    },
    erros: [],
    tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

app.post("/obras/nova", async (req, res) => {
  const titulo = String(req.body.titulo || "").trim();
  const tipo_material = String(req.body.tipo_material || "livro").trim();
  const autoresRaw = String(req.body.autores || "").trim();

  const edicao_editora = String(req.body.edicao_editora || "").trim() || null;
  const edicao_anoRaw = String(req.body.edicao_ano || "").trim();
  const edicao_capa_url = String(req.body.edicao_capa_url || "").trim() || null;

  const erros = [];
  if (!titulo) erros.push("O título da obra é obrigatório.");
  if (!ROTULO_TIPO_MATERIAL[tipo_material]) erros.push("Tipo de material inválido.");

  let edicao_ano = null;
  if (edicao_anoRaw) {
    const n = Number(edicao_anoRaw);
    if (!Number.isInteger(n) || n < 1000 || n > 2100) {
      erros.push("Ano da edição inválido (use um número entre 1000 e 2100).");
    } else {
      edicao_ano = n;
    }
  }

  const autores = autoresRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const temDadosEdicao = Boolean(edicao_editora || edicao_ano || edicao_capa_url);

  if (erros.length > 0) {
    return res.status(400).render("obra-form", {
      titulo: "Nova Obra",
      modo: "criar",
      acao: "/obras/nova",
      cancelarUrl: "/obras",
      obraId: null,
      valores: {
        titulo,
        tipo_material,
        autores: autoresRaw,
        edicao_editora: edicao_editora || "",
        edicao_ano: edicao_anoRaw,
        edicao_capa_url: edicao_capa_url || ""
      },
      erros,
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  const estadoObraFinal = autores.length === 0 ? "incompleta" : "pendente";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const obraR = await client.query(
      `INSERT INTO obras
         (titulo, tipo_material, estado_verificacao)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [titulo, tipo_material, estadoObraFinal]
    );
    const obraId = obraR.rows[0].id;

    for (let i = 0; i < autores.length; i++) {
      await client.query(
        "INSERT INTO obras_autores (obra_id, nome, ordem) VALUES ($1, $2, $3)",
        [obraId, autores[i], i + 1]
      );
    }

    if (temDadosEdicao) {
      await client.query(
        `INSERT INTO edicoes
           (obra_id, editora, ano, capa_url, estado_verificacao)
         VALUES ($1, $2, $3, $4, 'pendente')`,
        [obraId, edicao_editora, edicao_ano, edicao_capa_url]
      );
    }

    await client.query("COMMIT");
    res.redirect("/obras");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar obra:", err.message);
    return res.status(500).render("obra-form", {
      titulo: "Nova Obra",
      modo: "criar",
      acao: "/obras/nova",
      cancelarUrl: "/obras",
      obraId: null,
      valores: {
        titulo,
        tipo_material,
        autores: autoresRaw,
        edicao_editora: edicao_editora || "",
        edicao_ano: edicao_anoRaw,
        edicao_capa_url: edicao_capa_url || ""
      },
      erros: ["Erro interno ao salvar. Nada foi gravado."],
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  } finally {
    client.release();
  }
});

app.get("/obras/mesclar", async (req, res) => {
  const or = await pool.query(
    `SELECT o.id, o.titulo,
            COALESCE(
              (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                 FROM obras_autores oa WHERE oa.obra_id = o.id),
              ''
            ) AS autores
       FROM obras o
      WHERE o.arquivada = false
      ORDER BY o.titulo`
  );

  res.render("obras-mesclar", {
    titulo: "Mesclar Obras Duplicadas",
    obras: or.rows,
    valores: {
      vencedora_id: "",
      perdedora_id: "",
      confirmacao: ""
    },
    erros: []
  });
});

app.post("/obras/mesclar", async (req, res) => {
  const vencedoraId = Number(req.body.vencedora_id) || null;
  const perdedoraId = Number(req.body.perdedora_id) || null;
  const confirmacao = String(req.body.confirmacao || "").trim();

  const erros = [];

  if (!vencedoraId || !perdedoraId) {
    erros.push("Escolha as duas obras.");
  }
  if (vencedoraId && perdedoraId && vencedoraId === perdedoraId) {
    erros.push("A obra vencedora e a perdedora não podem ser a mesma.");
  }

  let vencedora = null;
  let perdedora = null;

  if (vencedoraId) {
    const r = await pool.query(
      "SELECT id, titulo, arquivada FROM obras WHERE id = $1",
      [vencedoraId]
    );
    if (r.rows.length === 0) {
      erros.push("Obra vencedora não encontrada.");
    } else if (r.rows[0].arquivada) {
      erros.push("A obra vencedora está arquivada.");
    } else {
      vencedora = r.rows[0];
    }
  }

  if (perdedoraId) {
    const r = await pool.query(
      "SELECT id, titulo, arquivada FROM obras WHERE id = $1",
      [perdedoraId]
    );
    if (r.rows.length === 0) {
      erros.push("Obra perdedora não encontrada.");
    } else if (r.rows[0].arquivada) {
      erros.push("A obra perdedora já está arquivada.");
    } else {
      perdedora = r.rows[0];
    }
  }

  if (perdedora && confirmacao !== perdedora.titulo) {
    erros.push(`Digite exatamente o título da obra perdedora ("${perdedora.titulo}") para confirmar.`);
  }

  if (erros.length > 0) {
    const or = await pool.query(
      `SELECT o.id, o.titulo,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS autores
         FROM obras o
        WHERE o.arquivada = false
        ORDER BY o.titulo`
    );
    return res.status(400).render("obras-mesclar", {
      titulo: "Mesclar Obras Duplicadas",
      obras: or.rows,
      valores: {
        vencedora_id: vencedoraId ? String(vencedoraId) : "",
        perdedora_id: perdedoraId ? String(perdedoraId) : "",
        confirmacao
      },
      erros
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE edicoes SET obra_id = $1 WHERE obra_id = $2",
      [vencedoraId, perdedoraId]
    );

    await client.query(
      "UPDATE usos SET obra_id = $1, atualizado_em = now() WHERE obra_id = $2",
      [vencedoraId, perdedoraId]
    );

    const autoresPerdedora = await client.query(
      "SELECT nome, ordem FROM obras_autores WHERE obra_id = $1 ORDER BY ordem",
      [perdedoraId]
    );

    const maxOrdemR = await client.query(
      "SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM obras_autores WHERE obra_id = $1",
      [vencedoraId]
    );
    let proximaOrdem = maxOrdemR.rows[0].max_ordem + 1;

    for (const a of autoresPerdedora.rows) {
      const existe = await client.query(
        "SELECT 1 FROM obras_autores WHERE obra_id = $1 AND LOWER(nome) = LOWER($2)",
        [vencedoraId, a.nome]
      );
      if (existe.rows.length === 0) {
        await client.query(
          "INSERT INTO obras_autores (obra_id, nome, ordem) VALUES ($1, $2, $3)",
          [vencedoraId, a.nome, proximaOrdem]
        );
        proximaOrdem++;
      }
    }

    await client.query(
      "UPDATE obras SET arquivada = true, atualizado_em = now() WHERE id = $1",
      [perdedoraId]
    );

    await client.query("DELETE FROM obras_autores WHERE obra_id = $1", [perdedoraId]);

    await client.query("COMMIT");
    res.redirect(`/obras/${vencedoraId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao mesclar obras:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao mesclar. Nada foi alterado.");
  } finally {
    client.release();
  }
});

app.get("/obras/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query(
    `SELECT id, titulo, titulo_original, idioma_original, tipo_material,
            observacoes, estado_verificacao, arquivada, criado_em, atualizado_em
       FROM obras WHERE id = $1`,
    [id]
  );
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const autoresR = await pool.query(
    "SELECT nome, ordem FROM obras_autores WHERE obra_id = $1 ORDER BY ordem",
    [id]
  );

  const edicoesR = await pool.query(
    `SELECT id, editora, ano, capa_url
       FROM edicoes
      WHERE obra_id = $1
      ORDER BY ano NULLS LAST, id`,
    [id]
  );

  const usosR = await pool.query(
    `SELECT u.id, u.papel, u.modalidade, u.orientacao, u.observacoes,
            u.validado_em, u.criado_em, u.atualizado_em,
            a.id AS aula_id, a.titulo AS aula_titulo, a.codigo AS aula_codigo,
            e.id AS edicao_id, e.editora AS edicao_editora, e.ano AS edicao_ano,
            e.capa_url AS edicao_capa_url,
            (
              EXISTS (
                SELECT 1 FROM usos u2
                 WHERE u2.obra_id = u.obra_id
                   AND u2.aula_id <> u.aula_id
              )
              AND (
                u.validado_em IS NULL
                OR EXISTS (
                  SELECT 1 FROM usos u3
                   WHERE u3.obra_id = u.obra_id
                     AND u3.aula_id <> u.aula_id
                     AND u3.atualizado_em > u.validado_em
                )
              )
            ) AS a_avaliar
       FROM usos u
       JOIN unidades a ON a.id = u.aula_id
       LEFT JOIN edicoes e ON e.id = u.edicao_id
      WHERE u.obra_id = $1
      ORDER BY
        CASE u.papel
          WHEN 'texto_base' THEN 1
          WHEN 'texto_complementar' THEN 2
          WHEN 'ficcao_ancora' THEN 3
          WHEN 'ficcao_complementar' THEN 4
          ELSE 5
        END,
        a.titulo`,
    [id]
  );

  const aulasIds = [...new Set(usosR.rows.map((u) => u.aula_id))];
  const caminhosPorAula = {};
  if (aulasIds.length > 0) {
    const caminhosR = await pool.query(
      `WITH RECURSIVE arvore AS (
         SELECT id AS raiz_id, id, titulo, superior_id, 1 AS nivel
           FROM unidades
          WHERE id = ANY($1::bigint[])
         UNION ALL
         SELECT a.raiz_id, u.id, u.titulo, u.superior_id, a.nivel + 1
           FROM unidades u
           JOIN arvore a ON u.id = a.superior_id
       )
       SELECT raiz_id,
              STRING_AGG(titulo, ' › ' ORDER BY nivel DESC) AS caminho
         FROM arvore
        GROUP BY raiz_id`,
      [aulasIds]
    );
    for (const row of caminhosR.rows) {
      caminhosPorAula[row.raiz_id] = row.caminho;
    }
  }

  const usosIds = usosR.rows.map((u) => u.id);
  let recortesPorUso = {};
  if (usosIds.length > 0) {
    const rr = await pool.query(
      `SELECT id, uso_id, rotulo, tipo, observacao, ordem
         FROM usos_recortes
        WHERE uso_id = ANY($1::bigint[])
        ORDER BY uso_id, ordem, id`,
      [usosIds]
    );
    for (const r of rr.rows) {
      if (!recortesPorUso[r.uso_id]) recortesPorUso[r.uso_id] = [];
      recortesPorUso[r.uso_id].push(r);
    }
  }

  const totalAulasDistintasR = await pool.query(
    "SELECT COUNT(DISTINCT aula_id)::int AS total FROM usos WHERE obra_id = $1",
    [id]
  );
  const totalAulasDistintas = totalAulasDistintasR.rows[0].total;

  obra.rotuloTipoMaterial = ROTULO_TIPO_MATERIAL[obra.tipo_material] || obra.tipo_material;
  obra.rotuloEstadoVerificacao =
    ROTULO_ESTADO_VERIFICACAO[obra.estado_verificacao] || obra.estado_verificacao;

  const edicoes = edicoesR.rows.map((e) => ({
    ...e,
    rotuloEstadoVerificacao:
      ROTULO_ESTADO_VERIFICACAO[e.estado_verificacao] || e.estado_verificacao
  }));

  const usos = usosR.rows.map((u) => ({
    ...u,
    recortes: recortesPorUso[u.id] || [],
    rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel,
    rotuloModalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade,
    caminho: caminhosPorAula[u.aula_id] || "",
    a_avaliar: u.a_avaliar,
    rotuloEstado: u.a_avaliar ? "A Avaliar" : "Validado"
  }));

  const salvo = req.query.salvo === "1";

  res.render("obra-detalhe", {
    titulo: obra.titulo,
    obra,
    autores: autoresR.rows,
    edicoes,
    usos,
    totalAulasDistintas,
    salvo
  });
});

// ----- Rotas de edição de obra e edições (R4) -----

app.get("/obras/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query(
    `SELECT id, titulo, tipo_material
       FROM obras WHERE id = $1`,
    [id]
  );
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const autoresR = await pool.query(
    "SELECT nome FROM obras_autores WHERE obra_id = $1 ORDER BY ordem",
    [id]
  );
  const autoresTexto = autoresR.rows.map((a) => a.nome).join("\n");

  res.render("obra-form", {
    titulo: `Editar Obra`,
    modo: "editar",
    acao: `/obras/${id}/editar`,
    cancelarUrl: `/obras/${id}`,
    obraId: id,
    valores: {
      titulo: obra.titulo,
      tipo_material: obra.tipo_material,
      autores: autoresTexto
    },
    erros: [],
    tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

app.post("/obras/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query("SELECT id FROM obras WHERE id = $1", [id]);
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }

  const titulo = String(req.body.titulo || "").trim();
  const tipo_material = String(req.body.tipo_material || "livro").trim();
  const autoresRaw = String(req.body.autores || "").trim();

  const erros = [];
  if (!titulo) erros.push("O título da obra é obrigatório.");
  if (!ROTULO_TIPO_MATERIAL[tipo_material]) erros.push("Tipo de material inválido.");

  const autores = autoresRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (erros.length > 0) {
    return res.status(400).render("obra-form", {
      titulo: "Editar Obra",
      modo: "editar",
      acao: `/obras/${id}/editar`,
      cancelarUrl: `/obras/${id}`,
      obraId: id,
      valores: {
        titulo,
        tipo_material,
        autores: autoresRaw
      },
      erros,
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE obras
          SET titulo = $1,
              tipo_material = $2,
              atualizado_em = now()
        WHERE id = $3`,
      [titulo, tipo_material, id]
    );

    await client.query("DELETE FROM obras_autores WHERE obra_id = $1", [id]);
    for (let i = 0; i < autores.length; i++) {
      await client.query(
        "INSERT INTO obras_autores (obra_id, nome, ordem) VALUES ($1, $2, $3)",
        [id, autores[i], i + 1]
      );
    }

    await client.query("COMMIT");
    res.redirect(`/obras/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao editar obra:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao salvar. Nada foi gravado.");
  } finally {
    client.release();
  }
});

app.get("/obras/:id/edicoes/nova", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query("SELECT id, titulo FROM obras WHERE id = $1", [id]);
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  res.render("edicao-form", {
    titulo: `Nova Edição — ${obra.titulo}`,
    modo: "criar",
    acao: `/obras/${id}/edicoes/nova`,
    cancelarUrl: `/obras/${id}`,
    obra,
    valores: {
      editora: "",
      ano: "",
      capa_url: ""
    },
    erros: [],
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

app.post("/obras/:id/edicoes/nova", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query("SELECT id, titulo FROM obras WHERE id = $1", [id]);
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const editora = String(req.body.editora || "").trim() || null;
  const anoRaw = String(req.body.ano || "").trim();
  const capa_url = String(req.body.capa_url || "").trim() || null;

  const erros = [];

  let ano = null;
  if (anoRaw) {
    const n = Number(anoRaw);
    if (!Number.isInteger(n) || n < 1000 || n > 2100) {
      erros.push("Ano inválido (use um número entre 1000 e 2100).");
    } else {
      ano = n;
    }
  }

  if (erros.length > 0) {
    return res.status(400).render("edicao-form", {
      titulo: `Nova Edição — ${obra.titulo}`,
      modo: "criar",
      acao: `/obras/${id}/edicoes/nova`,
      cancelarUrl: `/obras/${id}`,
      obra,
      valores: { editora: editora || "", ano: anoRaw, capa_url: capa_url || "" },
      erros,
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  await pool.query(
    `INSERT INTO edicoes
       (obra_id, editora, ano, capa_url, estado_verificacao)
     VALUES ($1, $2, $3, $4, 'pendente')`,
    [id, editora, ano, capa_url]
  );

  res.redirect(`/obras/${id}?salvo=1`);
});

app.get("/obras/:id/edicoes/:edicao_id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const edicaoId = Number(req.params.edicao_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(edicaoId) || edicaoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query("SELECT id, titulo FROM obras WHERE id = $1", [id]);
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const er = await pool.query(
    `SELECT id, editora, ano, capa_url
       FROM edicoes WHERE id = $1 AND obra_id = $2`,
    [edicaoId, id]
  );
  if (er.rows.length === 0) {
    return res.status(404).type("text/plain").send("Edição não encontrada.");
  }
  const edicao = er.rows[0];

  res.render("edicao-form", {
    titulo: `Editar Edição — ${obra.titulo}`,
    modo: "editar",
    acao: `/obras/${id}/edicoes/${edicaoId}/editar`,
    cancelarUrl: `/obras/${id}`,
    obra,
    valores: {
      editora: edicao.editora || "",
      ano: edicao.ano != null ? String(edicao.ano) : "",
      capa_url: edicao.capa_url || ""
    },
    erros: [],
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

app.post("/obras/:id/edicoes/:edicao_id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const edicaoId = Number(req.params.edicao_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(edicaoId) || edicaoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query("SELECT id, titulo FROM obras WHERE id = $1", [id]);
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const er = await pool.query("SELECT id FROM edicoes WHERE id = $1 AND obra_id = $2", [edicaoId, id]);
  if (er.rows.length === 0) {
    return res.status(404).type("text/plain").send("Edição não encontrada.");
  }

  const editora = String(req.body.editora || "").trim() || null;
  const anoRaw = String(req.body.ano || "").trim();
  const capa_url = String(req.body.capa_url || "").trim() || null;

  const erros = [];

  let ano = null;
  if (anoRaw) {
    const n = Number(anoRaw);
    if (!Number.isInteger(n) || n < 1000 || n > 2100) {
      erros.push("Ano inválido (use um número entre 1000 e 2100).");
    } else {
      ano = n;
    }
  }

  if (erros.length > 0) {
    return res.status(400).render("edicao-form", {
      titulo: `Editar Edição — ${obra.titulo}`,
      modo: "editar",
      acao: `/obras/${id}/edicoes/${edicaoId}/editar`,
      cancelarUrl: `/obras/${id}`,
      obra,
      valores: { editora: editora || "", ano: anoRaw, capa_url: capa_url || "" },
      erros,
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  await pool.query(
    `UPDATE edicoes
        SET editora = $1, ano = $2, capa_url = $3, atualizado_em = now()
      WHERE id = $4`,
    [editora, ano, capa_url, edicaoId]
  );

  res.redirect(`/obras/${id}?salvo=1`);
});

app.post("/obras/:id/edicoes/:edicao_id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  const edicaoId = Number(req.params.edicao_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(edicaoId) || edicaoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const er = await pool.query(
    "SELECT id FROM edicoes WHERE id = $1 AND obra_id = $2",
    [edicaoId, id]
  );
  if (er.rows.length === 0) {
    return res.status(404).type("text/plain").send("Edição não encontrada.");
  }

  const emUsoR = await pool.query(
    "SELECT COUNT(*)::int AS total FROM usos WHERE edicao_id = $1",
    [edicaoId]
  );
  const emUso = emUsoR.rows[0].total;

  if (emUso > 0) {
    return res.status(400).type("text/plain").send(
      `Esta edição está em uso em ${emUso} indicação(ões). Remova ou reatribua os usos antes de excluir.`
    );
  }

  await pool.query("DELETE FROM edicoes WHERE id = $1", [edicaoId]);

  res.redirect(`/obras/${id}?salvo=1`);
});

app.post("/obras/:id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id, titulo, arquivada FROM obras WHERE id = $1",
    [id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = r.rows[0];

  if (obra.arquivada) {
    return res.status(400).type("text/plain").send("Esta obra já está arquivada.");
  }

  const usosR = await pool.query(
    `SELECT a.id, a.titulo
       FROM usos u
       JOIN unidades a ON a.id = u.aula_id
      WHERE u.obra_id = $1
      ORDER BY a.titulo`,
    [id]
  );

  if (usosR.rows.length > 0) {
    const titulos = usosR.rows.map((u) => `"${u.titulo}"`).join(", ");
    return res.status(400).type("text/plain").send(
      `Esta obra está em uso em ${usosR.rows.length} aula(s): ${titulos}. Remova ou reatribua os usos antes de excluir.`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM edicoes WHERE obra_id = $1", [id]);
    await client.query("DELETE FROM obras_autores WHERE obra_id = $1", [id]);
    await client.query("DELETE FROM obras WHERE id = $1", [id]);

    await client.query("COMMIT");
    res.redirect("/obras");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao excluir obra:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao excluir. Nada foi alterado.");
  } finally {
    client.release();
  }
});

// ----- Rotas de edição de uso (R4) -----

app.get("/unidades/:id/usos/:uso_id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(usoId) || usoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const ur = await pool.query(
    "SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (ur.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const aula = ur.rows[0];
  if (aula.tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas têm usos.");
  }

  const usoR = await pool.query(
    `SELECT id, obra_id, edicao_id, papel, modalidade, orientacao
       FROM usos WHERE id = $1 AND aula_id = $2`,
    [usoId, id]
  );
  if (usoR.rows.length === 0) {
    return res.status(404).type("text/plain").send("Uso não encontrado.");
  }
  const uso = usoR.rows[0];

  const or = await pool.query(
    `SELECT o.id, o.titulo,
            COALESCE(
              (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                 FROM obras_autores oa WHERE oa.obra_id = o.id),
              ''
            ) AS autores
       FROM obras o
      WHERE o.arquivada = false
      ORDER BY o.titulo`
  );

  const er = await pool.query(
    `SELECT id, editora, ano
       FROM edicoes WHERE obra_id = $1
      ORDER BY ano NULLS LAST, id`,
    [uso.obra_id]
  );

  const rr = await pool.query(
    `SELECT rotulo, tipo, observacao
       FROM usos_recortes WHERE uso_id = $1 ORDER BY ordem, id`,
    [usoId]
  );

  const recortes = rr.rows.length > 0 ? rr.rows : [
    { rotulo: "", tipo: "capitulo", observacao: "" }
  ];

  const cadeia = await cadeiaDeSuperiores(aula.superior_id);

  res.render("uso-form", {
    titulo: `Editar Obra — ${aula.titulo}`,
    aula,
    cadeia,
    obras: or.rows,
    edicoes: er.rows,
    valores: {
      obra_id: String(uso.obra_id),
      edicao_id: uso.edicao_id ? String(uso.edicao_id) : "",
      papel: uso.papel,
      modalidade: uso.modalidade,
      orientacao: uso.orientacao || "",
      recortes,
      uso_id: usoId
    },
    erros: [],
    modo: "editar",
    acao: `/unidades/${id}/usos/${usoId}/editar`,
    cancelarUrl: `/unidades/${id}`,
    papeis: Object.entries(ROTULO_PAPEL),
    modalidades: Object.entries(ROTULO_MODALIDADE),
    tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
  });
});

app.post("/unidades/:id/usos/:uso_id/editar", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(usoId) || usoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const ur = await pool.query(
    "SELECT id, tipo, titulo, superior_id FROM unidades WHERE id = $1",
    [id]
  );
  if (ur.rows.length === 0) {
    return res.status(404).type("text/plain").send("Unidade não encontrada.");
  }
  const aula = ur.rows[0];
  if (aula.tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas têm usos.");
  }

  const usoR = await pool.query(
    "SELECT id FROM usos WHERE id = $1 AND aula_id = $2",
    [usoId, id]
  );
  if (usoR.rows.length === 0) {
    return res.status(404).type("text/plain").send("Uso não encontrado.");
  }

  const obra_id = Number(req.body.obra_id) || null;
  const edicao_id = Number(req.body.edicao_id) || null;
  const papel = String(req.body.papel || "").trim();
  const modalidade = String(req.body.modalidade || "").trim();
  const orientacao = String(req.body.orientacao || "").trim() || null;

  const rotulos = [].concat(req.body.recorte_rotulo || []);
  const tipos = [].concat(req.body.recorte_tipo || []);
  const observacoesRec = [].concat(req.body.recorte_observacao || []);

  const erros = [];
  if (!obra_id) erros.push("Escolha uma obra.");
  if (!ROTULO_PAPEL[papel]) erros.push("Papel inválido.");
  if (!ROTULO_MODALIDADE[modalidade]) erros.push("Modalidade inválida.");

  if (obra_id) {
    const o = await pool.query("SELECT id, arquivada FROM obras WHERE id = $1", [obra_id]);
    if (o.rows.length === 0) erros.push("Obra não encontrada.");
    else if (o.rows[0].arquivada) erros.push("Esta obra está arquivada.");
  }

  if (edicao_id) {
    const e = await pool.query("SELECT id, obra_id FROM edicoes WHERE id = $1", [edicao_id]);
    if (e.rows.length === 0) erros.push("Edição não encontrada.");
    else if (Number(e.rows[0].obra_id) !== Number(obra_id)) erros.push("A edição não pertence à obra selecionada.");
  }

  const recortes = [];
  for (let i = 0; i < tipos.length; i++) {
    const tipo = String(tipos[i] || "").trim();
    if (!ROTULO_RECORTE_TIPO[tipo]) continue;
    const rotulo = String(rotulos[i] || "").trim() || null;
    const observacao = String(observacoesRec[i] || "").trim() || null;
    if (!rotulo && !observacao && tipo !== "a_conferir") {
      continue;
    }
    recortes.push({ rotulo, tipo, observacao });
  }

  if (erros.length > 0) {
    const or = await pool.query(
      `SELECT o.id, o.titulo,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS autores
         FROM obras o
        WHERE o.arquivada = false
        ORDER BY o.titulo`
    );
    let edicoes = [];
    if (obra_id) {
      const er = await pool.query(
        `SELECT id, editora, ano
           FROM edicoes WHERE obra_id = $1
          ORDER BY ano NULLS LAST, id`,
        [obra_id]
      );
      edicoes = er.rows;
    }
    const cadeia = await cadeiaDeSuperiores(aula.superior_id);
    return res.status(400).render("uso-form", {
      titulo: `Editar Obra — ${aula.titulo}`,
      aula,
      cadeia,
      obras: or.rows,
      edicoes,
      valores: {
        obra_id: obra_id ? String(obra_id) : "",
        edicao_id: edicao_id ? String(edicao_id) : "",
        papel, modalidade, orientacao: orientacao || "",
        recortes: recortes.length > 0 ? recortes : [
          { rotulo: "", tipo: "capitulo", observacao: "" }
        ],
        uso_id: usoId
      },
      erros,
      modo: "editar",
      acao: `/unidades/${id}/usos/${usoId}/editar`,
      cancelarUrl: `/unidades/${id}`,
      papeis: Object.entries(ROTULO_PAPEL),
      modalidades: Object.entries(ROTULO_MODALIDADE),
      tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE usos
          SET obra_id = $1, edicao_id = $2, papel = $3, modalidade = $4,
              orientacao = $5, atualizado_em = now()
        WHERE id = $6`,
      [obra_id, edicao_id, papel, modalidade, orientacao, usoId]
    );

    await client.query("DELETE FROM usos_recortes WHERE uso_id = $1", [usoId]);
    for (let i = 0; i < recortes.length; i++) {
      const r = recortes[i];
      await client.query(
        `INSERT INTO usos_recortes (uso_id, rotulo, tipo, observacao, ordem)
         VALUES ($1, $2, $3, $4, $5)`,
        [usoId, r.rotulo, r.tipo, r.observacao, i + 1]
      );
    }

    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao editar uso:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao salvar. Nada foi gravado.");
  } finally {
    client.release();
  }
});

// ----- Rotas de uso (obra em aula) -----

app.get("/unidades/:id/usos/novo", async (req, res) => {
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
  const aula = ur.rows[0];
  if (aula.tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas recebem usos.");
  }

  const or = await pool.query(
    `SELECT o.id, o.titulo,
            COALESCE(
              (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                 FROM obras_autores oa WHERE oa.obra_id = o.id),
              ''
            ) AS autores
       FROM obras o
      WHERE o.arquivada = false
      ORDER BY o.titulo`
  );

  const obraPre = req.query.obra_id ? Number(req.query.obra_id) : null;

  let edicoes = [];
  if (obraPre) {
    const er = await pool.query(
      `SELECT id, editora, ano
         FROM edicoes WHERE obra_id = $1
        ORDER BY ano NULLS LAST, id`,
      [obraPre]
    );
    edicoes = er.rows;
  }

  const cadeia = await cadeiaDeSuperiores(aula.superior_id);

  res.render("uso-form", {
    titulo: `Adicionar Obra — ${aula.titulo}`,
    aula,
    cadeia,
    obras: or.rows,
    edicoes,
    valores: {
      obra_id: obraPre ? String(obraPre) : "",
      edicao_id: "",
      papel: "texto_base",
      modalidade: "parcial",
      orientacao: "",
      recortes: [
        { rotulo: "", tipo: "capitulo", observacao: "" }
      ]
    },
    erros: [],
    modo: "criar",
    acao: `/unidades/${id}/usos/novo`,
    cancelarUrl: `/unidades/${id}`,
    papeis: Object.entries(ROTULO_PAPEL),
    modalidades: Object.entries(ROTULO_MODALIDADE),
    tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
  });
});

app.get("/obras/:id/edicoes.json", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "Id inválido." });
  }
  const r = await pool.query(
    `SELECT id, editora, ano, capa_url
       FROM edicoes WHERE obra_id = $1
      ORDER BY ano NULLS LAST, id`,
    [id]
  );
  res.json({ edicoes: r.rows });
});

app.post("/unidades/:id/usos/novo", async (req, res) => {
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
  const aula = ur.rows[0];
  if (aula.tipo !== "aula") {
    return res.status(400).type("text/plain").send("Só aulas recebem usos.");
  }

  const obra_id = Number(req.body.obra_id) || null;
  const edicao_id = Number(req.body.edicao_id) || null;
  const papel = String(req.body.papel || "").trim();
  const modalidade = String(req.body.modalidade || "").trim();
  const orientacao = String(req.body.orientacao || "").trim() || null;

  const rotulos = [].concat(req.body.recorte_rotulo || []);
  const tipos = [].concat(req.body.recorte_tipo || []);
  const observacoesRec = [].concat(req.body.recorte_observacao || []);

  const erros = [];
  if (!obra_id) erros.push("Escolha uma obra.");
  if (!ROTULO_PAPEL[papel]) erros.push("Papel inválido.");
  if (!ROTULO_MODALIDADE[modalidade]) erros.push("Modalidade inválida.");

  if (obra_id) {
    const o = await pool.query("SELECT id, arquivada FROM obras WHERE id = $1", [obra_id]);
    if (o.rows.length === 0) erros.push("Obra não encontrada.");
    else if (o.rows[0].arquivada) erros.push("Esta obra está arquivada e não pode receber novos usos.");
  }

  if (edicao_id) {
    const e = await pool.query("SELECT id, obra_id FROM edicoes WHERE id = $1", [edicao_id]);
    if (e.rows.length === 0) {
      erros.push("Edição não encontrada.");
    } else if (Number(e.rows[0].obra_id) !== Number(obra_id)) {
      erros.push("A edição não pertence à obra selecionada.");
    }
  }

  const recortes = [];
  for (let i = 0; i < tipos.length; i++) {
    const tipo = String(tipos[i] || "").trim();
    if (!ROTULO_RECORTE_TIPO[tipo]) continue;
    const rotulo = String(rotulos[i] || "").trim() || null;
    const observacao = String(observacoesRec[i] || "").trim() || null;
    if (!rotulo && !observacao && tipo !== "a_conferir") {
      continue;
    }
    recortes.push({ rotulo, tipo, observacao });
  }

  if (erros.length > 0) {
    const or = await pool.query(
      `SELECT o.id, o.titulo,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS autores
         FROM obras o
        WHERE o.arquivada = false
        ORDER BY o.titulo`
    );
    let edicoes = [];
    if (obra_id) {
      const er = await pool.query(
        `SELECT id, editora, ano
           FROM edicoes WHERE obra_id = $1
          ORDER BY ano NULLS LAST, id`,
        [obra_id]
      );
      edicoes = er.rows;
    }
    const cadeia = await cadeiaDeSuperiores(aula.superior_id);
    return res.status(400).render("uso-form", {
      titulo: `Adicionar Obra — ${aula.titulo}`,
      aula,
      cadeia,
      obras: or.rows,
      edicoes,
      valores: {
        obra_id: obra_id ? String(obra_id) : "",
        edicao_id: edicao_id ? String(edicao_id) : "",
        papel, modalidade, orientacao: orientacao || "",
        recortes: recortes.length > 0 ? recortes : [
          { rotulo: "", tipo: "capitulo", observacao: "" }
        ]
      },
      erros,
      modo: "criar",
      acao: `/unidades/${id}/usos/novo`,
      cancelarUrl: `/unidades/${id}`,
      papeis: Object.entries(ROTULO_PAPEL),
      modalidades: Object.entries(ROTULO_MODALIDADE),
      tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO usos
         (aula_id, obra_id, edicao_id, papel, modalidade, orientacao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, obra_id, edicao_id, papel, modalidade, orientacao]
    );

    const usoR = await client.query(
      "SELECT id FROM usos WHERE aula_id = $1 AND obra_id = $2 ORDER BY id DESC LIMIT 1",
      [id, obra_id]
    );
    const usoId = usoR.rows[0].id;

    for (let i = 0; i < recortes.length; i++) {
      const r = recortes[i];
      await client.query(
        `INSERT INTO usos_recortes (uso_id, rotulo, tipo, observacao, ordem)
         VALUES ($1, $2, $3, $4, $5)`,
        [usoId, r.rotulo, r.tipo, r.observacao, i + 1]
      );
    }

    await client.query("COMMIT");
    res.redirect(`/unidades/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar uso:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao salvar. Nada foi gravado.");
  } finally {
    client.release();
  }
});

app.post("/unidades/:id/usos/:uso_id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(usoId) || usoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id FROM usos WHERE id = $1 AND aula_id = $2",
    [usoId, id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Uso não encontrado.");
  }

  await pool.query("DELETE FROM usos WHERE id = $1", [usoId]);

  res.redirect(`/unidades/${id}?salvo=1`);
});

app.post("/unidades/:id/usos/:uso_id/validar", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(usoId) || usoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id FROM usos WHERE id = $1 AND aula_id = $2",
    [usoId, id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Uso não encontrado.");
  }

  await pool.query(
    "UPDATE usos SET validado_em = now() WHERE id = $1",
    [usoId]
  );

  res.redirect(`/unidades/${id}?salvo=1`);
});

app.post("/unidades/:id/usos/:uso_id/reabrir", async (req, res) => {
  const id = Number(req.params.id);
  const usoId = Number(req.params.uso_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(usoId) || usoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id FROM usos WHERE id = $1 AND aula_id = $2",
    [usoId, id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Uso não encontrado.");
  }

  await pool.query(
    "UPDATE usos SET validado_em = NULL WHERE id = $1",
    [usoId]
  );

  res.redirect(`/unidades/${id}?salvo=1`);
});

// ----- Fim das rotas de uso -----

app.get("/revisao", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT o.id, o.titulo,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS autores,
              (SELECT COUNT(*)::int FROM usos u WHERE u.obra_id = o.id) AS total_usos,
              (
                SELECT COUNT(*)::int
                  FROM usos u
                 WHERE u.obra_id = o.id
                   AND (
                     EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id)
                   )
                   AND (
                     u.validado_em IS NULL
                     OR EXISTS (
                       SELECT 1 FROM usos u3
                        WHERE u3.obra_id = u.obra_id
                          AND u3.aula_id <> u.aula_id
                          AND u3.atualizado_em > u.validado_em
                     )
                   )
              ) AS usos_a_avaliar
         FROM obras o
        WHERE o.arquivada = false
          AND EXISTS (
            SELECT 1
              FROM usos u
             WHERE u.obra_id = o.id
               AND (
                 EXISTS (SELECT 1 FROM usos u2 WHERE u2.obra_id = u.obra_id AND u2.aula_id <> u.aula_id)
               )
               AND (
                 u.validado_em IS NULL
                 OR EXISTS (
                   SELECT 1 FROM usos u3
                    WHERE u3.obra_id = u.obra_id
                      AND u3.aula_id <> u.aula_id
                      AND u3.atualizado_em > u.validado_em
                 )
               )
          )
        ORDER BY o.titulo`,
      []
    );

    res.render("revisao", {
      titulo: "Revisão de Usos",
      obras: r.rows
    });
  } catch (err) {
    console.error("Erro na fila de revisão:", err.message);
    res.status(500).type("text/plain").send("Erro ao carregar a fila de revisão.");
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
    "SELECT id, tipo, titulo, codigo FROM unidades WHERE superior_id = $1 AND arquivada = false ORDER BY ordem, id",
    [id]
  );

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
  const proximo = PROXIMO_NIVEL[unidade.tipo];

  let ficha = null;
  if (unidade.tipo === "aula") {
    const fr = await pool.query(
      `SELECT id, conteudo_html, versao_atual, criado_em, atualizado_em
         FROM fichas
        WHERE aula_id = $1`,
      [id]
    );
    if (fr.rows.length > 0) {
      ficha = fr.rows[0];
    }
  }

  let usosAula = [];
  if (unidade.tipo === "aula") {
    const ua = await pool.query(
      `SELECT u.id, u.obra_id, u.edicao_id, u.papel, u.modalidade,
              u.orientacao, u.observacoes, u.validado_em, u.atualizado_em,
              o.titulo AS obra_titulo,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS obra_autores,
              e.id AS edicao_id_ref, e.editora AS edicao_editora, e.ano AS edicao_ano,
              e.capa_url AS edicao_capa_url,
              (
                EXISTS (
                  SELECT 1 FROM usos u2
                   WHERE u2.obra_id = u.obra_id
                     AND u2.aula_id <> u.aula_id
                )
                AND (
                  u.validado_em IS NULL
                  OR EXISTS (
                    SELECT 1 FROM usos u3
                     WHERE u3.obra_id = u.obra_id
                       AND u3.aula_id <> u.aula_id
                       AND u3.atualizado_em > u.validado_em
                  )
                )
              ) AS a_avaliar
         FROM usos u
         JOIN obras o ON o.id = u.obra_id
         LEFT JOIN edicoes e ON e.id = u.edicao_id
        WHERE u.aula_id = $1
        ORDER BY
          CASE u.papel
            WHEN 'texto_base' THEN 1
            WHEN 'texto_complementar' THEN 2
            WHEN 'ficcao_ancora' THEN 3
            WHEN 'ficcao_complementar' THEN 4
            ELSE 5
          END,
          o.titulo`,
      [id]
    );

    const usoIds = ua.rows.map((u) => u.id);
    let recortesPorUso = {};
    if (usoIds.length > 0) {
      const rr = await pool.query(
        `SELECT id, uso_id, rotulo, tipo, observacao, ordem
           FROM usos_recortes
          WHERE uso_id = ANY($1::bigint[])
          ORDER BY uso_id, ordem, id`,
        [usoIds]
      );
      for (const r of rr.rows) {
        if (!recortesPorUso[r.uso_id]) recortesPorUso[r.uso_id] = [];
        recortesPorUso[r.uso_id].push(r);
      }
    }

    usosAula = ua.rows.map((u) => ({
      ...u,
      recortes: recortesPorUso[u.id] || [],
      rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel,
      rotuloModalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade,
      a_avaliar: u.a_avaliar,
      rotuloEstado: u.a_avaliar ? "A Avaliar" : "Validado"
    }));
  }

  let caminhoCurricular = "";
  if (unidade.tipo === "aula") {
    const cadeiaDaAula = await cadeiaDeSuperiores(id);
    caminhoCurricular = cadeiaDaAula.map((u) => u.titulo).join(" › ");
  }

  const salvo = req.query.salvo === "1";
  const nadaMudou = req.query.salvo === "0";

  res.render("unidade-detalhe", {
    titulo: unidade.titulo,
    unidade,
    filhos: filhosR.rows,
    cadeia,
    rotuloTipo: ROTULO_TIPO[unidade.tipo],
    rotuloTipoExibido: rotuloTipoOuOmissao(unidade.tipo, unidade.codigo),
    proximoNivel: proximo,
    rotuloProximo: proximo ? ROTULO_TIPO[proximo] : null,
    rotuloNovoProximo: proximo ? ROTULO_NOVO[proximo] : null,
    nomeFilhoPlural: unidade.tipo === "aula" ? null : NOME_FILHO_PLURAL[unidade.tipo],
    ficha,
    usosAula,
    caminhoCurricular,
    salvo,
    nadaMudou
  });
});

// ----- Rota: exportar livros (JSON) -----

app.get("/exportar/livros", async (req, res) => {
  try {
    const obrasR = await pool.query(
      `SELECT o.id, o.titulo, o.tipo_material,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS autores
         FROM obras o
        WHERE o.arquivada = false
        ORDER BY o.titulo`
    );

    const usosR = await pool.query(
      `SELECT u.obra_id, u.papel, u.modalidade, u.orientacao,
              u.validado_em,
              a.id AS aula_id, a.titulo AS aula_titulo,
              e.editora AS edicao_editora, e.ano AS edicao_ano,
              (
                EXISTS (
                  SELECT 1 FROM usos u2
                   WHERE u2.obra_id = u.obra_id
                     AND u2.aula_id <> u.aula_id
                )
                AND (
                  u.validado_em IS NULL
                  OR EXISTS (
                    SELECT 1 FROM usos u3
                     WHERE u3.obra_id = u.obra_id
                       AND u3.aula_id <> u.aula_id
                       AND u3.atualizado_em > u.validado_em
                  )
                )
              ) AS a_avaliar
         FROM usos u
         JOIN unidades a ON a.id = u.aula_id
         LEFT JOIN edicoes e ON e.id = u.edicao_id
        ORDER BY a.titulo`
    );

    const recortesR = await pool.query(
      `SELECT uso_id, rotulo, tipo, observacao, ordem
         FROM usos_recortes
        ORDER BY uso_id, ordem, id`
    );

    const recortesPorUso = {};
    for (const r of recortesR.rows) {
      if (!recortesPorUso[r.uso_id]) recortesPorUso[r.uso_id] = [];
      recortesPorUso[r.uso_id].push(r);
    }

    // Caminhos curriculares das aulas
    const aulasIds = [...new Set(usosR.rows.map((u) => u.aula_id))];
    const caminhosPorAula = {};
    if (aulasIds.length > 0) {
      const caminhosR = await pool.query(
        `WITH RECURSIVE arvore AS (
           SELECT id AS raiz_id, id, titulo, superior_id, 1 AS nivel
             FROM unidades
            WHERE id = ANY($1::bigint[])
           UNION ALL
           SELECT a.raiz_id, u.id, u.titulo, u.superior_id, a.nivel + 1
             FROM unidades u
             JOIN arvore a ON u.id = a.superior_id
         )
         SELECT raiz_id,
                STRING_AGG(titulo, ' › ' ORDER BY nivel DESC) AS caminho
           FROM arvore
          GROUP BY raiz_id`,
        [aulasIds]
      );
      for (const row of caminhosR.rows) {
        caminhosPorAula[row.raiz_id] = row.caminho;
      }
    }

    // Monta o JSON agrupado por obra
    const obrasMap = new Map();
    for (const o of obrasR.rows) {
      obrasMap.set(o.id, {
        titulo: o.titulo,
        autores: o.autores ? o.autores.split(", ") : [],
        tipo_material: o.tipo_material,
        usos: []
      });
    }

    // Precisamos dos IDs de uso para buscar recortes. A consulta de usos não traz o id.
    // Refaz a consulta com o id para casar com os recortes.
    const usosComIdR = await pool.query(
      `SELECT u.id AS uso_id, u.obra_id, u.papel, u.modalidade, u.orientacao,
              u.validado_em,
              a.id AS aula_id, a.titulo AS aula_titulo,
              e.editora AS edicao_editora, e.ano AS edicao_ano,
              (
                EXISTS (
                  SELECT 1 FROM usos u2
                   WHERE u2.obra_id = u.obra_id
                     AND u2.aula_id <> u.aula_id
                )
                AND (
                  u.validado_em IS NULL
                  OR EXISTS (
                    SELECT 1 FROM usos u3
                     WHERE u3.obra_id = u.obra_id
                       AND u3.aula_id <> u.aula_id
                       AND u3.atualizado_em > u.validado_em
                  )
                )
              ) AS a_avaliar
         FROM usos u
         JOIN unidades a ON a.id = u.aula_id
         LEFT JOIN edicoes e ON e.id = u.edicao_id
        ORDER BY a.titulo`
    );

    for (const u of usosComIdR.rows) {
      const obra = obrasMap.get(u.obra_id);
      if (!obra) continue;
      obra.usos.push({
        aula_titulo: u.aula_titulo,
        aula_caminho: caminhosPorAula[u.aula_id] || "",
        papel: ROTULO_PAPEL[u.papel] || u.papel,
        modalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade,
        edicao: u.edicao_editora
          ? `${u.edicao_editora}${u.edicao_ano ? ", " + u.edicao_ano : ""}`
          : null,
        orientacao: u.orientacao || null,
        recortes: (recortesPorUso[u.uso_id] || []).map((r) => ({
          tipo: r.tipo,
          rotulo: r.rotulo || null,
          observacao: r.observacao || null
        })),
        estado: u.a_avaliar ? "A Avaliar" : "Validado"
      });
    }

    const json = {
      versao_formato: 1,
      exportado_em: new Date().toISOString(),
      obras: Array.from(obrasMap.values()).map((o) => ({
        ...o,
        tipo_material: ROTULO_TIPO_MATERIAL[o.tipo_material] || o.tipo_material
      }))
    };

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivoExportacao("livros")}"`
    );
    res.type("application/json").send(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Erro ao exportar livros:", err.message);
    res.status(500).type("text/plain").send("Erro ao exportar livros.");
  }
});

// ----- Rota: exportar ementa (JSON) -----

app.get("/exportar/ementa", async (req, res) => {
  try {
    const unidadesR = await pool.query(
      `SELECT id, tipo, titulo, codigo, superior_id, ordem, descricao, pergunta_norteadora
         FROM unidades
        WHERE arquivada = false
        ORDER BY tipo, ordem, id`
    );

    // Mapear por id para montar a árvore
    const porId = new Map();
    for (const u of unidadesR.rows) {
      porId.set(u.id, {
        id: u.id,
        titulo: u.titulo,
        codigo: u.codigo || null,
        descricao: u.descricao || null,
        pergunta_norteadora: u.pergunta_norteadora || null,
        ordem: u.ordem,
        tipo: u.tipo,
        filhos: []
      });
    }

    const raizes = [];
    for (const u of porId.values()) {
      if (u.tipo === "eixo") {
        raizes.push(u);
      } else {
        // Encontrar o pai
        const pai = unidadesR.rows.find((x) => x.id === u.id);
        const paiId = pai ? pai.superior_id : null;
        const paiObj = paiId ? porId.get(paiId) : null;
        if (paiObj) {
          paiObj.filhos.push(u);
        }
      }
    }

    // Função de ordenação
    function ordenarArvore(no) {
      no.filhos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.id - b.id);
      for (const f of no.filhos) ordenarArvore(f);
    }
    for (const r of raizes) ordenarArvore(r);

    // Transformar a árvore em estrutura nomeada
    function converter(no) {
      if (no.tipo === "eixo") {
        return {
          id: no.id,
          titulo: no.titulo,
          codigo: no.codigo,
          descricao: no.descricao,
          ordem: no.ordem,
          disciplinas: no.filhos
            .filter((f) => f.tipo === "disciplina")
            .map(converterDisciplina)
        };
      }
      return null;
    }

    function converterDisciplina(no) {
      return {
        id: no.id,
        titulo: no.titulo,
        codigo: no.codigo,
        descricao: no.descricao,
        ordem: no.ordem,
        temas: no.filhos.filter((f) => f.tipo === "tema").map(converterTema)
      };
    }

    function converterTema(no) {
      return {
        id: no.id,
        titulo: no.titulo,
        codigo: no.codigo,
        pergunta_norteadora: no.pergunta_norteadora,
        ordem: no.ordem,
        aulas: no.filhos.filter((f) => f.tipo === "aula").map(converterAula)
      };
    }

    function converterAula(no) {
      return {
        id: no.id,
        titulo: no.titulo,
        codigo: no.codigo,
        ordem: no.ordem
      };
    }

    const json = {
      versao_formato: 1,
      exportado_em: new Date().toISOString(),
      eixos: raizes.map(converter)
    };

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivoExportacao("ementa")}"`
    );
    res.type("application/json").send(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Erro ao exportar ementa:", err.message);
    res.status(500).type("text/plain").send("Erro ao exportar ementa.");
  }
});

app.get("/health", async (req, res) => {
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS total FROM unidades WHERE arquivada = false");
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