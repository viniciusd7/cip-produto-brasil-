export type CarretasCampo = {
  codigo: string;
  grupo: string;
  rotulo: string;
  ajuda: string;
  tipo?: "date" | "textarea";
};

export const CARRETAS_FICHA_CAMPOS: CarretasCampo[] = [
  { codigo: "statusValidacao", grupo: "Identificação local", rotulo: "Situação da validação", ajuda: "Registre o estágio de decisão local. O cadastro não autoriza atendimento." },
  { codigo: "territorio", grupo: "Identificação local", rotulo: "Município, região ou território", ajuda: "Preencher após confirmar qual território integra o piloto." },
  { codigo: "unidadeReferencia", grupo: "Identificação local", rotulo: "Estabelecimento de referência", ajuda: "UBS, distrito ou unidade responsável pela coordenação local." },
  { codigo: "especialidade", grupo: "Oferta e capacidade", rotulo: "Especialidade e procedimentos", ajuda: "Somente oferta confirmada e compatível com autorização e capacidade." },
  { codigo: "modalidade", grupo: "Oferta e capacidade", rotulo: "Modalidade ou tipologia da unidade móvel", ajuda: "A definir com a oferta efetivamente pactuada." },
  { codigo: "unidadeMovel", grupo: "Oferta e capacidade", rotulo: "Unidade móvel e prestador", ajuda: "Identificação do prestador/veículo conforme documento de origem." },
  { codigo: "responsavelTecnico", grupo: "Oferta e capacidade", rotulo: "Responsável técnico", ajuda: "Função e identificação validadas pelo prestador e autoridade competente." },
  { codigo: "janelaOperacao", grupo: "Oferta e capacidade", rotulo: "Período ou janela de operação", ajuda: "Não assumir disponibilidade ou duração antes da pactuação." },
  { codigo: "dataD0", grupo: "Oferta e capacidade", rotulo: "D0 — início pactuado", ajuda: "A referência define o cronograma relativamente a D0; sem data confirmada, deixe vazio.", tipo: "date" },
  { codigo: "capacidadeOferta", grupo: "Oferta e capacidade", rotulo: "Capacidade e vagas operacionais", ajuda: "Informar quantidade, unidade de análise e fonte; não estimar sem validação." },
  { codigo: "localInstalacao", grupo: "Prontidão e logística", rotulo: "Local e condições de instalação", ajuda: "Endereço/local, energia, água, resíduos, segurança e limpeza, conforme aplicável." },
  { codigo: "acessibilidade", grupo: "Prontidão e logística", rotulo: "Acessibilidade e mobilidade", ajuda: "Rotas, acessibilidade, transporte e apoio pactuados localmente." },
  { codigo: "equipeSubstitutos", grupo: "Prontidão e logística", rotulo: "Equipe, escala e substitutos", ajuda: "Funções, cobertura, treinamento e contingência; nomes dependem de designação." },
  { codigo: "fonteAgenda", grupo: "Regulação e continuidade", rotulo: "Sistema oficial e fonte da agenda", ajuda: "O sistema oficial prevalece; planilha auxiliar não o substitui." },
  { codigo: "criteriosRegulacao", grupo: "Regulação e continuidade", rotulo: "Critérios e autoridade de regulação", ajuda: "Prioridade, elegibilidade, cancelamento e reposição devem ser pactuados." },
  { codigo: "referenciaAssistencial", grupo: "Regulação e continuidade", rotulo: "Retaguarda e referência clínica", ajuda: "Serviço/equipe que recebe intercorrências, exames e casos não concluídos." },
  { codigo: "fluxoContrarreferencia", grupo: "Regulação e continuidade", rotulo: "Fluxo de continuidade e aceite", ajuda: "Definir como a rede recebe, aceita e acompanha pendências após a operação." },
  { codigo: "autorizacaoGestor", grupo: "Governança e decisão", rotulo: "Ato de abertura e autoridade decisora", ajuda: "Documento, instância competente, alçadas e signatários locais." },
  { codigo: "pactuacaoRegional", grupo: "Governança e decisão", rotulo: "Pactuação regional ou cooperação", ajuda: "Registrar instrumento e partes, quando aplicável; caso contrário, justificar." },
  { codigo: "alternativaRede", grupo: "Governança e decisão", rotulo: "Alternativas consideradas", ajuda: "Comparar oferta móvel com fortalecimento da rede permanente e outras alternativas." },
  { codigo: "vigilanciaSanitaria", grupo: "Autorizações e conformidade", rotulo: "Verificação sanitária e licenças", ajuda: "Órgão competente, aplicabilidade, documentos e validade a confirmar." },
  { codigo: "escopoLegalSUS", grupo: "Autorizações e conformidade", rotulo: "Normas SUS e escopo assistencial", ajuda: "Identificar normas vigentes aplicáveis e validação por autoridade competente." },
  { codigo: "contratacao14133", grupo: "Autorizações e conformidade", rotulo: "Contratação e Lei nº 14.133/2021", ajuda: "A aplicabilidade e a instrução do processo dependem de análise jurídica local." },
  { codigo: "protecaoDados", grupo: "Dados e comunicação", rotulo: "Proteção de dados e papéis", ajuda: "Controlador, operadores, perfis mínimos, canal seguro, retenção e resposta a incidentes." },
  { codigo: "sistemasDados", grupo: "Dados e comunicação", rotulo: "Sistemas, fontes e data de corte", ajuda: "Registrar origem, versão, data de corte e responsável pela conferência." },
  { codigo: "comunicacaoPublica", grupo: "Dados e comunicação", rotulo: "Comunicação pública e canais", ajuda: "Divulgar somente escopo real, acesso oficial, limitações e resultados agregados." },
  { codigo: "custosRecursos", grupo: "Orçamento e recursos", rotulo: "Fontes, pagadores e recursos", ajuda: "Detalhar responsabilidades e custos incrementais; ausência de cobrança pelo veículo não significa custo municipal zero." },
  { codigo: "criteriosParada", grupo: "Decisão e encerramento", rotulo: "Critérios de parada e suspensão", ajuda: "Autoridade competente, gatilhos, proteção imediata e condição documentada para retomada." },
  { codigo: "criteriosEncerramento", grupo: "Decisão e encerramento", rotulo: "Critérios de encerramento e escala", ajuda: "Definir condições para corrigir, repetir, suspender, encerrar ou ampliar." },
  { codigo: "observacoesLocais", grupo: "Decisão e encerramento", rotulo: "Perguntas e observações para validação", ajuda: "Use para registrar decisões pendentes e a quem cabe respondê-las.", tipo: "textarea" },
];

export const CARRETAS_GATES = [
  {
    codigo: "G0",
    nome: "Pertinência e decisão",
    responsaveis: "Gestão municipal e regulação; consulta regional quando aplicável.",
    criterioBloqueio: "Sem oferta legítima ou fila elegível, não abrir o projeto.",
    criterios: [
      ["demanda", "Demanda e fila oficial validadas"],
      ["oferta", "Oferta e capacidade confirmadas"],
      ["escopo", "Escopo, origem dos recursos e alternativa definidos"],
      ["autoridade", "Autoridades, alçadas e pactuação identificadas"],
    ],
  },
  {
    codigo: "G1",
    nome: "Prontidão operacional",
    responsaveis: "Coordenação, administração, prestador e vigilância sanitária quando competente.",
    criterioBloqueio: "Sem infraestrutura ou autorizações necessárias, não instalar nem iniciar.",
    criterios: [
      ["local", "Local, energia, água, resíduos, limpeza e segurança verificados"],
      ["acesso", "Rotas, acessibilidade e mobilidade planejadas"],
      ["equipe", "Equipe, substitutos, treinamento e escala confirmados"],
      ["recursos", "Orçamento, recursos e contingência documentados"],
      ["dados", "Prontidão de dados, perfis e canais verificada"],
    ],
  },
  {
    codigo: "G2",
    nome: "Segurança e continuidade",
    responsaveis: "Responsável técnico, referência clínica, APS e regulação.",
    criterioBloqueio: "Sem retaguarda e plano de transferência, bloquear procedimentos.",
    criterios: [
      ["responsavel-tecnico", "Responsável técnico e protocolos confirmados"],
      ["intercorrencias", "Intercorrências, urgência e suspensão pactuadas"],
      ["retaguarda", "Retaguarda e destino de resultados/retornos definidos"],
      ["aceite", "Contrarreferência e aceite da equipe receptora planejados"],
    ],
  },
  {
    codigo: "G3",
    nome: "Agenda e acesso",
    responsaveis: "Regulação, coordenação e APS.",
    criterioBloqueio: "Erros não resolvidos impedem convocação ou atendimento dos registros afetados.",
    criterios: [
      ["agenda", "Fila e agenda oficial reconciliadas"],
      ["acessibilidade", "Acessibilidade e canais de contato testados"],
      ["cancelamento", "Cancelamento, remarcação e reposição definidos"],
      ["ensaio", "Teste de mesa e exceções concluídos"],
    ],
  },
  {
    codigo: "G4",
    nome: "Encerramento responsável",
    responsaveis: "Gestão, referência clínica, prestador e monitoramento.",
    criterioBloqueio: "Sem transferência formal, não declarar encerramento assistencial.",
    criterios: [
      ["producao", "Produção conciliada com a fonte oficial"],
      ["pendencias", "Pendências e seguimentos com aceite registrados"],
      ["materiais", "Materiais rastreados até a entrega final ou pendência"],
      ["custos", "Custos, fontes e incidentes registrados"],
      ["relatorio", "Avaliação, evidências e decisão final aprovadas"],
    ],
  },
] as const;

export const CARRETAS_ETAPAS = [
  { codigo: "decidir", nome: "Decidir e pactuar", dependencia: "G0; ato de designação, demanda e oferta validadas." },
  { codigo: "planejar", nome: "Planejar e preparar", dependencia: "G1; infraestrutura, equipe, recursos e contingência." },
  { codigo: "qualificar", nome: "Qualificar a demanda", dependencia: "Fila oficial versionada, critérios e prioridades validados." },
  { codigo: "agenda", nome: "Preparar agenda e usuários", dependencia: "G3; agenda conciliada, contatos e cancelamentos testados." },
  { codigo: "executar", nome: "Executar e ajustar", dependencia: "Conciliação operacional, segurança e ações corretivas." },
  { codigo: "continuar", nome: "Garantir continuidade", dependencia: "Resultados, retornos e pendências com destinatário e aceite." },
  { codigo: "encerrar", nome: "Encerrar e aprender", dependencia: "G4; prestação de contas, evidências e plano de melhoria." },
] as const;

export const CARRETAS_ORCAMENTO = [
  { codigo: "equipe", categoria: "Equipe e coordenação", memoria: "Horas efetivas × custo-hora, se houver custo incremental; considerar substituições.", responsavelFuncional: "Gestão de pessoas e financeiro" },
  { codigo: "comunicacao", categoria: "Comunicação e busca ativa", memoria: "Telefonia, treinamento, materiais acessíveis e deslocamentos.", responsavelFuncional: "Coordenação territorial" },
  { codigo: "infraestrutura", categoria: "Infraestrutura local", memoria: "Adequações, energia, água, acessibilidade, segurança, limpeza e descarte.", responsavelFuncional: "Administração e infraestrutura" },
  { codigo: "mobilidade", categoria: "Apoio à mobilidade", memoria: "Transporte sanitário, rotas e acompanhantes conforme necessidade.", responsavelFuncional: "Transporte e APS" },
  { codigo: "retaguarda", categoria: "Retaguarda e continuidade", memoria: "Consultas, exames complementares, retornos e encaminhamentos não abrangidos.", responsavelFuncional: "Regulação e rede assistencial" },
  { codigo: "tecnologia", categoria: "Tecnologia e informação", memoria: "Sistemas, equipamentos, suporte, segurança e guarda documental.", responsavelFuncional: "TI e gestão da informação" },
  { codigo: "contratacao", categoria: "Contratação, fiscalização e riscos", memoria: "Escopo contratado, fiscalização e contingências permitidas.", responsavelFuncional: "Compras, jurídico e finanças" },
] as const;

export const CARRETAS_RISCOS = [
  { codigo: "R01", nome: "Demanda incompatível", prevencao: "Validar fila oficial, indicação, prioridade, capacidade efetiva e retaguarda.", gatilho: "Vagas sem elegíveis ou duplicidades relevantes.", resposta: "Não abrir agenda afetada; corrigir com regulação e responsável clínico.", responsavel: "REG" },
  { codigo: "R02", nome: "Governança ambígua", prevencao: "Formalizar cooperação, matriz de responsabilidades, suspensão, regulação e custeio.", gatilho: "Atribuição contestada ou execução sem alçada.", resposta: "Congelar a decisão afetada e escalar ao gestor municipal.", responsavel: "GEST" },
  { codigo: "R03", nome: "Agenda inconsistente", prevencao: "Usar sistema oficial, identificador único, histórico e conciliação diária.", gatilho: "Divergência de pessoa, procedimento ou status.", resposta: "Bloquear o registro afetado, corrigir na fonte e confirmar com segurança.", responsavel: "REG" },
  { codigo: "R04", nome: "Exclusão de usuários", prevencao: "Planejar contato institucional acessível, apoio territorial e mobilidade pactuada.", gatilho: "Baixa contatabilidade ou barreiras recorrentes por território/grupo.", resposta: "Reforçar busca ativa acessível sem alterar prioridade regulatória.", responsavel: "APS" },
  { codigo: "R05", nome: "Falha clínica ou sanitária", prevencao: "Verificar responsável técnico, recursos, medidas sanitárias, urgência e retaguarda.", gatilho: "Não conformidade crítica ou evento adverso relevante.", resposta: "Suspender procedimento afetado, proteger usuários e acionar protocolos/autoridade.", responsavel: "RT / VISA" },
  { codigo: "R06", nome: "Cuidado interrompido", prevencao: "Definir destino de contrarreferência e acompanhar casos pendentes desde G2.", gatilho: "Resultado/retorno sem responsável ou transferência sem aceite.", resposta: "Manter pendência, acionar APS/regulação e escalonar conforme risco clínico.", responsavel: "APS / CLÍN" },
  { codigo: "R07", nome: "Sobrecarga da APS", prevencao: "Planejar horas, cobertura, substituições, treinamento e escala.", gatilho: "Perda de cobertura essencial ou dependência de horas extraordinárias.", resposta: "Redistribuir, reduzir ritmo e recompor equipe antes de ampliar.", responsavel: "GEST / APS" },
  { codigo: "R08", nome: "Custo oculto", prevencao: "Mapear pagadores, custos incrementais, retaguarda, transporte e encerramento.", gatilho: "Obrigação sem fonte ou ultrapassagem do limite aprovado.", resposta: "Contingenciar etapa não clínica, reprogramar ou submeter decisão ao gestor.", responsavel: "FIN" },
  { codigo: "R09", nome: "Privacidade violada", prevencao: "Aplicar perfis mínimos, acesso auditável, canal seguro e treinamento.", gatilho: "Link público, envio indevido ou perda de dispositivo.", resposta: "Conter exposição e acionar encarregado/segurança conforme plano institucional.", responsavel: "DADOS" },
  { codigo: "R10", nome: "Indicador ilusório", prevencao: "Documentar numerador, denominador, corte, fonte e conferência.", gatilho: "Indicador sem fonte, quebra de série ou divulgação só de produção.", resposta: "Suspender divulgação afetada, auditar e republicar com nota metodológica.", responsavel: "MON" },
  { codigo: "R11", nome: "Item sem entrega final", prevencao: "Rastrear item, custodiante, transferências e recebimento final.", gatilho: "Divergência de itens ou entrega somente à UBS.", resposta: "Rastrear destinatário, corrigir registro e apurar eventual extravio.", responsavel: "LOG / APS" },
  { codigo: "R12", nome: "Dependência de força-tarefa", prevencao: "Documentar POP, designar substitutos, capacitar equipe e ensaiar operação.", gatilho: "Função crítica concentrada ou operação falha sem voluntariado.", resposta: "Reforçar estrutura e reprogramar antes de ampliar.", responsavel: "COORD" },
] as const;

export const CARRETAS_INDICADORES = [
  { codigo: "fila-compativel", nome: "Fila compatível", formula: "Solicitações elegíveis e validadas ÷ vagas programadas.", cautela: "Analisar especialidade e prioridade; sem elegíveis, revisar oferta/agenda.", responsavel: "REG" },
  { codigo: "contatabilidade", nome: "Contatabilidade", formula: "Pessoas com contato efetivo ÷ pessoas convocadas × 100.", cautela: "Tentativa não é contato efetivo; definir duplicidades.", responsavel: "APS" },
  { codigo: "confirmacao", nome: "Confirmação", formula: "Agendamentos confirmados ÷ agendamentos válidos convocados × 100.", cautela: "Estratificar por origem e barreiras de acesso.", responsavel: "COORD" },
  { codigo: "absenteismo-geral", nome: "Absenteísmo geral", formula: "Faltas ÷ agendamentos válidos na data × 100.", cautela: "Definir tratamento de cancelamentos tempestivos.", responsavel: "MON" },
  { codigo: "absenteismo-confirmados", nome: "Absenteísmo entre confirmados", formula: "Faltas de confirmados ÷ confirmações válidas × 100.", cautela: "O relato de 18% de Contagem é declarado e não auditado; não usar como meta.", responsavel: "MON" },
  { codigo: "ocupacao", nome: "Ocupação efetiva", formula: "Atendimentos realizados ÷ vagas ofertadas e operacionais × 100.", cautela: "Não equivale a efeito clínico ou qualidade.", responsavel: "MON" },
  { codigo: "reaproveitamento", nome: "Vagas reaproveitadas", formula: "Vagas liberadas elegíveis e preenchidas ÷ vagas liberadas elegíveis × 100.", cautela: "Registrar horário e janela operacional.", responsavel: "REG" },
  { codigo: "espera", nome: "Tempo de espera", formula: "Mediana de dias entre solicitação válida e atendimento.", cautela: "Estratificar por prioridade e população; não atribuir causalidade sem desenho avaliativo.", responsavel: "MON" },
  { codigo: "conciliacao-agenda", nome: "Conciliação da agenda", formula: "Registros sem divergência crítica ÷ registros conciliados.", cautela: "Divergência crítica aberta bloqueia o registro afetado.", responsavel: "REG" },
  { codigo: "seguimento", nome: "Seguimento documentado", formula: "Casos com seguimento necessário e destino confirmado ÷ casos com seguimento necessário × 100.", cautela: "Encaminhar não é igual a receber cuidado.", responsavel: "APS / CLÍN" },
  { codigo: "contrarreferencia", nome: "Contrarreferência aceita", formula: "Casos com seguimento e aceite ÷ casos com seguimento necessário.", cautela: "Caso sem destino exige escalonamento clínico.", responsavel: "APS / CLÍN" },
  { codigo: "pendencias-vencidas", nome: "Pendências clínicas vencidas", formula: "Pendências além do prazo clínico ÷ pendências de seguimento.", cautela: "Prazos clínicos são definidos localmente por autoridade competente.", responsavel: "CLÍN" },
  { codigo: "equidade", nome: "Equidade territorial", formula: "Diferença de contato, presença e conclusão entre territórios/grupos.", cautela: "Investigar barreiras; não alterar fila informalmente nem divulgar células pequenas.", responsavel: "MON / APS" },
  { codigo: "custo-incremental", nome: "Custo incremental total", formula: "Soma das despesas adicionais comprovadas, segregadas por fonte/pagador.", cautela: "Evitar dupla contagem e separar custos já cobertos.", responsavel: "FIN" },
  { codigo: "custo-percurso", nome: "Custo por percurso concluído", formula: "Custo incremental atribuível ÷ percursos com conclusão documentada.", cautela: "Explicitar a regra de conclusão e não comparar modalidades distintas.", responsavel: "FIN / MON" },
  { codigo: "itens-entregues", nome: "Itens entregues ao usuário", formula: "Itens com recibo final ÷ itens destinados a usuários.", cautela: "Recebimento pela UBS não equivale à entrega final ao usuário.", responsavel: "LOG" },
] as const;

export const CARRETAS_POPS = [
  { codigo: "POP-01", nome: "Integridade da fila e compatibilidade da oferta", entrada: "Solicitações oficiais, capacidade e protocolos aplicáveis.", checagem: "Duplicidade, pertinência, prioridade, território e restrições.", decisao: "Regulação homologa lista versionada e separa pendências.", registro: "ID, data de corte, versão e responsável.", saida: "Agenda apta para convocação.", excecao: "Discrepância clínica/prioridade suspende o agendamento afetado." },
  { codigo: "POP-02", nome: "Convocação, confirmação e equidade", entrada: "Agenda homologada e referência territorial.", checagem: "Canal institucional, identidade, acessibilidade e deslocamento.", decisao: "Confirmar, remarcar, registrar desistência ou manter busca ativa.", registro: "Tentativas, canal e resultado, sem diagnóstico em mensagem aberta.", saida: "Orientação compreendida pelo usuário.", excecao: "Acionar UBS/ACS e rota acessível homologada." },
  { codigo: "POP-03", nome: "Cancelamento, remarcação e reposição", entrada: "Ocorrência classificada na unidade.", checagem: "Motivo, identidade, autoridade e fila única.", decisao: "Perfil autorizado altera status no sistema oficial.", registro: "Protocolo, hora, executor, versão e comunicação.", saida: "Sistema, apoio e prestador conciliados.", excecao: "Divergência bloqueia registro e gera ocorrência rastreável." },
  { codigo: "POP-04", nome: "Prontidão sanitária e atendimento seguro", entrada: "Documentos, vistoria aplicável, recursos, pessoal e fluxos.", checagem: "Prontidão pelo RT, identidade/indicação e contingência.", decisao: "Liberar ou suspender o procedimento afetado.", registro: "Checklist, não conformidade, orientação e liberação.", saida: "Atividade liberada com evidência aplicável.", excecao: "Evento crítico aciona plano assistencial e autoridade." },
  { codigo: "POP-05", nome: "Navegação do cuidado e contrarreferência", entrada: "Resultado clínico do atendimento.", checagem: "Laudo, tratamento, retorno, risco e destino.", decisao: "Equipe habilitada define conduta; rede recebe plano protegido.", registro: "Envio, destinatário, aceite, agenda e situação.", saida: "Caso concluído ou seguimento assumido.", excecao: "Sem aceite, manter pendência e escalonar clinicamente." },
  { codigo: "POP-06", nome: "Controle e entrega de produtos", entrada: "Relação de itens e destinatários sob acesso restrito.", checagem: "Item, quantidade, integridade e custódia.", decisao: "Entregar ao destinatário ou manter pendência documentada.", registro: "Transferências e recibo de entrega final.", saida: "Entrega final comprovada ou pendência atribuída.", excecao: "Divergência/extravio bloqueia o item e inicia apuração." },
  { codigo: "POP-07", nome: "Proteção de dados e incidentes", entrada: "Solicitação de acesso, compartilhamento ou incidente.", checagem: "Finalidade, necessidade, perfil, canal e base legal.", decisao: "Conceder acesso mínimo autorizado ou conter exposição.", registro: "Permissões, retenção e incidentes.", saida: "Uso controlado e auditável.", excecao: "Acionar plano institucional e encarregado." },
  { codigo: "POP-08", nome: "Reunião de situação e melhoria", entrada: "Painel, divergências, reclamações, riscos e custos.", checagem: "Qualidade, prioridade clínica e incidentes.", decisao: "Corrigir dentro da alçada ou escalar risco crítico.", registro: "Ata/ID, responsável, prazo pactuado e evidência.", saida: "Pendência encerrada ou escalada.", excecao: "Item não resolvido permanece no painel." },
] as const;

export const CARRETAS_PRESTACAO = [
  { codigo: "decisao", nome: "Decisão e governança", criterio: "Ato de abertura, pactuações, alçadas e decisões G0–G4." },
  { codigo: "oferta", nome: "Oferta e agenda", criterio: "Fonte oficial, versões, conciliações e alterações autorizadas." },
  { codigo: "execucao", nome: "Execução e continuidade", criterio: "Produção agregada, pendências, transferência e aceites." },
  { codigo: "financeiro", nome: "Orçamento e pagamentos", criterio: "Memória de cálculo, pagador/fonte, comprovantes e reconciliação." },
  { codigo: "seguranca", nome: "Segurança e incidentes", criterio: "Prontidão, desvios, suspensão, correção e liberação." },
  { codigo: "materiais", nome: "Materiais e entrega final", criterio: "Custódia, transferências, recibos e pendências." },
  { codigo: "indicadores", nome: "Indicadores e avaliação", criterio: "Dicionário, fontes, cortes, auditoria, limitações e decisão do piloto." },
  { codigo: "comunicacao", nome: "Comunicação e controle social", criterio: "Escopo real, canais oficiais, ouvidoria e resultados agregados." },
] as const;

export function criarCarretasDossiePadrao() {
  return {
    versao: 1 as const,
    statusDemonstracao: "EM_VALIDACAO_CLIENTE",
    ficha: Object.fromEntries(CARRETAS_FICHA_CAMPOS.map((campo) => [campo.codigo, ""])),
    gates: CARRETAS_GATES.map((gate) => ({
      codigo: gate.codigo,
      situacao: "PENDENTE" as const,
      decisao: "",
      autoridade: "",
      dataDecisao: "",
      correcao: "",
      criterios: gate.criterios.map(([codigo]) => ({
        codigo,
        situacao: "PENDENTE" as const,
        responsavel: "",
        evidencia: "",
        ajusteLocal: "",
      })),
    })),
    cronograma: CARRETAS_ETAPAS.map((etapa) => ({
      codigo: etapa.codigo,
      situacao: "PENDENTE" as const,
      responsavel: "",
      inicioRelativo: "",
      duracao: "",
      evidencia: "",
    })),
    orcamento: CARRETAS_ORCAMENTO.map((item) => ({
      codigo: item.codigo,
      memoriaCalculo: "",
      valor: "",
      pagador: "",
      fonteRecurso: "",
      documento: "",
      responsavel: "",
      situacao: "A_DEFINIR" as const,
    })),
    riscos: CARRETAS_RISCOS.map((risco) => ({
      codigo: risco.codigo,
      situacao: "MONITORAR" as const,
      prevencaoLocal: "",
      gatilhoLocal: "",
      respostaLocal: "",
      responsavel: "",
      evidenciaControle: "",
      acaoLocal: "",
      revisadoEm: "",
    })),
    indicadores: CARRETAS_INDICADORES.map((indicador) => ({
      codigo: indicador.codigo,
      formulaLocal: "",
      unidadeAnalise: "",
      limitacaoLocal: "",
      linhaBase: "",
      meta: "",
      aprovacaoMeta: "",
      valorAtual: "",
      dataCorte: "",
      fonteLocal: "",
      responsavelLocal: "",
      faixaAlerta: "",
    })),
    pops: CARRETAS_POPS.map((pop) => ({
      codigo: pop.codigo,
      situacao: "PENDENTE" as const,
      responsavel: "",
      evidencia: "",
      excecaoLocal: "",
      detalhesLocais: "",
    })),
    prestacao: CARRETAS_PRESTACAO.map((item) => ({
      codigo: item.codigo,
      situacao: "PENDENTE" as const,
      responsavel: "",
      evidencia: "",
      observacao: "",
    })),
    decisaoPiloto: {
      resultado: "",
      justificativa: "",
      pendencias: "",
      autoridade: "",
      data: "",
    },
  };
}

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends Array<infer Item>
        ? Widen<Item>[]
        : T extends object
          ? { [Key in keyof T]: Widen<T[Key]> }
          : T;

export type CarretasDossie = Widen<ReturnType<typeof criarCarretasDossiePadrao>>;
