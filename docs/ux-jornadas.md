# Jornadas de UX — gestão pública por perfil

## Princípios

- Menu filtrado pelo papel; home distinta após o login.
- Fluxo único: **Cenário → Pasta (quem) → Projeto (o quê) → Cobrança**.
- Identidade visual Azimov / CIP executive (dark: rose `#ff5982`, violet `#7c9cff`, green `#b4e4a0`).
- Mobile-first: 1 coluna, CTAs únicos, progressive disclosure no desktop.
- Projeto nasce pelo **wizard** (`/minha-pasta/novo`) com classificação, modelo e viabilidade.
- Documento do projeto: alerta de bloqueio rotulado + árvore pasta/seta Meta → Tarefa → Subtarefa.
- Indicadores do board vêm de `Iniciativa` + `MarcoEntrega` + `MetaExecucao` + `Impedimento` via `/dashboard/resumo`.

## Papéis e homes

| Papel | Conta demo | Home | Edita |
|---|---|---|---|
| Prefeito | `prefeito@cmd.local` | `/painel` (board Azimov com seções) | Não |
| Secretário (`gestor`) | `gestor@cmd.local` | `/minha-pasta` (cockpit Azimov da pasta) | Sim |
| Equipe (`analista`) | `analista@cmd.local` | `/carteira` | Sim |
| Leitura | — | `/painel` | Não |
| Admin CIP | `admin@cip.local` | `/administracao` | Sim |

Senha demo: ver [`docs/DEMO.md`](DEMO.md) (somente ambiente local).

## 1) Prefeito

1. Login → cenário (`#visao` → `#metodo`) com TOC no rail
2. KPIs de carteira, metas, saúde das pastas, agenda e projetos estruturantes
3. Drill para pasta/projeto; sem formulários de edição

## 2) Secretário

1. Login → **Minha pasta** (board Azimov: hero da pasta · saúde · fila de ação)
2. Em **Pastas** → detalhe da secretaria: manter **Equipe da pasta** (titular + funcionários com cargo)
3. **Novo projeto** → wizard estruturante: Tipo → Categoria → Identidade (escopo) → Planejamento → Recursos → Preparação → Operação → Urgência → Prévia (catálogo QUIZ_P03+)
4. Condições usam `a avaliar / pendente / atendida / não se aplica` + providência; licitação, desapropriação, PPA/LOA etc. entram no checklist
5. Na Identidade, o **Responsável** vem da equipe da pasta (`Nome — Cargo`) ou **Registrar novo na pasta**
6. Bloqueios aparecem com rótulo (ex.: “Aguardando verba”) e alertam o responsável
7. Documento: condicionantes por grupo + árvore Meta→Tarefa com origem humanizada

## 3) Equipe (analista)

1. Carteira → wizard ou ficha
2. Metas, tarefas, subtarefas, evidências

## 4) Admin

1. Administração + importação
2. Ativar modelos do catálogo CIP (`POST /modelos-projeto/ativar/:id`)

## Equipe da pasta

- Vários funcionários por secretaria (`SecretariaPessoa`), com no máximo um **TITULAR** ativo.
- Campos `titular*` da secretaria permanecem sincronizados com o titular (compatível com painel).
- Projetos gravam `responsavelPessoaId` + nome em `responsavel` para listagens.
