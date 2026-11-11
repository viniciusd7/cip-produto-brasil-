# Deploy — Vercel + MySQL HostGator

## 1. Banco HostGator

1. Crie o database MySQL no painel HostGator.
2. Crie usuário com permissão total no schema.
3. Libere acesso remoto ao host MySQL (IP da Vercel / `%` conforme política).
4. Monte a URL:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"
```

5. Rode migrações a partir da máquina segura:

```bash
export DATABASE_URL="mysql://..."
pnpm db:migrate:deploy
# NÃO rode pnpm db:seed em produção.
# Seed demo só em ambiente isolado com CIP_ALLOW_DEMO_SEED=true (ver docs/DEMO.md).
```

## 2. Projeto API na Vercel (`cip-painel-api`)

- Root Directory: `apps/api`
- Framework: Express
- Node: `22.x`
- Install: `cd ../.. && pnpm install --frozen-lockfile --prod=false`
- Build: `cd ../.. && pnpm --filter @cip/shared build && pnpm --filter @cip/db generate && pnpm --filter @cip/db build && pnpm --filter @cip/api build`
- Entry: `export default app` em `apps/api/src/index.ts` (sem `listen` no Vercel)
- Env:
  - `DATABASE_URL` (MySQL remoto acessível da Vercel — não use `localhost`)
  - `NEXTAUTH_SECRET` / `JWT_SECRET` (mesmo do web)
  - `CORS_ORIGIN` = URLs do front separadas por vírgula: prefeituras e console (ex.: `https://app.cipinteligenciapublica.com.br,https://gestao.cipinteligenciapublica.com.br`)
- Produção atual: https://cip-painel-api.vercel.app

> Em contas HostGator com MySQL remoto lento, aumente timeout de connection do Prisma e use connection pooling se disponível.

## 3. Projeto Web na Vercel (`cip-painel`)

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Node: `22.x`
- Install: `cd ../.. && pnpm install --frozen-lockfile --prod=false`
- Build: `cd ../.. && pnpm --filter @cip/shared build && pnpm --filter @cip/ui build && pnpm --filter @cip/web build`
- Env:
  - `NEXTAUTH_URL` = URL pública do front (ex.: `https://cip-painel.vercel.app`)
  - `NEXTAUTH_SECRET`
  - `NEXT_PUBLIC_API_URL` = URL pública da API
  - `API_URL` = URL da API (server-side)
  - `NEXT_PUBLIC_DEMO_MODE=false` em produção
- Produção atual: https://cip-painel.vercel.app

### GitHub

Para deploy automático no push, conecte o repositório no dashboard Vercel
(`cip-produto-brasil-`). A conta do time precisa de write/admin no repo GitHub.

## 4. Checklist pós-deploy

- [ ] `/health` da API responde
- [ ] Login funciona
- [ ] Painel carrega KPIs
- [ ] Export CSV autentica
- [ ] Tentativa cross-município gera 403 + audit
- [ ] Variáveis secretas não commitadas

## 5. Domínio CIP

A plataforma usa dois endereços servidos pelo mesmo projeto web:

| Endereço | Quem acessa | O que abre |
|---|---|---|
| `app.cipinteligenciapublica.com.br` | Consultores, prefeitos e secretários | Ambiente da prefeitura (implantação, cenário, pastas) |
| `gestao.cipinteligenciapublica.com.br` | Somente equipe CIP (admin da plataforma) | Console: prefeituras, prefeito e mandato, consultores |

1. Aponte os dois domínios para o projeto web na Vercel.
2. Env do web: `GESTAO_HOST=gestao.cipinteligenciapublica.com.br`, `NEXT_PUBLIC_GESTAO_URL=https://gestao.cipinteligenciapublica.com.br`, `NEXT_PUBLIC_APP_URL=https://app.cipinteligenciapublica.com.br`.
3. Env da API: `CORS_ORIGIN` com os dois endereços.

As sessões são separadas por host: entrar no console não abre sessão no ambiente das prefeituras e vice-versa. Contas da equipe CIP são recusadas no ambiente das prefeituras, e contas municipais são recusadas no console.
