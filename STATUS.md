# Status do projeto

## Fase atual

Pacote 2 de melhorias pós-uso — rodadas R1 a R5.4 + R8 concluídas.
Próximas rodadas: R6 (autocomplete, comparação de recortes) e R7 (conflito lado a lado).

## Concluído

### Fase 0 — Fundação
- Repositório, banco Neon, serviço Render, VS Code, rota /health.

### Fase 1 — Estrutura curricular
- Tabela `unidades`; hierarquia Eixo → Disciplina → Módulo → Tema → Aula (depois simplificada na R8).

### Pacote 1 de correções pós-uso (Blocos A/B/C)
- Links na paleta, botão Cancelar fantasma, concordância nominal, banner,
  favicon, Title Case, descrição fora de tema e aula (constraint no banco).

### Fase 2 — Fichas de aula
- Tabelas `fichas` e `fichas_versoes`; editor Markdown com pré-visualização;
  estados separados (texto e bibliografia); histórico de versões; restauração;
  detecção de conflito.

### Fase 3 — Bibliografia
- Tabelas `obras`, `obras_autores`, `edicoes`, `usos`, `usos_recortes`;
  catálogo com busca; página de obra; associação obra↔aula; recortes;
  decisões de revisão; mesclagem de duplicatas.

### Pacote 2 de melhorias pós-uso

- **R1** — Bug #1 (recortes não salvavam).
- **R2** — Bug #3 (observação do recorte), F5, F6, F4.
- **R3** — F1 (preservar texto em conflito), F2 (salvamento atômico), F3 (transações).
- **R4** — Editar obra, adicionar/editar/excluir edições, editar uso.
- **R5.1** — Barra fixa no topo; botões flutuantes; migration `capa_url`; banner removido.
- **R5.2** — Tela "+ Aula"; ordenação de usos por papel; caminho curricular em cada uso;
  "não informado" explícito; omissão do tipo; "+ Nova Obra" no topo do catálogo.
- **R5.3** — Campo "URL da capa" em edições; exibição da capa em obra, aula e catálogo;
  texto da ficha justificado em telas largas.
- **R5.4** — Bug #4 (capa_url em Nova Obra); Bug #5 (comparação de tipos em uso);
  Bug #6 (aviso "Sair do site?" ao salvar ficha); simplificação dos formulários.
- **R8** — Remoção do nível "Módulo":
  - R8.1 Diagnóstico + backup
  - R8.2 Migração: 30 temas remanejados para disciplina; 9 módulos arquivados
  - R8.3 Constraints ajustadas (`unidades_tipo_check`, `descricao_apenas_em_eixo_disciplina`)
  - R8.4 `server.js` atualizado (PROXIMO_NIVEL, validações, rotas)
  - R8.5 Botão "+ Aula" removido da navbar; rota `/aulas/nova` e template removidos

## Em andamento

- Nenhum. Entre rodadas do Pacote 2.

## Próximo

- **R6** — Autocomplete no servidor para selects grandes (obras, autores);
  visão comparativa de recortes entre usos; deixar claro que o formulário
  permite múltiplos recortes.
- **R7** — Tela de comparação lado a lado em conflito de versão.

## Pendências anotadas

- **Item #6** — Editor de ficha lento e com atritos. Aguardando anotações específicas.
- **Tela de decisões de revisão** — mantida (uso futuro previsto).
- **Estados da ficha** — em observação pela usuária.

## Onde paramos

Hierarquia curricular simplificada para Eixo → Disciplina → Tema → Aula.
30 temas remanejados, 9 módulos arquivados no banco. Sistema funcional,
com os três pilares (estrutura, fichas, bibliografia) estáveis.
Próxima rodada: R6.

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.