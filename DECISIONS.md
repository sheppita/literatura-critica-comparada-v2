# Decisões do projeto

Registro curto das decisões consolidadas. Atualizar quando uma decisão mudar.

| # | Decisão | Status |
|---|---|---|
| D1 | Hierarquia curricular: Eixo → Disciplina → Módulo → Tema → Aula | consolidada |
| D2 | Leitura pública; edição exige login | consolidada |
| D3 | Editor de ficha: Markdown + pré-visualização + botões de formatação | consolidada |
| D4 | Começar por Fase 0 + Fase 1 | consolidada |
| D5 | Reconstrução do zero, sem herdar código do protótipo | consolidada |
| D6 | Repositório e serviço novos; troca de nomes no fim | consolidada |
| D7 | Sem upload de PDF; apenas link de referência | consolidada |
| D8 | Stack: Node.js + Express + PostgreSQL (Neon) + Render | consolidada |
| D9 | Renderização no servidor (sem SPA React) | consolidada |
| D10 | ORM: não; SQL direto com consultas parametrizadas | consolidada |
| D11 | Fonte: Quicksand (Google Fonts) | consolidada |
| D12 | Paleta: cozy autumn (creme, terracota, mostarda, marrom, verde-musgo) | consolidada |
| D13 | CSS centralizado em `public/estilo.css` | consolidada |
| D14 | Banner apenas na página inicial; favicon em todas | consolidada |
| D15 | Descrição existe apenas em eixo, disciplina e módulo. Tema usa pergunta norteadora. Aula terá ficha (Fase 2). | consolidada |
| D16 | Títulos digitados pela usuária não são capitalizados pelo sistema. Title Case só nos rótulos gerados. | consolidada |

## Regras de trabalho

- **R1:** quando uma alteração envolve mais de um ponto no mesmo arquivo, o arquivo inteiro é enviado.
- **R2:** quando envolve mais de um arquivo, todos os arquivos inteiros são enviados de uma vez.
- **R3:** em caso de erro, não mexer em nada antes de colar a mensagem exata e aguardar investigação.
- **R4:** nada é apagado do banco, repositório ou serviços sem explicação de consequências e cópia de segurança.

## Observações

- O banco do Neon se chama `neondb` dentro do projeto `literatura-critica-comparada-v2`.
- O protótipo antigo permanece arquivado em repositório separado.
- Restrição no banco: `descricao_apenas_em_eixo_disciplina_modulo` (adicionada em out/2026).

| D17 | Tabelas `fichas` e `fichas_versoes` (1-para-1 com aula) | consolidada |
| D18 | Toda aula tem ficha em branco desde a criação | consolidada |
| D19 | Pré-visualização por **botão** (Markdown processado no servidor) | consolidada |
| D20 | Ficha **integrada na página da aula** (não é tela separada) | consolidada |
| D21 | Fase 2 dividida em 7 etapas (2.1 a 2.7) | consolidada |
| D22 | Restauração cria nova versão no histórico (linha do tempo preservada) | consolidada |
| D23 | Detecção de conflito impede salvamento silencioso em versão mais antiga | consolidada |