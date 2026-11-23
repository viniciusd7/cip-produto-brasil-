"use client";

import { Button } from "@cip/ui";
import { RotuloComAjuda } from "@/components/ajuda-campo";

export type EscopoNo = {
  codigo: string;
  nivel: "TAREFA" | "SUBTAREFA";
  nome: string;
  responsavel?: string | null;
  prazo?: string | null;
  origemPerguntaCodigo?: string | null;
  origemValor?: string | null;
  manual?: boolean;
  children: EscopoNo[];
};

let sequencia = 0;
export function novoCodigo(nivel: EscopoNo["nivel"]) {
  sequencia += 1;
  return `MANUAL-${nivel}-${Date.now().toString(36)}-${sequencia}`;
}

export function criarNo(nivel: EscopoNo["nivel"], nome: string): EscopoNo {
  return { codigo: novoCodigo(nivel), nivel, nome, manual: true, children: [] };
}

export function temResponsavel(no: { responsavel?: string | null }) {
  return Boolean(no.responsavel?.trim());
}

export function EscopoEditor({ nodes, onChange, equipe, listId }: {
  nodes: EscopoNo[];
  onChange: (next: EscopoNo[]) => void;
  equipe: string[];
  listId: string;
}) {
  function atualizar(index: number, patch: Partial<EscopoNo>) {
    onChange(nodes.map((no, i) => i === index ? { ...no, ...patch } : no));
  }

  return (
    <div className="stack">
      <datalist id={listId}>
        {equipe.map((nome) => <option key={nome} value={nome} />)}
      </datalist>
      {!nodes.length && <p className="dashboard-muted">Nenhuma tarefa ainda. Adicione a primeira tarefa do projeto.</p>}
      {nodes.map((tarefa, ti) => (
        <article key={tarefa.codigo} className="entity-card">
          <div className="entity-card__top">
            <strong>Tarefa {ti + 1}</strong>
            <Button type="button" variant="ghost" onClick={() => onChange(nodes.filter((_, i) => i !== ti))}>
              Remover tarefa
            </Button>
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <RotuloComAjuda htmlFor={`${tarefa.codigo}-nome`} campo="Nome da tarefa" ajuda="Descreva uma atividade necessária para realizar o projeto." />
              <input id={`${tarefa.codigo}-nome`} required minLength={3} maxLength={500} value={tarefa.nome} onChange={(e) => atualizar(ti, { nome: e.target.value })} />
            </div>
            <div>
              <RotuloComAjuda htmlFor={`${tarefa.codigo}-responsavel`} campo="Responsável pela tarefa" ajuda="Informe a pessoa ou equipe responsável pela execução da tarefa." />
              <input id={`${tarefa.codigo}-responsavel`} list={listId} maxLength={200} value={tarefa.responsavel ?? ""} placeholder="Nome da pessoa ou equipe" onChange={(e) => atualizar(ti, { responsavel: e.target.value })} />
            </div>
            <div>
              <RotuloComAjuda htmlFor={`${tarefa.codigo}-prazo`} campo="Prazo da tarefa" ajuda="Escolha a data prevista para concluir a tarefa. É opcional." />
              <input id={`${tarefa.codigo}-prazo`} type="date" value={tarefa.prazo?.slice(0, 10) ?? ""} onChange={(e) => atualizar(ti, { prazo: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
            </div>
          </div>
          <ul className="stack" style={{ listStyle: "none", paddingLeft: 16, marginTop: 10 }}>
            {tarefa.children.map((sub, si) => (
              <li key={sub.codigo} className="form-grid form-grid--2">
                <div>
                  <RotuloComAjuda htmlFor={`${sub.codigo}-nome`} campo="Nome da subtarefa" ajuda="Descreva um passo necessário para concluir a tarefa." />
                  <input id={`${sub.codigo}-nome`} required minLength={3} maxLength={500} value={sub.nome} onChange={(e) => atualizar(ti, { children: tarefa.children.map((s, i) => i === si ? { ...s, nome: e.target.value } : s) })} />
                </div>
                <div>
                  <RotuloComAjuda htmlFor={`${sub.codigo}-responsavel`} campo="Responsável pela subtarefa" ajuda="Informe a pessoa ou equipe responsável pela execução da subtarefa." />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input id={`${sub.codigo}-responsavel`} list={listId} maxLength={200} value={sub.responsavel ?? ""} placeholder="Nome da pessoa ou equipe" onChange={(e) => atualizar(ti, { children: tarefa.children.map((s, i) => i === si ? { ...s, responsavel: e.target.value } : s) })} />
                    <Button type="button" variant="ghost" aria-label={`Remover subtarefa ${sub.nome}`} onClick={() => atualizar(ti, { children: tarefa.children.filter((_, i) => i !== si) })}>×</Button>
                  </div>
                </div>
                <div>
                  <RotuloComAjuda htmlFor={`${sub.codigo}-prazo`} campo="Prazo da subtarefa" ajuda="Escolha a data prevista para concluir a subtarefa. É opcional." />
                  <input id={`${sub.codigo}-prazo`} type="date" value={sub.prazo?.slice(0, 10) ?? ""} onChange={(e) => atualizar(ti, { children: tarefa.children.map((s, i) => i === si ? { ...s, prazo: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null } : s) })} />
                </div>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" onClick={() => atualizar(ti, { children: [...tarefa.children, criarNo("SUBTAREFA", "Nova subtarefa")] })}>+ Subtarefa</Button>
        </article>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...nodes, criarNo("TAREFA", "Nova tarefa")])}>+ Tarefa</Button>
    </div>
  );
}
