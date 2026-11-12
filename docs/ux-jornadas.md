# Jornadas de UX — gestão pública por perfil

## Princípios

- Menu filtrado pelo papel; home distinta após o login.
- Fluxo único: **Cenário → Minha secretaria (quem) → Projeto (o quê) → Cobrança**.
- Identidade visual Azimov / CIP executive (dark: rose `#ff5982`, violet `#7c9cff`, green `#b4e4a0`).
- Mobile-first: 1 coluna, CTAs únicos, progressive disclosure no desktop.
- Projeto nasce pelo **wizard** (`/minha-pasta/novo`) com classificação, modelo e viabilidade.
- Documento do projeto: alerta de bloqueio rotulado + árvore pasta/seta Meta → Tarefa → Subtarefa.
- Indicadores do board vêm de `Iniciativa` + `MarcoEntrega` + `MetaExecucao` + `Impedimento` via `/dashboard/resumo`.

## Papéis e homes

| Papel | Conta demo | Home | Permissões operacionais |
|---|---|---|---|
| Prefeito | `prefeito@cmd.local` | `/painel` (cenário em um olhar: situação geral, semáforo das secretarias, metas e atenção) | Não — somente leitura de toda a prefeitura |
| Secretário (`gestor`) | `gestor@cmd.local` | `/minha-pasta` (carteira visual da secretaria e tarefas) | Somente envio de evidências |
| Consultor (`analista`) | `analista@cmd.local` | `/carteira` | Sim: secretarias, equipe (`/equipe`), plano, metas, indicadores, projetos e tarefas |
| Leitura | — | `/painel` | Não |
| Admin CIP | `admin@cip.local` | `gestao.<domínio>/` (console separado; local: `http://gestao.localhost:3000`) | Sim: prefeituras, consultores e prefeito responsável |

Senha demo: ver [`docs/DEMO.md`](DEMO.md) (somente ambiente local).

## Agenda e prestação de contas

- **Agenda** (`/pendencias`): “O que precisa ser feito”, agrupado por urgência com cores (atrasado, esta semana, mais adiante, sem prazo), faixa dos próximos 7 dias e andamento por projeto.
- **Prestação de contas** (`/relatorios`): relatório no tema escuro CIP com barra de filtros fixa — períodos rápidos (este mês, mês passado, 30 dias, trimestre, ano, mandato), datas De/Até, secretaria, projeto e situação (atrasadas, sem prazo, no prazo, concluídas). Uma tarefa entra no período se o prazo vigente ou a conclusão cair nele. Seções: resumo com veredito, KPIs, evolução mês a mês, ranking por secretaria (clique filtra), metas estratégicas, metas de execução, evidências por tipo, projetos (clique filtra), tabela de tarefas com busca/ordenação e próximos passos. “Salvar PDF / imprimir” gera A4 claro com todas as linhas; o CSV (`/reports/prestacao.csv`) respeita os filtros. Secretário vê só a própria secretaria.

## 1) Prefeito

1. Login → cenário em um olhar (`#visao` → `#detalhes`): medidor de entregas em dia, semáforo das secretarias, metas estratégicas e de execução, e o que precisa de atenção; a análise completa fica atrás de “Ver análise detalhada”
2. Visão de todas as secretarias ativas, incluindo as que ainda não têm projetos, com indicadores, metas, agenda e prioridades
3. Drill para o cenário detalhado de uma secretaria e, dali, para projetos; sem formulários de edição

## 2) Secretário

1. Login → **Minha secretaria** (visão geral, carteira unificada e tarefas da secretaria)
2. A carteira reúne projetos principais e correlacionados, com progresso, atrasos, tarefas sem prazo e impedimentos; busca e filtros permitem localizar prioridades
3. Abre o projeto para acompanhar metas, tarefas e subtarefas; não cria nem altera plano, tarefas ou indicadores
4. Em **Evidências**, registra o avanço com foto, vídeo, documento ou link; o consultor valida antes de contar como entrega
5. O acesso é limitado no servidor aos projetos vinculados à secretaria do usuário, inclusive aos projetos correlacionados

## 3) Consultor (analista)

1. Secretarias → acompanhar prioridades e abrir a pasta municipal
2. Projetos → abrir metas, tarefas, subtarefas e evidências
3. Agenda → consultar a carteira de projetos com progresso, tarefas por estado, secretarias correlacionadas e providências abertas; no perfil secretário, os dados são limitados à própria secretaria

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

- O mesmo painel visual (medidor, barra de status, "o que precisa de atenção", pastas de projetos com correlacionados 🤝, metas estratégicas e de execução) aparece:
  - para o **prefeito**, em `/painel?secretariaId=…`, com chips para trocar de secretaria e filtros de saúde;
  - para o **secretário**, em `/minha-pasta`, restrito à própria secretaria.

## Central de notificações

- `/notificacoes` mostra contador de não lidas, alternância Não lidas/Todas, blocos por tipo (atribuídas, para validar, decisões, prazos) que funcionam como filtro e agrupamento por dia (Hoje, Ontem, Nesta semana, Anteriores).
- Cada aviso leva direto à tarefa, meta ou validação. Canais: painel ativo; e-mail e WhatsApp em breve.
