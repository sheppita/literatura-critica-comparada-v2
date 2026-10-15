# Status do projeto

## Fase atual

Fase 2 — Fichas de aula (CONCLUÍDA).
Próxima fase: Fase 3 — Bibliografia (obras, edições, usos em aulas).

## Concluído

### Fase 0 — Fundação
- Repositório, banco Neon, serviço Render, VS Code, rota /health.

### Fase 1 — Estrutura curricular
- Tabela `unidades`; navegação hierárquica Eixo → Disciplina → Módulo → Tema → Aula;
  criar, editar, excluir unidades.

### Pacote de correções pós-uso (Blocos A/B/C)
- Links na paleta, botão Cancelar fantasma, concordância nominal, banner,
  favicon, Title Case, descrição fora de tema e aula (constraint no banco).

### Fase 2 — Fichas de aula
- 2.1 Tabelas `fichas` e `fichas_versoes` no Neon.
- 2.2 Ficha exibida na página da aula (leitura).
- 2.3 Editor Markdown com pré-visualização, botões de formatação,
  estados (texto e bibliografia), histórico de versões gravando.
- 2.4 (pulada — sem ajustes de polimento identificados no momento).
- 2.5 Histórico de versões e restauração.
- 2.6 Aviso visual de salvamento bem-sucedido e de "nada mudou".
- 2.7 Detecção de conflito de versão (abrir em duas abas).

## Em andamento

- Planejamento da Fase 3 — Bibliografia.

## Próximo

- Fase 3 — Obras, edições, usos em aulas, revisão de repetições.

## Pendências anotadas para próximo pacote de correções

- **Editor de ficha:** lento e problemático (relato genérico de uso).
  Aguardando anotações específicas antes de atacar.

## Onde paramos

Fichas de aula totalmente operacionais, com histórico, restauração e proteção
contra conflito. Próximo passo: planejar a Fase 3 (bibliografia).

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.