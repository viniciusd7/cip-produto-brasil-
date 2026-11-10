# Segurança — CIP Plataforma

## Relato

Comunique vulnerabilidades pelo canal institucional da CIP
([cipinteligenciapublica.com.br](https://cipinteligenciapublica.com.br/)).
Não abra issue pública com exploits ou dados sensíveis.

## Controles mínimos antes de publicar

1. Nenhum `.env` / secret no Git (`git status`, `git check-ignore -v .env`).
2. `NEXTAUTH_SECRET` / `JWT_SECRET` fortes e iguais na web e na API.
3. `NEXT_PUBLIC_DEMO_MODE` ausente ou `false` em produção.
4. Nunca `pnpm db:seed` em banco de produção.
5. `CORS_ORIGIN` = URL exata do front (sem `*`).
6. Revisar uploads e logs antes de compartilhar dumps.

## Propriedade

Código e marca CIP — Centro de Inteligência Pública. Ver `LICENSE` e `NOTICE`.
