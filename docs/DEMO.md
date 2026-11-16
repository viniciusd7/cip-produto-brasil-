# Ambiente demo (somente desenvolvimento local)

Para as novas **Prefeitura Modelo 1** e **Prefeitura Modelo 2**, use o
[seed separado de prefeituras fictícias](seed-prefeituras-modelo.md), que exige
banco PostgreSQL isolado e senha explícita. As contas e instruções abaixo
pertencem ao **seed legado do piloto**, não às prefeituras Modelo.

**Não use estas contas em produção.** Não execute `pnpm db:seed` contra banco
de staging/produção com dados reais.

Após `pnpm db:seed` em ambiente local:

| E-mail | Senha | Papel |
|---|---|---|
| `admin@cip.local` | `Cip@2026` | admin |
| `prefeito@cmd.local` | `Cip@2026` | prefeito |
| `gestor@cmd.local` | `Cip@2026` | gestor (secretário) |
| `analista@cmd.local` | `Cip@2026` | analista (equipe) |

Para exibir o bloco de contas na tela de login, defina no front:

```env
NEXT_PUBLIC_DEMO_MODE=true
```

Em produção, deixe `NEXT_PUBLIC_DEMO_MODE` ausente ou `false`.
