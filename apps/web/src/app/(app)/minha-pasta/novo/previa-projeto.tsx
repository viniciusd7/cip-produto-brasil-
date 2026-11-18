"use client";

import { Button } from "@cip/ui";
import type { EscopoNo } from "./escopo-editor";

export type CondicaoPrevia = {
  codigo: string;
  nome: string;
  atendida: boolean;
  impedeInicio: boolean;
  proximaProvidencia?: string | null;
  responsavel?: string | null;
};

type Props = {
  nome: string;
  tipo: string;
  secretaria: string;
  outrasSecretarias: string[];
  responsavel: string;
  meta: string;
  novoPlano?: string;
  descricao: string;
  entrega: string;
  beneficiarios: string;
  foraEscopo: string;
  tarefas: EscopoNo[];
  condicoes: CondicaoPrevia[];
  avisos: string[];
  avaliacaoPronta: boolean;
  aguardaPreRequisito: boolean;
  onEditar: (secao: "identidade" | "condicoes" | "tarefas") => void;
};

function prazoLabel(prazo?: string | null) {
  if (!prazo) return "Sem prazo definido";
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) return "Verifique o prazo";
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function Atividade({ no, subtarefa = false }: { no: EscopoNo; subtarefa?: boolean }) {
  return (
    <li>
      <div className="wizard-review__task">
        <div>
          <span className="wizard-review__label">{subtarefa ? "Subtarefa" : "Tarefa"}</span>
          <strong>{no.nome}</strong>
        </div>
        <div>
          <span className="wizard-review__label">Responsável</span>
          <span className={!no.responsavel?.trim() ? "wizard-review__missing" : undefined}>
            {no.responsavel?.trim() || "Ainda não definido"}
          </span>
        </div>
        <div>
          <span className="wizard-review__label">Prazo</span>
          <span>{prazoLabel(no.prazo)}</span>
        </div>
      </div>
      {!!no.children.length && (
        <ol className="wizard-review__subtasks">
          {no.children.map((filho) => <Atividade key={filho.codigo} no={filho} subtarefa />)}
        </ol>
      )}
    </li>
  );
}

export function PreviaProjeto(props: Props) {
  const pendentes = props.condicoes.filter((item) => !item.atendida);
  const atendidas = props.condicoes.filter((item) => item.atendida);
  const aguarda = props.aguardaPreRequisito || pendentes.some((item) => item.impedeInicio);

  return (
    <div className="wizard-review">
      <div className="wizard-review__intro">
        <p>{props.tipo}</p>
        <h2>{props.nome}</h2>
        <p>Confira os dados e as atividades que serão cadastrados.</p>
      </div>

      <section className="wizard-review__section" aria-label="Dados do projeto">
        <div className="wizard-review__heading">
          <h3>Dados do projeto</h3>
          <Button type="button" variant="ghost" onClick={() => props.onEditar("identidade")}>Editar dados</Button>
        </div>
        <dl className="wizard-review__details">
          <div><dt>Secretaria responsável</dt><dd>{props.secretaria || "Não informada"}</dd></div>
          <div><dt>Responsável pelo projeto</dt><dd>{props.responsavel || "Não informado"}</dd></div>
          <div className="wizard-review__wide"><dt>Meta estratégica</dt><dd>{props.meta || "Não informada"}</dd></div>
          {props.novoPlano && <div className="wizard-review__wide"><dt>Plano de governo da nova meta</dt><dd>{props.novoPlano}</dd></div>}
          {!!props.outrasSecretarias.length && <div className="wizard-review__wide"><dt>Outras secretarias participantes</dt><dd>{props.outrasSecretarias.join(", ")}</dd></div>}
          <div className="wizard-review__wide"><dt>O que motivou o projeto</dt><dd>{props.descricao}</dd></div>
          {props.entrega && <div className="wizard-review__wide"><dt>O que será entregue</dt><dd>{props.entrega}</dd></div>}
          {props.beneficiarios && <div><dt>Público beneficiado</dt><dd>{props.beneficiarios}</dd></div>}
          {props.foraEscopo && <div className="wizard-review__wide"><dt>O que fica fora deste projeto</dt><dd>{props.foraEscopo}</dd></div>}
        </dl>
      </section>

      <section className="wizard-review__section" aria-label="O que precisa ser resolvido">
        <div className="wizard-review__heading">
          <h3>O que precisa ser resolvido</h3>
          <Button type="button" variant="ghost" onClick={() => props.onEditar("condicoes")}>Revisar condições</Button>
        </div>
        {!props.avaliacaoPronta ? (
          <p>Volte à etapa anterior para conferir as condições do projeto.</p>
        ) : aguarda ? (
          <p className="wizard-review__notice">Você pode cadastrar o projeto, mas há pré-requisitos a resolver antes de iniciar as atividades que dependem deles.</p>
        ) : pendentes.length ? (
          <p>Você informou os itens abaixo como pendentes. Confira as providências e quem vai acompanhar cada uma.</p>
        ) : props.avisos.length ? (
          <p>Confira as informações que ainda faltam antes de confirmar.</p>
        ) : (
          <p>Nenhum pré-requisito pendente foi identificado nas respostas informadas.</p>
        )}
        {!!pendentes.length && (
          <ul className="wizard-review__conditions">
            {pendentes.map((item) => (
              <li key={item.codigo}>
                <strong>{item.nome}</strong>
                <p>{item.impedeInicio ? "Resolver antes de iniciar as atividades que dependem deste item." : "Item informado como pendente."}</p>
                {item.proximaProvidencia && <p><span className="wizard-review__label">Próxima providência</span>{item.proximaProvidencia}</p>}
                {item.responsavel && <p><span className="wizard-review__label">Responsável pelo acompanhamento</span>{item.responsavel}</p>}
              </li>
            ))}
          </ul>
        )}
        {!!props.avisos.length && <ul className="wizard-review__warnings">{props.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>}
        {!!atendidas.length && (
          <details className="wizard-review__resolved">
            <summary>Itens que você informou como atendidos</summary>
            <ul>{atendidas.map((item) => <li key={item.codigo}>{item.nome}</li>)}</ul>
          </details>
        )}
      </section>

      <section className="wizard-review__section" aria-label="Tarefas e responsáveis">
        <div className="wizard-review__heading">
          <h3>Tarefas e responsáveis</h3>
          <Button type="button" variant="ghost" onClick={() => props.onEditar("tarefas")}>Editar tarefas</Button>
        </div>
        {props.tarefas.length ? (
          <ol className="wizard-review__tasks">{props.tarefas.map((no) => <Atividade key={no.codigo} no={no} />)}</ol>
        ) : (
          <p>Nenhuma tarefa adicionada. Use “Editar tarefas” para incluir as atividades do projeto.</p>
        )}
      </section>
      <p className="wizard-review__confirmation">Ao confirmar, o projeto e suas tarefas serão cadastrados com as informações acima.</p>
    </div>
  );
}
