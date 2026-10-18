# Decisões do projeto

Registro curto das decisões consolidadas. Atualizar quando uma decisão mudar.

| # | Decisão | Status |
|---|---|---|
| D1 | Hierarquia curricular: Eixo → Disciplina → Módulo → Tema → Aula | substituída por D55 |
| D2 | Leitura pública; edição exige login | consolidada |
| D3 | Editor de ficha: Markdown + pré-visualização + botões de formatação | substituída por D76 |
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
| D15 | Descrição existe apenas em eixo, disciplina e módulo. Tema usa pergunta norteadora. | substituída por D58 |
| D16 | Títulos digitados pela usuária não são capitalizados pelo sistema. Title Case só nos rótulos gerados. | consolidada |
| D17 | Tabelas `fichas` e `fichas_versoes` (1-para-1 com aula) | consolidada |
| D18 | Toda aula tem ficha em branco desde a criação | consolidada |
| D19 | Pré-visualização por botão (Markdown processado no servidor) | substituída por D76 |
| D20 | Ficha integrada na página da aula (não é tela separada) | consolidada |
| D21 | Fase 2 dividida em 7 etapas (2.1 a 2.7) | consolidada |
| D22 | Restauração cria nova versão no histórico (linha do tempo preservada) | consolidada |
| D23 | Detecção de conflito impede salvamento silencioso em versão mais antiga | consolidada |
| D24 | Papéis de uso: texto_base, texto_complementar, ficcao_ancora, ficcao_complementar | consolidada |
| D25 | Modalidade de uso: integral, parcial | consolidada |
| D26 | Estados de revisão de uso: a_avaliar, repeticao_validada, substituicao_planejada, resolvida | substituída por D68–D72 |
| D27 | Estado de verificação: dois campos separados (obra e edição) | consolidada |
| D28 | Aula exibe usos e permite editar direto na página | consolidada |
| D29 | Sem upload de PDF, sem pesquisa automática de ISBN, sem comparação automática de trechos | consolidada |
| D30 | Fase 3.7 faz decisões de revisão e mesclagem na mesma etapa | substituída por D72 |
| D31 | Mesclagem usa arquivamento (obra perdedora não é apagada, fica `arquivada`) | consolidada |
| D32 | Aviso de decisão possivelmente vencida aparece na página da obra | substituída por D72 |
| D33 | Tela de mesclagem em `/obras/mesclar` (tela separada) | consolidada |
| D34 | Registrar decisão também atualiza o estado de revisão dos usos envolvidos | substituída por D72 |
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
| D45 | Botão "+ Aula" leva a uma tela intermediária de escolha de tema | substituída por D59 |
| D46 | Botões flutuantes "ir pro topo/fundo": desativados em telas < 600px; ⬇️ desaparece quando está no fundo | consolidada |
| D47 | Texto da ficha justificado em telas ≥ 700px, com hifenização automática | consolidada |
| D48 | Capa da edição por URL (sem upload); exibida em obra, aula e catálogo | consolidada |
| D49 | No catálogo, capa exibida é a da edição mais recente (por ano) | consolidada |
| D50 | Formulário de Nova Obra: Título, Autoria, Tipo de material e bloco de Primeira Edição (Editora, Ano, Capa) | consolidada |
| D51 | Formulário de Edição: Editora, Ano, Capa | consolidada |
| D52 | Formulário de Uso: Estado de revisão e Observações removidos da interface | consolidada |
| D53 | Bloco de Primeira Edição sempre visível; edição só é criada se ao menos um campo dela for preenchido | consolidada |
| D54 | Campos removidos da interface continuam existindo no banco (decisão reversível) | consolidada |
| D55 | Hierarquia curricular agora é **Eixo → Disciplina → Tema → Aula**. Nível "Módulo" removido. | consolidada |
| D56 | Módulos existentes foram **arquivados** (`arquivada = true`), não apagados. Reversível. | consolidada |
| D57 | A constraint `unidades_tipo_check` permite `modulo` apenas quando `arquivada = true` — impede criação de módulo novo. | consolidada |
| D58 | Constraint `descricao` só se aplica a eixo e disciplina (não mais módulo). | consolidada |
| D59 | Botão "+ Aula" removido da navbar. Criação de aula acontece dentro do tema. | consolidada |
| D60 | Rota `/aulas/nova` e template `aula-nova-escolher-tema.ejs` removidos. | consolidada |
| D61 | Excluir obra: bloqueia se estiver em uso; exclusão direta se não estiver, com confirmação simples. | consolidada |
| D62 | Excluir uso: disponível na tela de editar uso, com confirmação simples. | consolidada |
| D63 | ISBN removido dos formulários e da exibição (coluna mantida no banco, D54). | consolidada |
| D64 | Tipos de material: `livro`, `artigo`, `ensaio`, `revista`, `outro`. | consolidada |
| D65 | Tipos de recorte: `capitulo`, `secao`, `ensaio`, `a_conferir` | substituída por D75 |
| D66 | Campos "Início" e "Fim" removidos dos formulários de recorte (colunas mantidas no banco, D54). | consolidada |
| D67 | Recorte `a_conferir` é o único tipo especial que permanece. `integral` foi removido. | consolidada |
| D68 | Estado "a avaliar" é **calculado**, não mantido. | consolidada |
| D69 | Coluna `usos.validado_em` (TIMESTAMPTZ). `NULL` = não validado. | consolidada |
| D70 | O uso é **validado individualmente**. | consolidada |
| D71 | Se um uso novo da mesma obra é cadastrado, os usos antigos voltam a "a avaliar" automaticamente. | consolidada |
| D72 | **Removida** a mecânica de decisões de revisão. | consolidada |
| D73 | Filtros em cápsula no catálogo: "Todas" / "A Avaliar". | consolidada |
| D74 | Tela `/revisao` lista obras com usos a avaliar. Link "Revisão" na navbar. | consolidada |
| D75 | Tipos de recorte: `capitulo`, `secao`, `ensaio`, `conto`, `poema`, `a_conferir`. | consolidada |
| D76 | Editor de ficha: **Quill** (WYSIWYG), via CDN. Substitui Markdown + textarea + pré-visualização. | consolidada |
| D77 | Fichas armazenadas em **HTML** (`fichas.conteudo_html`, `fichas_versoes.conteudo_html`). Markdown antigo convertido. | consolidada |
| D78 | Estados de ficha (`estado_texto`, `estado_bibliografia`) saem da interface. Colunas mantidas no banco. | consolidada |
| D79 | Faixa de versão mostra "vN · Editada em DD/MM/AAAA", sem chips de estado. | consolidada |

## Regras de trabalho

- **R1:** quando uma alteração envolve mais de um ponto no mesmo arquivo, o arquivo inteiro é enviado.
- **R2:** quando envolve mais de um arquivo, todos os arquivos inteiros são enviados de uma vez.
- **R3:** em caso de erro, não mexer em nada antes de colar a mensagem exata e aguardar investigação.
- **R4:** nada é apagado do banco, repositório ou serviços sem explicação de consequências e cópia de segurança.
- **R5:** ao final de cada fase, os arquivos `DECISIONS.md` e `STATUS.md` são atualizados e commitados.
- **R6:** quando o volume crescer, o padrão de "busca com autocomplete no servidor" substitui os `<select>` com listas grandes.
- **R7:** arquivos de código são enviados **inteiros**, sempre. Exceções: `estilo.css` (aditivo) e SQL (executado por comando). A preferência da usuária é o padrão.
- **R8:** perguntar à usuária antes de dividir arquivo grande em trechos. A decisão de receber inteiro ou em pedaços é dela.
- **R9:** quando houver dúvida entre manter um campo pela spec e remover pela simplicidade do uso, **o uso manda**. YAGNI reverso.
- **R10:** ao remover uma camada da hierarquia, os dados dessa camada são **arquivados**, não apagados.
- **R11:** mudanças em constraints do banco ou migrações de dados merecem atenção redobrada.
- **R12:** quando o estado de uma entidade é derivado, ele deve ser calculado no SQL.
- **R13:** quando uma dependência externa for introduzida (CDN), registrar o motivo e o risco de indisponibilidade.

## Comportamentos conhecidos (não são bugs)

- O aviso "Sair do site?" (`beforeunload`) é suprimido por navegadores em alguns casos, como cliques em links da mesma origem. É limitação do navegador.

## Observações

- O banco do Neon se chama `neondb` dentro do projeto `literatura-critica-comparada-v2`.
- O protótipo antigo permanece arquivado em repositório separado.
- Coluna `capa_url` em `edicoes` (out/2026).
- Coluna `arquivada` em `unidades` (out/2026).
- Coluna `validado_em` em `usos` (out/2026).
- Coluna `conteudo_html` em `fichas` e `fichas_versoes` (out/2026). `conteudo_markdown` em `fichas` mantida como legado.
- 9 módulos arquivados em `unidades` (`tipo = 'modulo'`, `arquivada = true`).
- Constraints ativas em `unidades`: `unidades_tipo_check`, `descricao_apenas_em_eixo_disciplina`, `pergunta_norteadora_so_em_tema`.
- Constraint ativa em `usos_recortes`: `usos_recortes_tipo_check` (`capitulo`, `secao`, `ensaio`, `conto`, `poema`, `a_conferir`).
- Constraint ativa em `obras`: `obras_tipo_material_check` (`livro`, `artigo`, `ensaio`, `revista`, `outro`).
- Dependências externas: Google Fonts (Quicksand), jsDelivr CDN (Quill).