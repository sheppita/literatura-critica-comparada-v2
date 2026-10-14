import "dotenv/config";
import express from "express";
import pg from "pg";

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", (req, res) => {
  res.type("text/plain").send("Literatura Crítica Comparada — v2\n");
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