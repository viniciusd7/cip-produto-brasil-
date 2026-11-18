"use client";

import { Button } from "@cip/ui";
import {
  adicionarImpedimentosPersonalizados,
  LIMITE_IMPEDIMENTOS_PERSONALIZADOS,
  type ImpedimentoPersonalizado,
} from "@cip/shared";
import { CondicaoCard, type CondicaoValorState } from "./condicao-card";

export function ImpedimentosEditor({ itens, respostas, onChange, onResposta, onRemover, exemplo }: {
  itens: ImpedimentoPersonalizado[];
  respostas: Record<string, CondicaoValorState>;
  onChange: (itens: ImpedimentoPersonalizado[]) => void;
  onResposta: (codigo: string, valor: CondicaoValorState) => void;
  onRemover: (codigo: string) => void;
  exemplo: string;
}) {
  const perguntas = adicionarImpedimentosPersonalizados({ codigo: "PERSONALIZADO", nome: "Itens do projeto", perguntas: [], estrutura: [] }, itens).perguntas;

  function atualizar(codigo: string, patch: Partial<ImpedimentoPersonalizado>) {
    onChange(itens.map((item) => item.codigo === codigo ? { ...item, ...patch } : item));
  }

  return (
    <div className="stack">
      <div>
        <h3>Itens específicos deste projeto</h3>
        <p className="dashboard-muted">Faltou algum item no checklist? Adicione quantos precisar e detalhe cada um. Ex.: {exemplo}.</p>
      </div>
      {itens.map((item, indice) => (
        <section key={item.codigo} className="condicao-card" aria-label={`Item personalizado ${indice + 1}`}>
          <div className="condicao-card__grid">
            <label className="condicao-card__field" htmlFor={`${item.codigo}-tipo`}>
              <span>Tipo do item</span>
              <select id={`${item.codigo}-tipo`} value={item.tipo} onChange={(e) => atualizar(item.codigo, { tipo: e.target.value as ImpedimentoPersonalizado["tipo"] })}>
                <option value="IMPEDIMENTO">Impedimento</option>
                <option value="PRE_REQUISITO">Pré-requisito</option>
              </select>
            </label>
            <label className="condicao-card__field" htmlFor={`${item.codigo}-nome`}>
              <span>Nome do item {indice + 1}</span>
              <input id={`${item.codigo}-nome`} required minLength={3} maxLength={200} value={item.nome} placeholder={exemplo} onChange={(e) => atualizar(item.codigo, { nome: e.target.value })} />
            </label>
          </div>
          <label className="condicao-card__field" htmlFor={`${item.codigo}-descricao`}>
            <span>Descrição ou condição necessária</span>
            <textarea id={`${item.codigo}-descricao`} rows={2} maxLength={2000} value={item.descricao} onChange={(e) => atualizar(item.codigo, { descricao: e.target.value })} />
          </label>
          <label className="condicao-card__field" htmlFor={`${item.codigo}-bloqueante`}>
            <span>O projeto precisa aguardar este item?</span>
            <select id={`${item.codigo}-bloqueante`} value={String(item.bloqueante)} onChange={(e) => atualizar(item.codigo, { bloqueante: e.target.value === "true" })}>
              <option value="false">Não, pode avançar enquanto o item é tratado</option>
              <option value="true">Sim, a pendência impede o avanço</option>
            </select>
          </label>
          <CondicaoCard
            pergunta={{ ...perguntas[indice], rotulo: item.nome.trim() || `Item ${indice + 1}` }}
            valor={respostas[item.codigo]}
            onChange={(valor) => onResposta(item.codigo, valor)}
            mostrarAjuda
          />
          <Button type="button" variant="ghost" onClick={() => onRemover(item.codigo)} aria-label={`Remover ${item.nome.trim() || `item ${indice + 1}`}`}>Remover item</Button>
        </section>
      ))}
      <Button type="button" variant="secondary" disabled={itens.length >= LIMITE_IMPEDIMENTOS_PERSONALIZADOS} onClick={() => onChange([...itens, {
        codigo: `imp_personalizado_${crypto.randomUUID()}`,
        nome: "",
        tipo: "PRE_REQUISITO",
        descricao: "",
        bloqueante: false,
      }])}>+ Adicionar impedimento ou pré-requisito</Button>
      {itens.length >= LIMITE_IMPEDIMENTOS_PERSONALIZADOS && <p role="status">Limite de {LIMITE_IMPEDIMENTOS_PERSONALIZADOS} itens personalizados por projeto.</p>}
    </div>
  );
}
