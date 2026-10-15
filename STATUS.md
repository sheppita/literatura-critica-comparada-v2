# Status do projeto

## Fase atual

Pacote 2 de melhorias pós-uso — rodadas R1 a R5 concluídas.
Próxima rodada: R6 (autocomplete e melhorias estruturais).

## Concluído

### Fase 0 — Fundação
- Repositório, banco Neon, serviço Render, VS Code, rota /health.

### Fase 1 — Estrutura curricular
- Tabela `unidades`; hierarquia Eixo → Disciplina → Módulo → Tema → Aula;
  criar, navegar, editar, excluir unidades.

### Pacote 1 de correções pós-uso (Blocos A/B/C)
- Links na paleta, botão Cancelar fantasma, concordância nominal, banner,
  favicon, Title Case, descrição fora de tema e aula (constraint no banco).

### Fase 2 — Fichas de aula
- 2.1 Tabelas `fichas` e `fichas_versoes`.
- 2.2 Ficha exibida na página da aula (leitura).
- 2.3 Editor Markdown com pré-visualização, botões de formatação,
  estados (texto e bibliografia), histórico de versões gravando.
- 2.5 Histórico de versões e restauração.
- 2.6 Aviso visual de salvamento.
- 2.7 Detecção de conflito de versão.

### Fase 3 — Bibliografia
- 3.1 Tabelas `obras`, `obras_autores`, `edicoes`, `usos`, `usos_recortes`.
- 3.2 Cadastro de obra + primeira edição.
- 3.3 Catálogo de obras com busca e filtros.
- 3.4 Página de uma obra.
- 3.5 Associar obra a aula.
- 3.6 Catálogo enriquecido.
- 3.7a Coluna `arquivada` em obras; tabelas `decisoes_revisao` e `decisoes_usos`.
- 3.7b Registrar decisão de revisão; sinalização de decisão vencida; mesclagem.

### Pacote 2 de melhorias pós-uso

- **R1** — Bug #1 (recortes não salvavam) e ajustes de formulário.
- **R2** — Bug #3 (observação do recorte), F5 (parcial sem recorte),
  F6 (aulas distintas na página da obra), F4 (aviso de não-salvo com selects).
- **R3** — F1 (preservar texto em conflito), F2 (salvamento atômico),
  F3 (transações em ficha e restauração).
- **R4** — Editar obra, adicionar/editar/excluir edições, editar uso.
- **R5.1** — Barra fixa no topo; botões flutuantes; migration `capa_url`; banner removido.
- **R5.2** — Tela "+ Aula" com lista de temas; ordenação de usos por papel;
  caminho curricular em cada uso; "não informado" explícito; omissão do tipo
  quando o código começa com ele; "+ Nova Obra" no topo do catálogo.
- **R5.3** — Campo "URL da capa" em edições; exibição da capa em obra, aula
  e catálogo; texto da ficha justificado em telas largas.

## Em andamento

- Nenhum. Entre rodadas do Pacote 2.

## Próximo

- R6 — Autocomplete no servidor para selects grandes (obras, autores, etc.);
  comparação de recortes entre usos; deixar claro que o formulário permite
  múltiplos recortes.
- R7 — Tela de comparação lado a lado em conflito de versão.

## Pendências anotadas para rodadas futuras do Pacote 2

- **Item #6** — Editor de ficha lento e com atritos (relato genérico).
  Aguardando anotações específicas antes de atacar.
- **Item #14** — Linha "tipo · código" redundante (resolvido em R5.2).
- **Item #11** — Visão comparativa de recortes entre usos (R6).
- **Item #12** — Deixar claro que o formulário permite múltiplos recortes (R6).

## Onde paramos

Sistema tem os três pilares funcionais (estrutura, fichas, bibliografia),
com identidade visual aplicada, navegação fixa, capas, ordenação, e as
principais correções de robustez do Pacote 2. Próxima rodada: R6.

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.