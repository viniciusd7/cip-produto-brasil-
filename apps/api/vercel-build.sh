#!/bin/sh
set -eu

pnpm --filter @cip/shared build
pnpm --filter @cip/db build
pnpm --filter @cip/api build

if [ "${VERCEL_ENV:-}" = "preview" ] && [ "${CIP_INIT_DEMO_DB:-}" = "true" ]; then
  pnpm --filter @cip/db exec prisma migrate status
  CIP_ALLOW_DEMO_SEED=true pnpm --filter @cip/db seed
fi
