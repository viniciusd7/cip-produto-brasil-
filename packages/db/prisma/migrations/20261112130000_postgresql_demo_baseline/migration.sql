-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "SessionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Municipio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "ibgeCode" TEXT,
    "cnpjOrgao" VARCHAR(14),
    "mandatoInicio" TIMESTAMP(3),
    "mandatoFim" TIMESTAMP(3),
    "prefeitoNome" TEXT,
    "prefeitoTelefone" TEXT,
    "prefeitoEmail" TEXT,
    "consultorResponsavelId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinculoUsuarioMunicipio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "secretariaId" TEXT,
    "roleCode" TEXT NOT NULL DEFAULT 'leitura',
    "principal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoUsuarioMunicipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoGoverno" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "periodo" TEXT,
    "descricao" TEXT,
    "mandatoInicio" TIMESTAMP(3),
    "mandatoFim" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoGoverno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secretaria" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "titularNome" TEXT,
    "titularCargo" TEXT,
    "titularTelefone" TEXT,
    "titularEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secretaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretariaPessoa" (
    "id" TEXT NOT NULL,
    "secretariaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "papel" TEXT NOT NULL DEFAULT 'EQUIPE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretariaPessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaEstrategica" (
    "id" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "secretariaId" TEXT,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "indicador" TEXT,
    "valorBase" TEXT,
    "alvo" TEXT,
    "unidade" TEXT,
    "periodicidade" TEXT,
    "prazo" TIMESTAMP(3),
    "statusValidacao" TEXT NOT NULL DEFAULT 'PENDENTE',
    "perspectivaBsc" TEXT,
    "resultadoChaveOkr" TEXT,
    "responsavelUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaEstrategica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compromisso" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "codigo" TEXT,
    "titulo" TEXT NOT NULL,
    "fonte" TEXT,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iniciativa" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "secretariaPrincipalId" TEXT NOT NULL,
    "metaEstrategicaId" TEXT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT,
    "origem" TEXT,
    "responsavel" TEXT,
    "responsavelPessoaId" TEXT,
    "ciclo" TEXT NOT NULL DEFAULT 'EM_ACOMPANHAMENTO',
    "publicacao" TEXT NOT NULL DEFAULT 'INTERNA',
    "dataReferencia" TIMESTAMP(3),
    "fonte" TEXT,
    "confiabilidade" TEXT DEFAULT 'MEDIA',
    "estruturante" BOOLEAN NOT NULL DEFAULT false,
    "classificacaoPrincipal" TEXT,
    "vinculoPlanoGoverno" BOOLEAN NOT NULL DEFAULT false,
    "modeloProjetoId" TEXT,
    "modeloSnapshot" JSONB,
    "bloqueioLabel" TEXT,
    "bloqueiosAtivos" JSONB,
    "prioridadeNivel" TEXT,
    "etapaAtual" TEXT,
    "prontidaoPct" INTEGER,
    "criadoPorId" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iniciativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaExecucao" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "indicador" TEXT,
    "criterio" TEXT,
    "alvo" TEXT,
    "valorAtual" TEXT,
    "unidade" TEXT,
    "responsavel" TEXT,
    "responsavelUserId" TEXT,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicao" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "metaEstrategicaId" TEXT,
    "metaExecucaoId" TEXT,
    "indicadorId" TEXT,
    "dataCorte" TIMESTAMP(3) NOT NULL,
    "valorRealizado" TEXT NOT NULL,
    "valorEsperado" TEXT,
    "fonte" TEXT,
    "confiabilidade" TEXT DEFAULT 'MEDIA',
    "observacao" TEXT,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicador" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "metaEstrategicaId" TEXT,
    "metaExecucaoId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "formula" TEXT,
    "unidade" TEXT,
    "valorBase" TEXT,
    "alvo" TEXT,
    "valorAtual" TEXT,
    "periodicidade" TEXT,
    "fonte" TEXT,
    "polaridade" TEXT NOT NULL DEFAULT 'MAIOR_MELHOR',
    "responsavelUserId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IniciativaSecretaria" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "secretariaId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'CORRESPONSAVEL',
    "responsavel" TEXT,

    CONSTRAINT "IniciativaSecretaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IniciativaCompromisso" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "compromissoId" TEXT NOT NULL,
    "tipoContribuicao" TEXT,
    "origemVinculo" TEXT,

    CONSTRAINT "IniciativaCompromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipamentoPublico" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "endereco" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipamentoPublico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IniciativaEquipamento" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "tipoVinculo" TEXT NOT NULL DEFAULT 'RELACIONADO',
    "validado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IniciativaEquipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarcoEntrega" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "metaExecucaoId" TEXT,
    "equipamentoId" TEXT,
    "codigo" TEXT,
    "descricao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "responsavel" TEXT,
    "responsavelUserId" TEXT,
    "prazoOriginal" TIMESTAMP(3),
    "prazoVigente" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "encerradoSemSolucaoEm" TIMESTAMP(3),
    "motivoEncerramento" TEXT,
    "gravidade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarcoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtarefa" (
    "id" TEXT NOT NULL,
    "marcoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" TEXT,
    "responsavelUserId" TEXT,
    "prazo" TIMESTAMP(3),
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reprogramacao" (
    "id" TEXT NOT NULL,
    "marcoId" TEXT NOT NULL,
    "dataAnterior" TIMESTAMP(3),
    "dataNova" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT,
    "autorizacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reprogramacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoVerificacao" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoVerificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verificacao" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "tipoVerificacaoId" TEXT NOT NULL,
    "aplicabilidade" TEXT NOT NULL DEFAULT 'A_AVALIAR',
    "situacao" TEXT NOT NULL DEFAULT 'NAO_INICIADA',
    "responsavel" TEXT,
    "justificativa" TEXT,
    "documentoFonte" TEXT,
    "efeitoNoAvanco" TEXT NOT NULL DEFAULT 'INFORMATIVO',
    "proximaAcao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impedimento" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "marcoId" TEXT,
    "tipo" TEXT,
    "descricao" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL DEFAULT 'MEDIA',
    "responsavel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "proximoPasso" TEXT,
    "prazo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Impedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoProvidencia" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "impedimentoId" TEXT,
    "descricao" TEXT NOT NULL,
    "responsavel" TEXT,
    "autorId" TEXT,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisaoProvidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "marcoId" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT,
    "urlOuArquivo" TEXT,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "arquivoNome" TEXT,
    "fonte" TEXT,
    "autorNome" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DECLARADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidacaoEvidencia" (
    "id" TEXT NOT NULL,
    "evidenciaId" TEXT NOT NULL,
    "validadorId" TEXT,
    "status" TEXT NOT NULL,
    "parecer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidacaoEvidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoSnapshot" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "autorId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "dataReferencia" TIMESTAMP(3) NOT NULL,
    "fonte" TEXT,
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "importadas" INTEGER NOT NULL DEFAULT 0,
    "conflitos" INTEGER NOT NULL DEFAULT 0,
    "resultado" TEXT NOT NULL DEFAULT 'PENDENTE',
    "mapaCampos" JSONB,
    "log" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoConflito" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "chaveExterna" TEXT NOT NULL,
    "campo" TEXT,
    "valorAtual" TEXT,
    "valorNovo" TEXT,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoConflito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "municipioId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "filtros" JSONB,
    "geradoPorId" TEXT,
    "arquivoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloProjetoCatalogo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloProjetoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloProjeto" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "catalogoOrigemId" TEXT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "classificacoesPermitidas" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloProjeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloPergunta" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tipoResposta" TEXT NOT NULL,
    "impacto" TEXT NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "dependeDePerguntaId" TEXT,
    "dependeDeValor" JSONB,
    "opcoes" JSONB,
    "efeitos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloPergunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeloEstruturaItem" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "parentCodigo" TEXT,
    "nome" TEXT NOT NULL,
    "indicador" TEXT,
    "alvo" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "sempreIncluir" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloEstruturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IniciativaRespostaViabilidade" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "perguntaCodigo" TEXT NOT NULL,
    "perguntaTexto" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "impacto" TEXT NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IniciativaRespostaViabilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IniciativaRespostaHistorico" (
    "id" TEXT NOT NULL,
    "respostaId" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNovo" JSONB NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IniciativaRespostaHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGeradoOrigem" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "metaExecucaoId" TEXT,
    "marcoId" TEXT,
    "subtarefaId" TEXT,
    "perguntaCodigo" TEXT,
    "valorQueGerou" TEXT,
    "modeloEstruturaCodigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemGeradoOrigem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comunicado" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "autorId" TEXT,
    "destinatarioId" TEXT,
    "destinoPapel" TEXT,
    "texto" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'MENSAGEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComunicadoLeitura" (
    "comunicadoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComunicadoLeitura_pkey" PRIMARY KEY ("comunicadoId","userId")
);

-- CreateTable
CREATE TABLE "DependenciaVinculo" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "origemTipo" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "destinoTipo" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'IMPEDITIVA',
    "sentido" TEXT NOT NULL DEFAULT 'ORIGEM_BLOQUEIA_DESTINO',
    "justificativa" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "autorId" TEXT,
    "validadorId" TEXT,
    "validadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DependenciaVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoConhecimento" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "vigencia" TEXT,
    "versao" TEXT,
    "fonte" TEXT,
    "responsavel" TEXT,
    "statusConferencia" TEXT NOT NULL DEFAULT 'PENDENTE',
    "arquivoUrl" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoConhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IniciativaDocumento" (
    "id" TEXT NOT NULL,
    "iniciativaId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'REFERENCIA',

    CONSTRAINT "IniciativaDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SugestaoIA" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT,
    "campo" TEXT,
    "sugestao" TEXT NOT NULL,
    "fonte" TEXT,
    "confianca" TEXT NOT NULL DEFAULT 'BAIXA',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "autorId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SugestaoIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitacaoValidacao" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'REVISAO',
    "justificativa" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoValidacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoValidacao" (
    "id" TEXT NOT NULL,
    "solicitacaoId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "parecer" TEXT NOT NULL,
    "validadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoValidacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "link" TEXT,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SessionToken_token_key" ON "SessionToken"("token");

-- CreateIndex
CREATE INDEX "SessionToken_userId_idx" ON "SessionToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Municipio_ibgeCode_key" ON "Municipio"("ibgeCode");

-- CreateIndex
CREATE INDEX "Municipio_consultorResponsavelId_idx" ON "Municipio"("consultorResponsavelId");

-- CreateIndex
CREATE INDEX "VinculoUsuarioMunicipio_municipioId_idx" ON "VinculoUsuarioMunicipio"("municipioId");

-- CreateIndex
CREATE INDEX "VinculoUsuarioMunicipio_secretariaId_idx" ON "VinculoUsuarioMunicipio"("secretariaId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoUsuarioMunicipio_userId_municipioId_key" ON "VinculoUsuarioMunicipio"("userId", "municipioId");

-- CreateIndex
CREATE INDEX "PlanoGoverno_municipioId_idx" ON "PlanoGoverno"("municipioId");

-- CreateIndex
CREATE INDEX "Secretaria_municipioId_idx" ON "Secretaria"("municipioId");

-- CreateIndex
CREATE UNIQUE INDEX "Secretaria_municipioId_nome_key" ON "Secretaria"("municipioId", "nome");

-- CreateIndex
CREATE INDEX "SecretariaPessoa_secretariaId_idx" ON "SecretariaPessoa"("secretariaId");

-- CreateIndex
CREATE INDEX "SecretariaPessoa_secretariaId_ativo_idx" ON "SecretariaPessoa"("secretariaId", "ativo");

-- CreateIndex
CREATE INDEX "MetaEstrategica_planoId_idx" ON "MetaEstrategica"("planoId");

-- CreateIndex
CREATE INDEX "MetaEstrategica_secretariaId_idx" ON "MetaEstrategica"("secretariaId");

-- CreateIndex
CREATE INDEX "MetaEstrategica_responsavelUserId_idx" ON "MetaEstrategica"("responsavelUserId");

-- CreateIndex
CREATE INDEX "Compromisso_municipioId_idx" ON "Compromisso"("municipioId");

-- CreateIndex
CREATE INDEX "Iniciativa_municipioId_idx" ON "Iniciativa"("municipioId");

-- CreateIndex
CREATE INDEX "Iniciativa_secretariaPrincipalId_idx" ON "Iniciativa"("secretariaPrincipalId");

-- CreateIndex
CREATE INDEX "Iniciativa_ciclo_idx" ON "Iniciativa"("ciclo");

-- CreateIndex
CREATE INDEX "Iniciativa_modeloProjetoId_idx" ON "Iniciativa"("modeloProjetoId");

-- CreateIndex
CREATE INDEX "Iniciativa_responsavelPessoaId_idx" ON "Iniciativa"("responsavelPessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "Iniciativa_municipioId_codigo_key" ON "Iniciativa"("municipioId", "codigo");

-- CreateIndex
CREATE INDEX "MetaExecucao_iniciativaId_idx" ON "MetaExecucao"("iniciativaId");

-- CreateIndex
CREATE INDEX "MetaExecucao_responsavelUserId_idx" ON "MetaExecucao"("responsavelUserId");

-- CreateIndex
CREATE INDEX "Medicao_municipioId_idx" ON "Medicao"("municipioId");

-- CreateIndex
CREATE INDEX "Medicao_indicadorId_dataCorte_idx" ON "Medicao"("indicadorId", "dataCorte");

-- CreateIndex
CREATE INDEX "Medicao_metaEstrategicaId_dataCorte_idx" ON "Medicao"("metaEstrategicaId", "dataCorte");

-- CreateIndex
CREATE INDEX "Medicao_metaExecucaoId_dataCorte_idx" ON "Medicao"("metaExecucaoId", "dataCorte");

-- CreateIndex
CREATE INDEX "Indicador_municipioId_idx" ON "Indicador"("municipioId");

-- CreateIndex
CREATE INDEX "Indicador_metaEstrategicaId_idx" ON "Indicador"("metaEstrategicaId");

-- CreateIndex
CREATE INDEX "Indicador_metaExecucaoId_idx" ON "Indicador"("metaExecucaoId");

-- CreateIndex
CREATE INDEX "Indicador_responsavelUserId_idx" ON "Indicador"("responsavelUserId");

-- CreateIndex
CREATE UNIQUE INDEX "IniciativaSecretaria_iniciativaId_secretariaId_key" ON "IniciativaSecretaria"("iniciativaId", "secretariaId");

-- CreateIndex
CREATE UNIQUE INDEX "IniciativaCompromisso_iniciativaId_compromissoId_key" ON "IniciativaCompromisso"("iniciativaId", "compromissoId");

-- CreateIndex
CREATE INDEX "EquipamentoPublico_municipioId_idx" ON "EquipamentoPublico"("municipioId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipamentoPublico_municipioId_nome_key" ON "EquipamentoPublico"("municipioId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "IniciativaEquipamento_iniciativaId_equipamentoId_key" ON "IniciativaEquipamento"("iniciativaId", "equipamentoId");

-- CreateIndex
CREATE INDEX "MarcoEntrega_iniciativaId_idx" ON "MarcoEntrega"("iniciativaId");

-- CreateIndex
CREATE INDEX "MarcoEntrega_metaExecucaoId_idx" ON "MarcoEntrega"("metaExecucaoId");

-- CreateIndex
CREATE INDEX "MarcoEntrega_prazoVigente_idx" ON "MarcoEntrega"("prazoVigente");

-- CreateIndex
CREATE INDEX "MarcoEntrega_responsavelUserId_idx" ON "MarcoEntrega"("responsavelUserId");

-- CreateIndex
CREATE INDEX "Subtarefa_marcoId_idx" ON "Subtarefa"("marcoId");

-- CreateIndex
CREATE INDEX "Subtarefa_responsavelUserId_idx" ON "Subtarefa"("responsavelUserId");

-- CreateIndex
CREATE INDEX "Reprogramacao_marcoId_idx" ON "Reprogramacao"("marcoId");

-- CreateIndex
CREATE UNIQUE INDEX "TipoVerificacao_codigo_key" ON "TipoVerificacao"("codigo");

-- CreateIndex
CREATE INDEX "Verificacao_iniciativaId_idx" ON "Verificacao"("iniciativaId");

-- CreateIndex
CREATE UNIQUE INDEX "Verificacao_iniciativaId_tipoVerificacaoId_key" ON "Verificacao"("iniciativaId", "tipoVerificacaoId");

-- CreateIndex
CREATE INDEX "Impedimento_iniciativaId_idx" ON "Impedimento"("iniciativaId");

-- CreateIndex
CREATE INDEX "Impedimento_status_idx" ON "Impedimento"("status");

-- CreateIndex
CREATE INDEX "DecisaoProvidencia_iniciativaId_idx" ON "DecisaoProvidencia"("iniciativaId");

-- CreateIndex
CREATE INDEX "Evidencia_iniciativaId_idx" ON "Evidencia"("iniciativaId");

-- CreateIndex
CREATE INDEX "Evidencia_status_idx" ON "Evidencia"("status");

-- CreateIndex
CREATE INDEX "ValidacaoEvidencia_evidenciaId_idx" ON "ValidacaoEvidencia"("evidenciaId");

-- CreateIndex
CREATE INDEX "ImportacaoSnapshot_municipioId_idx" ON "ImportacaoSnapshot"("municipioId");

-- CreateIndex
CREATE INDEX "ImportacaoConflito_importacaoId_idx" ON "ImportacaoConflito"("importacaoId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_municipioId_idx" ON "AuditLog"("municipioId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Relatorio_municipioId_idx" ON "Relatorio"("municipioId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloProjetoCatalogo_codigo_key" ON "ModeloProjetoCatalogo"("codigo");

-- CreateIndex
CREATE INDEX "ModeloProjeto_municipioId_idx" ON "ModeloProjeto"("municipioId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloProjeto_municipioId_codigo_key" ON "ModeloProjeto"("municipioId", "codigo");

-- CreateIndex
CREATE INDEX "ModeloPergunta_modeloId_idx" ON "ModeloPergunta"("modeloId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloPergunta_modeloId_codigo_key" ON "ModeloPergunta"("modeloId", "codigo");

-- CreateIndex
CREATE INDEX "ModeloEstruturaItem_modeloId_idx" ON "ModeloEstruturaItem"("modeloId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeloEstruturaItem_modeloId_codigo_key" ON "ModeloEstruturaItem"("modeloId", "codigo");

-- CreateIndex
CREATE INDEX "IniciativaRespostaViabilidade_iniciativaId_idx" ON "IniciativaRespostaViabilidade"("iniciativaId");

-- CreateIndex
CREATE UNIQUE INDEX "IniciativaRespostaViabilidade_iniciativaId_perguntaCodigo_key" ON "IniciativaRespostaViabilidade"("iniciativaId", "perguntaCodigo");

-- CreateIndex
CREATE INDEX "IniciativaRespostaHistorico_respostaId_idx" ON "IniciativaRespostaHistorico"("respostaId");

-- CreateIndex
CREATE INDEX "ItemGeradoOrigem_iniciativaId_idx" ON "ItemGeradoOrigem"("iniciativaId");

-- CreateIndex
CREATE INDEX "Comunicado_iniciativaId_createdAt_idx" ON "Comunicado"("iniciativaId", "createdAt");

-- CreateIndex
CREATE INDEX "Comunicado_destinatarioId_idx" ON "Comunicado"("destinatarioId");

-- CreateIndex
CREATE INDEX "DependenciaVinculo_municipioId_idx" ON "DependenciaVinculo"("municipioId");

-- CreateIndex
CREATE INDEX "DependenciaVinculo_origemTipo_origemId_idx" ON "DependenciaVinculo"("origemTipo", "origemId");

-- CreateIndex
CREATE INDEX "DependenciaVinculo_destinoTipo_destinoId_idx" ON "DependenciaVinculo"("destinoTipo", "destinoId");

-- CreateIndex
CREATE INDEX "DependenciaVinculo_status_idx" ON "DependenciaVinculo"("status");

-- CreateIndex
CREATE INDEX "DocumentoConhecimento_municipioId_tipo_idx" ON "DocumentoConhecimento"("municipioId", "tipo");

-- CreateIndex
CREATE INDEX "DocumentoConhecimento_statusConferencia_idx" ON "DocumentoConhecimento"("statusConferencia");

-- CreateIndex
CREATE UNIQUE INDEX "IniciativaDocumento_iniciativaId_documentoId_key" ON "IniciativaDocumento"("iniciativaId", "documentoId");

-- CreateIndex
CREATE INDEX "SugestaoIA_municipioId_status_idx" ON "SugestaoIA"("municipioId", "status");

-- CreateIndex
CREATE INDEX "SugestaoIA_entidadeTipo_entidadeId_idx" ON "SugestaoIA"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "SolicitacaoValidacao_municipioId_status_idx" ON "SolicitacaoValidacao"("municipioId", "status");

-- CreateIndex
CREATE INDEX "SolicitacaoValidacao_entidadeTipo_entidadeId_idx" ON "SolicitacaoValidacao"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "DecisaoValidacao_solicitacaoId_idx" ON "DecisaoValidacao"("solicitacaoId");

-- CreateIndex
CREATE INDEX "Notificacao_userId_municipioId_lidaEm_idx" ON "Notificacao"("userId", "municipioId", "lidaEm");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionToken" ADD CONSTRAINT "SessionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_consultorResponsavelId_fkey" FOREIGN KEY ("consultorResponsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuarioMunicipio" ADD CONSTRAINT "VinculoUsuarioMunicipio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuarioMunicipio" ADD CONSTRAINT "VinculoUsuarioMunicipio_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinculoUsuarioMunicipio" ADD CONSTRAINT "VinculoUsuarioMunicipio_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoGoverno" ADD CONSTRAINT "PlanoGoverno_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secretaria" ADD CONSTRAINT "Secretaria_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretariaPessoa" ADD CONSTRAINT "SecretariaPessoa_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEstrategica" ADD CONSTRAINT "MetaEstrategica_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoGoverno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEstrategica" ADD CONSTRAINT "MetaEstrategica_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEstrategica" ADD CONSTRAINT "MetaEstrategica_responsavelUserId_fkey" FOREIGN KEY ("responsavelUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iniciativa" ADD CONSTRAINT "Iniciativa_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iniciativa" ADD CONSTRAINT "Iniciativa_secretariaPrincipalId_fkey" FOREIGN KEY ("secretariaPrincipalId") REFERENCES "Secretaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iniciativa" ADD CONSTRAINT "Iniciativa_metaEstrategicaId_fkey" FOREIGN KEY ("metaEstrategicaId") REFERENCES "MetaEstrategica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iniciativa" ADD CONSTRAINT "Iniciativa_modeloProjetoId_fkey" FOREIGN KEY ("modeloProjetoId") REFERENCES "ModeloProjeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iniciativa" ADD CONSTRAINT "Iniciativa_responsavelPessoaId_fkey" FOREIGN KEY ("responsavelPessoaId") REFERENCES "SecretariaPessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaExecucao" ADD CONSTRAINT "MetaExecucao_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaExecucao" ADD CONSTRAINT "MetaExecucao_responsavelUserId_fkey" FOREIGN KEY ("responsavelUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_metaEstrategicaId_fkey" FOREIGN KEY ("metaEstrategicaId") REFERENCES "MetaEstrategica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_metaExecucaoId_fkey" FOREIGN KEY ("metaExecucaoId") REFERENCES "MetaExecucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "Indicador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicador" ADD CONSTRAINT "Indicador_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicador" ADD CONSTRAINT "Indicador_metaEstrategicaId_fkey" FOREIGN KEY ("metaEstrategicaId") REFERENCES "MetaEstrategica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicador" ADD CONSTRAINT "Indicador_metaExecucaoId_fkey" FOREIGN KEY ("metaExecucaoId") REFERENCES "MetaExecucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicador" ADD CONSTRAINT "Indicador_responsavelUserId_fkey" FOREIGN KEY ("responsavelUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaSecretaria" ADD CONSTRAINT "IniciativaSecretaria_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaSecretaria" ADD CONSTRAINT "IniciativaSecretaria_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaCompromisso" ADD CONSTRAINT "IniciativaCompromisso_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaCompromisso" ADD CONSTRAINT "IniciativaCompromisso_compromissoId_fkey" FOREIGN KEY ("compromissoId") REFERENCES "Compromisso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipamentoPublico" ADD CONSTRAINT "EquipamentoPublico_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaEquipamento" ADD CONSTRAINT "IniciativaEquipamento_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaEquipamento" ADD CONSTRAINT "IniciativaEquipamento_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "EquipamentoPublico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarcoEntrega" ADD CONSTRAINT "MarcoEntrega_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarcoEntrega" ADD CONSTRAINT "MarcoEntrega_metaExecucaoId_fkey" FOREIGN KEY ("metaExecucaoId") REFERENCES "MetaExecucao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarcoEntrega" ADD CONSTRAINT "MarcoEntrega_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "EquipamentoPublico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarcoEntrega" ADD CONSTRAINT "MarcoEntrega_responsavelUserId_fkey" FOREIGN KEY ("responsavelUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtarefa" ADD CONSTRAINT "Subtarefa_marcoId_fkey" FOREIGN KEY ("marcoId") REFERENCES "MarcoEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtarefa" ADD CONSTRAINT "Subtarefa_responsavelUserId_fkey" FOREIGN KEY ("responsavelUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reprogramacao" ADD CONSTRAINT "Reprogramacao_marcoId_fkey" FOREIGN KEY ("marcoId") REFERENCES "MarcoEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reprogramacao" ADD CONSTRAINT "Reprogramacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verificacao" ADD CONSTRAINT "Verificacao_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verificacao" ADD CONSTRAINT "Verificacao_tipoVerificacaoId_fkey" FOREIGN KEY ("tipoVerificacaoId") REFERENCES "TipoVerificacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impedimento" ADD CONSTRAINT "Impedimento_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impedimento" ADD CONSTRAINT "Impedimento_marcoId_fkey" FOREIGN KEY ("marcoId") REFERENCES "MarcoEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoProvidencia" ADD CONSTRAINT "DecisaoProvidencia_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoProvidencia" ADD CONSTRAINT "DecisaoProvidencia_impedimentoId_fkey" FOREIGN KEY ("impedimentoId") REFERENCES "Impedimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoProvidencia" ADD CONSTRAINT "DecisaoProvidencia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_marcoId_fkey" FOREIGN KEY ("marcoId") REFERENCES "MarcoEntrega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidacaoEvidencia" ADD CONSTRAINT "ValidacaoEvidencia_evidenciaId_fkey" FOREIGN KEY ("evidenciaId") REFERENCES "Evidencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidacaoEvidencia" ADD CONSTRAINT "ValidacaoEvidencia_validadorId_fkey" FOREIGN KEY ("validadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoSnapshot" ADD CONSTRAINT "ImportacaoSnapshot_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoSnapshot" ADD CONSTRAINT "ImportacaoSnapshot_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoConflito" ADD CONSTRAINT "ImportacaoConflito_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloProjeto" ADD CONSTRAINT "ModeloProjeto_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloProjeto" ADD CONSTRAINT "ModeloProjeto_catalogoOrigemId_fkey" FOREIGN KEY ("catalogoOrigemId") REFERENCES "ModeloProjetoCatalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloPergunta" ADD CONSTRAINT "ModeloPergunta_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloPergunta" ADD CONSTRAINT "ModeloPergunta_dependeDePerguntaId_fkey" FOREIGN KEY ("dependeDePerguntaId") REFERENCES "ModeloPergunta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeloEstruturaItem" ADD CONSTRAINT "ModeloEstruturaItem_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ModeloProjeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaRespostaViabilidade" ADD CONSTRAINT "IniciativaRespostaViabilidade_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaRespostaHistorico" ADD CONSTRAINT "IniciativaRespostaHistorico_respostaId_fkey" FOREIGN KEY ("respostaId") REFERENCES "IniciativaRespostaViabilidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGeradoOrigem" ADD CONSTRAINT "ItemGeradoOrigem_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "Comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicadoLeitura" ADD CONSTRAINT "ComunicadoLeitura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependenciaVinculo" ADD CONSTRAINT "DependenciaVinculo_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependenciaVinculo" ADD CONSTRAINT "DependenciaVinculo_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependenciaVinculo" ADD CONSTRAINT "DependenciaVinculo_validadorId_fkey" FOREIGN KEY ("validadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoConhecimento" ADD CONSTRAINT "DocumentoConhecimento_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaDocumento" ADD CONSTRAINT "IniciativaDocumento_iniciativaId_fkey" FOREIGN KEY ("iniciativaId") REFERENCES "Iniciativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IniciativaDocumento" ADD CONSTRAINT "IniciativaDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoConhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoValidacao" ADD CONSTRAINT "SolicitacaoValidacao_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoValidacao" ADD CONSTRAINT "SolicitacaoValidacao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoValidacao" ADD CONSTRAINT "DecisaoValidacao_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "SolicitacaoValidacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoValidacao" ADD CONSTRAINT "DecisaoValidacao_validadorId_fkey" FOREIGN KEY ("validadorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
