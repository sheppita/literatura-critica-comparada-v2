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

// Rota: página inicial
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

// Rota: formulário de criação de unidade
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
    modo: "criar"
  });
});

// Rota: processar criação de unidade
app.post("/unidades/nova", async (req, res) => {
  const tipo = String(req.body.tipo || "").trim();
  const superiorId = req.body.superior_id ? Number(req.body.superior_id) : null;
  const titulo = String(req.body.titulo || "").trim();
  const codigo = String(req.body.codigo || "").trim() || null;
  const descricao = String(req.body.descricao || "").trim() || null;
  const pergunta = String(req.body.pergunta_norteadora || "").trim() || null;

  // 1) Validação básica
  const erros = [];
  if (!TIPOS_VALIDOS.includes(tipo)) erros.push("Tipo inválido.");
  if (!titulo) erros.push("O título é obrigatório.");
  if (tipo !== "tema" && pergunta) erros.push("Pergunta norteadora só existe em tema.");
  if (tipo === "eixo" && superiorId) erros.push("Eixo não tem unidade superior.");

  // 2) Se houver superior, confirmar que ele existe e é do nível certo
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
      // niveis esperados: disciplina -> eixo, modulo -> disciplina, tema -> modulo, aula -> tema
      const esperado = {
        disciplina: "eixo",
        modulo: "disciplina",
        tema: "modulo",
        aula: "tema"
      };
      if (esperado[tipo] && superior.tipo !== esperado[tipo]) {
        erros.push(`Uma ${ROTULO_TIPO[tipo]} deve pertencer a um(a) ${ROTULO_TIPO[esperado[tipo]]}.`);
      }
    }
  } else if (tipo !== "eixo") {
    erros.push(`${ROTULO_TIPO[tipo]} precisa de uma unidade superior.`);
  }

  // 3) Se houver erros, redesenha o formulário com os valores e as mensagens
  if (erros.length > 0) {
    return res.status(400).render("unidade-form", {
      titulo: `Nova ${ROTULO_TIPO[tipo] || "Unidade"}`,
      tipo,
      rotuloTipo: ROTULO_TIPO[tipo] || "Unidade",
      superior,
      valores: { titulo, codigo: codigo || "", descricao: descricao || "", pergunta_norteadora: pergunta || "" },
      erros,
      modo: "criar"
    });
  }

  // 4) Calcular a ordem (última posição entre os irmãos)
  const ordemR = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima
       FROM unidades
      WHERE tipo = $1
        AND superior_id IS NOT DISTINCT FROM $2`,
    [tipo, superiorId]
  );
  const ordem = ordemR.rows[0].proxima;

  // 5) Inserir
  const insertR = await pool.query(
    `INSERT INTO unidades
       (tipo, titulo, codigo, superior_id, ordem, descricao, pergunta_norteadora)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [tipo, titulo, codigo, superiorId, ordem, descricao, pergunta]
  );

  // 6) Redirecionar para a página inicial (por enquanto)
  res.redirect("/");
});

// Rota: health
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