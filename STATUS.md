# Status do projeto

## Fase atual

Fase 1 — Estrutura curricular.

## Concluído

### Fase 0 — Fundação
- 0.1 Repositório novo no GitHub: sheppita/literatura-critica-comparada-v2
- 0.2 Banco novo no Neon (projeto literatura-critica-comparada-v2, banco neondb)
- 0.3 VS Code configurado; projeto clonado em C:\Users\shepp\Projetos\postgrad-literatura\literatura-critica-comparada-v2
- 0.3 Arquivos iniciais: package.json, server.js, .env.example, DECISIONS.md, STATUS.md
- 0.4 Serviço novo no Render: https://literatura-critica-comparada-v2.onrender.com
- 0.5 Rota /health confirmada no endereço público.

### Fase 1 — Estrutura curricular
- 1.1 Tabela `unidades` criada no Neon (vazia, com todas as constraints).
- 1.2 Servidor conectado ao banco; /health mostra `banco: conectado` e `unidades: 0`.
- 1.2 `.env` local criado (fora do Git); DATABASE_URL configurada no Render.
- 1.2 dotenv instalado; string de conexão protegida nos dois ambientes.

## Em andamento

- 1.3 Página inicial listando os eixos.

## Próximo

- 1.3 Página inicial com lista de eixos (lendo do banco).
- 1.4 Tela de criação/edição de unidade.
- 1.5 Navegação hierárquica até a aula.

## Onde paramos

Servidor fala com o banco. Tabela `unidades` vazia. Próximo passo: listar os eixos na página inicial.