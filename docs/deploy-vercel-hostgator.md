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

## 2. Projeto API na Vercel

- Root Directory: `apps/api`
- Build Command: `cd ../.. && pnpm --filter @cip/shared build && pnpm --filter @cip/db build && pnpm --filter @cip/api build`
- Output: serverless via entry Node (ou hospede API em serviço Node se preferir long-running)
- Env:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET` (mesmo do web)
  - `CORS_ORIGIN` = URL do front
  - `API_PORT=4000`

> Em contas HostGator com MySQL remoto lento, aumente timeout de connection do Prisma e use connection pooling se disponível.

## 3. Projeto Web na Vercel

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Env:
  - `NEXTAUTH_URL` = URL pública do front
  - `NEXTAUTH_SECRET`
  - `NEXT_PUBLIC_API_URL` = URL pública da API
  - `API_URL` = URL interna/pública da API (server-side)

## 4. Checklist pós-deploy

- [ ] `/health` da API responde
- [ ] Login funciona
- [ ] Painel carrega KPIs
- [ ] Export CSV autentica
- [ ] Tentativa cross-município gera 403 + audit
- [ ] Variáveis secretas não commitadas

## 5. Domínio CIP

Aponte o domínio (ex.: `app.cipinteligenciapublica.com.br`) para o projeto web na Vercel e atualize `NEXTAUTH_URL`/`CORS_ORIGIN`.
