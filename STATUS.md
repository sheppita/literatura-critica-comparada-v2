# Status do projeto

## Fase atual

Fase 3 — Bibliografia (CONCLUÍDA).
Próxima fase: Fase 4 (a definir) ou Pacote 2 de melhorias pós-uso.

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
- 3.2 Cadastro de obra + primeira edição (formulário único, transação).
- 3.3 Catálogo de obras com busca e filtros.
- 3.4 Página de uma obra (dados, edições, usos).
- 3.5 Associar obra a aula (criar uso com papel, modalidade, recortes, estado).
- 3.6 Catálogo enriquecido (aulas distintas, eixos, resumo de revisão, ícone de pendência).
- 3.7a Coluna `arquivada` em obras; tabelas `decisoes_revisao` e `decisoes_usos`.
- 3.7b Registrar decisão de revisão; sinalização de decisão vencida; mesclagem de duplicatas.

## Em andamento

- Uso real do sistema pela usuária, coleta de incômodos para o Pacote 2.

## Próximo

- Pacote 2 de melhorias pós-uso (quando acumular itens suficientes).
- Depois: Fase 4 (a definir — possivelmente leitura contínua de aulas de um tema).

## Pendências anotadas para o Pacote 2 de melhorias

- **Item #6 — Editor de ficha:** lento e com atritos (relato genérico).
  Aguardando anotações específicas antes de atacar.
- **Item #7 — Dropdown de obra precisa de busca por digitação:**
  será implementado com busca no servidor (autocomplete assíncrono),
  solução completa desde o início, para não precisar voltar depois.
- **Item #8 — Padrão de busca com autocomplete no servidor:**
  aplicar em todos os `<select>` que possam crescer (obras, autores, etc.).

## Onde paramos

Fase 3 concluída. Sistema tem os três pilares:
1) estrutura curricular, 2) fichas de aula, 3) bibliografia com usos e decisões.
Próximo passo: uso real + anotação de melhorias para o Pacote 2.

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.