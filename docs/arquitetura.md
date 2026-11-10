# Arquitetura — CIP Gestão Municipal

## Visão geral

```
[Browser]
    │  NextAuth session (JWT)
    ▼
[apps/web — Vercel]
    │  Bearer token
    ▼
[apps/api — Vercel / Node]
    │  Prisma
    ▼
[MySQL — HostGator]
```

## Separação front / back

- **web**: autenticação (Auth.js), UI, Server Components, middleware de proteção de rotas.
- **api**: regras de negócio, RBAC por permissão, auditoria, importação, relatórios.
- **packages/db**: única fonte de verdade do schema Prisma.
- **packages/shared**: contratos (roles, status dimensionais, tipos).
- **packages/ui**: design system CIP.

## Segurança

- JWT assinado com `NEXTAUTH_SECRET`
- Permissões por papel (`ROLE_PERMISSIONS`)
- `assertMunicipioAccess` bloqueia leitura/escrita cross-município e grava `AuditLog`
- HTTPS obrigatório em produção (Vercel + HostGator TLS)

## Dimensões de status

Nunca colapsar em um único campo `status`:

| Dimensão | Exemplos |
|---|---|
| Ciclo da iniciativa | Rascunho, Em acompanhamento, Concluída… |
| Prazo do marco | Sem prazo, No prazo, Vencido, Concluído |
| Verificação | Pendente, Atendida, Dispensada… |
| Entrave | Aberto, Em encaminhamento, Resolvido |
| Evidência | Declarada, A verificar, Verificada, Rejeitada |

## Observabilidade mínima

- `GET /health` na API
- `AuditLog` para login, CRUD crítico, reprogramação, validação e exportação
