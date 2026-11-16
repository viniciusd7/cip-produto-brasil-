# Conversão local: reaproveitar CMD e Belo Horizonte

Comando **separado** do seed para banco vazio:

```sh
pnpm db:convert:modelos --help
```

Reaproveita os dois `Municipio.id` fornecidos explicitamente e uma conta demo
**já existente**, também identificada por ID. Não cria municípios ou usuários,
não aplica migrations e não usa as URLs padrão da aplicação como fallback.

A conversão foi ensaiada em uma cópia local e, posteriormente, aplicada ao
banco local autorizado pelo operador. Os testes automatizados de integração
usam PostgreSQL descartável; uma nova execução exige avaliação e confirmação
explícitas do operador.

## Resultado e preservação

- CMD passa a **Prefeitura Modelo 1**, BH a **Prefeitura Modelo 2**.
- Somente `Municipio.nome` e seu `updatedAt` são atualizados. Os IDs, IBGE/CNPJ,
  contatos, consultor, documentos, históricos e todos os filhos preexistentes
  permanecem intactos.
- Acrescenta 4 projetos fictícios por município: 4 metas estratégicas, 4 metas de
  execução, 16 tarefas, 32 subtarefas, 4 indicadores, 12 medições, classificações,
  impedimento, providência e evidências ilustrativas em cada um. Um plano demo
  novo mantém as metas novas separadas dos planos anteriores.
- No estado informado (3 projetos/13 secretarias em CMD e 0/1 em BH), os projetos
  ficam em **7 e 4**, respectivamente. A quantidade final de secretarias depende
  dos reaproveitamentos aprovados no dry-run; nenhuma secretaria atual é removida
  ou renomeada. Pessoas demonstrativas são acrescentadas como equipe nas pastas
  reutilizadas, sem substituir titulares.
- Preserva todos os usuários, hashes de senha, papéis, vínculos e campos de
  secretaria/principal existentes. Acrescenta somente vínculos ausentes de
  **leitura** entre o ID da conta demo e os dois IDs municipais.
  Vínculos fora desse par continuam existindo; o seletor pode mostrar mais opções.
- Conta inativa, administrador de plataforma, perfil `prefeito` em qualquer
  município ou vínculo incompatível bloqueiam a primeira aplicação. Não promove
  nem converte contas para contornar essas regras. Conta `gestor` só é aceita no
  alvo se sua secretaria vinculada estiver ativa e pertencer àquele município.
  Se esse for o papel preservado, o acesso continua restrito à sua secretaria.

## Guardas e idempotência

1. `CONVERT_DATABASE_URL` é obrigatória e independente de `DATABASE_URL`,
   `DIRECT_URL` e do `.env` remoto. Aceita somente PostgreSQL em `127.0.0.1`,
   `localhost` ou `[::1]`, sem query string/fragmentos.
2. `CONVERT_EXPECT_DATABASE` deve ser exatamente o nome do banco. Ao contrário
   de `db:seed:modelos`, esta conversão **pode aceitar o nome `cip`**, pois foi
   projetada para o reaproveitamento aprovado pelo operador. Isso não autoriza
   sua execução automática no banco ativo. `NODE_ENV=production` é bloqueado.
3. Exige `--cmd-id`, `--bh-id` distintos e `--user-id`. IDs precisam ter 1–128
   caracteres alfanuméricos, hífen ou sublinhado. Na primeira execução, os alvos
   devem estar ativos, em MG e com os nomes originais exatos.
4. Sem `--apply`, inclusive com `--dry-run`, executa somente consultas numa
   transação PostgreSQL **READ ONLY** e retorna JSON com IDs, renomeações,
   contagens, secretarias reaproveitadas/criadas, vínculos novos e avisos.
   `--help` nem conecta. Dry-run é um retrato, não uma reserva dos registros.
5. Escrita exige `--apply --backup-confirmed --confirm TOKEN`. O token é emitido
   no dry-run e vinculado ao host/porta/banco, par de municípios, conta e mapa de
   secretarias. Não é senha nem prova criptográfica de backup: o operador é
   responsável por realmente criar e testar o backup.
6. A aplicação revalida o estado, serializa este comando por advisory lock e
   bloqueia as linhas de município/usuário. Criação dos exemplos, renomeações,
   vínculos e marcadores ocorre numa única transação. Conflitos/falhas causam
   rollback; não há catch que transforme erro em sucesso.
7. São criados dois `AuditLog` com ação `CONVERT_DEMO_LOCAL_V1` e IDs estáveis
   derivados dos IDs municipais. Eles registram o par, a conta, os nomes e
   mapeamentos aprovados. Não se atribui falsamente a execução à conta demo:
   `actorId` fica nulo e a conta beneficiada é registrada no conteúdo.
8. Com os dois marcadores válidos, uma reexecução retorna `ja-aplicado` **sem
   gravar nada**, preservando renomes posteriores, edições, exclusões, senhas e
   remoções de vínculos. Se o seletor estiver indisponível, retorna aviso em vez
   de restaurar acesso. ID de conta diferente, marcadores parciais/alterados ou
   par diferente em um dos mesmos municípios causam conflito explícito.
9. **Não apague/edite esses marcadores nem inclua-os em limpeza de auditoria.**
   São o registro durável da aplicação, não apenas logs descartáveis. Sem eles,
   a operação não tem autorização para reparar a carga. Colisões de namespace,
   códigos ou nomes interrompem o processo; não há remoção ou mesclagem automática.

A guarda de loopback não distingue serviço local de túnel/proxy. Não use
redirecionamentos para atingir bases remotas e não use este comando em produção.
Durante a aplicação aprovada, suspenda outros escritores/importadores para
evitar alterações concorrentes externas ao comando. Nenhuma função desfaz
automaticamente uma conversão; reversão depende do backup e de decisão do operador.

## Procedimento exato pelo operador

Pré-requisitos: dependências instaladas, cliente Prisma gerado e schema atual
já presente. `pg_dump`, `pg_restore` e `psql` compatíveis com o servidor são úteis
para backup, restauração e identificação. Nenhum passo requer `db:seed`, reset ou
migration no banco ativo.

### 1. Backup e ensaio em cópia isolada

1. Faça backup consistente, fora do repositório, e restaure-o em **outro banco
   local**, por exemplo `cip_demo_rehearsal_modelos`, com credenciais próprias.
   Não exponha essa cópia: ela pode conter dados e contatos reais.
2. Configure a conexão da **cópia**, nunca por fallback. Exemplo — substitua
   usuário, senha e porta pelos reais da instância isolada:

   ```sh
   export CONVERT_DATABASE_URL='postgresql://OPERADOR:SENHA@127.0.0.1:55439/cip_demo_rehearsal_modelos'
   export CONVERT_EXPECT_DATABASE='cip_demo_rehearsal_modelos'
   ```

   Não grave senhas no histórico ou em arquivos versionados; use o gerenciador
   de segredos/entrada oculta para definir a variável. A URL completa não é
   impressa pelo comando. O token contém somente um hash do destino sem senha
   e do mapeamento.

3. Se a cópia ainda estiver vazia, restaure o backup nela (apenas na cópia):

   ```sh
   pg_restore --exit-on-error --no-owner --no-privileges \
     --dbname="$CONVERT_DATABASE_URL" /CAMINHO/SEGURO/backup-antes-da-conversao.dump
   ```

   O backup deve ser produzido pelo operador a partir da origem aprovada,
   usando, por exemplo, `pg_dump --format=custom --file=... --dbname=...`.
   Não sobreponha uma restauração a banco em uso. O comando de conversão não faz
   backup, não restaura e não verifica automaticamente se o backup é restaurável.

### 2. Identificar os IDs, sem adivinhar

Execute estas consultas **na cópia**, em modo somente leitura, com a URL acima:

```sh
psql --dbname="$CONVERT_DATABASE_URL" --set=ON_ERROR_STOP=1 --command='
BEGIN READ ONLY;
SELECT id, nome, uf, active FROM "Municipio" ORDER BY nome;
SELECT id, email, name, active, "isPlatformAdmin" FROM "User" ORDER BY email;
SELECT id, "municipioId", nome, sigla, active FROM "Secretaria" ORDER BY "municipioId", nome;
COMMIT;'
```

Não publique a saída contendo dados de usuários. Confirme pessoalmente a conta
demo e os dois IDs municipais originais. Restaurações preservam esses IDs.

```sh
export CMD_ID='ID_REAL_DO_REGISTRO_CMD'
export BH_ID='ID_REAL_DO_REGISTRO_BH'
export DEMO_USER_ID='ID_REAL_DA_CONTA_DEMO_EXISTENTE'
```

### 3. Dry-run e mapeamento de pastas

```sh
pnpm db:convert:modelos \
  --cmd-id "$CMD_ID" --bh-id "$BH_ID" --user-id "$DEMO_USER_ID" \
  --dry-run
```

O padrão também é dry-run quando o último argumento é omitido.
Nomes e siglas iguais são reaproveitados automaticamente, sem modificar campos.
Sigla igual com nome divergente (ex.: `Cultura`/`CUL` em vez de `Cultura e Turismo`)
**não cria pasta duplicada**: bloqueia e exige mapeamento explícito.

Se necessário, defina os IDs das pastas existentes aprovadas:

```sh
export SECRETARIAS_MAP='{"1:CUL":"ID_REAL_DA_SECRETARIA_CULTURA_CMD"}'
pnpm db:convert:modelos \
  --cmd-id "$CMD_ID" --bh-id "$BH_ID" --user-id "$DEMO_USER_ID" \
  --secretarias "$SECRETARIAS_MAP" --dry-run
```

Para mapeamento vazio, use `export SECRETARIAS_MAP='{}'`.
As chaves aceitas são `1:EDU`, `1:SAU`, `1:INF`, `1:CUL`, `1:PLA`,
`2:EDU`, `2:SAU`, `2:MOB`, `2:SUR`, `2:PLA`. O ID deve pertencer ao município
correspondente e estar ativo; uma pasta não pode representar duas chaves.
Duplicatas existentes por nome/sigla exigem resolução humana ou mapeamento
explícito, nunca seleção arbitrária.

### 4. Aplicar somente na cópia e conferir

Copie o campo `confirmacao` do último dry-run, mantendo o mesmo mapa:

```sh
export CONVERSION_TOKEN='CONVERTER_TOKEN_EXATO_DO_DRY_RUN'
pnpm db:convert:modelos \
  --cmd-id "$CMD_ID" --bh-id "$BH_ID" --user-id "$DEMO_USER_ID" \
  --secretarias "$SECRETARIAS_MAP" \
  --apply --backup-confirmed --confirm "$CONVERSION_TOKEN"
```

Confira `status: aplicado`. Repita o dry-run: deve retornar `ja-aplicado`, sem
novos projetos/vínculos. Nome inesperado ou qualquer erro exige revisão, não
remoção da guarda. Execute a web/API de ensaio contra essa cópia. Entre com o
**mesmo e-mail e senha existentes** pelo endereço da prefeitura, escolha cada
município e use **Trocar prefeitura**. Outros vínculos originais continuam
aparecendo. Sessões antigas podem exigir novo login para atualizar o nome.

### 5. Aplicação futura na origem — não executada nesta entrega

Somente depois de backup restaurado/testado, conferência do ensaio e aprovação
operacional, o operador pode escolher a origem local explicitamente:

```sh
export CONVERT_DATABASE_URL='postgresql://OPERADOR:SENHA@127.0.0.1:5434/cip'
export CONVERT_EXPECT_DATABASE='cip'
```

Repita o **passo 3** com os IDs e mapeamentos conferidos no banco de origem e
inspecione o plano. O token da cópia **não serve** para a origem. Atualize
`CONVERSION_TOKEN` com o novo token, suspenda escritores e execute o **passo 4**
somente se tiver decidido aplicar. **Estes exemplos são instruções ao operador,
não ações realizadas pelo assistente.**

Não execute `pnpm db:seed:modelos` nesse procedimento: ele atende a outro fluxo
e cria municípios próprios. Não altere a conexão da API para a URL remota do
`.env` por engano. A conversão não reinicia servidores nem publica a aplicação.

## Testes

```sh
pnpm --filter @cip/db typecheck
pnpm --filter @cip/db test:conversion
```

Sem variáveis de teste, valida guardas/parser/CLI e pula integração.
A integração exige **banco novo e vazio** com nome `cip_demo_test_*` e schema
atual previamente aplicado **somente nesse banco descartável**:

```sh
CONVERT_TEST_DATABASE_URL='postgresql://demo:SENHA@127.0.0.1:55439/cip_demo_test_conversion' \
CONVERT_TEST_CONFIRM='cip_demo_test_conversion' \
  pnpm --filter @cip/db test:conversion
```

A suíte cria municípios/usuários sentinela sintéticos e o cenário 3 projetos,
13 secretarias em CMD e 0/1 em BH. Verifica snapshots anteriores, dry-run sem
escrita, ausência de municípios/usuários extras, mapeamentos, colisões, rollback
tardio, concorrência, idempotência e preservação de exclusões. Deixa dados no
banco de teste; descarte a instância inteira depois. Não use uma cópia em uso
ou o banco ativo como banco de testes.

## Limites

- Não é anonimização: somente os exemplos são fictícios. Dados e identificadores
  oficiais anteriores continuam presentes. Não publique sem revisão própria.
- O schema deve corresponder ao Prisma atual. Schema ausente/desatualizado causa
  erro; não existe migration automática ou fallback para uma carga parcial.
- Não repara exclusões, não adiciona versões novas a uma carga já aplicada, não
  redefine senhas e não restabelece automaticamente acessos removidos.
- Preserva papéis existentes, inclusive permissões de edição do usuário.
  Não promete acesso somente leitura se a conta já tinha papel mais amplo.
- Data-base dos exemplos fixa em 16/11/2026; evidências sem arquivos reais.
  Integrações externas, modelos de wizard e documentos de conhecimento não são
  criados nem desativados por esta conversão.
