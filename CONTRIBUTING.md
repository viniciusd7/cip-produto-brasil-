# Guia de contribuição — CIP Plataforma

## Branches

- `main` — estável / deploy
- `feature/<slug>` — novas capacidades
- `fix/<slug>` — correções
- `docs/<slug>` — documentação

## Commits

Conventional Commits:

- `feat:` nova funcionalidade (citar RF quando aplicável)
- `fix:` correção (citar AT quando aplicável)
- `docs:` documentação
- `chore:` tooling / deps
- `refactor:` sem mudança funcional

Exemplo: `feat(rf-06): registrar reprogramação com histórico imutável`

## Checklist de PR

- [ ] Build passa (`pnpm build`)
- [ ] Migration Prisma incluída se schema mudou
- [ ] Regras de consistência do doc 01 respeitadas
- [ ] Fonte/data de referência preservadas na UI quando relevante
- [ ] README/docs atualizados se o fluxo de setup mudou

## Segurança

- Nunca commitade `.env`, senhas HostGator, chaves ou dumps reais sem anonimização.
- Credenciais demo: apenas [`docs/DEMO.md`](docs/DEMO.md); UI demo exige `NEXT_PUBLIC_DEMO_MODE=true`.
- Em produção: `NEXTAUTH_SECRET`/`JWT_SECRET` obrigatórios; **não** rode `pnpm db:seed`.
- Antes do push: `git status` e confirme que `.env`, `.next`, `uploads` e `.data` estão ignorados.
- Software proprietário CIP — ver [`LICENSE`](LICENSE) e [`NOTICE`](NOTICE).
