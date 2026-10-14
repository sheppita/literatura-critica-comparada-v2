# Status do projeto

## Fase atual

Fase 1 — Estrutura curricular.

## Concluído

### Fase 0 — Fundação
- 0.1 Repositório novo no GitHub: sheppita/literatura-critica-comparada-v2
- 0.2 Banco novo no Neon (projeto literatura-critica-comparada-v2, banco neondb)
- 0.3 VS Code configurado; projeto clonado em C:\Users\shepp\Projetos\postgrad-literatura\literatura-critica-comparada-v2
- 0.4 Serviço novo no Render: https://literatura-critica-comparada-v2.onrender.com
- 0.5 Rota /health confirmada no endereço público.

### Fase 1 — Estrutura curricular
- 1.1 Tabela `unidades` criada no Neon.
- 1.2 Servidor conectado ao banco; /health mostra `banco: conectado`.
- 1.3 Página inicial lê eixos do banco.
- 1.4a Formulário de criação de unidade.
- 1.4b Rota POST que salva no banco (com validações e hierarquia).
- 1.4c.1 Página de uma unidade, navegação hierárquica, caminho de navegação.
- 1.4c.2 Edição de unidade existente.
- 1.4c.3 Exclusão com confirmação e bloqueio quando há filhos.
- Estilo: Quicksand + paleta cozy autumn, CSS em public/estilo.css.

## Em andamento

- Cadastro dos nove eixos reais.

## Próximo

- Cadastrar os nove eixos e começar a popular a hierarquia (disciplinas, módulos, temas, aulas).
- Depois: Fase 2 — fichas de aula.

## Onde paramos

Estrutura curricular totalmente operacional (criar, navegar, editar, excluir).
Próximo passo manual: cadastrar os nove eixos.