# Status do projeto

## Fase atual

Fase 1 — Estrutura curricular (CONCLUÍDA).
Pacote de correções pós-uso aplicado.
Próxima fase: Fase 2 — Fichas de aula.

## Concluído

### Fase 0 — Fundação
- 0.1 Repositório novo no GitHub: sheppita/literatura-critica-comparada-v2
- 0.2 Banco novo no Neon (projeto literatura-critica-comparada-v2, banco neondb)
- 0.3 VS Code configurado; projeto clonado localmente
- 0.4 Serviço novo no Render: https://literatura-critica-comparada-v2.onrender.com
- 0.5 Rota /health confirmada no endereço público.

### Fase 1 — Estrutura curricular
- 1.1 Tabela `unidades` criada no Neon.
- 1.2 Servidor conectado ao banco; /health mostra `banco: conectado`.
- 1.3 Página inicial lê eixos do banco.
- 1.4a Formulário de criação de unidade.
- 1.4b Rota POST que salva no banco (validações e hierarquia).
- 1.4c.1 Página de uma unidade, navegação hierárquica, caminho de navegação.
- 1.4c.2 Edição de unidade existente.
- 1.4c.3 Exclusão com confirmação e bloqueio quando há filhos.
- Estilo: Quicksand + paleta cozy autumn, CSS em public/estilo.css.

### Pacote de correções pós-uso
- A.1 Links na paleta cozy autumn (incluindo :visited).
- A.2 Botão Cancelar como "fantasma"; concordância nominal nos títulos gerados.
- B.1 Banner (só na inicial) + favicon (todas as páginas).
- B.2 Title Case nos rótulos do sistema.
- C.1 Constraint no banco: descricao só em eixo, disciplina, modulo.
- C.2 Formulário esconde Descrição em tema e aula; servidor valida.

## Em andamento

- Planejamento da Fase 2 — Fichas de aula.

## Próximo

- Fase 2 — Fichas de aula (Markdown com pré-visualização, estados separados,
  histórico de versões, avisos de alteração não salva).

## Onde paramos

Estrutura curricular totalmente operacional, com identidade visual aplicada.
Próximo passo: iniciar Fase 2, ou nova rodada de uso antes.

## Registros de incidentes

- 15/10/2026 — Apagamento acidental de arquivos no Explorer do VS Code (Ctrl+A).
  Recuperado via Git e Lixeira do Windows, sem perda. Nenhum dado do banco afetado.