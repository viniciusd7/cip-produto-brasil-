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
| Prefeito | `prefeito@cmd.local` | `/painel` (board Azimov com seções) | Não |
| Secretário (`gestor`) | `gestor@cmd.local` | `/minha-pasta` (carteira visual da secretaria e tarefas) | Somente envio de evidências |
| Consultor (`analista`) | `analista@cmd.local` | `/carteira` | Sim: plano, metas, indicadores, projetos e tarefas |
| Leitura | — | `/painel` | Não |
| Admin CIP | `admin@cip.local` | `/administracao` | Sim: usuários e cadastros |

Senha demo: ver [`docs/DEMO.md`](DEMO.md) (somente ambiente local).

## 1) Prefeito

1. Login → panorama municipal consolidado (`#visao` → `#metodo`), sem escolher uma secretaria antes
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
