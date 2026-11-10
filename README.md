# CIP — Plataforma de Inteligência de Gestão Municipal

Monorepo da solução CIP para prefeituras: visão executiva, carteira de iniciativas, fichas com evidências, pendências, importação controlada e governança multi-município.

Base documental: dossiê técnico `doc 01.docx` (CMD — Conceição do Mato Dentro, piloto).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 (App Router) + Auth.js/NextAuth |
| Backend | Node.js + Express (`apps/api`) |
| Banco | MySQL 8 + Prisma (`packages/db`) |
| Deploy app | Vercel |
| Banco produção | MySQL HostGator (`DATABASE_URL`) |
| Dev local | Docker Compose + pnpm workspaces |

## Estrutura

```
apps/
  web/          # Next.js — UI + autenticação
  api/          # API REST Node
packages/
  db/           # Prisma schema, migrations, seed
  shared/       # Tipos, roles, status dimensionais
  ui/           # Design system CIP
docs/           # Arquitetura, deploy, aderência RF/AT
```

## Hierarquia funcional

`Plano de Governo → Secretarias → Meta Estratégica → Projeto/Iniciativa → Marcos/Indicadores → Tarefas → Subtarefas`

Vínculos transversais (ex.: equipamento público) existem fora da árvore de navegação e **não duplicam contagens**.

## Regras de produto (inegociáveis)

- Prazo original **nunca** é sobrescrito; reprogramação gera histórico imutável.
- Evidência declarada **≠** entrega comprovada (exige validação).
- Status são **dimensões separadas**: ciclo, prazo, verificação, entrave, evidência.
- Toda tela crítica exibe **fonte + data de referência**.
- Acesso cruzado entre municípios é bloqueado e auditado (AT-08).

## Pré-requisitos

- Node.js 20+
- pnpm 9+
- MySQL 8 (Docker Compose **ou** Homebrew `mysql@8.4`)

## Setup rápido

```bash
cp .env.example .env
pnpm install

# Opção A — Docker
pnpm docker:up

# Opção B — Homebrew (se Docker Desktop estiver indisponível)
# brew install mysql@8.4 && brew services start mysql@8.4
# mysql -u root -e "CREATE DATABASE cip_gestao; CREATE USER 'cip'@'localhost' IDENTIFIED BY 'cip_secret'; GRANT ALL ON cip_gestao.* TO 'cip'@'localhost'; FLUSH PRIVILEGES;"

pnpm db:generate
pnpm db:migrate:deploy  # aplica migrations
pnpm db:seed            # dados demo (somente local — ver docs/DEMO.md)
pnpm dev                # web :3000 + api :4000
```

### Usuários demo

Credenciais de demonstração ficam em [`docs/DEMO.md`](docs/DEMO.md) (ambiente local apenas).  
**Não execute `pnpm db:seed` em produção.** Em produção, `NEXTAUTH_SECRET` / `JWT_SECRET` são obrigatórios.

## Scripts

- `pnpm dev` — sobe web e api em paralelo
- `pnpm build` — build de todos os pacotes/apps
- `pnpm db:seed` — popula município piloto + iniciativas
- `pnpm docker:up` / `pnpm docker:down`

## Versionamento

- Branch principal: `main`
- Features: `feature/<assunto>`
- Fixes: `fix/<assunto>`
- Commits no padrão Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`
- PRs pequenos, com descrição do RF/AT impactado

## Deploy

Ver [`docs/deploy-vercel-hostgator.md`](docs/deploy-vercel-hostgator.md).

Resumo:

1. MySQL na HostGator → configurar `DATABASE_URL`
2. Rodar `pnpm db:migrate:deploy` apontando para o banco remoto
3. Publicar `apps/web` e `apps/api` na Vercel (dois projetos no monorepo)
4. Configurar `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`

## Jornadas do usuário

| Perfil | Caminho |
|---|---|
| Gestor | Painel → pendências → ficha → decisão |
| Analista | Carteira → ficha → marcos/reprogramação/evidências |
| Coordenação | Carteira filtrada + Relatórios CSV |
| Admin | Administração (usuários/auditoria) + Importação |

## Documentação

- [`docs/arquitetura.md`](docs/arquitetura.md)
- [`docs/aderencia-doc01.md`](docs/aderencia-doc01.md) — mapa RF-01…RF-20 e AT-01…AT-10
- [`docs/ux-jornadas.md`](docs/ux-jornadas.md)
- [`docs/deploy-vercel-hostgator.md`](docs/deploy-vercel-hostgator.md)
- [`docs/DEMO.md`](docs/DEMO.md) — contas locais (nunca produção)
- [`SECURITY.md`](SECURITY.md) — checklist e canal de relato

## Identidade visual

Inspirada em [cipinteligenciapublica.com.br](https://cipinteligenciapublica.com.br/): navy institucional, azul de confiança, dourado de destaque e cartões limpos orientados à decisão.

## Propriedade e licença

Software proprietário do **Centro de Inteligência Pública (CIP)**.  
Consulte [`LICENSE`](LICENSE) e [`NOTICE`](NOTICE). Uso apenas sob contrato ou autorização da CIP.

Site: [cipinteligenciapublica.com.br](https://cipinteligenciapublica.com.br/)
