# API: documentos de conhecimento

## Projetos sem metas de execucao

- `POST /iniciativas/:id/metas-execucao` retorna `410 META_EXECUCAO_DESCONTINUADA`
  apos as verificacoes de acesso; nenhum registro e criado.
- Cadastro de projeto, preview e confirmacao do wizard rejeitam campos
  `metaExecucaoId` e `metasExecucao` com `400 VALIDATION_ERROR`.
- O wizard recebe `estruturaOverride` com tarefas na raiz e subtarefas nas
  tarefas. Nos overrides, `META` e vinculos `metaExecucaoId` sao rejeitados.
  Modelos antigos sao lidos sem alteracao no banco e normalizados pelo gerador
  compartilhado para tarefas e subtarefas, diretamente na iniciativa.
- `POST /iniciativas/:id/marcos` cria tarefa direta; enviar `metaExecucaoId`
  resulta em erro de validacao, nunca em sucesso ignorando o vinculo.
- `GET /iniciativas/:id` disponibiliza todas as tarefas em `data.marcos`,
  incluindo as ligadas a metas antigas. Registros e vinculos legados sao
  preservados. `PATCH /iniciativas/marcos/:id` permite edicao normal,
  manter o mesmo `metaExecucaoId` legado ou remove-lo com `null`, mas rejeita
  novo vinculo com `422 META_EXECUCAO_DESCONTINUADA`.

## Criacao com classificacao automatica

`POST /conhecimento/documentos` recebe `multipart/form-data`, autenticado com
Bearer token e permissao `conhecimento:upload`, em um municipio ativo.

- `tipo`: `AUTO` ou um tipo explicito existente (`PLANO_GOVERNO`, `PPA`, `LDO`,
  `LOA`, `DIAGNOSTICO`, `OUTRO`).
- `titulo`: obrigatorio, com pelo menos 3 caracteres; pode ser o nome do arquivo.
  Nao participa da classificacao.
- `arquivo`: obrigatorio para `AUTO` e `PLANO_GOVERNO`. Um unico PDF, DOC ou DOCX,
  com extensao, MIME e bytes validos, de ate 4 MiB.
- Metadados opcionais preservados: `vigencia`, `versao`, `fonte`, `responsavel`,
  `observacao`, `arquivoUrl` e `statusConferencia`. URL nao substitui arquivo.
  Conferencia diferente de `PENDENTE` continua exigindo `iniciativa:write`.

O arquivo e validado e seu texto e extraido antes da classificacao e do
armazenamento. `AUTO` existe apenas no contrato de criacao: a resposta
`201 { data: { ... } }` retorna em `data.tipo` o tipo concreto persistido.
Nao ha alteracao no formato publico da resposta; texto extraido e chave de
armazenamento continuam privados. O municipio vem da sessao, nunca do formulario.

Tipos explicitos nao sao reclassificados. Para os demais tipos explicitos,
anexo continua opcional. `PATCH /conhecimento/documentos/:id` nao aceita `AUTO`.

Erros relevantes: `400 VALIDATION_ERROR` para campos invalidos,
`400 INVALID_MULTIPART` para arquivos/campos de upload inesperados,
`422 DOCUMENT_FILE_REQUIRED` para anexo obrigatorio ausente,
`422 INVALID_FILE` para formato/bytes invalidos,
`413 FILE_TOO_LARGE` acima de 4 MiB. Autenticacao e permissoes mantem os
erros existentes (`401`, `403`, ou `409` sem contexto de municipio).

## Regras e limitacoes

Classificacao deterministica e local, sem IA, OCR ou servico externo. Considera
somente as primeiras 20 linhas nao vazias dos primeiros 2.000 caracteres do
texto extraido, ignorando caixa, acentos e espacos repetidos.

Exige um titulo completo em linha propria:

- `Plano Plurianual` -> `PPA`
- `Lei de Diretrizes Orcamentarias` -> `LDO`
- `Lei Orcamentaria Anual` -> `LOA`
- `Diagnostico Municipal`, `Situacional`, `Socioeconomico`, `Territorial` ou
  `da Gestao Municipal` -> `DIAGNOSTICO`

Aceita a sigla correspondente e/ou exercicios de quatro digitos iniciados por
`20`, inclusive intervalos, depois do titulo. Referencias em prosa, siglas
isoladas, titulos desconhecidos, ausencia de texto ou mais de uma categoria
identificada na abertura retornam `OUTRO`. Uma abertura com titulo de plano,
programa ou proposta de governo, sumario, indice ou referencias bibliograficas
tambem retorna `OUTRO`.

Nunca produz `PLANO_GOVERNO` automaticamente: esse tipo requer escolha explicita
e arquivo, evitando satisfazer o requisito de Plano de Governo por inferencia.
Classificacao nao comprova autenticidade, vigencia, validade juridica ou
conferencia. PDFs digitalizados sem texto, titulos quebrados em varias linhas,
capas longas ou formatos de titulo diferentes podem resultar em `OUTRO`
intencionalmente. O tipo pode ser corrigido pelo fluxo autorizado existente.

## Validacao

```sh
pnpm --filter @cip/api exec tsx --test src/services/conhecimento-classificacao.test.ts src/services/conhecimento-documentos.test.ts src/routes/conhecimento.test.ts
pnpm --filter @cip/api typecheck
```

Os testes HTTP usam extracao real de PDF/DOCX, com persistencia e armazenamento
simulados, sem alterar banco ou chamar armazenamento externo.
