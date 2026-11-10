# Graph Report - cip projeto  (2026-11-09)

## Corpus Check
- Corpus is ~23,084 words - fits in a single context window. You may not need a graph.

## Summary
- 475 nodes · 599 edges · 36 communities (28 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- api/src/index.ts
- db/package.json
- shared/src/index.ts
- web/tsconfig.json
- ui/package.json
- api/package.json
- web/package.json
- package.json
- devDependencies
- dependencies
- shared/package.json
- ui/tsconfig.json
- route.ts
- acao-form.tsx
- api/tsconfig.json
- db/tsconfig.json
- shared/tsconfig.json
- index.tsx
- carteira/page.tsx
- desdobramento-forms.tsx
- planejamento/page.tsx
- import-form.tsx
- export-buttons.tsx
- app/layout.tsx
- next-auth.d.ts
- (app)/layout.tsx
- painel/page.tsx
- web/vercel.json
- api/vercel.json
- login/page.tsx
- seed.ts
- db/src/index.ts
- eslint.config.mjs
- next.config.ts
- middleware.ts

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `authOptions` - 15 edges
3. `scripts` - 15 edges
4. `apiFetch()` - 14 edges
5. `compilerOptions` - 11 edges
6. `requireAuth()` - 10 edges
7. `HttpError` - 9 edges
8. `compilerOptions` - 9 edges
9. `scripts` - 9 edges
10. `compilerOptions` - 9 edges

## Surprising Connections (you probably didn't know these)
- `statusPor()` --calls--> `prazoStatus()`  [EXTRACTED]
  apps/api/src/routes/dashboard.ts → apps/api/src/services/prazo.ts
- `AdministracaoPage()` --calls--> `apiFetch()`  [EXTRACTED]
  apps/web/src/app/(app)/administracao/page.tsx → apps/web/src/lib/api.ts
- `requireAuth()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/middleware/auth.ts → apps/api/src/middleware/error.ts
- `requirePermission()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/middleware/auth.ts → apps/api/src/middleware/error.ts
- `assertMunicipioAccess()` --calls--> `HttpError`  [EXTRACTED]
  apps/api/src/middleware/auth.ts → apps/api/src/middleware/error.ts

## Import Cycles
- None detected.

## Communities (36 total, 7 thin omitted)

### Community 0 - "api/src/index.ts"
Cohesion: 0.07
Nodes (49): app, port, assertMunicipioAccess(), AuthUser, Express, permissionsForRole(), Request, requireAuth() (+41 more)

### Community 1 - "db/package.json"
Cohesion: 0.06
Nodes (33): dependencies, bcryptjs, @prisma/client, devDependencies, prisma, tsx, @types/bcryptjs, @types/node (+25 more)

### Community 2 - "shared/src/index.ts"
Cohesion: 0.08
Nodes (29): PermissionCode, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, RoleCode, ROLES, Aplicabilidade, CICLO_INICIATIVA (+21 more)

### Community 3 - "web/tsconfig.json"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 4 - "ui/package.json"
Cohesion: 0.08
Nodes (25): devDependencies, react, react-dom, @types/react, @types/react-dom, typescript, exports, ./styles.css (+17 more)

### Community 5 - "api/package.json"
Cohesion: 0.09
Nodes (22): devDependencies, tsx, @types/cors, @types/express, @types/jsonwebtoken, @types/node, typescript, tsx (+14 more)

### Community 6 - "web/package.json"
Cohesion: 0.09
Nodes (22): dependencies, @cip/shared, @cip/ui, next, next-auth, react, react-dom, @cip/shared (+14 more)

### Community 7 - "package.json"
Cohesion: 0.09
Nodes (22): description, engines, node, name, packageManager, private, scripts, build (+14 more)

### Community 8 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/react, @types/react-dom (+9 more)

### Community 9 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, bcryptjs, @cip/db, @cip/shared, cors, express, jsonwebtoken, zod (+7 more)

### Community 10 - "shared/package.json"
Cohesion: 0.14
Nodes (13): devDependencies, typescript, exports, typescript, main, name, private, scripts (+5 more)

### Community 11 - "ui/tsconfig.json"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, esModuleInterop, jsx, module, moduleResolution, outDir, rootDir (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.21
Nodes (5): handler, DashboardResponse, Detail, authOptions, LoginResponse

### Community 13 - "acao-form.tsx"
Cohesion: 0.23
Nodes (5): AcaoForm(), InitiativesResponse, AdministracaoPage(), Dash, apiFetch()

### Community 14 - "api/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, module, outDir, resolveJsonModule, rootDir, skipLibCheck, strict (+3 more)

### Community 15 - "db/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 16 - "shared/tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, esModuleInterop, module, outDir, rootDir, skipLibCheck, strict (+3 more)

### Community 17 - "index.tsx"
Cohesion: 0.24
Nodes (4): Button(), Card(), cn(), KpiCard()

### Community 18 - "carteira/page.tsx"
Cohesion: 0.28
Nodes (6): CarteiraPage(), ListResponse, tonePrazo(), Meta, ProjetoForm(), Secretaria

### Community 19 - "desdobramento-forms.tsx"
Cohesion: 0.36
Nodes (5): DesdobramentoForms(), DetailResponse, fmt(), IniciativaPage(), tonePrazo()

### Community 20 - "planejamento/page.tsx"
Cohesion: 0.29
Nodes (3): PlanningResponse, PlanejamentoForm(), Secretaria

### Community 21 - "import-form.tsx"
Cohesion: 0.33
Nodes (3): ImportForm(), sample, Snapshots

### Community 22 - "export-buttons.tsx"
Cohesion: 0.38
Nodes (4): ExportButtons(), classTone(), RelatoriosPage(), Report

### Community 23 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): cipSans, metadata, Providers()

### Community 24 - "next-auth.d.ts"
Cohesion: 0.33
Nodes (5): JWT, next-auth, next-auth/jwt, Session, User

### Community 26 - "painel/page.tsx"
Cohesion: 0.60
Nodes (4): classLabel(), classTone(), DashboardResponse, PainelPage()

### Community 27 - "web/vercel.json"
Cohesion: 0.40
Nodes (4): buildCommand, framework, installCommand, outputDirectory

### Community 28 - "api/vercel.json"
Cohesion: 0.50
Nodes (3): builds, routes, version

## Knowledge Gaps
- **251 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 283 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `authOptions` connect `route.ts` to `acao-form.tsx`, `carteira/page.tsx`, `desdobramento-forms.tsx`, `planejamento/page.tsx`, `import-form.tsx`, `export-buttons.tsx`, `(app)/layout.tsx`, `painel/page.tsx`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `web/package.json`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `api/package.json`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0706605222734255 - nodes in this community are weakly interconnected._
- **Should `db/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `shared/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08021390374331551 - nodes in this community are weakly interconnected._

## Product update (2026-11-09)
- Brand light CIP + mobile drawer
- MetaExecucao + subtarefas
- Painel/relatório executivo com gravidade
