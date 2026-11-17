# Jornadas de UX — gestão pública por perfil

## Princípios

- Menu filtrado pelo papel; home distinta após o login.
- Fluxo único: **Visão geral → Minha secretaria (quem) → Projeto (o quê) → Cobrança**.
- Identidade visual Azimov / CIP executive (dark: rose `#ff5982`, violet `#7c9cff`, green `#b4e4a0`).
- Mobile-first: 1 coluna, CTAs únicos, progressive disclosure no desktop.
- Projeto nasce pelo **wizard** (`/minha-pasta/novo`): a entrada geral oferece quatro categorias exclusivas; o assistente começa pelos impedimentos comuns e segue com o modelo e as perguntas do fluxo escolhido.
- Projeto prioritário é uma categoria própria, com o fluxo de viabilidade estruturante e contagem separada.
- Preparação (projeto técnico, licenças e situação do imóvel) integra **Impedimentos e pré-requisitos**, sem etapa separada “O que falta para começar”. A necessidade de imóvel é perguntada uma vez; somente quando aplicável aparece a situação detalhada, preservando a geração das providências de aquisição/desapropriação.
- O assistente mantém automaticamente **um rascunho por usuário, prefeitura e categoria neste navegador** (`localStorage` versionado, sem token). Ao sair e voltar ao mesmo fluxo, recupera identidade, responsável, respostas e árvore de tarefas/subtarefas; a prévia é recalculada antes de concluir. Não há sincronização entre dispositivos e limpar os dados do navegador remove esses rascunhos. O usuário pode descartar e recomeçar. Falhas de leitura/gravação são exibidas, rascunhos inválidos não são sobrescritos e a limpeza só ocorre após criação confirmada pela API.
- A ajuda `?` fica na mesma linha do rótulo/pergunta; os controles mantêm identificação acessível e a ajuda não fica dentro de um `label`.
- Documento do projeto: alerta de bloqueio rotulado, metas estratégicas e indicadores, e árvore Tarefa → Subtarefa.
- Indicadores do board vêm de projetos, metas estratégicas, tarefas e impedimentos via `/dashboard/resumo`.

## Papéis e homes

| Papel | Conta demo | Home | Permissões operacionais |
|---|---|---|---|
| Prefeito | `prefeito@cmd.local` | `/painel` (visão geral única, com resultados estratégicos em destaque e detalhamento por secretaria) | Não edita projetos ou tarefas; mantém os acessos de consulta já existentes |
| Secretário (`gestor`) | `gestor@cmd.local` | `/minha-pasta` (carteira visual da secretaria e tarefas) | Somente envio de evidências |
| Consultor (`analista`) | `analista@cmd.local` | `/painel` (cenário da prefeitura ativa) | Sim: secretarias, equipe (`/equipe`), plano, metas, indicadores, projetos e tarefas |
| Leitura | — | `/painel` | Não |
| Admin CIP | `admin@cip.local` | `gestao.<domínio>/` (console separado; local: `http://gestao.localhost:3000`) | Sim: prefeituras, consultores e prefeito responsável |

Senha demo: ver [`docs/DEMO.md`](DEMO.md) (somente ambiente local).

## Agenda e prestação de contas

- **Agenda** (`/pendencias`): “O que precisa ser feito”, agrupado por urgência com cores (atrasado, esta semana, mais adiante, sem prazo), faixa dos próximos 7 dias e andamento por projeto.
- **Relatórios** (`/relatorios`): consulta plana, sem árvore de seções. Escolha tarefas, metas estratégicas e indicadores, projetos, secretarias ou evidências; selecione secretaria, projeto, datas e situação das tarefas quando aplicável. A busca considera todas as células, sem diferenciar acentos ou maiúsculas. Confirme em **Aplicar filtros e busca**; clique no cabeçalho para ordenar, mantendo os filtros na URL. Não há corte silencioso de linhas. **Exportar esta tabela (CSV)** baixa o mesmo retrato exibido, com as mesmas colunas, linhas e ordem, mesmo se os dados mudarem depois; reaplique os filtros para atualizar. A consulta é autorizada e auditada no servidor. “Salvar PDF / imprimir” usa tabela A4 horizontal. O secretário só recebe projetos autorizados à sua secretaria, inclusive correlacionados. Tarefas historicamente vinculadas a metas de execução continuam incluídas.

## 1) Prefeito

1. Login → dashboard executivo único em `/painel`: metas estratégicas, indicadores, realizado informado, esperado na data, desvio, medição anterior e fonte.
2. A visão mostra todas as secretarias ativas, inclusive as que ainda não têm projetos. A seleção de uma secretaria aprofunda metas estratégicas, metas de execução e projetos na própria rota `/painel?secretariaId=…`.
3. Projetos com atraso e dados defasados aparecem como pontos de atenção. As contagens de tarefas permanecem em um bloco de execução, separado dos indicadores de resultado.
4. Os acessos de consulta já existentes permanecem disponíveis. O prefeito não recebe formulários de edição de projetos ou tarefas.
5. A Visão geral do prefeito tem abas para Resultados, Secretarias, Projetos e Acompanhamento. Cada aba abre conteúdo próprio; os filtros de secretarias e projetos ficam recolhidos em “Filtros adicionais”.
6. No menu lateral, clicar em Projetos abre a carteira completa. A seta ao lado expande as categorias de projeto.

## 2) Secretário

1. Login → **Minha secretaria** (visão geral, carteira unificada e tarefas da secretaria)
2. A carteira reúne projetos principais e correlacionados, com progresso, atrasos, tarefas sem prazo e impedimentos; busca e filtros permitem localizar prioridades
3. Abre o projeto para acompanhar metas, tarefas e subtarefas; não cria nem altera plano, tarefas ou indicadores
4. Em **Evidências**, registra o avanço com foto, vídeo, documento ou link; o consultor valida antes de contar como entrega
5. O acesso é limitado no servidor aos projetos vinculados à secretaria do usuário, inclusive aos projetos correlacionados

## 3) Consultor (analista)

1. Login ou troca de prefeitura → **Visão geral** (`/painel`) da prefeitura ativa, com indicadores operacionais, tarefas, prazos e ações de acompanhamento. Secretarias continua como próximo passo para abrir a pasta municipal.
2. Projetos → abrir metas, tarefas, subtarefas e evidências; em **Aprovações**, decidir pedidos de conclusão com justificativa e evidência
3. Agenda → consultar a carteira de projetos com progresso, tarefas por estado, secretarias correlacionadas e providências abertas; no perfil secretário, os dados são limitados à própria secretaria

A troca confirma a sessão antes de recarregar a página de entrada, descartando o cache e os filtros do município anterior, inclusive quando a URL continua `/painel`. A lista permanece limitada aos vínculos com prefeituras ativas; o papel é o de cada vínculo, não o de outra prefeitura. Um vínculo `leitura` não recebe permissões de consultor. O consultor também pode abrir o cenário vazio de uma prefeitura ainda sem secretarias. Nenhuma permissão ou vínculo é criado por essa navegação.

## 4) Admin

1. Administração → cadastrar usuários municipais como secretário, consultor, prefeito, leitura ou admin
2. Ao cadastrar ou editar o vínculo, associar cada secretário a uma secretaria; sem vínculo, o perfil não recebe dados operacionais
3. Importação e ativação de modelos do catálogo CIP (`POST /modelos-projeto/ativar/:id`)

## Equipe da pasta

- Vários funcionários por secretaria (`SecretariaPessoa`), com no máximo um **TITULAR** ativo.
- Campos `titular*` da secretaria permanecem sincronizados com o titular (compatível com painel).
- Projetos gravam `responsavelPessoaId` + nome em `responsavel` para listagens.

## Página do projeto (pastas)

- O projeto é exibido como pastas: **meta → tarefa → subtarefa**, com anel de progresso no topo e abas Tarefas / Evidências / Sobre o projeto.
- Removidos "Dependências tipadas" e "Equipamento público"; o histórico virou uma linha do tempo simples.
- Evidência guiada: o secretário escolhe foto, vídeo ou documento, envia, e o item fica "Aguardando validação" até a consultoria aprovar (com parecer) ou devolver.

## Visão da secretaria

- O mesmo painel visual (medidor, barra de status, "o que precisa de atenção", pastas de projetos com correlacionados 🤝 e metas estratégicas) aparece:
  - para o **prefeito**, em `/painel?secretariaId=…`, com metas estratégicas, metas de execução por projeto, medições e projetos vinculados em leitura executiva;
  - para o **secretário**, em `/minha-pasta`, restrito à própria secretaria.

## Central de notificações

- `/notificacoes` mostra contador de não lidas, alternância Não lidas/Todas, blocos por tipo (atribuídas, para validar, decisões, prazos) que funcionam como filtro e agrupamento por dia (Hoje, Ontem, Nesta semana, Anteriores).
- Cada aviso leva direto à tarefa, meta ou validação. Canais: painel ativo; e-mail e WhatsApp em breve.
