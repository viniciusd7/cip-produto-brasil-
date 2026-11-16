# Seed separado: Prefeituras Modelo 1 e 2

> **Escopo atualizado — reaproveitar os municípios locais:** o fluxo desejado
> agora é converter os registros existentes de Conceição do Mato Dentro e
> Belo Horizonte nos nomes Prefeitura Modelo 1 e Prefeitura Modelo 2, preservando
> seus IDs. O comando `db:seed:modelos` abaixo **não implementa essa conversão**:
> continua exclusivo para uma base demo separada e cria raízes próprias.
> Não o use para atender ao novo escopo, nem mesmo sobre uma cópia do banco
> local, pois isso criaria municípios adicionais. A conversão separada foi
> implementada: consulte [comando, guardas e instruções exatas](conversao-prefeituras-locais.md).

## Plano de reaproveitamento local — referência do desenho

O plano abaixo registra os critérios que orientaram a implementação. Para uso,
prevalece o [manual executável da conversão](conversao-prefeituras-locais.md).
O controle durável usa `AuditLog` existente, sem migration nova.

Este plano substitui a proposta de criar duas prefeituras adicionais no cenário
local. Nenhuma consulta, renomeação, carga ou migração no banco ativo é autorizada
por este documento. O alvo informado pelo operador é `127.0.0.1:5434/cip`;
não foi consultado para elaborar o plano.

### 1. Identificar e congelar o mapeamento

- Estado **informado pelo operador, não verificado nesta etapa**:
  Conceição do Mato Dentro tem 3 projetos e 13 secretarias; Belo Horizonte tem
  0 projetos e 1 secretaria.
- Preparar um comando separado de conversão, sem alterar a proteção do seed
  para bases novas. Exigir URL local explícita, IDs dos dois municípios distintos,
  ID da conta demo e confirmação específica do par de IDs e da operação.
  Não selecionar alvo para escrita somente pelo nome ou pelo conteúdo do `.env`.
- Primeiro ensaiar exclusivamente em cópia isolada e protegida do banco local,
  com dados sensíveis tratados conforme as permissões do operador. Identificar
  os registros nessa cópia e registrar o mapeamento estável:
  ID original CMD → Prefeitura Modelo 1; ID original BH → Prefeitura Modelo 2.
  Não inventar IDs nem depender de nomes depois da primeira execução.
- Antes da aplicação futura, gerar backup consistente e verificar sua
  restauração em ambiente temporário. A aprovação para executar no banco ativo
  deve ser separada deste planejamento.

### 2. Renomear, sem substituir registros

- Atualizar somente `Municipio.nome` nos dois IDs aprovados, com precondição de
  nome original ou nome Modelo correspondente. `updatedAt` e o registro de
  auditoria refletirão a conversão; nenhum outro campo deve ser regravado.
- Preservar todos os IDs/FKs, secretarias, projetos, planos, pessoas, documentos,
  histórico, vínculos de usuários, senhas, papéis, consultor e estado ativo.
  Não excluir/recriar municípios, não transferir filhos para novas raízes e
  não substituir a carteira de CMD pelos exemplos.
- Nome inesperado, alvo ausente, prefeitura inativa, município Modelo adicional
  ou qualquer colisão interrompe o processo para revisão; não tentar mesclar,
  apagar duplicatas ou reativar registros automaticamente.
- Preservar IBGE/CNPJ e contatos existentes é diferente de anonimizar a base.
  Trocar apenas os nomes **não torna esses registros fictícios**. Não remover
  identificadores/contatos silenciosamente; não disponibilizar publicamente a
  cópia nem habilitar consultas externas como se os exemplos fossem oficiais.
  Anonimização e tratamento de integrações exigem escopo separado.

### 3. Acrescentar exemplos idempotentes, sem alterar os atuais

- Reutilizar secretarias pelo ID aprovado no mesmo município. Quando for preciso
  criar uma pasta, conferir primeiro nome e sigla dentro do município:
  divergência/ambiguidade exige mapeamento explícito, não pasta duplicada.
  Preservar as 13 secretarias atuais de CMD e a secretaria atual de BH.
- A carga proposta é **aditiva**: 4 projetos fictícios por município, com códigos
  reservados e IDs determinísticos derivados do ID original e da versão da carga.
  No estado informado, o resultado seria 7 projetos em Modelo 1 e 4 em Modelo 2,
  não 4 em ambas. Projetos existentes não são contados como exemplos nem
  reclassificados automaticamente.
- Reutilizar o conteúdo ilustrativo, mas refatorar os construtores atuais para
  receber IDs de município/secretaria/plano, em vez de depender das raízes fixas
  `cip-demo-modelos-v1-*`. Toda nova meta/tarefa/medição/classificação deve
  permanecer no escopo do município original.
- Detectar colisões antes de gravar; não usar `upsert` com atualização sobre
  registros existentes. Se um exemplo já estiver registrado pela carga,
  preservá-lo integralmente, inclusive seus filhos e edições.
- Para distinguir primeira execução de exclusões posteriores, manter um registro
  durável e versionado da aplicação/mapeamento, com chave única por município e
  versão, criado na mesma transação. Não confiar apenas em `findUnique` do
  projeto: isso recriaria um exemplo que o usuário excluiu. A persistência desse
  registro ainda precisa ser implementada; se exigir schema, a migration deve ser
  revisada e ensaiada apenas na cópia, nunca aplicada implicitamente pelo seed.

### 4. Preservar acessos e habilitar o seletor

- Renomear os mesmos IDs conserva os vínculos atuais. Para a conta demo existente,
  confirmar seu ID e sua política de acesso antes de adicionar vínculos ausentes
  aos dois municípios originais. Não vincular uma conta apenas por coincidência
  de e-mail, não redefinir senha e não promover a administrador.
- Se já houver vínculo com um dos municípios, preservar seu papel, secretaria
  e indicador principal. Não remover acesso a outros municípios em nome da demo;
  nesse caso, o seletor poderá mostrar opções adicionais, conforme os acessos
  anteriores. Uma conta exclusiva com exatamente duas opções seria uma escolha
  separada, não uma redução silenciosa dos acessos existentes.
- O perfil `prefeito` não permite login com múltiplos municípios. Se a conta demo
  tiver esse papel, interromper e documentar o conflito; não converter o papel
  automaticamente. Para conta compatível, criar somente vínculos ausentes de
  leitura, sem secretaria. Exclusões posteriores desses vínculos também devem
  ser respeitadas pelo registro versionado da operação.
- O seletor existente usa os IDs/vínculos; não precisa de municípios novos.
  Sessões já abertas podem conservar o nome antigo até renovar a sessão ou
  trocar o contexto. Validar novo login antes de anunciar os nomes atualizados.

### 5. Execução futura e critérios de aceite

O comando de conversão deverá ter modo de plano somente leitura, sem aplicação
implícita, e modo de escrita explicitamente confirmado. Revalidar precondições
sob lock/transação curta: falha ou concorrência deve causar rollback completo,
sem renomear apenas uma prefeitura ou conceder acesso parcial.

No ensaio temporário, comprovar:

- Quantidade de municípios inalterada; mesmos dois IDs com os novos nomes.
- Todos os registros preexistentes preservados, exceto nomes, timestamps
  correspondentes e auditoria da operação explicitamente prevista.
- Os 3 projetos e as 14 secretarias informados continuam nos mesmos municípios;
  novos exemplos são apenas acréscimos identificáveis.
- Reexecução não muda snapshots; edições/exclusões posteriores não são
  sobrescritas nem recriadas; colisões e execuções simultâneas são seguras.
- Mesmas senhas e permissões existentes; login/seleção/troca funcionam para os
  dois IDs originais e não concedem acesso fora do aprovado.
- Schema e tipos válidos, testes de integração aprovados e backup restaurável.

**Implementação:** `pnpm db:convert:modelos --help`, em comando separado,
sem execução no banco ativo durante a entrega. As instruções abaixo permanecem
apenas como referência do seed isolado anterior; não executá-las para converter
os registros locais. Para conversão, siga o manual vinculado acima.

---

Este comando é **opt-in** e independente do seed legado. Não altera schema,
migrations, municípios reais, RBAC global ou o comportamento de `pnpm db:seed`.
Não execute o seed legado para preparar esta demonstração: ele modifica dados do
piloto. O schema atual de `packages/db/prisma/schema.prisma` é PostgreSQL;
as instruções MySQL do setup antigo não se aplicam a este comando.

## Conteúdo fictício

- **Prefeitura Modelo 1**: inspiração territorial em Conceição do Mato Dentro,
  com escola rural, atendimento itinerante, acessos comunitários e cultura.
- **Prefeitura Modelo 2**: inspiração na escala urbana de Belo Horizonte,
  com acessibilidade escolar, consultas regionalizadas, mobilidade e zeladoria.
- Cada prefeitura tem 5 secretarias (Planejamento sem projeto principal, para
  visualizar o estado vazio), 1 plano, 4 metas estratégicas, 4 projetos,
  4 metas de execução, 16 tarefas, 32 subtarefas, 4 indicadores e 12 medições.
- As quatro classificações estão presentes, inclusive classificações simultâneas,
  com flags e vínculos correspondentes. Há tarefas concluídas, vencidas, sem
  prazo e no prazo, impedimento, providência e evidências a verificar.
- Municípios sem código IBGE e sem CNPJ; equipes, nomes de projetos e números
  inventados. Não há contatos reais nem documentos comprobatórios.
- Data de referência fixa: **16/11/2026, 12:00 UTC**. O conteúdo é reproduzível;
  IDs internos auxiliares, timestamps de criação e hashes de senha podem variar.

## Proteções e idempotência

1. Sem `--apply`, imprime somente um plano estático e **não conecta** ao banco
   (não é uma análise de diferenças do banco).
2. Usa exclusivamente `DEMO_DATABASE_URL`, ignorando `DATABASE_URL` e `DIRECT_URL`
   do ambiente da aplicação. Aceita somente host local explícito `127.0.0.1`,
   `localhost` ou `[::1]`, sem parâmetros de conexão ou fragmentos, nome de banco
   `cip_demo_<nome>` e `DEMO_SEED_CONFIRM` exatamente igual a esse nome.
3. Bloqueia `NODE_ENV=production`, sem opção de contornar esse bloqueio.
   A proteção local não torna um banco seguro por si só: não use túneis, proxies
   ou redirecionamentos para uma base real; escolha banco realmente isolado,
   com credenciais próprias de menor privilégio.
4. As duas prefeituras são criadas numa única transação, com lock do seed.
   Uma colisão/falha reverte toda a execução. Não há `update`, `upsert`, exclusão
   ou migração durante o seed.
5. IDs de raiz reservados: `cip-demo-modelos-v1-1-municipio` e
   `cip-demo-modelos-v1-2-municipio`. Se a raiz já existir, preserva **toda a
   prefeitura**, sem alterar filhos, contas, senhas, exclusões ou vínculos
   editados. A existência de IBGE/CNPJ nessa raiz é tratada como conflito.
6. Nome de prefeitura ou e-mail reservado ocupado fora desse conjunto gera
   erro, nunca apropriação de registros/acessos. Não conecta secretarias de
   outros municípios. Não cria administrador de plataforma.
7. Cria, se ausente, a conta reservada `demo@modelos.example.test`, com perfil
   `leitura` e dois vínculos: somente Prefeitura Modelo 1 e Prefeitura Modelo 2.
   Essa conta também pode ser adicionada a uma base demo preparada pela versão
   anterior deste seed, sem alterar os registros das prefeituras.
   Se já existir, preserva nome/senha e exige que a conta esteja ativa, sem
   administração central, com exatamente os dois vínculos de leitura esperados.
   Conta ocupada, vínculos alterados ou prefeitura inativa geram erro e rollback,
   em vez de reativar registros, restaurar acessos ou anunciar seletor funcional.

**Limite intencional:** reexecução não repara uma prefeitura parcialmente
modificada e não acrescenta versões novas a uma raiz existente. Se apenas uma
raiz existir, preserva essa e cria a outra. Para uma demonstração limpa, crie
**outro banco descartável**; não remova raízes para tentar resetar dados editados.
O namespace dos IDs é reservado ao seed, não um mecanismo de autenticação.

### Banco da API ativa

O servidor API ativo usa **`127.0.0.1:5434/cip`**, não necessariamente a URL remota
presente no `.env`. **Não execute seed ou migração nesse banco.** O comando
recusa o nome `cip`, mesmo com host local e confirmação explícita, e não usa a
conexão da API como fallback. Nenhum procedimento abaixo muda a API em execução.
Não renomeie a base atual nem remova as proteções para contornar essa restrição.

## Execução segura pelo operador

Use um PostgreSQL **novo, vazio, isolado**, por exemplo `cip_demo_modelos`,
com usuário exclusivo. Não aponte para o banco atual da aplicação e não renomeie
um banco existente para satisfazer a proteção. Este documento não autoriza
migrations/seeds sobre bases existentes.

1. Instale as dependências do monorepo. Gere o cliente (não acessa o banco):

   ```sh
   pnpm db:generate
   pnpm db:seed:modelos
   ```

2. Provisione o banco vazio fora da aplicação. Aplique as migrations PostgreSQL
   existentes **somente nele**, explicitando as duas URLs para não herdar a
   conexão atual. A URL abaixo é apenas exemplo local:

   ```sh
   export DEMO_DATABASE_URL='postgresql://demo:SENHA_DO_BANCO@127.0.0.1:55439/cip_demo_modelos'
   DATABASE_URL="$DEMO_DATABASE_URL" DIRECT_URL="$DEMO_DATABASE_URL" \
     pnpm --filter @cip/db migrate:deploy
   ```

3. Defina uma senha de acesso à demonstração com **16+ caracteres e até 72
   bytes**, preferencialmente por entrada oculta/gerenciador de segredos (não
   grave em arquivos versionados ou histórico). Não existe senha padrão.
   Com `DEMO_SEED_PASSWORD` já exportada:

   ```sh
   DEMO_SEED_CONFIRM=cip_demo_modelos pnpm db:seed:modelos --apply
   unset DEMO_SEED_PASSWORD
   ```

   Exporte as variáveis `DEMO_*` explicitamente: o comando não depende do `.env`
   da aplicação para configurá-las e a conexão explícita prevalece sobre a
   conexão padrão do Prisma. Não imprime URL/senha e termina com código diferente
   de zero em caso de erro. Use conexão local direta PostgreSQL, sem parâmetros
   de URL. Não use poolers/túneis para atingir bases remotas.

## Disponibilizar ao usuário

O seed **não publica nem troca a conexão do aplicativo atual**. Para acesso:

1. Suba uma instância separada de web e API, apontando a API para o banco demo
   (`DATABASE_URL` e, quando aplicável, `DIRECT_URL`), e o frontend para essa API.
   Não altere a conexão da API ativa em `127.0.0.1:5434/cip`.
2. Configure URL da API, origem CORS e segredos de autenticação próprios conforme
   a documentação de deploy. Mantenha acesso restrito; não reutilize segredos de
   produção. Não exponha PostgreSQL publicamente sem controle de rede/TLS.
3. Entregue a URL do **frontend**, não a URL do banco, e envie a senha por canal
   separado. Na entrada da **prefeitura**, use `demo@modelos.example.test` e a
   senha informada quando essa conta foi criada. O login mostrará as duas
   prefeituras para escolher. Depois de entrar, o seletor **Ambiente ativo /
   Trocar prefeitura** permite alternar sem logout. A conta tem perfil `leitura`,
   sem administração central ou acesso a municípios reais. Não se usa `prefeito`
   para essa conta porque esse perfil é restrito a uma única prefeitura.
   As contas `prefeito@modelo1.example.test` e `prefeito@modelo2.example.test`
   continuam disponíveis, cada uma com acesso apenas à sua própria prefeitura.
4. Comece em **Cenário**, depois Secretarias, Projetos, Tarefas e Pendências.
   Essas contas acompanham, mas não são contas de edição/consultoria.

O painel antigo de credenciais da tela de login **não inclui estas contas**:
mantenha `NEXT_PUBLIC_DEMO_MODE` desligado para não sugerir usuários do seed
legado. Uma administração central já existente pode ver os dois municípios
somente se estiver conectada ao mesmo banco; este script não concede esse acesso.

### Limitações de visualização

As datas fixas preservam o cenário na data-base; telas que usam o relógio atual
podem mostrar envelhecimento/atrasos diferentes. Evidências são registros de
texto a verificar, sem anexos reais ou validação de entrega. Não são criados
modelos de wizard, documentos de conhecimento, integrações externas ou séries
históricas de auditoria. Consultas IBGE/PNCP/Transferegov não se aplicam aos
municípios fictícios. Isso não é uma carga de migração nem cópia dos dados reais.

## Validação reproduzível

```sh
pnpm --filter @cip/db typecheck:demo
pnpm --filter @cip/db test:demo
```

O teste padrão valida fixtures, proteções e CLI sem banco. A integração só roda
quando explicitamente apontada para um **PostgreSQL descartável vazio**, com
migrations já aplicadas, cujo nome comece por `cip_demo_test_`:

```sh
DEMO_TEST_DATABASE_URL='postgresql://demo:SENHA_DO_BANCO@127.0.0.1:55439/cip_demo_test_modelos' \
DEMO_TEST_CONFIRM=cip_demo_test_modelos \
  pnpm --filter @cip/db test:demo
```

A suíte cria sentinelas de municípios reais **nesse banco temporário** e testa
integridade/vínculos, classificações, tarefas e medições, autenticação por hash,
isolamento das contas, rollback por colisão, concorrência, reexecução e
preservação de edições/exclusões/senhas, além dos dois vínculos da conta do
seletor e da atualização aditiva de uma demo anterior. Ela deixa os dados de teste no banco;
descarte a instância temporária inteira ao terminar. Nunca rode essa suíte
contra uma demonstração em uso.
