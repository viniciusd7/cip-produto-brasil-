export type SecretariaOverview = {
  id: string;
  nome: string;
  sigla?: string | null;
  projetos: number;
  projetosComAtraso: number;
  projetosAtencaoExecutiva: number;
  tarefasTotal: number;
  abertas: number;
  concluidas: number;
  noPrazo: number;
  atrasadas: number;
  semPrazo: number;
  criticas: number;
  pctAtraso: number;
  indicePonderado: number;
  diasSemAtualizacao: number | null;
  classificacao: string;
  metasTotal?: number;
  metasComValor?: number;
  metasAtrasadas?: number;
  metasSemPrazo?: number;
  titular?: { nome?: string | null };
};

export type OverviewResponse = {
  data: {
    governo: {
      totalProjetos: number;
      projetosComAtraso: number;
      pctCarteiraComAtraso: number;
      semAtrasoRegistrado: number;
      atencaoExecutiva: number;
      totalTarefas: number;
      concluidas: number;
      abertas: number;
      atrasadas: number;
      semPrazo: number;
      noPrazo?: number;
      indicePonderado: number;
      metodoVersao: string;
    };
    metas?: {
      total: number;
      comIndicador: number;
      comValor: number;
      cobertura: number;
      atrasadas: number;
      semPrazo: number;
      concluidas: number;
      pedemAcao: Array<{
        id: string;
        nome: string;
        iniciativaId: string;
        iniciativaNome: string;
        secretaria: string;
        valorAtual: string | null;
        alvo: string | null;
        prazo: string | null;
      }>;
    };
    agenda: {
      entraves: Array<{ tipo: string; qtd: number }>;
      estruturantesAtrasados: number;
      pastasDesatualizadas: Array<{ id: string; nome: string; dias: number | null }>;
      gravidadeBuckets: Record<string, number>;
    };
    tarefasPedemAcao?: {
      atrasadas: Array<{
        id: string;
        descricao: string;
        iniciativaId: string;
        iniciativaNome: string;
        secretaria: string;
        gravidade: string | null;
        responsavel: string | null;
      }>;
      vencemEm15d: Array<{
        id: string;
        descricao: string;
        iniciativaId: string;
        iniciativaNome: string;
        secretaria: string;
        prazo: string | null;
      }>;
      semPrazo: Array<{
        id: string;
        descricao: string;
        iniciativaId: string;
        iniciativaNome: string;
        secretaria: string;
      }>;
    };
    porSecretaria: SecretariaOverview[];
    projetosEstruturantes: Array<{
      id: string;
      nome: string;
      secretaria: string;
      marcos: number;
      atrasadas: number;
      pendencias: number;
    }>;
    pendencias: Array<{
      id: string;
      tipo: string;
      titulo: string;
      iniciativaId: string;
      iniciativaNome: string;
      href?: string;
    }>;
    estrategia?: {
      metas: Array<{
        id: string;
        nome: string;
        codigo?: string | null;
        secretariaNome?: string | null;
        indicador?: string | null;
        valorBase?: string | null;
        alvo?: string | null;
        unidade?: string | null;
        perspectivaBsc?: string | null;
        resultadoChaveOkr?: string | null;
        projetos: number;
        desvio: number | null;
        aguardandoMedicao: boolean;
        medicaoAtual: {
          dataCorte: string;
          valorRealizado: string;
          valorEsperado: string | null;
          fonte: string | null;
        } | null;
        medicaoAnterior: {
          dataCorte: string;
          valorRealizado: string;
        } | null;
      }>;
      porPerspectivaBsc: Array<{
        perspectiva: string;
        total: number;
        comMedicao: number;
      }>;
      alertasOrcamento: Array<{
        id: string;
        tipo: string;
        titulo: string;
        statusConferencia: string;
      }>;
      alertaEquipamentos: Array<{
        id: string;
        nome: string;
        frentesComAtraso: Array<{
          iniciativaId: string;
          nome: string;
          secretaria: string;
          atrasos: number;
        }>;
      }> | null;
    };
  };
  meta?: { dataReferencia?: string; fonte?: string; metodoVersao?: string };
};
