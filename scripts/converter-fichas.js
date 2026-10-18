import "dotenv/config";
import pg from "pg";
import { marked } from "marked";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Iniciando conversão de fichas: Markdown → HTML\n");

  const totalR = await pool.query(
    "SELECT COUNT(*)::int AS total FROM fichas WHERE conteudo_markdown <> '' AND conteudo_html IS NULL"
  );
  const total = totalR.rows[0].total;
  console.log(`Fichas a converter: ${total}\n`);

  if (total === 0) {
    console.log("Nada a converter. Todas as fichas com conteúdo já estão com HTML.");
    await pool.end();
    return;
  }

  const fichasR = await pool.query(
    "SELECT id, conteudo_markdown FROM fichas WHERE conteudo_markdown <> '' AND conteudo_html IS NULL ORDER BY id"
  );

  let convertidas = 0;
  let erros = 0;

  for (const ficha of fichasR.rows) {
    try {
      const html = marked.parse(ficha.conteudo_markdown);
      await pool.query(
        "UPDATE fichas SET conteudo_html = $1 WHERE id = $2",
        [html, ficha.id]
      );
      convertidas++;
      if (convertidas % 10 === 0 || convertidas === total) {
        console.log(`Convertidas: ${convertidas}/${total}`);
      }
    } catch (err) {
      erros++;
      console.error(`Erro na ficha ${ficha.id}:`, err.message);
    }
  }

  console.log(`\nConversão concluída.`);
  console.log(`  Convertidas: ${convertidas}`);
  console.log(`  Erros: ${erros}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});