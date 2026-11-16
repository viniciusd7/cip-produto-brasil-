"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { canManageSecretariaRole, getNextStepForRole } from "@/lib/roles";
import { s } from "./ov";
import { SecretariaGlance } from "./secretaria-glance";

export type CenarioSecretariaResponse = {
  data: {
    secretarias: Array<{
      id: string;
      nome: string;
      sigla?: string | null;
      titularNome?: string | null;
    }>;
    selected: {
      id: string;
      nome: string;
      sigla?: string | null;
      titularNome?: string | null;
      titularCargo?: string | null;
    } | null;
    metasEstrategicas: Array<{
      id: string;
      nome: string;
      codigo?: string | null;
      valorBase?: string | null;
      alvo?: string | null;
      unidade?: string | null;
      perspectivaBsc?: string | null;
      resultadoChaveOkr?: string | null;
      projetos: number;
      projetosVinculados: Array<{ id: string; codigo: string; nome: string }>;
      indicadores: Array<{
        id: string;
        nome: string;
        unidade?: string | null;
        valorBase?: string | null;
        alvo?: string | null;
        valorAtual?: string | null;
        periodicidade?: string | null;
        responsavel?: { id: string; name: string } | null;
        ultimaMedicao: string | null;
      }>;
      desvio: number | null;
      aguardandoMedicao: boolean;
      medicaoAtual: {
        dataCorte: string;
        valorRealizado: string;
        valorEsperado: string | null;
        fonte: string | null;
      } | null;
    }>;
    indicadores: {
      projetos: number;
      totalTarefas: number;
      concluidas: number;
      atrasadas: number;
      semPrazo: number;
      noPrazo: number;
      pctConclusao: number;
    };
    projetos?: Array<{
      id: string;
      codigo: string;
      nome: string;
      participacao: "PRINCIPAL" | "CORRELACIONADO";
      totalTarefas: number;
      concluidas: number;
      atrasadas: number;
      semPrazo: number;
      pctConclusao: number;
    }>;
    tarefasAtencao?: Array<{
      id: string;
      descricao: string;
      prazo: string | null;
      responsavel?: string | null;
      estado: string;
      iniciativaId: string;
      iniciativaNome: string;
    }>;
  };
  meta?: { dataReferencia?: string; fonte?: string };
};

export function CenarioSecretaria({
  payload,
  municipio,
  role,
}: {
  payload: CenarioSecretariaResponse;
  municipio: string;
  role?: string;
}) {
  const router = useRouter();
  const { secretarias, selected } = payload.data;
  const nextStep = getNextStepForRole(role);
  const canManage = canManageSecretariaRole(role);
  const dataRef = payload.meta?.dataReferencia
    ? new Date(payload.meta.dataReferencia).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
      })
    : "—";

  function onSelect(id: string) {
    router.push(`/painel?secretariaId=${id}`);
  }

  if (!selected) {
    return (
      <div className={s.board}>
        <header className={s.header}>
          <div>
            <span className={s.eyebrow}>Cenário</span>
            <p className={s.toplineTitle}>Cadastre uma secretaria</p>
            <p>{municipio}</p>
          </div>
          {canManage && (
            <Link href="/secretarias" className={s.button}>
              Gerir estrutura ↗
            </Link>
          )}
        </header>
      </div>
    );
  }

  return (
    <div className={s.board}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>Cenário · visão da secretaria</span>
          <p className={s.toplineTitle}>{selected.nome}</p>
          <p>
            {municipio}
            {selected.titularNome ? ` · ${selected.titularNome}` : ""}
            {selected.titularCargo ? ` · ${selected.titularCargo}` : ""}
          </p>
        </div>
        <div className={s.headerActions}>
          <span className={s.date}>◷ {dataRef}</span>
          <Link href="/painel" className={s.button}>
            Cenário geral
          </Link>
          {canManage && (
            <Link href={`/secretarias/${selected.id}`} className={s.button}>
              Gerir estrutura ↗
            </Link>
          )}
          <Link href={nextStep.href} className={s.button}>
            {nextStep.label} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <div className="gl-chips gl-secs" role="group" aria-label="Trocar de secretaria">
        {secretarias.map((sec) => (
          <button
            key={sec.id}
            type="button"
            aria-pressed={sec.id === selected.id}
            onClick={() => onSelect(sec.id)}
          >
            {sec.sigla || sec.nome}
          </button>
        ))}
      </div>

      <SecretariaGlance dados={payload.data} titulo={`Situação · ${selected.sigla || selected.nome}`} />
    </div>
  );
}
