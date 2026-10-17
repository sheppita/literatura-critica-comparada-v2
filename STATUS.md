# Status do projeto

## Fase atual

Pacote 2 de melhorias pós-uso — rodadas R1 a R5.4, R8, R9 e R10 concluídas.
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
- Tabelas `fichas` e `fichas_versoes`; editor Markdown com pré-visualização;
  estados; histórico; restauração; detecção de conflito.

### Fase 3 — Bibliografia
- Tabelas `obras`, `obras_autores`, `edicoes`, `usos`, `usos_recortes`;
  catálogo com busca; página de obra; associação obra↔aula; recortes.

### Pacote 2 de melhorias pós-uso

- **R1** — Bug #1 (recortes não salvavam).
- **R2** — Bug #3 (observação do recorte), F5, F6, F4.
- **R3** — F1 (preservar texto em conflito), F2 (salvamento atômico), F3 (transações).
- **R4** — Editar obra, adicionar/editar/excluir edições, editar uso.
- **R5.1** — Barra fixa no topo; botões flutuantes; migration `capa_url`; banner removido.
- **R5.2** — Tela "+ Aula"; ordenação de usos por papel; caminho curricular em cada uso;
  "não informado" explícito; omissão do tipo; "+ Nova Obra" no topo do catálogo.
- **R5.3** — Campo "URL da capa"; exibição da capa em obra, aula e catálogo;
  texto da ficha justificado em telas largas.
- **R5.4** — Bug #4, #5, #6; simplificação dos formulários.
- **R8** — Remoção do nível "Módulo": 30 temas remanejados, 9 módulos arquivados,
  constraints ajustadas, botão "+ Aula" e rota `/aulas/nova` removidos.
- **R9** — Ajustes finos da bibliografia:
  - Excluir obra (bloqueia se em uso), excluir uso na tela de edição
  - ISBN removido dos formulários e da exibição
  - Tipos de material: Livro, Artigo, Ensaio, Revista, Outro
  - Recortes simplificados: sem início/fim; tipos Capítulo, Seção, Ensaio, A Conferir
- **R10** — Reformulação da mecânica de avaliação de usos:
  - #29 Grid dos campos de recorte corrigido
  - #30 Tipos de recorte: adicionados Conto e Poema
  - #31 Estado "a avaliar" calculado em SQL; validação individual por uso;
    reabertura automática ao cadastrar novo uso; filtros em cápsula no catálogo;
    tela `/revisao`; exclusão das tabelas de decisões e da coluna `estado_revisao`

## Em andamento

- Nenhum. Entre rodadas do Pacote 2.

## Próximo

- **R6** — Autocomplete no servidor para selects grandes (obras, autores);
  visão comparativa de recortes entre usos; deixar claro que o formulário
  permite múltiplos recortes.
- **R7** — Tela de comparação lado a lado em conflito de versão.

## Pendências anotadas

- **Item #6** — Editor de ficha lento e com atritos. Aguardando anotações específicas.
- **Estados da ficha** — em observação pela usuária.

## Onde paramos

Mecânica de avaliação reformulada: estado calculado, validação individual,
fila de revisão. Próxima rodada: R6.

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.