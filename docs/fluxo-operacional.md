# Fluxo operacional municipal

A navegação principal segue secretaria → projeto → meta estratégica e indicadores, ou projeto → tarefas → subtarefas. Tarefas anteriores continuam visíveis no projeto, inclusive aquelas antes associadas a metas de execução.

## Cadastro

Escolher o tipo, registrar a entrega e responsável, responder condições aplicáveis e organizar o escopo. Compromissos do plano podem selecionar uma meta estratégica existente ou criar meta e plano no próprio assistente. Esses registros só são gravados na confirmação, na mesma transação do projeto.

O ícone de interrogação junto aos campos do assistente abre uma explicação sobre o preenchimento. Ele também pode ser acionado pelo teclado e fechado com Escape.

A meta estratégica representa o resultado acompanhado pelo projeto. O cadastro inicial não pede previsão de atraso. O primeiro prazo é definido na tarefa; mudanças posteriores são reprogramações.

Na aba **Metas e indicadores** de um projeto, a consultoria pode cadastrar sua meta estratégica e indicadores de acompanhamento, com unidade, valor inicial, valor atual e resultado esperado. Os indicadores pertencem à meta estratégica vinculada ao projeto. O cadastro é restrito aos perfis autorizados, enquanto os demais podem consultar conforme seu acesso. Registros antigos de execução permanecem preservados no banco, sem integrar o fluxo de trabalho.

### Contratos de criação na API

- `codigo` é opcional em `POST /iniciativas` e `POST /iniciativas/wizard/confirmar`. Quando omitido, o servidor gera um UUID v4 completo com `crypto.randomUUID()`. Quando informado, o código manual é preservado e deve conter ao menos dois caracteres; texto vazio, um caractere ou `null` retornam `400 VALIDATION_ERROR`, sem geração automática. As duas respostas de criação incluem o código efetivamente salvo em `data.codigo`.
- O código é único por prefeitura (`municipioId` + `codigo`), não por secretaria. Colisões manuais ou automáticas retornam `409 CODIGO_INICIATIVA_DUPLICADO`, sem renomear ou repetir a gravação automaticamente. A restrição do banco é a garantia final, inclusive para requisições concorrentes. Clientes que ainda enviem sigla + últimos quatro dígitos do relógio não usam a geração do servidor; devem omitir `codigo` para utilizá-la.
- `POST /iniciativas` aceita `classificacaoPrincipal` com uma das categorias `ESTRUTURANTE`, `PRIORITARIO`, `PLANO_GOVERNO` ou `ACAO_DIARIA`. Se `classificacoes` também for enviado, deve conter exatamente essa categoria; divergências retornam `400 VALIDATION_ERROR`, sem trocar o tipo silenciosamente. O formato legado com apenas `classificacoes` ou `estruturante` continua aceito; sem classificação, o cadastro direto continua sem categoria.
- Os IDs de `secretariaIds` e `compromissoIds` são deduplicados antes da persistência. A secretaria principal não é repetida como correlata. As referências continuam sujeitas às validações do município e Plano de Governo continua exigindo meta ou compromisso.
- Preview, confirmação e reavaliação do wizard aceitam uma resposta por `perguntaCodigo`; repetições retornam `400 VALIDATION_ERROR`. Respostas `null` são persistidas como JSON null, inclusive no histórico, sem converter `false`, `0`, texto vazio ou objetos para outro tipo.
- A confirmação do wizard exige aplicabilidade definida (`sim` ou `nao`) para cada impedimento obrigatório visível no catálogo do servidor. Resposta ausente ou ainda `a_avaliar` retorna `422 IMPEDIMENTO_NAO_RESPONDIDO` antes da transação, mesmo com detalhes preenchidos ou chamada direta à API. Um impedimento aplicável e pendente não impede o cadastro; suas regras de bloqueio continuam valendo. Preview e reavaliação não ganham essa exigência de confirmação.

Regressões locais, sem banco: `pnpm --filter @cip/api exec tsx --test src/routes/criacao-projetos.test.ts`. Os testes exercitam HTTP, autenticação e validação reais com a persistência Prisma simulada; não comprovam execução de transações em PostgreSQL. Também entram em `pnpm --filter @cip/api test`.

## Estratégia de um projeto existente (API)

As rotas de estratégia preservam o campo singular `Iniciativa.metaEstrategicaId`, os indicadores e as metas legadas, sem migração ou exclusão. A criação de metas de execução foi desativada; tarefas novas são vinculadas diretamente ao projeto e tarefas antigas continuam acessíveis.

### Integridade nos caminhos legados

- `POST /planejamento/metas` não cria mais metas avulsas: retorna `409 PROJETO_REQUIRED`. Use o cadastro da estratégia de um projeto existente ou `novaMeta` na confirmação do wizard, que continua criando meta, eventual plano e projeto na mesma transação. O cadastro de planos permanece independente; a UI de planejamento não oferece mais criação de metas sem projeto.
- `POST /planejamento/indicadores` e a aceitação de sugestões de IA só criam indicadores estratégicos quando a meta pertence ao município e possui ao menos um projeto desse município. Meta sem projeto retorna `409 PROJETO_REQUIRED`; meta de outro município retorna `422 INVALID_META`.
- `PATCH /planejamento/indicadores/:id` considera os dois alvos efetivos, incluindo valores que não vieram no PATCH. Se o vínculo mudar, exige alvo válido e projeto; não permite retirar todos os alvos. Leitura, medições e edição descritiva dos registros antigos, inclusive órfãos, permanecem disponíveis. Não há reparação ou exclusão automática.
- `PATCH /iniciativas/:id` impede trocar ou remover a meta quando esse é seu último projeto no município (`409 META_ULTIMO_PROJETO`). Primeiro vincule outro projeto à meta anterior. Metas compartilhadas permanecem compartilhadas: é permitido alterar um vínculo quando sobra outro projeto municipal, sem clonar, apagar ou transferir indicadores. Na rota global de planejamento, novos indicadores de uma meta compartilhada continuam comuns aos seus projetos; a rota exclusiva de estratégia de projeto mantém sua restrição própria.
- Verificações e escritas de indicadores, aceitação de sugestões e edição de vínculos usam transação `Serializable`; conflito `P2034` retorna `409 ESTRATEGIA_CONCURRENT_UPDATE`. Essa proteção cobre os endpoints acima, não scripts externos ou escritas diretas no banco.

Regressões isoladas: `pnpm --filter @cip/api exec tsx --test src/routes/integridade-estrategica.test.ts src/routes/criacao-projetos.test.ts src/routes/estrategia-projeto.test.ts`. São testes HTTP com Prisma simulado e rollback simulado do wizard, não testes de concorrência ou de transações em PostgreSQL real.

- `GET /iniciativas/:id/estrategia` retorna `200 {data: {meta: null}}` quando não há meta, ou `{data: {meta: {id,nome,descricao,indicadores: [{id,nome,descricao,unidade,valorBase,alvo,valorAtual,periodicidade}]}}}`. Campos opcionais não preenchidos retornam `null`. A leitura exige `iniciativa:read`, prefeitura ativa e acesso ao projeto; secretário só lê projetos da pasta principal ou correlata.
- `GET /iniciativas/:id/estrategia/planos` retorna `200 {data: {planos: [{id,nome,periodo,mandatoInicio,mandatoFim}], selecaoObrigatoria: boolean}}`, sem modificar o contrato do GET de estratégia. Exige o mesmo acesso de leitura ao projeto e lista apenas planos do município, ordenados por nome e ID crescentes. Datas são ISO ou `null`; período pode ser `null`. A ordem serve apenas à apresentação, nunca à seleção.
- `POST /iniciativas/:id/estrategia` recebe `{nome,descricao?,planoId?}` e retorna `201 {data: {meta: {id,nome,descricao,indicadores: []}}}`. Cria a meta no plano do município e na secretaria principal do projeto, vinculando-a atomicamente. Não substitui meta: vínculo existente retorna `409 META_ESTRATEGICA_EXISTS`.
- Se houver mais de um plano no município, `planoId` é obrigatório: omissão retorna `409 PLANO_SELECTION_REQUIRED`, sem gravação. Com exatamente um plano, a omissão usa esse único plano; sem planos retorna `409 PLANO_GOVERNO_REQUIRED`. ID inexistente ou de outro município retorna `422 INVALID_PLANO`, sem fallback. `planoId` deve ser texto aparado não vazio com até 191 caracteres. A lista e a seleção são revalidadas dentro da transação do POST: se outro plano surgiu desde o GET, o servidor passa a exigir seleção. Nunca cria plano automaticamente.
- Todos os planos municipais são listados, inclusive históricos, futuros e sem datas: vigência não é inferida de nome, período ou data de criação, nem usada para escolher entre planos. A escolha explícita permite associar uma meta a um plano histórico ou futuro. `selecaoObrigatoria` significa mais de um plano, não disponibilidade para cadastro; lista vazia continua impedindo criar meta. Isso evita associação implícita em municípios como Modelo 1 com múltiplos planos.
- `POST /iniciativas/:id/estrategia/indicadores` recebe `{nome,descricao?,unidade?,valorBase?,alvo?,valorAtual?,periodicidade?}` e retorna `201 {data: {id,nome,descricao,unidade,valorBase,alvo,valorAtual,periodicidade}}`. O servidor deriva município e meta do projeto; não aceita IDs no corpo. Sem meta, retorna `409 META_ESTRATEGICA_REQUIRED`.
- As duas escritas exigem `iniciativa:write` (consultor/`analista` ou administrador central com prefeitura selecionada). `nome` é texto aparado com 3–191 caracteres; descrição tem até 10.000 caracteres; demais campos são textos de até 191 caracteres, inclusive valores numéricos, conforme a modelagem legada. Campos desconhecidos, `null` ou tipos incorretos retornam `400 VALIDATION_ERROR`.
- Meta legada compartilhada continua consultável por quem pode ler o projeto, mas adicionar indicador retorna `409 META_ESTRATEGICA_SHARED` se qualquer outro projeto a referenciar, inclusive em outro município. Não clona nem desassocia metas. A leitura inclui indicadores ativos e inativos da meta apenas no município atual e sem vínculo simultâneo a meta de execução; não sintetiza indicadores a partir de campos textuais legados da meta. Meta ligada a plano de outro município retorna `409 INVALID_META`, sem expor seu conteúdo.
- Escritas usam transação `Serializable`; criação da meta, vínculo condicional (apenas se ainda nulo) e auditorias `CREATE MetaEstrategica`/`UPDATE Iniciativa` são indivisíveis. Indicador, verificação de compartilhamento/vínculo e auditoria `CREATE Indicador` também são atômicos. Auditorias registram autor, prefeitura, IP, projeto e IDs dos registros. Falha de auditoria aborta a escrita. Conflito Prisma `P2034` retorna `409 ESTRATEGIA_CONCURRENT_UPDATE`, orientando recarregar e tentar novamente. Não há repetição automática de criação.
- A exclusividade do indicador é verificada no momento da transação. As rotas legadas de associação continuam compatíveis e podem compartilhar uma meta posteriormente; não foi introduzida restrição global de unicidade no banco. Esta API não oferece substituição de meta.

Testes HTTP sem banco: `pnpm --filter @cip/api exec tsx --test src/routes/estrategia-projeto.test.ts`. Persistência, rollback e conflitos são simulados; essa suíte não comprova o mecanismo de isolamento do PostgreSQL real.

Integração PostgreSQL real e descartável: `pnpm --filter @cip/api exec tsx scripts/verify-estrategia-postgres.ts`. Exige Docker ativo e a imagem `postgres:16-alpine` já disponível (não baixa imagem nem instala dependências). Cria um contêiner exclusivo com cluster em tmpfs, sem volumes/bind mounts, usuário e banco sintéticos e porta aleatória publicada apenas em loopback. A autenticação `trust` pertence apenas a essa instância efêmera. Copia schema/migrações para diretório temporário e aplica as migrações existentes somente nesse banco; não carrega `.env` nem usa a URL do banco ativo. Executa Express, autenticação e Prisma reais, cobrindo seleção de plano, criação/leitura, isolamento, preservação do vínculo, auditoria, rollback por falha SQL induzida e duas criações HTTP concorrentes. Verifica a identidade do banco antes dos dados sintéticos e remove apenas servidor, contêiner rotulado e diretório temporário criados pela própria execução, inclusive em caso de falha. As respostas `500` e mensagens SQL `it_expected_audit_failure` são esperadas nos dois testes de rollback. Não executa SQL no banco `cip`.

## Prazos

Uma tarefa sem prazo permite definir o prazo inicial. Uma tarefa aberta com prazo permite reprogramar, informando data futura diferente da atual e motivo/providência. O prazo original nunca é substituído. A alteração e o aviso são gravados na mesma transação. Alterações simultâneas geram conflito em vez de sobrescrever o prazo de outra pessoa. O histórico fica disponível inclusive para consulta do prefeito.

## Comunicação interna

Avisos e conversas têm caixa de entrada, contador de não lidos, confirmação de leitura e registro na pasta do projeto. Secretários e analistas podem enviar orientações a usuários ativos do mesmo município e responder pelo projeto.

Reprogramação, definição de prazo, evidência enviada e bloqueios avisam a secretaria. O titular é localizado pelo e-mail cadastrado na secretaria, vinculado a usuário ativo com papel gestor no mesmo município. Se não houver esse vínculo, o aviso entra na caixa compartilhada dos secretários do município, explicitamente identificada. Para entrega individual, cadastre o e-mail de acesso do titular na secretaria.

Validação ou devolução de evidência avisa seu autor identificado pelo registro de criação; sem esse registro, entra na caixa da equipe. Os avisos são internos ao sistema; não são envio por e-mail, WhatsApp ou push externo. A tela consulta atualizações a cada 30 segundos.

## Banco e verificação

A migração `20261110180000_comunicacao_interna` cria comunicados e leituras. Foi aplicada no MySQL local. Outros ambientes precisam executar `pnpm --filter @cip/db migrate:deploy` antes de iniciar a nova API.

Teste integrado: após compilar a API, executar `node --env-file=packages/db/.env apps/api/scripts/verify-gestao.cjs`. O script exige banco local e cria e remove município e usuários temporários. Cobre meta no cadastro, preservação de prazo, aviso ao titular, leitura, resposta, primeiro prazo, evidências e isolamento entre municípios.
