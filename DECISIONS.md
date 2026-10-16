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
| D14 | Banner apenas na página inicial; favicon em todas | substituída por D44 |
| D15 | Descrição existe apenas em eixo, disciplina e módulo. Tema usa pergunta norteadora. Aula terá ficha. | consolidada |
| D16 | Títulos digitados pela usuária não são capitalizados pelo sistema. Title Case só nos rótulos gerados. | consolidada |
| D17 | Tabelas `fichas` e `fichas_versoes` (1-para-1 com aula) | consolidada |
| D18 | Toda aula tem ficha em branco desde a criação | consolidada |
| D19 | Pré-visualização por botão (Markdown processado no servidor) | consolidada |
| D20 | Ficha integrada na página da aula (não é tela separada) | consolidada |
| D21 | Fase 2 dividida em 7 etapas (2.1 a 2.7) | consolidada |
| D22 | Restauração cria nova versão no histórico (linha do tempo preservada) | consolidada |
| D23 | Detecção de conflito impede salvamento silencioso em versão mais antiga | consolidada |
| D24 | Papéis de uso: texto_base, texto_complementar, ficcao_ancora, ficcao_complementar | consolidada |
| D25 | Modalidade de uso: integral, parcial | consolidada |
| D26 | Estados de revisão de uso: a_avaliar, repeticao_validada, substituicao_planejada, resolvida | consolidada |
| D27 | Estado de verificação: dois campos separados (obra e edição) | consolidada |
| D28 | Aula exibe usos e permite editar direto na página | consolidada |
| D29 | Sem upload de PDF, sem pesquisa automática de ISBN, sem comparação automática de trechos | consolidada |
| D30 | Fase 3.7 faz decisões de revisão e mesclagem na mesma etapa | consolidada |
| D31 | Mesclagem usa arquivamento (obra perdedora não é apagada, fica `arquivada`) | consolidada |
| D32 | Aviso de decisão possivelmente vencida aparece na página da obra | consolidada |
| D33 | Tela de mesclagem em `/obras/mesclar` (tela separada) | consolidada |
| D34 | Registrar decisão também atualiza o estado de revisão dos usos envolvidos | consolidada |
| D35 | Excluir edição em uso: bloquear com mensagem clara | consolidada |
| D36 | Excluir edição sem uso: exclusão direta com confirmação | consolidada |
| D37 | Editar obra: apagar e reinserir os autores | consolidada |
| D38 | Editar uso: apagar e reinserir os recortes | consolidada |
| D39 | Ordenação dos usos por papel (texto-base → texto complementar → ficção-âncora → ficção complementar) | consolidada |
| D40 | Papéis e modalidade: leitura parcial sem recorte é pendência | consolidada |
| D41 | Caminho curricular completo exibido em cada uso na página da obra | consolidada |
| D42 | "Edição não informada" e "Recorte não informado" exibidos explicitamente | consolidada |
| D43 | Regra de omissão do tipo: se o código começa com o nome do tipo, mostra só o código | consolidada |
| D44 | Banner removido; barra fixa no topo em todas as páginas | consolidada |
| D45 | Botão "+ Aula" leva a uma tela intermediária de escolha de tema (lista agrupada com busca) | consolidada |
| D46 | Botões flutuantes "ir pro topo/fundo": desativados em telas < 600px; ⬇️ desaparece quando está no fundo | consolidada |
| D47 | Texto da ficha justificado em telas ≥ 700px, com hifenização automática | consolidada |
| D48 | Capa da edição por URL (sem upload); exibida em obra, aula e catálogo | consolidada |
| D49 | No catálogo, capa exibida é a da edição mais recente (por ano) | consolidada |
| D50 | Formulário de Nova Obra: apenas Título, Autoria, Tipo de material e bloco de Primeira Edição (Editora, Ano, ISBN, Capa) | consolidada |
| D51 | Formulário de Edição: apenas Editora, Ano, ISBN, Capa | consolidada |
| D52 | Formulário de Uso: Estado de revisão e Observações removidos da interface | consolidada |
| D53 | Bloco de Primeira Edição sempre visível; edição só é criada se ao menos um campo dela for preenchido | consolidada |
| D54 | Campos removidos da interface continuam existindo no banco (decisão reversível) | consolidada |

## Regras de trabalho

- **R1:** quando uma alteração envolve mais de um ponto no mesmo arquivo, o arquivo inteiro é enviado.
- **R2:** quando envolve mais de um arquivo, todos os arquivos inteiros são enviados de uma vez.
- **R3:** em caso de erro, não mexer em nada antes de colar a mensagem exata e aguardar investigação.
- **R4:** nada é apagado do banco, repositório ou serviços sem explicação de consequências e cópia de segurança.
- **R5:** ao final de cada fase, os arquivos `DECISIONS.md` e `STATUS.md` são atualizados e commitados.
- **R6:** quando o volume crescer, o padrão de "busca com autocomplete no servidor" substitui os `<select>` com listas grandes.
- **R7:** arquivos de código são enviados **inteiros**, sempre. Exceções: `estilo.css` (aditivo) e SQL (executado por comando). A preferência da usuária é o padrão.
- **R8:** perguntar à usuária antes de dividir arquivo grande em trechos. A decisão de receber inteiro ou em pedaços é dela.
- **R9:** quando houver dúvida entre manter um campo pela spec e remover pela simplicidade do uso, **o uso manda**. YAGNI reverso: construir, ver e remover é melhor que construir enxuto demais e descobrir depois que faltava.

## Comportamentos conhecidos (não são bugs)

- O aviso "Sair do site?" (`beforeunload`) é suprimido por navegadores em alguns casos, como cliques em links da mesma origem. Não é falha do código; é limitação do navegador.

## Observações

- O banco do Neon se chama `neondb` dentro do projeto `literatura-critica-comparada-v2`.
- O protótipo antigo permanece arquivado em repositório separado.
- Restrição no banco: `descricao_apenas_em_eixo_disciplina_modulo` (adicionada em out/2026).
- Coluna `capa_url` em `edicoes` (adicionada em out/2026).