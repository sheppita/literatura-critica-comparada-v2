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
- 1.1 Tabela `unidades` criada no Neon (vazia, com todas as constraints).
- 1.2 Servidor conectado ao banco; /health mostra `banco: conectado` e `unidades: 0`.
- 1.3 Página inicial lê eixos do banco.
- 1.4a Formulário de criação de unidade (sem salvar ainda).
- Estilo: Quicksand + paleta cozy autumn, CSS centralizado em public/estilo.css.

## Em andamento

- 1.4b Rota POST /unidades/nova para salvar no banco.

## Próximo

- 1.4b Testar cadastro real, limpar dados de teste, commit.
- 1.4c Edição de unidade existente.
- 1.5 Navegação hierárquica até a aula.

## Onde paramos

Gravação funcionando; aguardando teste e limpeza dos dados de teste.