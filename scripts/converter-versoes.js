import "dotenv/config";
import pg from "pg";
import { marked } from "marked";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Iniciando conversão de versões: Markdown → HTML\n");

  // 1. Renomear a coluna (se ainda não foi renomeada)
  const colunaR = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'fichas_versoes' AND column_name = 'conteudo_markdown'`
  );

  if (colunaR.rows.length > 0) {
    console.log("Renomeando coluna conteudo_markdown → conteudo_html em fichas_versoes...");
    await pool.query(
      "ALTER TABLE fichas_versoes RENAME COLUMN conteudo_markdown TO conteudo_html"
    );
    console.log("  OK\n");
  } else {
    console.log("Coluna já renomeada. Pulando.\n");
  }

  // 2. Converter o conteúdo das versões
  const totalR = await pool.query(
    "SELECT COUNT(*)::int AS total FROM fichas_versoes WHERE conteudo_html <> ''"
  );
  const total = totalR.rows[0].total;
  console.log(`Versões com conteúdo a converter: ${total}\n`);

  const versoesR = await pool.query(
    "SELECT id, conteudo_html FROM fichas_versoes WHERE conteudo_html <> '' ORDER BY id"
  );

  let convertidas = 0;
  let erros = 0;

  for (const v of versoesR.rows) {
    try {
      // marked.parse em HTML já convertido não muda nada (não tem sintaxe Markdown)
      // Mas para versões antigas (em Markdown), converte.
      const html = marked.parse(v.conteudo_html);
      if (html !== v.conteudo_html) {
        await pool.query(
          "UPDATE fichas_versoes SET conteudo_html = $1 WHERE id = $2",
          [html, v.id]
        );
        convertidas++;
      }
      if ((convertidas + erros) % 20 === 0) {
        console.log(`Processadas: ${convertidas + erros}/${total}`);
      }
    } catch (err) {
      erros++;
      console.error(`Erro na versão ${v.id}:`, err.message);
    }
  }

  console.log(`\nConversão concluída.`);
  console.log(`  Convertidas (tinham Markdown): ${convertidas}`);
  console.log(`  Já em HTML (não alteradas): ${total - convertidas - erros}`);
  console.log(`  Erros: ${erros}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});