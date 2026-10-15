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

const ROTULO_TIPO_MATERIAL = {
  livro: "Livro",
  ensaio: "Ensaio",
  capitulo_coletanea: "Capítulo de Coletânea",
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

const ROTULO_ESTADO_REVISAO = {
  a_avaliar: "A Avaliar",
  repeticao_validada: "Repetição Validada",
  substituicao_planejada: "Substituição Planejada",
  resolvida: "Resolvida"
};

const ROTULO_RECORTE_TIPO = {
  capitulo: "Capítulo",
  secao: "Seção",
  paginas: "Páginas",
  integral: "Obra Integral",
  a_conferir: "A Conferir"
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

async function caminhoCurricularDaAula(aulaId) {
  const cadeia = await cadeiaDeSuperiores(aulaId);
  return cadeia.map((u) => u.titulo).join(" › ");
}


function rotuloTipoOuOmissao(tipo, codigo) {
  const rotulo = ROTULO_TIPO[tipo] || tipo;
  if (!codigo) return rotulo;
  const codigoUpper = String(codigo).toUpperCase();
  const rotuloUpper = String(rotulo).toUpperCase();
  if (codigoUpper.startsWith(rotuloUpper)) {
    return null; // omite o tipo
  }
  return rotulo;
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

    // #14: rótulo do tipo, omitido quando o código começa com ele
  const rotuloTipoExibido = rotuloTipoOuOmissao(unidade.tipo, unidade.codigo);


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

// ----- Rota: tela intermediária para nova aula -----

app.get("/aulas/nova", async (req, res) => {
  const busca = String(req.query.q || "").trim();

  // Busca todos os temas, com sua cadeia de superiores
  const temasR = await pool.query(
    `SELECT
        t.id AS tema_id, t.titulo AS tema_titulo, t.codigo AS tema_codigo,
        m.id AS modulo_id, m.titulo AS modulo_titulo,
        d.id AS disciplina_id, d.titulo AS disciplina_titulo,
        e.id AS eixo_id, e.titulo AS eixo_titulo
       FROM unidades t
       JOIN unidades m ON m.id = t.superior_id AND m.tipo = 'modulo'
       JOIN unidades d ON d.id = m.superior_id AND d.tipo = 'disciplina'
       JOIN unidades e ON e.id = d.superior_id AND e.tipo = 'eixo'
      WHERE t.tipo = 'tema'
      ORDER BY e.ordem, e.titulo, d.ordem, d.titulo, m.ordem, m.titulo, t.ordem, t.titulo`
  );

  // Filtro por busca (em memória — a lista de temas não é gigante)
  let temas = temasR.rows;
  if (busca) {
    const b = busca.toLowerCase();
    temas = temas.filter((t) =>
      t.tema_titulo.toLowerCase().includes(b) ||
      (t.tema_codigo && t.tema_codigo.toLowerCase().includes(b)) ||
      t.modulo_titulo.toLowerCase().includes(b) ||
      t.disciplina_titulo.toLowerCase().includes(b) ||
      t.eixo_titulo.toLowerCase().includes(b)
    );
  }

  // Agrupa por eixo → disciplina → módulo → [temas]
  const porEixo = new Map();
  for (const t of temas) {
    if (!porEixo.has(t.eixo_id)) {
      porEixo.set(t.eixo_id, {
        id: t.eixo_id,
        titulo: t.eixo_titulo,
        disciplinas: new Map()
      });
    }
    const eixo = porEixo.get(t.eixo_id);
    if (!eixo.disciplinas.has(t.disciplina_id)) {
      eixo.disciplinas.set(t.disciplina_id, {
        id: t.disciplina_id,
        titulo: t.disciplina_titulo,
        modulos: new Map()
      });
    }
    const disc = eixo.disciplinas.get(t.disciplina_id);
    if (!disc.modulos.has(t.modulo_id)) {
      disc.modulos.set(t.modulo_id, {
        id: t.modulo_id,
        titulo: t.modulo_titulo,
        temas: []
      });
    }
    disc.modulos.get(t.modulo_id).temas.push({
      id: t.tema_id,
      titulo: t.tema_titulo,
      codigo: t.tema_codigo
    });
  }

  // Converte Maps para arrays (mais fácil de iterar no template)
  const estrutura = Array.from(porEixo.values()).map((e) => ({
    ...e,
    disciplinas: Array.from(e.disciplinas.values()).map((d) => ({
      ...d,
      modulos: Array.from(d.modulos.values())
    }))
  }));

  res.render("aula-nova-escolher-tema", {
    titulo: "Nova Aula — Escolher Tema",
    busca,
    estrutura,
    totalTemas: temas.length
  });
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
    `SELECT id, conteudo_markdown, estado_texto, estado_bibliografia, versao_atual
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
      conteudo_markdown: ficha.conteudo_markdown,
      estado_texto: ficha.estado_texto,
      estado_bibliografia: ficha.estado_bibliografia
    },
    erros: [],
    estadosTexto: Object.entries(ROTULO_ESTADO_TEXTO),
    estadosBibliografia: Object.entries(ROTULO_ESTADO_BIBLIOGRAFIA),
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

  const conteudo_markdown = String(req.body.conteudo_markdown || "");
  const estado_texto = String(req.body.estado_texto || "rascunho");
  const estado_bibliografia = String(req.body.estado_bibliografia || "pendente");
  const versaoQueAbri = Number(req.body.versao_que_abri) || 0;
  const forcar = String(req.body.forcar || "") === "1";

  const erros = [];
  if (!ROTULO_ESTADO_TEXTO[estado_texto]) erros.push("Estado do texto inválido.");
  if (!ROTULO_ESTADO_BIBLIOGRAFIA[estado_bibliografia]) erros.push("Estado da bibliografia inválido.");

  const fr = await pool.query(
    `SELECT id, conteudo_markdown, estado_texto, estado_bibliografia, versao_atual
       FROM fichas WHERE aula_id = $1`,
    [id]
  );
  const ficha = fr.rows.length > 0 ? fr.rows[0] : null;
  if (!ficha) {
    erros.push("Ficha não encontrada para esta aula.");
  }

  // Função auxiliar: renderiza o editor preservando o que veio no body
  async function renderizarEditorComErros(mensagens, conflitoAtivo) {
    const cadeia = await cadeiaDeSuperiores(unidade.superior_id);
    return res.status(400).render("ficha-editor", {
      titulo: `Editar Ficha — ${unidade.titulo}`,
      unidade,
      ficha: ficha || { versao_atual: 1 },
      cadeia,
      valores: {
        conteudo_markdown,
        estado_texto,
        estado_bibliografia
      },
      erros: mensagens,
      estadosTexto: Object.entries(ROTULO_ESTADO_TEXTO),
      estadosBibliografia: Object.entries(ROTULO_ESTADO_BIBLIOGRAFIA),
      conflito: conflitoAtivo
    });
  }

  if (erros.length > 0) {
    return renderizarEditorComErros(erros, null);
  }

  // F2: verificação atômica de versão. Se a versão que a usuária abriu
  // não for mais a atual, e não foi forçado, é conflito.
  // F1: em vez de redirecionar (que descarta o body), renderizamos o editor
  // com os valores do body + aviso de conflito.
  if (!forcar && versaoQueAbri > 0 && versaoQueAbri !== ficha.versao_atual) {
    return renderizarEditorComErros([], {
      versaoQueAbri,
      versaoAtual: ficha.versao_atual
    });
  }

  const mudou =
    ficha.conteudo_markdown !== conteudo_markdown ||
    ficha.estado_texto !== estado_texto ||
    ficha.estado_bibliografia !== estado_bibliografia;

  if (!mudou) {
    return res.redirect(`/unidades/${id}?salvo=0`);
  }

  // F2 + F3: salvamento atômico + transação.
  // O UPDATE só pega se versao_atual ainda for a que a usuária abriu
  // (a menos que forcar=1). Se não pegar, foi conflito por baixo dos panos.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateR = await client.query(
      `UPDATE fichas
          SET conteudo_markdown = $1,
              estado_texto = $2,
              estado_bibliografia = $3,
              versao_atual = versao_atual + 1,
              atualizado_em = now()
        WHERE id = $4
          AND ($5::boolean = true OR versao_atual = $6)
        RETURNING versao_atual`,
      [conteudo_markdown, estado_texto, estado_bibliografia, ficha.id, forcar, ficha.versao_atual]
    );

    if (updateR.rows.length === 0) {
      await client.query("ROLLBACK");
      // Alguém salvou no meio do caminho (conflito por baixo dos panos).
      // Recarrega a versão atual do banco para mostrar o conflito.
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
         (ficha_id, numero_versao, conteudo_markdown, estado_texto, estado_bibliografia, motivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ficha.id, novaVersao, conteudo_markdown, estado_texto, estado_bibliografia, motivo]
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

app.post("/unidades/:id/ficha/preview", async (req, res) => {
  const conteudo = String(req.body.conteudo_markdown || "");
  const html = conteudo.trim() ? marked.parse(conteudo) : "<p><em>(vazio)</em></p>";
  res.type("text/html").send(html);
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
    `SELECT id, numero_versao, estado_texto, estado_bibliografia, motivo, criado_em,
            LENGTH(conteudo_markdown) AS tamanho
       FROM fichas_versoes
      WHERE ficha_id = $1
      ORDER BY numero_versao DESC`,
    [ficha.id]
  );

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  const versoes = versoesR.rows.map((v) => ({
    ...v,
    rotuloEstadoTexto: ROTULO_ESTADO_TEXTO[v.estado_texto] || v.estado_texto,
    rotuloEstadoBibliografia: ROTULO_ESTADO_BIBLIOGRAFIA[v.estado_bibliografia] || v.estado_bibliografia
  }));

  res.render("ficha-versoes", {
    titulo: `Histórico — ${unidade.titulo}`,
    unidade,
    ficha,
    cadeia,
    versoes
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
    `SELECT id, numero_versao, conteudo_markdown, estado_texto, estado_bibliografia,
            motivo, criado_em
       FROM fichas_versoes
      WHERE ficha_id = $1 AND numero_versao = $2`,
    [ficha.id, numero]
  );
  if (vr.rows.length === 0) {
    return res.status(404).type("text/plain").send("Versão não encontrada.");
  }
  const versao = vr.rows[0];

  const cadeia = await cadeiaDeSuperiores(unidade.superior_id);

  versao.conteudo_html = versao.conteudo_markdown.trim()
    ? marked.parse(versao.conteudo_markdown)
    : null;
  versao.rotuloEstadoTexto = ROTULO_ESTADO_TEXTO[versao.estado_texto] || versao.estado_texto;
  versao.rotuloEstadoBibliografia =
    ROTULO_ESTADO_BIBLIOGRAFIA[versao.estado_bibliografia] || versao.estado_bibliografia;

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
    `SELECT numero_versao, conteudo_markdown, estado_texto, estado_bibliografia
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
          SET conteudo_markdown = $1,
              estado_texto = $2,
              estado_bibliografia = $3,
              versao_atual = versao_atual + 1,
              atualizado_em = now()
        WHERE id = $4
        RETURNING versao_atual`,
      [versao.conteudo_markdown, versao.estado_texto, versao.estado_bibliografia, ficha.id]
    );

    const novaVersao = updateR.rows[0].versao_atual;

    await client.query(
      `INSERT INTO fichas_versoes
         (ficha_id, numero_versao, conteudo_markdown, estado_texto, estado_bibliografia, motivo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ficha.id,
        novaVersao,
        versao.conteudo_markdown,
        versao.estado_texto,
        versao.estado_bibliografia,
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
                SELECT STRING_AGG(DISTINCT titulo_eixo, ' · ')
                  FROM (
                    SELECT COALESCE(eixo.titulo, 'Sem eixo') AS titulo_eixo
                      FROM usos u
                      JOIN unidades aula ON aula.id = u.aula_id
                      LEFT JOIN unidades tema ON tema.id = aula.superior_id
                      LEFT JOIN unidades modulo ON modulo.id = tema.superior_id
                      LEFT JOIN unidades disciplina ON disciplina.id = modulo.superior_id
                      LEFT JOIN unidades eixo ON eixo.id = disciplina.superior_id
                     WHERE u.obra_id = o.id
                  ) sub
              ) AS eixos,
              (
                SELECT jsonb_object_agg(estado_revisao, total)
                  FROM (
                    SELECT estado_revisao, COUNT(*) AS total
                      FROM usos u
                     WHERE u.obra_id = o.id
                     GROUP BY estado_revisao
                  ) sub2
              ) AS estados_revisao_contagem,
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

    const obras = r.rows.map((o) => {
      const estados = o.estados_revisao_contagem || {};
      const resumoEstados = Object.entries(estados)
        .map(([estado, total]) => {
          const rotulo = ROTULO_ESTADO_REVISAO[estado] || estado;
          const rotuloMinusculo = rotulo.charAt(0).toLowerCase() + rotulo.slice(1);
          return `${total} ${rotuloMinusculo}`;
        })
        .join(", ");

      return {
        ...o,
        rotuloTipoMaterial: ROTULO_TIPO_MATERIAL[o.tipo_material] || o.tipo_material,
        rotuloEstadoVerificacao: ROTULO_ESTADO_VERIFICACAO[o.estado_verificacao] || o.estado_verificacao,
        resumoEstados
      };
    });

    res.render("obras-lista", {
      titulo: "Bibliografia",
      obras,
      filtros: {
        q: busca,
        tipo: tipoFiltro,
        estado: estadoFiltro
      },
      temFiltro: Boolean(busca || tipoFiltro || estadoFiltro),
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
      edicao_observacoes: "",
      edicao_estado: "pendente",
      incluir_edicao: false
    },
    erros: [],
    tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

app.post("/obras/nova", async (req, res) => {
  const titulo = String(req.body.titulo || "").trim();
  const titulo_original = String(req.body.titulo_original || "").trim() || null;
  const idioma_original = String(req.body.idioma_original || "").trim() || null;
  const tipo_material = String(req.body.tipo_material || "livro").trim();
  const autoresRaw = String(req.body.autores || "").trim();
  const observacoes = String(req.body.observacoes || "").trim() || null;
  const estado_verificacao = String(req.body.estado_verificacao || "pendente").trim();

  const incluir_edicao = String(req.body.incluir_edicao || "") === "1";
  const edicao_editora = String(req.body.edicao_editora || "").trim() || null;
  const edicao_anoRaw = String(req.body.edicao_ano || "").trim();
  const edicao_numero = String(req.body.edicao_numero || "").trim() || null;
  const edicao_traducao = String(req.body.edicao_traducao || "").trim() || null;
  const edicao_idioma = String(req.body.edicao_idioma || "").trim() || null;
  const edicao_isbn = String(req.body.edicao_isbn || "").trim() || null;
  const edicao_link = String(req.body.edicao_link || "").trim() || null;
  const edicao_observacoes = String(req.body.edicao_observacoes || "").trim() || null;
  const edicao_estado = String(req.body.edicao_estado || "pendente").trim();

  const erros = [];
  if (!titulo) erros.push("O título da obra é obrigatório.");
  if (!ROTULO_TIPO_MATERIAL[tipo_material]) erros.push("Tipo de material inválido.");
  if (!ROTULO_ESTADO_VERIFICACAO[estado_verificacao]) erros.push("Estado de verificação da obra inválido.");
  if (!ROTULO_ESTADO_VERIFICACAO[edicao_estado]) erros.push("Estado de verificação da edição inválido.");

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

  if (erros.length > 0) {
    return res.status(400).render("obra-form", {
      titulo: "Nova Obra",
      valores: {
        titulo, titulo_original: titulo_original || "", idioma_original: idioma_original || "",
        tipo_material, autores: autoresRaw, observacoes: observacoes || "", estado_verificacao,
        edicao_editora: edicao_editora || "", edicao_ano: edicao_anoRaw, edicao_numero: edicao_numero || "",
        edicao_traducao: edicao_traducao || "", edicao_idioma: edicao_idioma || "",
        edicao_isbn: edicao_isbn || "", edicao_link: edicao_link || "",
        edicao_observacoes: edicao_observacoes || "", edicao_estado,
        incluir_edicao
      },
      erros,
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  let estadoObraFinal = estado_verificacao;
  if (autores.length === 0 && estadoObraFinal === "verificada") {
    estadoObraFinal = "incompleta";
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const obraR = await client.query(
      `INSERT INTO obras
         (titulo, titulo_original, idioma_original, tipo_material,
          observacoes, estado_verificacao)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [titulo, titulo_original, idioma_original, tipo_material, observacoes, estadoObraFinal]
    );
    const obraId = obraR.rows[0].id;

    for (let i = 0; i < autores.length; i++) {
      await client.query(
        "INSERT INTO obras_autores (obra_id, nome, ordem) VALUES ($1, $2, $3)",
        [obraId, autores[i], i + 1]
      );
    }

    if (incluir_edicao) {
      await client.query(
        `INSERT INTO edicoes
           (obra_id, editora, ano, numero_edicao, traducao, idioma, isbn,
            link_referencia, observacoes, estado_verificacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [obraId, edicao_editora, edicao_ano, edicao_numero, edicao_traducao,
         edicao_idioma, edicao_isbn, edicao_link, edicao_observacoes, edicao_estado]
      );
    }

    await client.query("COMMIT");
    res.redirect("/obras");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar obra:", err.message);
    return res.status(500).render("obra-form", {
      titulo: "Nova Obra",
      valores: {
        titulo, titulo_original: titulo_original || "", idioma_original: idioma_original || "",
        tipo_material, autores: autoresRaw, observacoes: observacoes || "", estado_verificacao,
        edicao_editora: edicao_editora || "", edicao_ano: edicao_anoRaw, edicao_numero: edicao_numero || "",
        edicao_traducao: edicao_traducao || "", edicao_idioma: edicao_idioma || "",
        edicao_isbn: edicao_isbn || "", edicao_link: edicao_link || "",
        edicao_observacoes: edicao_observacoes || "", edicao_estado,
        incluir_edicao
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

app.get("/obras/:id/decisoes/nova", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query(
    "SELECT id, titulo FROM obras WHERE id = $1",
    [id]
  );
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const usosR = await pool.query(
    `SELECT u.id, u.papel, u.modalidade, u.estado_revisao,
            a.titulo AS aula_titulo
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

  const usos = usosR.rows.map((u) => ({
    ...u,
    rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel,
    rotuloModalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade,
    rotuloEstadoRevisao: ROTULO_ESTADO_REVISAO[u.estado_revisao] || u.estado_revisao
  }));

  let usosPreSelecionados = [];
  if (req.query.usos) {
    usosPreSelecionados = String(req.query.usos)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  res.render("decisao-form", {
    titulo: `Nova Decisão — ${obra.titulo}`,
    obra,
    usos,
    valores: {
      estado: "repeticao_validada",
      justificativa: "",
      usosSelecionados: usosPreSelecionados
    },
    erros: [],
    estadosRevisao: Object.entries(ROTULO_ESTADO_REVISAO)
  });
});

app.post("/obras/:id/decisoes/nova", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query(
    "SELECT id, titulo FROM obras WHERE id = $1",
    [id]
  );
  if (or.rows.length === 0) {
    return res.status(404).type("text/plain").send("Obra não encontrada.");
  }
  const obra = or.rows[0];

  const estado = String(req.body.estado || "").trim();
  const justificativa = String(req.body.justificativa || "").trim();
  const usosSelecionados = [].concat(req.body.usos || [])
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

  const erros = [];
  if (!ROTULO_ESTADO_REVISAO[estado]) erros.push("Estado de revisão inválido.");
  if (!justificativa) erros.push("A justificativa é obrigatória.");
  if (usosSelecionados.length === 0) erros.push("Selecione pelo menos um uso.");

  if (usosSelecionados.length > 0) {
    const vr = await pool.query(
      "SELECT id FROM usos WHERE id = ANY($1::bigint[]) AND obra_id = $2",
      [usosSelecionados, id]
    );
    if (vr.rows.length !== usosSelecionados.length) {
      erros.push("Um ou mais usos selecionados não pertencem a esta obra.");
    }
  }

  const usosR = await pool.query(
    `SELECT u.id, u.papel, u.modalidade, u.estado_revisao,
            a.titulo AS aula_titulo
       FROM usos u
       JOIN unidades a ON a.id = u.aula_id
      WHERE u.obra_id = $1
      ORDER BY a.titulo`,
    [id]
  );

  const usos = usosR.rows.map((u) => ({
    ...u,
    rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel,
    rotuloModalidade: ROTULO_MODALIDADE[u.modalidade] || u.modalidade,
    rotuloEstadoRevisao: ROTULO_ESTADO_REVISAO[u.estado_revisao] || u.estado_revisao
  }));

  if (erros.length > 0) {
    return res.status(400).render("decisao-form", {
      titulo: `Nova Decisão — ${obra.titulo}`,
      obra,
      usos,
      valores: {
        estado,
        justificativa,
        usosSelecionados
      },
      erros,
      estadosRevisao: Object.entries(ROTULO_ESTADO_REVISAO)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dR = await client.query(
      `INSERT INTO decisoes_revisao (obra_id, estado, justificativa)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [id, estado, justificativa]
    );
    const decisaoId = dR.rows[0].id;

    for (const usoId of usosSelecionados) {
      await client.query(
        "INSERT INTO decisoes_usos (decisao_id, uso_id) VALUES ($1, $2)",
        [decisaoId, usoId]
      );
      await client.query(
        "UPDATE usos SET estado_revisao = $1, atualizado_em = now() WHERE id = $2",
        [estado, usoId]
      );
    }

    await client.query("COMMIT");
    res.redirect(`/obras/${id}?salvo=1`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar decisão:", err.message);
    res.status(500).type("text/plain").send("Erro interno ao salvar. Nada foi gravado.");
  } finally {
    client.release();
  }
});

app.post("/obras/:id/decisoes/:decisao_id/excluir", async (req, res) => {
  const id = Number(req.params.id);
  const decisaoId = Number(req.params.decisao_id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(decisaoId) || decisaoId <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const r = await pool.query(
    "SELECT id FROM decisoes_revisao WHERE id = $1 AND obra_id = $2",
    [decisaoId, id]
  );
  if (r.rows.length === 0) {
    return res.status(404).type("text/plain").send("Decisão não encontrada.");
  }

  await pool.query("DELETE FROM decisoes_revisao WHERE id = $1", [decisaoId]);

  res.redirect(`/obras/${id}?salvo=1`);
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
    `SELECT id, editora, ano, numero_edicao, traducao, idioma, isbn,
            link_referencia, observacoes, estado_verificacao, capa_url,
            criado_em, atualizado_em
       FROM edicoes
      WHERE obra_id = $1
      ORDER BY ano NULLS LAST, id`,
    [id]
  );

  const usosR = await pool.query(
    `SELECT u.id, u.papel, u.modalidade, u.orientacao, u.observacoes,
            u.estado_revisao, u.criado_em, u.atualizado_em,
            a.id AS aula_id, a.titulo AS aula_titulo, a.codigo AS aula_codigo,
            e.id AS edicao_id, e.editora AS edicao_editora, e.ano AS edicao_ano
       FROM usos u
       JOIN unidades a ON a.id = u.aula_id
       LEFT JOIN edicoes e ON e.id = u.edicao_id
      WHERE u.obra_id = $1
      ORDER BY a.titulo`,
    [id]
  );

    // M2: para cada uso, calcular o caminho curricular da aula
  const aulasIds = [...new Set(usosR.rows.map((u) => u.aula_id))];
  const caminhosPorAula = {};
  if (aulasIds.length > 0) {
    // Busca a cadeia de cada aula de uma vez, usando uma única query com CTE
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
      `SELECT id, uso_id, rotulo, tipo, inicio, fim, observacao, ordem
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

    // F6: contar aulas distintas em que a obra aparece
  const totalAulasDistintasR = await pool.query(
    "SELECT COUNT(DISTINCT aula_id)::int AS total FROM usos WHERE obra_id = $1",
    [id]
  );
  const totalAulasDistintas = totalAulasDistintasR.rows[0].total;


  const decisoesR = await pool.query(
    `SELECT d.id, d.estado, d.justificativa, d.criado_em
       FROM decisoes_revisao d
      WHERE d.obra_id = $1
      ORDER BY d.criado_em DESC`,
    [id]
  );

  const decisoesIds = decisoesR.rows.map((d) => d.id);
  let usosPorDecisao = {};
  let usoInfoPorId = {};
  for (const u of usosR.rows) {
    usoInfoPorId[u.id] = u;
  }
  if (decisoesIds.length > 0) {
    const dr = await pool.query(
      `SELECT du.decisao_id, du.uso_id
         FROM decisoes_usos du
        WHERE du.decisao_id = ANY($1::bigint[])`,
      [decisoesIds]
    );
    for (const r of dr.rows) {
      if (!usosPorDecisao[r.decisao_id]) usosPorDecisao[r.decisao_id] = [];
      usosPorDecisao[r.decisao_id].push(r.uso_id);
    }
  }

  const decisoes = decisoesR.rows.map((d) => {
    const usosIdsDec = usosPorDecisao[d.id] || [];
    const usosDaDecisao = usosIdsDec
      .map((uid) => usoInfoPorId[uid])
      .filter(Boolean);

    const dataDecisao = new Date(d.criado_em);
    const vencida = usosDaDecisao.some(
      (u) => new Date(u.atualizado_em) > dataDecisao
    );

    return {
      ...d,
      rotuloEstado: ROTULO_ESTADO_REVISAO[d.estado] || d.estado,
      usos: usosDaDecisao.map((u) => ({
        id: u.id,
        aula_titulo: u.aula_titulo,
        rotuloPapel: ROTULO_PAPEL[u.papel] || u.papel
      })),
      vencida
    };
  });

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
    rotuloEstadoRevisao: ROTULO_ESTADO_REVISAO[u.estado_revisao] || u.estado_revisao,
    caminho: caminhosPorAula[u.aula_id] || ""
  }));

  const salvo = req.query.salvo === "1";

    res.render("obra-detalhe", {
    titulo: obra.titulo,
    obra,
    autores: autoresR.rows,
    edicoes,
    usos,
    totalAulasDistintas,
    decisoes,
    salvo
  });
});

// ----- Rotas de edição de obra e edições (R4) -----

// Rota: formulário de editar obra
app.get("/obras/:id/editar", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).type("text/plain").send("Id inválido.");
  }

  const or = await pool.query(
    `SELECT id, titulo, titulo_original, idioma_original, tipo_material,
            observacoes, estado_verificacao
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
      titulo_original: obra.titulo_original || "",
      idioma_original: obra.idioma_original || "",
      tipo_material: obra.tipo_material,
      autores: autoresTexto,
      observacoes: obra.observacoes || "",
      estado_verificacao: obra.estado_verificacao
    },
    erros: [],
    tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

// Rota: salvar edição de obra
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
  const titulo_original = String(req.body.titulo_original || "").trim() || null;
  const idioma_original = String(req.body.idioma_original || "").trim() || null;
  const tipo_material = String(req.body.tipo_material || "livro").trim();
  const autoresRaw = String(req.body.autores || "").trim();
  const observacoes = String(req.body.observacoes || "").trim() || null;
  const estado_verificacao = String(req.body.estado_verificacao || "pendente").trim();

  const erros = [];
  if (!titulo) erros.push("O título da obra é obrigatório.");
  if (!ROTULO_TIPO_MATERIAL[tipo_material]) erros.push("Tipo de material inválido.");
  if (!ROTULO_ESTADO_VERIFICACAO[estado_verificacao]) erros.push("Estado de verificação inválido.");

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
        titulo_original: titulo_original || "",
        idioma_original: idioma_original || "",
        tipo_material,
        autores: autoresRaw,
        observacoes: observacoes || "",
        estado_verificacao
      },
      erros,
      tiposMaterial: Object.entries(ROTULO_TIPO_MATERIAL),
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  // Se ficou sem autor e estava verificada, marca incompleta
  let estadoFinal = estado_verificacao;
  if (autores.length === 0 && estadoFinal === "verificada") {
    estadoFinal = "incompleta";
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE obras
          SET titulo = $1,
              titulo_original = $2,
              idioma_original = $3,
              tipo_material = $4,
              observacoes = $5,
              estado_verificacao = $6,
              atualizado_em = now()
        WHERE id = $7`,
      [titulo, titulo_original, idioma_original, tipo_material, observacoes, estadoFinal, id]
    );

    // D37: apagar e reinserir autores
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

// Rota: formulário de nova edição
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
      numero_edicao: "",
      traducao: "",
      idioma: "",
      isbn: "",
      link_referencia: "",
      observacoes: "",
      estado_verificacao: "pendente"
    },
    erros: [],
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

// Rota: salvar nova edição
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
  const numero_edicao = String(req.body.numero_edicao || "").trim() || null;
  const traducao = String(req.body.traducao || "").trim() || null;
  const idioma = String(req.body.idioma || "").trim() || null;
  const isbn = String(req.body.isbn || "").trim() || null;
  const link_referencia = String(req.body.link_referencia || "").trim() || null;
  const observacoes = String(req.body.observacoes || "").trim() || null;
  const estado_verificacao = String(req.body.estado_verificacao || "pendente").trim();

  const erros = [];
  if (!ROTULO_ESTADO_VERIFICACAO[estado_verificacao]) erros.push("Estado de verificação inválido.");

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
      valores: { editora: editora || "", ano: anoRaw, numero_edicao: numero_edicao || "", traducao: traducao || "", idioma: idioma || "", isbn: isbn || "", link_referencia: link_referencia || "", observacoes: observacoes || "", estado_verificacao },
      erros,
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  await pool.query(
    `INSERT INTO edicoes
       (obra_id, editora, ano, numero_edicao, traducao, idioma, isbn, link_referencia, observacoes, estado_verificacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, editora, ano, numero_edicao, traducao, idioma, isbn, link_referencia, observacoes, estado_verificacao]
  );

  res.redirect(`/obras/${id}?salvo=1`);
});

// Rota: formulário de editar edição
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
    `SELECT id, editora, ano, numero_edicao, traducao, idioma, isbn,
            link_referencia, observacoes, estado_verificacao, capa_url
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
      numero_edicao: edicao.numero_edicao || "",
      traducao: edicao.traducao || "",
      idioma: edicao.idioma || "",
      isbn: edicao.isbn || "",
      link_referencia: edicao.link_referencia || "",
      observacoes: edicao.observacoes || "",
      estado_verificacao: edicao.estado_verificacao
    },
    erros: [],
    estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
  });
});

// Rota: salvar edição de edição
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
  const numero_edicao = String(req.body.numero_edicao || "").trim() || null;
  const traducao = String(req.body.traducao || "").trim() || null;
  const idioma = String(req.body.idioma || "").trim() || null;
  const isbn = String(req.body.isbn || "").trim() || null;
  const link_referencia = String(req.body.link_referencia || "").trim() || null;
  const observacoes = String(req.body.observacoes || "").trim() || null;
  const estado_verificacao = String(req.body.estado_verificacao || "pendente").trim();

  const erros = [];
  if (!ROTULO_ESTADO_VERIFICACAO[estado_verificacao]) erros.push("Estado de verificação inválido.");

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
      valores: { editora: editora || "", ano: anoRaw, numero_edicao: numero_edicao || "", traducao: traducao || "", idioma: idioma || "", isbn: isbn || "", link_referencia: link_referencia || "", observacoes: observacoes || "", estado_verificacao },
      erros,
      estadosVerificacao: Object.entries(ROTULO_ESTADO_VERIFICACAO)
    });
  }

  await pool.query(
    `UPDATE edicoes
        SET editora = $1, ano = $2, numero_edicao = $3, traducao = $4, idioma = $5,
            isbn = $6, link_referencia = $7, observacoes = $8, estado_verificacao = $9,
            atualizado_em = now()
      WHERE id = $10`,
    [editora, ano, numero_edicao, traducao, idioma, isbn, link_referencia, observacoes, estado_verificacao, edicaoId]
  );

  res.redirect(`/obras/${id}?salvo=1`);
});

// Rota: excluir edição (D35: bloqueia se em uso; D36: exclusão direta se não usada)
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

// ----- Rotas de edição de uso (R4) -----

// Rota: formulário de editar uso
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
    `SELECT id, obra_id, edicao_id, papel, modalidade, orientacao, observacoes, estado_revisao
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
    `SELECT id, editora, ano, numero_edicao, idioma
       FROM edicoes WHERE obra_id = $1
      ORDER BY ano NULLS LAST, id`,
    [uso.obra_id]
  );

  const rr = await pool.query(
    `SELECT rotulo, tipo, inicio, fim, observacao
       FROM usos_recortes WHERE uso_id = $1 ORDER BY ordem, id`,
    [usoId]
  );

  const recortes = rr.rows.length > 0 ? rr.rows : [
    { rotulo: "", tipo: "capitulo", inicio: "", fim: "", observacao: "" }
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
      observacoes: uso.observacoes || "",
      estado_revisao: uso.estado_revisao,
      recortes
    },
    erros: [],
    modo: "editar",
    acao: `/unidades/${id}/usos/${usoId}/editar`,
    cancelarUrl: `/unidades/${id}`,
    papeis: Object.entries(ROTULO_PAPEL),
    modalidades: Object.entries(ROTULO_MODALIDADE),
    estadosRevisao: Object.entries(ROTULO_ESTADO_REVISAO),
    tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
  });
});

// Rota: salvar edição de uso
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
  const observacoes = String(req.body.observacoes || "").trim() || null;
  const estado_revisao = String(req.body.estado_revisao || "").trim();

  const rotulos = [].concat(req.body.recorte_rotulo || []);
  const tipos = [].concat(req.body.recorte_tipo || []);
  const inicios = [].concat(req.body.recorte_inicio || []);
  const fins = [].concat(req.body.recorte_fim || []);
  const observacoesRec = [].concat(req.body.recorte_observacao || []);

  const erros = [];
  if (!obra_id) erros.push("Escolha uma obra.");
  if (!ROTULO_PAPEL[papel]) erros.push("Papel inválido.");
  if (!ROTULO_MODALIDADE[modalidade]) erros.push("Modalidade inválida.");
  if (!ROTULO_ESTADO_REVISAO[estado_revisao]) erros.push("Estado de revisão inválido.");

  if (obra_id) {
    const o = await pool.query("SELECT id, arquivada FROM obras WHERE id = $1", [obra_id]);
    if (o.rows.length === 0) erros.push("Obra não encontrada.");
    else if (o.rows[0].arquivada) erros.push("Esta obra está arquivada.");
  }

  if (edicao_id) {
    const e = await pool.query("SELECT id, obra_id FROM edicoes WHERE id = $1", [edicao_id]);
    if (e.rows.length === 0) erros.push("Edição não encontrada.");
    else if (e.rows[0].obra_id !== obra_id) erros.push("A edição não pertence à obra selecionada.");
  }

  const recortes = [];
  for (let i = 0; i < tipos.length; i++) {
    const tipo = String(tipos[i] || "").trim();
    if (!ROTULO_RECORTE_TIPO[tipo]) continue;
    const rotulo = String(rotulos[i] || "").trim() || null;
    const inicio = String(inicios[i] || "").trim() || null;
    const fim = String(fins[i] || "").trim() || null;
    const observacao = String(observacoesRec[i] || "").trim() || null;
    if (!rotulo && !inicio && !fim && !observacao && tipo !== "integral" && tipo !== "a_conferir") {
      continue;
    }
    recortes.push({ rotulo, tipo, inicio, fim, observacao });
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
        `SELECT id, editora, ano, numero_edicao, idioma
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
        observacoes: observacoes || "",
        estado_revisao,
        recortes: recortes.length > 0 ? recortes : [
          { rotulo: "", tipo: "capitulo", inicio: "", fim: "", observacao: "" }
        ]
      },
      erros,
      modo: "editar",
      acao: `/unidades/${id}/usos/${usoId}/editar`,
      cancelarUrl: `/unidades/${id}`,
      papeis: Object.entries(ROTULO_PAPEL),
      modalidades: Object.entries(ROTULO_MODALIDADE),
      estadosRevisao: Object.entries(ROTULO_ESTADO_REVISAO),
      tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE usos
          SET obra_id = $1, edicao_id = $2, papel = $3, modalidade = $4,
              orientacao = $5, observacoes = $6, estado_revisao = $7,
              atualizado_em = now()
        WHERE id = $8`,
      [obra_id, edicao_id, papel, modalidade, orientacao, observacoes, estado_revisao, usoId]
    );

    // D38: apagar e reinserir recortes
    await client.query("DELETE FROM usos_recortes WHERE uso_id = $1", [usoId]);
    for (let i = 0; i < recortes.length; i++) {
      const r = recortes[i];
      await client.query(
        `INSERT INTO usos_recortes (uso_id, rotulo, tipo, inicio, fim, observacao, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [usoId, r.rotulo, r.tipo, r.inicio, r.fim, r.observacao, i + 1]
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

// ----- Fim das rotas de bibliografia -----

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
      `SELECT id, editora, ano, numero_edicao, idioma
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
      observacoes: "",
      estado_revisao: "a_avaliar",
      recortes: [
        { rotulo: "", tipo: "capitulo", inicio: "", fim: "", observacao: "" }
      ]
    },
    erros: [],
    modo: "criar",
    papeis: Object.entries(ROTULO_PAPEL),
    modalidades: Object.entries(ROTULO_MODALIDADE),
    estadosRevisao: Object.entries(ROTULO_ESTADO_REVISAO),
    tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
  });
});

app.get("/obras/:id/edicoes.json", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: "Id inválido." });
  }
 
  const r = await pool.query(
    `SELECT id, editora, ano, numero_edicao, idioma, capa_url
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
  const observacoes = String(req.body.observacoes || "").trim() || null;
  const estado_revisao = String(req.body.estado_revisao || "").trim();

  // CORREÇÃO: o Express com `extended: true` remove os colchetes
  // dos nomes dos campos. Lemos sem colchetes.
  const rotulos = [].concat(req.body.recorte_rotulo || []);
  const tipos = [].concat(req.body.recorte_tipo || []);
  const inicios = [].concat(req.body.recorte_inicio || []);
  const fins = [].concat(req.body.recorte_fim || []);
  const observacoesRec = [].concat(req.body.recorte_observacao || []);

  const erros = [];
  if (!obra_id) erros.push("Escolha uma obra.");
  if (!ROTULO_PAPEL[papel]) erros.push("Papel inválido.");
  if (!ROTULO_MODALIDADE[modalidade]) erros.push("Modalidade inválida.");
  if (!ROTULO_ESTADO_REVISAO[estado_revisao]) erros.push("Estado de revisão inválido.");

  if (obra_id) {
    const o = await pool.query("SELECT id, arquivada FROM obras WHERE id = $1", [obra_id]);
    if (o.rows.length === 0) erros.push("Obra não encontrada.");
    else if (o.rows[0].arquivada) erros.push("Esta obra está arquivada e não pode receber novos usos.");
  }

  if (edicao_id) {
    const e = await pool.query("SELECT id, obra_id FROM edicoes WHERE id = $1", [edicao_id]);
    if (e.rows.length === 0) {
      erros.push("Edição não encontrada.");
    } else if (e.rows[0].obra_id !== obra_id) {
      erros.push("A edição não pertence à obra selecionada.");
    }
  }

  const recortes = [];
  for (let i = 0; i < tipos.length; i++) {
    const tipo = String(tipos[i] || "").trim();
    if (!ROTULO_RECORTE_TIPO[tipo]) continue;
    const rotulo = String(rotulos[i] || "").trim() || null;
    const inicio = String(inicios[i] || "").trim() || null;
    const fim = String(fins[i] || "").trim() || null;
    const observacao = String(observacoesRec[i] || "").trim() || null;
    if (!rotulo && !inicio && !fim && !observacao && tipo !== "integral" && tipo !== "a_conferir") {
      continue;
    }
    recortes.push({ rotulo, tipo, inicio, fim, observacao });
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
        `SELECT id, editora, ano, numero_edicao, idioma
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
        observacoes: observacoes || "",
        estado_revisao,
        recortes: recortes.length > 0 ? recortes : [
          { rotulo: "", tipo: "capitulo", inicio: "", fim: "", observacao: "" }
        ]
      },
      erros,
      modo: "criar",
      papeis: Object.entries(ROTULO_PAPEL),
      modalidades: Object.entries(ROTULO_MODALIDADE),
      estadosRevisao: Object.entries(ROTULO_ESTADO_REVISAO),
      tiposRecorte: Object.entries(ROTULO_RECORTE_TIPO)
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const usoR = await client.query(
      `INSERT INTO usos
         (aula_id, obra_id, edicao_id, papel, modalidade, orientacao, observacoes, estado_revisao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [id, obra_id, edicao_id, papel, modalidade, orientacao, observacoes, estado_revisao]
    );
    const usoId = usoR.rows[0].id;

    for (let i = 0; i < recortes.length; i++) {
      const r = recortes[i];
      await client.query(
        `INSERT INTO usos_recortes (uso_id, rotulo, tipo, inicio, fim, observacao, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [usoId, r.rotulo, r.tipo, r.inicio, r.fim, r.observacao, i + 1]
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

// ----- Fim das rotas de uso -----

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

  let usosAula = [];
  if (unidade.tipo === "aula") {
    const ua = await pool.query(
      `SELECT u.id, u.obra_id, u.edicao_id, u.papel, u.modalidade,
              u.orientacao, u.observacoes, u.estado_revisao,
              o.titulo AS obra_titulo,
              COALESCE(
                (SELECT STRING_AGG(oa.nome, ', ' ORDER BY oa.ordem)
                   FROM obras_autores oa WHERE oa.obra_id = o.id),
                ''
              ) AS obra_autores,
              e.id AS edicao_id_ref, e.editora AS edicao_editora, e.ano AS edicao_ano
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
        `SELECT id, uso_id, rotulo, tipo, inicio, fim, observacao, ordem
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
      rotuloEstadoRevisao: ROTULO_ESTADO_REVISAO[u.estado_revisao] || u.estado_revisao
    }));
  }

  // M2: caminho curricular da aula (usado em cada uso, para contexto)
  let caminhoCurricular = "";
  if (unidade.tipo === "aula") {
    const cadeia = await cadeiaDeSuperiores(id);
    caminhoCurricular = cadeia.map((u) => u.titulo).join(" › ");
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