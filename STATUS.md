# Status do projeto

## Fase atual

Pacote 2 de melhorias pós-uso — rodadas R1 a R5.4, R8, R9, R10 e R11 concluídas.
Próximas rodadas: R6 (autocomplete, comparação de recortes) e R7 (conflito lado a lado).

## Concluído

### Fase 0 — Fundação
- Repositório, banco Neon, serviço Render, VS Code, rota /health.

### Fase 1 — Estrutura curricular
- Tabela `unidades`; hierarquia (depois simplificada na R8).

### Pacote 1 de correções pós-uso (Blocos A/B/C)
- Links na paleta, botão Cancelar fantasma, concordância nominal, banner,
  favicon, Title Case, descrição fora de tema e aula.

### Fase 2 — Fichas de aula
- Tabelas `fichas` e `fichas_versoes`; histórico; restauração; detecção de conflito.

### Fase 3 — Bibliografia
- Tabelas `obras`, `obras_autores`, `edicoes`, `usos`, `usos_recortes`;
  catálogo com busca; página de obra; associação obra↔aula; recortes.

### Pacote 2 de melhorias pós-uso

- **R1** — Bug #1 (recortes não salvavam).
- **R2** — Bug #3, F5, F6, F4.
- **R3** — F1, F2, F3.
- **R4** — Editar obra, edições, uso.
- **R5.1** — Barra fixa; botões flutuantes; `capa_url`; banner removido.
- **R5.2** — Tela "+ Aula"; ordenação por papel; caminho curricular; "não informado";
  omissão do tipo; "+ Nova Obra" no topo.
- **R5.3** — Capa por URL; texto justificado.
- **R5.4** — Bugs #4, #5, #6; simplificação dos formulários.
- **R8** — Remoção do nível "Módulo"; arquivamento; rota `/aulas/nova` removida.
- **R9** — Excluir obra e uso; ISBN removido; tipos de material ajustados;
  recortes simplificados.
- **R10** — Reformulação da mecânica de avaliação de usos:
  estado calculado em SQL; validação individual; reabertura automática;
  filtros em cápsula; tela `/revisao`; exclusão das tabelas de decisões.
- **R11** — Editor Quill:
  - R11.1 Conversão de 57 fichas e versões de Markdown para HTML.
  - R11.2 `server.js` lê/grava `conteudo_html`; `ficha-editor.ejs` com Quill;
    faixa "vN · Editada em DD/MM/AAAA"; estados de ficha removidos da interface.

## Em andamento

- Nenhum. Entre rodadas do Pacote 2.

## Próximo

- **R6** — Autocomplete no servidor para selects grandes; visão comparativa
  de recortes entre usos.
- **R7** — Tela de comparação lado a lado em conflito de versão.

## Pendências anotadas

- **Item #6** — Editor de ficha lento e com atritos. **Observação:** o Quill
  provavelmente resolve a maior parte; aguardando uso real para confirmar.
- **Estados da ficha** — removidos da interface (R11).

## Onde paramos

Editor de ficha migrado para Quill. Fichas em HTML. Próxima rodada: R6.

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.