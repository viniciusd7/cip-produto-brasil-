"use client";

import { useState } from "react";
import Link from "next/link";

type Opcoes = {
  secretarias: Array<{ id: string; nome: string; sigla?: string | null }>;
  projetos: Array<{ id: string; codigo: string; nome: string; secretariaId: string }>;
  mandato: { inicio: string | null; fim: string | null } | null;
};

export function FiltrosPrestacao({ opcoes, filtros }: { opcoes: Opcoes; filtros: Record<string, string> }) {
  const [tipo, setTipo] = useState(filtros.tipo || "tarefas");
  const [secretariaId, setSecretariaId] = useState(filtros.secretariaId || "");
  const [projetoId, setProjetoId] = useState(filtros.projetoId || "");
  const [de, setDe] = useState(filtros.de || "");
  const [ate, setAte] = useState(filtros.ate || "");
  const tarefas = ["tarefas", "projetos", "secretarias"].includes(tipo);
  const projetos = opcoes.projetos.filter((p) => !secretariaId || p.secretariaId === secretariaId);
  const mandatoInicio = opcoes.mandato?.inicio?.slice(0, 10);
  const mandatoFim = opcoes.mandato?.fim?.slice(0, 10);

  return (
    <form action="/relatorios" method="get" className="pc-filtros no-print" aria-label="Filtros do relatório">
      <div className="pc-filtros__campos">
        <label>Dados do relatório
          <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="tarefas">Tarefas</option>
            <option value="metas">Metas estratégicas e indicadores</option>
            <option value="projetos">Projetos</option>
            <option value="secretarias">Secretarias</option>
            <option value="evidencias">Evidências</option>
          </select>
        </label>
        <label>Secretaria
          <select name="secretariaId" value={secretariaId} onChange={(e) => { setSecretariaId(e.target.value); setProjetoId(""); }}>
            <option value="">Todas as secretarias</option>
            {opcoes.secretarias.map((s) => <option key={s.id} value={s.id}>{s.sigla ? `${s.sigla} · ` : ""}{s.nome}</option>)}
          </select>
        </label>
        <label>Projeto
          <select name="projetoId" value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            <option value="">Todos os projetos</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nome}</option>)}
          </select>
        </label>
        <label>De
          <input type="date" name="de" value={de} max={ate || undefined} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label>Até
          <input type="date" name="ate" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} />
        </label>
        {tarefas && <label>Situação das tarefas
          <select name="status" defaultValue={filtros.status || ""}>
            <option value="">Todas as situações</option>
            <option value="VENCIDO">Atrasadas</option>
            <option value="SEM_PRAZO">Sem prazo</option>
            <option value="NO_PRAZO">No prazo</option>
            <option value="CONCLUIDO">Concluídas</option>
            <option value="ENCERRADO_SEM_SOLUCAO">Encerradas sem solução</option>
          </select>
        </label>}
        <label className="pc-filtros__busca">Buscar nos resultados
          <input type="search" name="busca" defaultValue={filtros.busca || ""} maxLength={200} placeholder="Tarefa, responsável, projeto, indicador…" />
        </label>
      </div>
      {tipo === filtros.tipo && filtros.ordenar && <input type="hidden" name="ordenar" value={filtros.ordenar} />}
      {tipo === filtros.tipo && filtros.direcao && <input type="hidden" name="direcao" value={filtros.direcao} />}
      <div className="pc-filtros__acoes">
        <button type="submit" className="pc-botao">Aplicar filtros e busca</button>
        <Link href="/relatorios" className="pc-limpar">Limpar filtros</Link>
        {mandatoInicio && mandatoFim && (
          <button type="button" className="pc-limpar" onClick={() => {
            setDe(mandatoInicio); setAte(mandatoFim);
          }}>Usar período do mandato</button>
        )}
        <span>As alterações são aplicadas ao confirmar. Clique no título de uma coluna para ordenar.</span>
      </div>
    </form>
  );
}
