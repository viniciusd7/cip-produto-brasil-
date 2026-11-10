import type { RoleCode } from "./roles";
import type {
  CicloIniciativa,
  EntraveStatus,
  EvidenciaStatus,
  SituacaoVerificacao,
} from "./status";

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    dataReferencia?: string;
    fonte?: string;
    total?: number;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
  municipioId: string;
  municipioNome: string;
}

export interface PainelKpi {
  totalIniciativas: number;
  emAcompanhamento: number;
  pendenciasAbertas: number;
  vencidas: number;
  semPrazo: number;
  evidenciasPendentes: number;
  secretariasDesatualizadas: number;
}

export interface IniciativaResumo {
  id: string;
  codigo: string;
  nome: string;
  ciclo: CicloIniciativa;
  secretariaPrincipal: string;
  responsavel?: string | null;
  origem?: string | null;
  atualizadoEm: string;
  fonte?: string | null;
  dataReferencia?: string | null;
  pendencias: number;
  prazoDerivado?: string | null;
}

export interface PendenciaItem {
  id: string;
  tipo: "IMPEDIMENTO" | "VERIFICACAO" | "DECISAO" | "EVIDENCIA";
  titulo: string;
  status: EntraveStatus | SituacaoVerificacao | EvidenciaStatus | string;
  responsavel?: string | null;
  prazo?: string | null;
  iniciativaId: string;
  iniciativaNome: string;
}
