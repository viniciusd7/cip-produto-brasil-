# Fluxo operacional municipal

A navegação principal de projetos segue secretaria → pasta do projeto → metas de execução → tarefas → subtarefas. A referência funcional é o README do repositório viniciusd7/cip-projeto: pastas estruturantes e ações do dia a dia.

## Cadastro

Escolher o tipo, registrar a entrega e responsável, responder condições aplicáveis e organizar o escopo. Compromissos do plano podem selecionar uma meta estratégica existente ou criar meta e plano no próprio assistente. Esses registros só são gravados na confirmação, na mesma transação do projeto.

O ícone de interrogação junto aos campos do assistente abre uma explicação sobre o preenchimento. Ele também pode ser acionado pelo teclado e fechado com Escape.

A meta estratégica representa o compromisso do governo; as metas de execução organizam as entregas dentro da pasta do projeto. O cadastro inicial não pede previsão de atraso. O primeiro prazo é definido na tarefa; mudanças posteriores são reprogramações.

Na etapa **Escopo** do assistente, cada meta do projeto pode receber um indicador textual e um resultado esperado. Depois da confirmação, a aba **Metas e indicadores** permite consultar as metas, cadastrar novas entregas e adicionar indicadores de acompanhamento com unidade, valor inicial e alvo. O cadastro é restrito aos perfis autorizados; os demais perfis podem consultar conforme seu acesso. Esses indicadores são vinculados à meta de execução do projeto, não criam um plano de governo nem uma meta estratégica. O indicador textual cadastrado no escopo permanece exibido separadamente dos indicadores de acompanhamento.

### Contratos de criação na API

- `codigo` é opcional em `POST /iniciativas` e `POST /iniciativas/wizard/confirmar`. Quando omitido, o servidor gera um UUID v4 completo com `crypto.randomUUID()`. Quando informado, o código manual é preservado e deve conter ao menos dois caracteres; texto vazio, um caractere ou `null` retornam `400 VALIDATION_ERROR`, sem geração automática. As duas respostas de criação incluem o código efetivamente salvo em `data.codigo`.
- O código é único por prefeitura (`municipioId` + `codigo`), não por secretaria. Colisões manuais ou automáticas retornam `409 CODIGO_INICIATIVA_DUPLICADO`, sem renomear ou repetir a gravação automaticamente. A restrição do banco é a garantia final, inclusive para requisições concorrentes. Clientes que ainda enviem sigla + últimos quatro dígitos do relógio não usam a geração do servidor; devem omitir `codigo` para utilizá-la.
- `POST /iniciativas` aceita `classificacaoPrincipal` com uma das categorias `ESTRUTURANTE`, `PRIORITARIO`, `PLANO_GOVERNO` ou `ACAO_DIARIA`. Se `classificacoes` também for enviado, deve conter exatamente essa categoria; divergências retornam `400 VALIDATION_ERROR`, sem trocar o tipo silenciosamente. O formato legado com apenas `classificacoes` ou `estruturante` continua aceito; sem classificação, o cadastro direto continua sem categoria.
- Os IDs de `secretariaIds` e `compromissoIds` são deduplicados antes da persistência. A secretaria principal não é repetida como correlata. As referências continuam sujeitas às validações do município e Plano de Governo continua exigindo meta ou compromisso.
- Preview, confirmação e reavaliação do wizard aceitam uma resposta por `perguntaCodigo`; repetições retornam `400 VALIDATION_ERROR`. Respostas `null` são persistidas como JSON null, inclusive no histórico, sem converter `false`, `0`, texto vazio ou objetos para outro tipo.
- A confirmação do wizard exige aplicabilidade definida (`sim` ou `nao`) para cada impedimento obrigatório visível no catálogo do servidor. Resposta ausente ou ainda `a_avaliar` retorna `422 IMPEDIMENTO_NAO_RESPONDIDO` antes da transação, mesmo com detalhes preenchidos ou chamada direta à API. Um impedimento aplicável e pendente não impede o cadastro; suas regras de bloqueio continuam valendo. Preview e reavaliação não ganham essa exigência de confirmação.

Regressões locais, sem banco: `pnpm --filter @cip/api exec tsx --test src/routes/criacao-projetos.test.ts`. Os testes exercitam HTTP, autenticação e validação reais com a persistência Prisma simulada; não comprovam execução de transações em PostgreSQL. Também entram em `pnpm --filter @cip/api test`.

## Prazos

Uma tarefa sem prazo permite definir o prazo inicial. Uma tarefa aberta com prazo permite reprogramar, informando data futura diferente da atual e motivo/providência. O prazo original nunca é substituído. A alteração e o aviso são gravados na mesma transação. Alterações simultâneas geram conflito em vez de sobrescrever o prazo de outra pessoa. O histórico fica disponível inclusive para consulta do prefeito.

## Comunicação interna

Avisos e conversas têm caixa de entrada, contador de não lidos, confirmação de leitura e registro na pasta do projeto. Secretários e analistas podem enviar orientações a usuários ativos do mesmo município e responder pelo projeto.

Reprogramação, definição de prazo, evidência enviada e bloqueios avisam a secretaria. O titular é localizado pelo e-mail cadastrado na secretaria, vinculado a usuário ativo com papel gestor no mesmo município. Se não houver esse vínculo, o aviso entra na caixa compartilhada dos secretários do município, explicitamente identificada. Para entrega individual, cadastre o e-mail de acesso do titular na secretaria.

Validação ou devolução de evidência avisa seu autor identificado pelo registro de criação; sem esse registro, entra na caixa da equipe. Os avisos são internos ao sistema; não são envio por e-mail, WhatsApp ou push externo. A tela consulta atualizações a cada 30 segundos.

## Banco e verificação

A migração `20261110180000_comunicacao_interna` cria comunicados e leituras. Foi aplicada no MySQL local. Outros ambientes precisam executar `pnpm --filter @cip/db migrate:deploy` antes de iniciar a nova API.

Teste integrado: após compilar a API, executar `node --env-file=packages/db/.env apps/api/scripts/verify-gestao.cjs`. O script exige banco local e cria e remove município e usuários temporários. Cobre meta no cadastro, preservação de prazo, aviso ao titular, leitura, resposta, primeiro prazo, evidências e isolamento entre municípios.
