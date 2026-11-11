# Graph Report - cip projeto  (2026-11-11)

## Corpus Check
- 180 files · ~102,809 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1273 nodes · 1966 edges · 85 communities (71 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `36a525ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- tarefas-board.tsx
- dependencies
- CIP — Plataforma de Inteligência de Gestão Municipal
- shared/package.json
- app-shell.tsx
- status.ts
- api/src/index.ts
- wizard-engine.ts
- compilerOptions
- iniciativas.ts
- wizard.ts
- scripts
- condicao-resposta.ts
- apiFetch
- dashboard.ts
- wizard-prioridade.test.ts
- condicoes-estruturante.ts
- lib/auth.ts
- status-tones.ts
- novo-projeto-wizard.tsx
- 🚀 Relatório de Deploy — Correções de Segurança CIP
- admin.ts
- devDependencies
- DossieGovernanca
- secretarias/[id]/page.tsx
- compilerOptions
- compilerOptions
- minha-pasta/page.tsx
- estruturante-modelo-snapshot.ts
- compilerOptions
- db/package.json
- execucao.ts
- plano-estrutura.tsx
- compilerOptions
- ui/package.json
- src/types.ts
- governo-overview.tsx
- index.tsx
- planejamento.ts
- pendencias/page.tsx
- lib/roles.ts
- sugestoes.ts
- Relatório executivo CIP — fórmulas e mapeamento
- projeto-documento.tsx
- importacao/page.tsx
- Relatório de Implementação: Correções de Segurança — CIP
- verify-gestao.cjs
- api.ts
- relatorios/page.tsx
- app/layout.tsx
- Deploy — Vercel + MySQL HostGator
- next-auth.d.ts
- Guia de contribuição — CIP Plataforma
- Piloto CMD — importação controlada
- web/README.md
- web/vercel.json
- api/vercel.json
- Jornadas de UX — gestão pública por perfil
- db/src/index.ts
- AGENTS.md
- eslint.config.mjs
- next.config.ts
- HttpError
- PlatformAdminConsole
- governo-glance.tsx
- Aderência ao dossiê Izabela (08/11/2026)
- Arquitetura — CIP Gestão Municipal
- equipe/page.tsx
- secretarias/page.tsx
- Fluxo operacional municipal
- Gestão municipal multi-prefeitura
- Segurança — CIP Plataforma
- implantacao/page.tsx
- notificacoes-lista.tsx
- README.md
- 0001-per-tenant-roles-and-platform-admin.md
- 0002-validacao-de-conclusao-pela-consultoria.md
- modelos/page.tsx
- dossie-governanca.tsx
- evidencia-actions.tsx
- evidencia-form.tsx
- 0003-console-de-gestao-em-host-separado.md

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 52 edges
2. `HttpError` - 30 edges
3. `authOptions` - 24 edges
4. `requireAuth()` - 17 edges
5. `NovoProjetoWizard()` - 17 edges
6. `compilerOptions` - 16 edges
7. `evaluateWizard()` - 16 edges
8. `scripts` - 15 edges
9. `requirePermission()` - 14 edges
10. `CIP — Plataforma de Inteligência de Gestão Municipal` - 14 edges

## Surprising Connections (you probably didn't know these)
- `carregarAlvo()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/routes/execucao.ts → apps/api/src/middleware/error.ts
- `assertAlvosIndicador()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/routes/planejamento.ts → apps/api/src/middleware/error.ts
- `ModelosAdminPage()` --calls--> `apiFetch()`  [EXTRACTED]
  apps/web/src/app/(app)/equipe/modelos/page.tsx → apps/web/src/lib/api.ts
- `estado()` --calls--> `evaluateWizard()`  [EXTRACTED]
  packages/shared/src/wizard-prioridade.test.ts → packages/shared/src/wizard-engine.ts
- `requireAuth()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/middleware/auth.ts → apps/api/src/middleware/error.ts

## Import Cycles
- None detected.

## Communities (85 total, 11 thin omitted)

### Community 0 - "tarefas-board.tsx"
Cohesion: 0.11
Nodes (13): DesdobramentoForms(), ItemTextoEditor(), ProjetoDocMarco, ProjetoDocMeta, ReprogramarTarefa(), ResponsavelEditor(), SubtarefaToggle(), TarefaAcoes() (+5 more)

### Community 1 - "dependencies"
Cohesion: 0.05
Nodes (42): dependencies, bcryptjs, @cip/db, @cip/shared, cors, express, jsonwebtoken, multer (+34 more)

### Community 2 - "CIP — Plataforma de Inteligência de Gestão Municipal"
Cohesion: 0.13
Nodes (15): CIP — Plataforma de Inteligência de Gestão Municipal, Deploy, Documentação, Estrutura, Hierarquia funcional, Identidade visual, Jornadas do usuário, Propriedade e licença (+7 more)

### Community 3 - "shared/package.json"
Cohesion: 0.11
Nodes (18): devDependencies, tsx, @types/node, typescript, exports, tsx, @types/node, typescript (+10 more)

### Community 4 - "app-shell.tsx"
Cohesion: 0.17
Nodes (9): AppShell(), AvisosBadge(), NotificacoesBadge(), CenarioSecretaria(), CenarioSecretariaResponse, tonePrazo(), s, getNavForRole() (+1 more)

### Community 5 - "status.ts"
Cohesion: 0.08
Nodes (22): Aplicabilidade, CICLO_INICIATIVA, CLASSIFICACAO_PROJETO, ClassificacaoProjeto, DECISAO_STATUS, DecisaoStatus, EFEITO_AVANCO, EfeitoAvanco (+14 more)

### Community 6 - "api/src/index.ts"
Cohesion: 0.12
Nodes (26): app, origin, port, authSecret(), AuthUser, Express, permissionsForRole(), Request (+18 more)

### Community 7 - "wizard-engine.ts"
Cohesion: 0.12
Nodes (28): PrioridadeNivel, avaliarEtapas(), avaliarPrioridade(), BloqueioAtivo, buildTree(), CondicaoValor, contaParaEtapa(), detalheNumero() (+20 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 9 - "iniciativas.ts"
Cohesion: 0.09
Nodes (24): createSchema, decisaoSchema, dependenciaSchema, evidenciaSchema, impedimentoSchema, marcoPatchSchema, marcoSchema, metaExecSchema (+16 more)

### Community 10 - "wizard.ts"
Cohesion: 0.14
Nodes (14): confirmSchema, mapAplicabilidade(), mapSituacao(), novaPessoaSchema, persistVerificacoesFromRespostas(), previewSchema, reavaliarSchema, treeNodeSchema (+6 more)

### Community 11 - "scripts"
Cohesion: 0.08
Nodes (24): author, description, engines, node, license, name, packageManager, private (+16 more)

### Community 12 - "condicao-resposta.ts"
Cohesion: 0.11
Nodes (25): buildAcaoDiariaPerguntas(), GRUPOS_ACAO, MODELO_ACAO_DIARIA, TemaAcao, TEMAS, toPergunta(), GRUPOS_CONDICOES, buildPlanoGovernoPerguntas() (+17 more)

### Community 13 - "apiFetch"
Cohesion: 0.15
Nodes (15): AppLayout(), Metas, Modelos, NovoProjetoPage(), Secretarias, NotificacoesLista(), marcar(), marcarTodas() (+7 more)

### Community 14 - "dashboard.ts"
Cohesion: 0.19
Nodes (17): assertSecretariaAccess(), iniciativaScopeFilter(), dashboardRouter, MarcoAgg, MetaAgg, statusPor(), buildSecretariaReport(), reportsRouter (+9 more)

### Community 15 - "wizard-prioridade.test.ts"
Cohesion: 0.25
Nodes (4): RespostaViabilidade, TreeNode, estado(), estruturante

### Community 16 - "condicoes-estruturante.ts"
Cohesion: 0.18
Nodes (16): CatalogoSnapshotPartial, etiquetaEspera(), GrupoCondicaoId, PERGUNTAS_ATUAIS, QUIZ_P03, QUIZ_P03_BASE, QUIZ_P03_ENRIQUECIDO, QUIZ_P03_EXTRA (+8 more)

### Community 17 - "lib/auth.ts"
Cohesion: 0.14
Nodes (6): handler, ListResponse, Aviso, ComunicacaoProjeto(), authOptions, LoginResponse

### Community 18 - "status-tones.ts"
Cohesion: 0.12
Nodes (8): AZIMOV, CLASS_COLORS, CLASS_GROUPS, GRAVIDADE_COLORS, PAINEL_TOC, SERIES, CipTone, gravidadeChartColor

### Community 19 - "novo-projeto-wizard.tsx"
Cohesion: 0.06
Nodes (46): criarNo(), dataParaIso(), EscopoEditor(), atualizarMeta(), atualizarSubtarefas(), atualizarTarefas(), EscopoNo, isoParaData() (+38 more)

### Community 20 - "🚀 Relatório de Deploy — Correções de Segurança CIP"
Cohesion: 0.05
Nodes (38): 1. **apps/api/src/middleware/tarefa-auth.ts** (114 linhas), 2. **apps/api/src/routes/__tests__/security.test.ts** (84 linhas), 3. **docs/auditoria/RELATORIO-CORRECOES-IMPLEMENTADAS.md** (91 linhas), ✨ Após Priority #6, 📁 Arquivos Criados, 🔄 Backward Compatibility, Build Output, Checklist de Conclusão (+30 more)

### Community 21 - "admin.ts"
Cohesion: 0.14
Nodes (14): requireAnyPermission(), requirePlatformAdmin(), adminRouter, municipioOnboardingSchema, pessoaPatchSchema, pessoaSchema, requireSecretariaWrite, secretariaCreateSchema (+6 more)

### Community 22 - "devDependencies"
Cohesion: 0.05
Nodes (41): dependencies, @cip/shared, @cip/ui, next, next-auth, react, react-dom, recharts (+33 more)

### Community 24 - "secretarias/[id]/page.tsx"
Cohesion: 0.20
Nodes (7): EquipeAddForm(), EquipeLista(), PessoaPasta, Detail, SecretariaDetailPage(), TitularForm(), canEditSecretariaRole()

### Community 25 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict (+5 more)

### Community 26 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, jsx, module, moduleResolution, outDir, rootDir (+5 more)

### Community 27 - "minha-pasta/page.tsx"
Cohesion: 0.06
Nodes (40): data(), IndicadorPasta, MetaEstrategicaPasta, MetaExecucaoPasta, MetasSecretaria(), toneProgresso(), AgendaResponse, classLabel() (+32 more)

### Community 28 - "estruturante-modelo-snapshot.ts"
Cohesion: 0.23
Nodes (10): ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT, ativarModeloPadrao(), main(), prisma, SnapshotModelo, UBS_MODELO_SNAPSHOT, ubsExtras, buildCatalogoPerguntas() (+2 more)

### Community 29 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, outDir, resolveJsonModule, rootDir, skipLibCheck, strict (+5 more)

### Community 30 - "db/package.json"
Cohesion: 0.06
Nodes (33): dependencies, bcryptjs, @prisma/client, devDependencies, prisma, tsx, @types/bcryptjs, @types/node (+25 more)

### Community 31 - "execucao.ts"
Cohesion: 0.08
Nodes (22): carregarAlvo(), decidirSchema, execucaoRouter, notificacoesRouter, PayloadConclusao, reprogramarSchema, solicitacaoSchema, TZ (+14 more)

### Community 32 - "plano-estrutura.tsx"
Cohesion: 0.06
Nodes (38): Pessoa, Secretaria, VinculosEditor(), ConhecimentoForm(), conferir(), submitDoc(), Doc, MedicaoFormMeta (+30 more)

### Community 33 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 34 - "ui/package.json"
Cohesion: 0.08
Nodes (25): devDependencies, react, react-dom, @types/react, @types/react-dom, typescript, exports, ./styles.css (+17 more)

### Community 35 - "src/types.ts"
Cohesion: 0.15
Nodes (16): PermissionCode, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, RoleCode, ROLES, CicloIniciativa, EntraveStatus (+8 more)

### Community 36 - "governo-overview.tsx"
Cohesion: 0.27
Nodes (9): GovernoOverview(), health(), normalize(), number(), percent(), Radar(), recommendation(), OverviewResponse (+1 more)

### Community 37 - "index.tsx"
Cohesion: 0.24
Nodes (3): Button(), Card(), cn()

### Community 38 - "planejamento.ts"
Cohesion: 0.15
Nodes (13): assertAlvosIndicador(), indicadorSchema, medicaoIndicadorSchema, medicaoSchema, metaSchema, planejamentoRouter, planoSchema, SugestaoPayload (+5 more)

### Community 39 - "pendencias/page.tsx"
Cohesion: 0.18
Nodes (15): ACAO_PENDENCIA, DashboardResponse, diasAte(), Grupo, grupoDe(), GRUPOS, hoje(), inicioDoDia() (+7 more)

### Community 40 - "lib/roles.ts"
Cohesion: 0.31
Nodes (8): IniciativaPage(), ValidacoesPage(), ALL_NAV, AppRole, canSubmitEvidenceRole(), canValidateRole(), NavItem, normalizeRole()

### Community 41 - "sugestoes.ts"
Cohesion: 0.15
Nodes (9): ContextoMeta, GENERICOS, provedorAtivo, provedorHeuristico, SugestaoIndicador, SugestaoTarefa, SuggestionProvider, Tema (+1 more)

### Community 42 - "Relatório executivo CIP — fórmulas e mapeamento"
Cohesion: 0.25
Nodes (7): Classificação de secretaria, Indicadores, Metas de execução, Relatório executivo CIP — fórmulas e mapeamento, Telas, Unidades, Versão metodológica

### Community 43 - "projeto-documento.tsx"
Cohesion: 0.18
Nodes (10): DetailResponse, Aba, ABAS, GRUPOS_DOCUMENTO, metaProgress(), ProjetoDocData, ProjetoDocumento(), respostaLegivel() (+2 more)

### Community 44 - "importacao/page.tsx"
Cohesion: 0.33
Nodes (3): ImportForm(), sample, Snapshots

### Community 45 - "Relatório de Implementação: Correções de Segurança — CIP"
Cohesion: 0.18
Nodes (10): 1. ✅ Middleware de Autorização por Tarefa, 2. ✅ Testes de Segurança, Curto prazo (Próximas 2 semanas), 🚀 Próximos Passos, Relatório de Implementação: Correções de Segurança — CIP, 📋 Resumo das Correções, TypeScript, URGENTE (Esta semana) (+2 more)

### Community 46 - "verify-gestao.cjs"
Cohesion: 0.33
Nodes (4): assert, { prisma }, { ROLE_PERMISSIONS }, { signAccessToken }

### Community 47 - "api.ts"
Cohesion: 0.22
Nodes (4): AcaoForm(), InitiativesResponse, SugerirTarefas(), Sugestao

### Community 48 - "relatorios/page.tsx"
Cohesion: 0.08
Nodes (26): ExportButtons(), CLASSE_COR, conclusao(), COR, numero(), ORDEM, plural(), RelatoriosPage() (+18 more)

### Community 49 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): cipSans, metadata, Providers()

### Community 50 - "Deploy — Vercel + MySQL HostGator"
Cohesion: 0.25
Nodes (7): 1. Banco HostGator, 2. Projeto API na Vercel (`cip-painel-api`), 3. Projeto Web na Vercel (`cip-painel`), 4. Checklist pós-deploy, 5. Domínio CIP, Deploy — Vercel + MySQL HostGator, GitHub

### Community 51 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 52 - "Guia de contribuição — CIP Plataforma"
Cohesion: 0.40
Nodes (5): Branches, Checklist de PR, Commits, Guia de contribuição — CIP Plataforma, Segurança

### Community 53 - "Piloto CMD — importação controlada"
Cohesion: 0.40
Nodes (4): Endpoint, Mapeamento sugerido, Piloto CMD — importação controlada, Política

### Community 54 - "web/README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 55 - "web/vercel.json"
Cohesion: 0.50
Nodes (3): buildCommand, framework, installCommand

### Community 57 - "Jornadas de UX — gestão pública por perfil"
Cohesion: 0.22
Nodes (9): 1) Prefeito, 2) Secretário, 3) Consultor (analista), 4) Admin, Agenda e prestação de contas, Equipe da pasta, Jornadas de UX — gestão pública por perfil, Papéis e homes (+1 more)

### Community 62 - "HttpError"
Cohesion: 0.24
Nodes (11): assertIniciativaAccess(), assertMunicipioAccess(), HttpError, assertMarcoAccess(), PERMISSION_BY_ACTION, requireMarcoAccess(), cache, cachedFetch() (+3 more)

### Community 64 - "PlatformAdminConsole"
Cohesion: 0.21
Nodes (9): Consultant, Municipality, MunicipalityUsers, MunicipalUser, PlatformAdminConsole(), assignConsultant(), refresh(), submit() (+1 more)

### Community 65 - "governo-glance.tsx"
Cohesion: 0.27
Nodes (7): COR, Data, GovernoGlance(), numero(), ORDEM, saudeGoverno(), veredito()

### Community 66 - "Aderência ao dossiê Izabela (08/11/2026)"
Cohesion: 0.33
Nodes (6): Aderência ao dossiê Izabela (08/11/2026), Camadas, Critérios de aceite do piloto, Orientações Izabela, Regras de negócio (amostra crítica), Requisitos funcionais (dossiê)

### Community 67 - "Arquitetura — CIP Gestão Municipal"
Cohesion: 0.33
Nodes (6): Arquitetura — CIP Gestão Municipal, Dimensões de status, Observabilidade mínima, Segurança, Separação front / back, Visão geral

### Community 68 - "equipe/page.tsx"
Cohesion: 0.13
Nodes (14): EquipePage(), Usuario, SecretariaAssignment(), SecretariaOption, SecretariaOption, UsuarioForm(), Home(), ContextResponse (+6 more)

### Community 69 - "secretarias/page.tsx"
Cohesion: 0.36
Nodes (5): NovaSecretariaForm(), classLabel(), Dash, SecretariasPage(), canManageSecretariaRole()

### Community 70 - "Fluxo operacional municipal"
Cohesion: 0.33
Nodes (5): Banco e verificação, Cadastro, Comunicação interna, Fluxo operacional municipal, Prazos

### Community 71 - "Gestão municipal multi-prefeitura"
Cohesion: 0.40
Nodes (4): Gestão municipal multi-prefeitura, Operação municipal, Plano de governo e execução, Plataforma e acesso

### Community 72 - "Segurança — CIP Plataforma"
Cohesion: 0.40
Nodes (4): Controles mínimos antes de publicar, Propriedade, Relato, Segurança — CIP Plataforma

### Community 73 - "implantacao/page.tsx"
Cohesion: 0.67
Nodes (3): ano(), Implantacao, ImplantacaoPage()

### Community 74 - "notificacoes-lista.tsx"
Cohesion: 0.50
Nodes (3): fmt, Notificacao, TIPOS

### Community 80 - "modelos/page.tsx"
Cohesion: 0.33
Nodes (4): AtivarModeloButton(), Ativos, Catalogo, ModelosAdminPage()

### Community 81 - "dossie-governanca.tsx"
Cohesion: 0.33
Nodes (5): Dependencia, Equipamento, HistoricoItem, Sugestao, VinculoEquip

### Community 82 - "evidencia-actions.tsx"
Cohesion: 0.40
Nodes (3): EvidenciaCard(), EvidenciaItem, EvidenciaMedia()

## Knowledge Gaps
- **544 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+539 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 664 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `apiFetch` to `plano-estrutura.tsx`, `PlatformAdminConsole`, `equipe/page.tsx`, `governo-overview.tsx`, `secretarias/page.tsx`, `pendencias/page.tsx`, `lib/roles.ts`, `implantacao/page.tsx`, `notificacoes-lista.tsx`, `projeto-documento.tsx`, `importacao/page.tsx`, `api.ts`, `modelos/page.tsx`, `lib/auth.ts`, `relatorios/page.tsx`, `secretarias/[id]/page.tsx`, `minha-pasta/page.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `NovoProjetoWizard()` connect `novo-projeto-wizard.tsx` to `plano-estrutura.tsx`, `apiFetch`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `authOptions` connect `lib/auth.ts` to `plano-estrutura.tsx`, `equipe/page.tsx`, `governo-overview.tsx`, `secretarias/page.tsx`, `pendencias/page.tsx`, `lib/roles.ts`, `implantacao/page.tsx`, `projeto-documento.tsx`, `importacao/page.tsx`, `apiFetch`, `api.ts`, `modelos/page.tsx`, `relatorios/page.tsx`, `secretarias/[id]/page.tsx`, `minha-pasta/page.tsx`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `requireAuth()` (e.g. with `admin.ts` and `routes/auth.ts`) actually correct?**
  _`requireAuth()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _544 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `tarefas-board.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._