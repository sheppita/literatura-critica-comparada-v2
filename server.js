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