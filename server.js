import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.type("text/plain").send("Literatura Crítica Comparada — v2\n");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "literatura-critica-comparada-v2" });
});

app.listen(PORT, () => {
  console.log(`Servidor ouvindo em http://localhost:${PORT}`);
});