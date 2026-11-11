# Graph Report - cip projeto  (2026-11-09)

## Corpus Check
- 122 files · ~55,993 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 850 nodes · 1226 edges · 55 communities (47 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- iniciativas.ts
- secretarias/[id]/page.tsx
- shared/package.json
- governo-overview.tsx
- ui/package.json
- novo-projeto-wizard.tsx
- compilerOptions
- dependencies
- NovoProjetoWizard
- devDependencies
- scripts
- wizard-engine.ts
- db/package.json
- dashboard.ts
- status.ts
- status-tones.ts
- compilerOptions
- compilerOptions
- compilerOptions
- compilerOptions
- CIP — Plataforma de Inteligência de Gestão Municipal
- index.tsx
- notifications.ts
- app/layout.tsx
- next-auth.d.ts
- api/src/index.ts
- web/vercel.json
- estruturante-modelo-snapshot.ts
- api/vercel.json
- db/src/index.ts
- eslint.config.mjs
- next.config.ts
- middleware.ts
- catalogos-fluxos.test.ts
- condicoes-estruturante.ts
- middleware/auth.ts
- wizard.ts
- lib/auth.ts
- admin.ts
- iniciativas/[id]/page.tsx
- condicao-resposta.ts
- apiFetch
- Relatório executivo CIP — fórmulas e mapeamento
- wizard-prioridade.test.ts
- api.ts
- modelos/page.tsx
- importacao/page.tsx
- minha-pasta/page.tsx
- relatorios/page.tsx
- Guia de contribuição — CIP Plataforma
- Piloto CMD — importação controlada
- web/README.md
- secretarias/page.tsx
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 19 edges
2. `authOptions` - 18 edges
3. `compilerOptions` - 16 edges
4. `evaluateWizard()` - 16 edges
5. `scripts` - 15 edges
6. `HttpError` - 14 edges
7. `CIP — Plataforma de Inteligência de Gestão Municipal` - 14 edges
8. `requireAuth()` - 13 edges
9. `NovoProjetoWizard()` - 13 edges
10. `requirePermission()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ModelosAdminPage()` --calls--> `apiFetch()`  [EXTRACTED]
  apps/web/src/app/(app)/administracao/modelos/page.tsx → apps/web/src/lib/api.ts
- `estado()` --calls--> `evaluateWizard()`  [EXTRACTED]
  packages/shared/src/wizard-prioridade.test.ts → packages/shared/src/wizard-engine.ts
- `requireAuth()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/middleware/auth.ts → apps/api/src/middleware/error.ts
- `cachedFetch()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/routes/integracoes.ts → apps/api/src/middleware/error.ts
- `statusPor()` --calls--> `prazoStatus()`  [EXTRACTED]
  apps/api/src/routes/dashboard.ts → apps/api/src/services/prazo.ts

## Import Cycles
- None detected.

## Communities (55 total, 7 thin omitted)

### Community 0 - "iniciativas.ts"
Cohesion: 0.12
Nodes (17): createSchema, decisaoSchema, evidenciaSchema, impedimentoSchema, marcoSchema, metaExecSchema, reprogSchema, subtarefaSchema (+9 more)

### Community 1 - "secretarias/[id]/page.tsx"
Cohesion: 0.23
Nodes (5): EquipeAddForm(), EquipeLista(), PessoaPasta, Detail, TitularForm()

### Community 2 - "shared/package.json"
Cohesion: 0.11
Nodes (18): devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node, typescript (+10 more)

### Community 3 - "governo-overview.tsx"
Cohesion: 0.11
Nodes (25): DEMO_ACCOUNTS, LoginPage(), onSubmit(), Home(), AppShell(), BrandLogo(), GovernoOverview(), health() (+17 more)

### Community 4 - "ui/package.json"
Cohesion: 0.08
Nodes (25): devDependencies, react, react-dom, @types/react, @types/react-dom, typescript, exports, ./styles.css (+17 more)

### Community 5 - "novo-projeto-wizard.tsx"
Cohesion: 0.05
Nodes (31): DesdobramentoForms(), EvidenciaCard(), EvidenciaItem, EvidenciaForm(), MarcoOption, EvidenciaMedia(), Aba, ABAS (+23 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 7 - "dependencies"
Cohesion: 0.05
Nodes (41): dependencies, bcryptjs, @cip/db, @cip/shared, cors, express, jsonwebtoken, multer (+33 more)

### Community 8 - "NovoProjetoWizard"
Cohesion: 0.11
Nodes (15): Meta, ProjetoForm(), Secretaria, NovoProjetoWizard(), confirm(), mapTree(), next(), renderPerguntas() (+7 more)

### Community 9 - "devDependencies"
Cohesion: 0.05
Nodes (41): dependencies, @cip/shared, @cip/ui, next, next-auth, react, react-dom, recharts (+33 more)

### Community 10 - "scripts"
Cohesion: 0.09
Nodes (22): description, engines, node, name, packageManager, private, scripts, build (+14 more)

### Community 11 - "wizard-engine.ts"
Cohesion: 0.13
Nodes (27): PrioridadeNivel, avaliarEtapas(), avaliarPrioridade(), BloqueioAtivo, buildTree(), CondicaoValor, contaParaEtapa(), detalheNumero() (+19 more)

### Community 12 - "db/package.json"
Cohesion: 0.06
Nodes (33): dependencies, bcryptjs, @prisma/client, devDependencies, prisma, tsx, @types/bcryptjs, @types/node (+25 more)

### Community 13 - "dashboard.ts"
Cohesion: 0.20
Nodes (15): dashboardRouter, MarcoAgg, MetaAgg, statusPor(), buildSecretariaReport(), reportsRouter, ClassificacaoSecretaria, classificarSecretaria() (+7 more)

### Community 14 - "status.ts"
Cohesion: 0.06
Nodes (38): PermissionCode, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, RoleCode, ROLES, Aplicabilidade, CICLO_INICIATIVA (+30 more)

### Community 15 - "status-tones.ts"
Cohesion: 0.12
Nodes (8): AZIMOV, CLASS_COLORS, CLASS_GROUPS, GRAVIDADE_COLORS, PAINEL_TOC, SERIES, CipTone, gravidadeChartColor

### Community 16 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict (+5 more)

### Community 17 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, jsx, module, moduleResolution, outDir, rootDir (+5 more)

### Community 18 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, outDir, resolveJsonModule, rootDir, skipLibCheck, strict (+3 more)

### Community 19 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 20 - "CIP — Plataforma de Inteligência de Gestão Municipal"
Cohesion: 0.05
Nodes (39): Aderência ao doc 01 — RF e AT, Camadas de completude, Critérios de aceite, Requisitos funcionais, Arquitetura — CIP Gestão Municipal, Dimensões de status, Observabilidade mínima, Segurança (+31 more)

### Community 21 - "index.tsx"
Cohesion: 0.24
Nodes (3): Button(), Card(), cn()

### Community 22 - "notifications.ts"
Cohesion: 0.25
Nodes (4): BloqueioNotifyCtx, ConsoleNotificationPort, NotificationPort, notifications

### Community 23 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): cipSans, metadata, Providers()

### Community 24 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 25 - "api/src/index.ts"
Cohesion: 0.15
Nodes (17): app, port, assertMunicipioAccess(), requirePermission(), errorHandler(), HttpError, iniciativasRouter, cache (+9 more)

### Community 26 - "web/vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, installCommand, outputDirectory

### Community 27 - "estruturante-modelo-snapshot.ts"
Cohesion: 0.23
Nodes (10): ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT, ativarModeloPadrao(), main(), prisma, SnapshotModelo, UBS_MODELO_SNAPSHOT, ubsExtras, buildCatalogoPerguntas() (+2 more)

### Community 28 - "api/vercel.json"
Cohesion: 0.50
Nodes (3): builds, routes, version

### Community 34 - "catalogos-fluxos.test.ts"
Cohesion: 0.18
Nodes (14): buildAcaoDiariaPerguntas(), GRUPOS_ACAO, MODELO_ACAO_DIARIA, TemaAcao, TEMAS, toPergunta(), buildPlanoGovernoPerguntas(), GRUPOS_PLANO (+6 more)

### Community 35 - "condicoes-estruturante.ts"
Cohesion: 0.16
Nodes (17): CatalogoSnapshotPartial, etiquetaEspera(), GrupoCondicaoId, GRUPOS_CONDICOES, QUIZ_P03, QUIZ_P03_BASE, QUIZ_P03_ENRIQUECIDO, QUIZ_P03_EXTRA (+9 more)

### Community 36 - "middleware/auth.ts"
Cohesion: 0.20
Nodes (13): AuthUser, Express, permissionsForRole(), Request, requireAuth(), secret(), signAccessToken(), authRouter (+5 more)

### Community 37 - "wizard.ts"
Cohesion: 0.15
Nodes (13): confirmSchema, mapAplicabilidade(), mapSituacao(), novaPessoaSchema, persistVerificacoesFromRespostas(), previewSchema, reavaliarSchema, valorRespostaSchema (+5 more)

### Community 38 - "lib/auth.ts"
Cohesion: 0.17
Nodes (6): handler, ListResponse, DashboardResponse, PlanningResponse, authOptions, LoginResponse

### Community 39 - "admin.ts"
Cohesion: 0.23
Nodes (9): adminRouter, pessoaPatchSchema, pessoaSchema, secretariaTitularSchema, userSchema, Db, promoteToTitular(), syncTitularFieldsFromPessoa() (+1 more)

### Community 40 - "iniciativas/[id]/page.tsx"
Cohesion: 0.23
Nodes (9): DetailResponse, IniciativaPage(), SecretariaDetailPage(), Bloco, DadosExternos(), formatMoney(), ItemExterno, loadBloco() (+1 more)

### Community 41 - "condicao-resposta.ts"
Cohesion: 0.22
Nodes (10): AplicabilidadeCondicao, CondicaoResposta, deRespostaFechada(), formatarDetalhes(), parseCondicaoResposta(), RESPOSTA_FECHADA_LABEL, RESPOSTA_FECHADA_OPCOES, respostaFechada (+2 more)

### Community 42 - "apiFetch"
Cohesion: 0.32
Nodes (6): AdministracaoPage(), Metas, Modelos, NovoProjetoPage(), Secretarias, apiFetch()

### Community 43 - "Relatório executivo CIP — fórmulas e mapeamento"
Cohesion: 0.25
Nodes (7): Classificação de secretaria, Indicadores, Metas de execução, Relatório executivo CIP — fórmulas e mapeamento, Telas, Unidades, Versão metodológica

### Community 44 - "wizard-prioridade.test.ts"
Cohesion: 0.25
Nodes (4): RespostaViabilidade, TreeNode, estado(), estruturante

### Community 46 - "modelos/page.tsx"
Cohesion: 0.33
Nodes (4): AtivarModeloButton(), Ativos, Catalogo, ModelosAdminPage()

### Community 47 - "importacao/page.tsx"
Cohesion: 0.33
Nodes (3): ImportForm(), sample, Snapshots

### Community 48 - "minha-pasta/page.tsx"
Cohesion: 0.38
Nodes (5): classLabel(), MinhaPastaPage(), PastaResumo, PastaSaudeResumo(), Status

### Community 50 - "Guia de contribuição — CIP Plataforma"
Cohesion: 0.33
Nodes (5): Branches, Checklist de PR, Commits, Guia de contribuição — CIP Plataforma, Segurança

### Community 51 - "Piloto CMD — importação controlada"
Cohesion: 0.40
Nodes (4): Endpoint, Mapeamento sugerido, Piloto CMD — importação controlada, Política

### Community 52 - "web/README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 53 - "secretarias/page.tsx"
Cohesion: 0.67
Nodes (3): classLabel(), Dash, SecretariasPage()

## Knowledge Gaps
- **394 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+389 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 467 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NovoProjetoWizard()` connect `NovoProjetoWizard` to `apiFetch`, `novo-projeto-wizard.tsx`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `authOptions` connect `lib/auth.ts` to `secretarias/[id]/page.tsx`, `governo-overview.tsx`, `iniciativas/[id]/page.tsx`, `apiFetch`, `api.ts`, `modelos/page.tsx`, `importacao/page.tsx`, `minha-pasta/page.tsx`, `relatorios/page.tsx`, `secretarias/page.tsx`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `apiFetch()` connect `apiFetch` to `secretarias/[id]/page.tsx`, `governo-overview.tsx`, `lib/auth.ts`, `iniciativas/[id]/page.tsx`, `api.ts`, `modelos/page.tsx`, `importacao/page.tsx`, `minha-pasta/page.tsx`, `relatorios/page.tsx`, `secretarias/page.tsx`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _394 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `iniciativas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Should `shared/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `governo-overview.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._