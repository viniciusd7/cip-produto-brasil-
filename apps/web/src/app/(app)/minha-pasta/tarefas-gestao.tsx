"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@cip/ui";
import { API_URL, apiFetch } from "@/lib/api";

export type TarefaGestaoItem = {
  id: string;
  codigo: string | null;
  descricao: string;
  status: string;
  responsavel: string | null;
  prazo: string | null;
  meta: string | null;
  subtarefas: { total: number; concluidas: number };
  iniciativaId: string;
  iniciativaCodigo: string;
  iniciativaNome: string;
  secretaria: string;
  minha?: boolean;
  aguardandoValidacao?: boolean;
};

type Filtro = "TODAS" | "ABERTAS" | "MINHAS" | "ATRASADAS" | "SEM_PRAZO" | "VALIDACAO" | "CONCLUIDAS";
type Visualizacao = "LISTA" | "QUADRO";

const filtros: Array<{ id: Filtro; label: string }> = [
  { id: "TODAS", label: "Todas" },
  { id: "ABERTAS", label: "Em aberto" },
  { id: "MINHAS", label: "Atribuídas a mim" },
  { id: "ATRASADAS", label: "Atrasadas" },
  { id: "SEM_PRAZO", label: "Sem prazo" },
  { id: "VALIDACAO", label: "Aguardando validação" },
  { id: "CONCLUIDAS", label: "Concluídas" },
];

const colunas = [
  { id: "VENCIDO", titulo: "Atrasadas", tone: "danger" },
  { id: "SEM_PRAZO", titulo: "Sem prazo", tone: "warning" },
  { id: "NO_PRAZO", titulo: "No prazo", tone: "info" },
  { id: "CONCLUIDO", titulo: "Concluídas", tone: "success" },
  { id: "ENCERRADO_SEM_SOLUCAO", titulo: "Encerradas", tone: "neutral" },
] as const;

const statusLabel: Record<string, string> = {
  VENCIDO: "Atrasada",
  SEM_PRAZO: "Sem prazo",
  NO_PRAZO: "No prazo",
  CONCLUIDO: "Concluída",
  ENCERRADO_SEM_SOLUCAO: "Encerrada sem solução",
};

function dataCurta(value: string | null) {
  if (!value) return "Sem prazo";
  return new Date(value).toLocaleDateString("pt-BR");
}

function encerrada(tarefa: TarefaGestaoItem) {
  return ["CONCLUIDO", "ENCERRADO_SEM_SOLUCAO"].includes(tarefa.status);
}

const TIPOS_EVIDENCIA = [
  { id: "DOCUMENTO", label: "Documento", accept: ".pdf,.doc,.docx,application/pdf" },
  { id: "FOTO", label: "Foto", accept: "image/*" },
  { id: "VIDEO", label: "Vídeo", accept: "video/mp4,video/webm,video/quicktime" },
] as const;

async function enviarEvidencia(token: string, tarefa: TarefaGestaoItem, form: FormData) {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return null;
  const body = new FormData();
  body.set("arquivo", arquivo);
  body.set("tipo", String(form.get("tipo") || "DOCUMENTO"));
  body.set("marcoId", tarefa.id);
  body.set("titulo", `Evidência — ${tarefa.descricao}`.slice(0, 180));
  body.set("descricao", String(form.get("descricao") || "").trim() || `Evidência da tarefa ${tarefa.descricao}`);
  const res = await fetch(`${API_URL}/iniciativas/${tarefa.iniciativaId}/evidencias`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || "Falha ao enviar a evidência.");
  return json.data?.id as string;
}

type Painel = "CONCLUIR" | "REPROGRAMAR" | "EVIDENCIA" | null;

function CampoEvidencia({ id, obrigatorio }: { id: string; obrigatorio?: boolean }) {
  const [tipo, setTipo] = useState<(typeof TIPOS_EVIDENCIA)[number]["id"]>("DOCUMENTO");
  const accept = TIPOS_EVIDENCIA.find((t) => t.id === tipo)?.accept;
  return (
    <div className="gp-form__grid">
      <div>
        <label htmlFor={`tipo-${id}`}>Tipo de evidência</label>
        <select id={`tipo-${id}`} name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          {TIPOS_EVIDENCIA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <div className="gp-form__wide">
        <label htmlFor={`arq-${id}`}>Arquivo (até 25 MB){obrigatorio ? "" : " — opcional"}</label>
        <input id={`arq-${id}`} name="arquivo" type="file" accept={accept} required={obrigatorio} />
      </div>
    </div>
  );
}

function AcoesTarefa({ tarefa, token, painel, fechar }: { tarefa: TarefaGestaoItem; token: string; painel: Painel; fechar: () => void }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [amanha] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setEnviando(true);
    setErro("");
    try {
      if (painel === "REPROGRAMAR") {
        await apiFetch(`/execucao/marcos/${tarefa.id}/reprogramar`, {
          token,
          method: "POST",
          body: JSON.stringify({
            dataNova: new Date(`${form.get("dataNova")}T12:00:00`).toISOString(),
            motivo: String(form.get("motivo") || "").trim(),
          }),
        });
      } else if (painel === "EVIDENCIA") {
        await enviarEvidencia(token, tarefa, form);
      } else if (painel === "CONCLUIR") {
        const evidenciaId = await enviarEvidencia(token, tarefa, form);
        await apiFetch("/execucao/solicitacoes", {
          token,
          method: "POST",
          body: JSON.stringify({
            entidadeTipo: "MARCO",
            entidadeId: tarefa.id,
            justificativa: String(form.get("descricao") || "").trim(),
            ...(evidenciaId ? { evidenciaId } : {}),
          }),
        });
      }
      fechar();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setEnviando(false);
    }
  }

  if (!painel) return null;
  return (
    <form className="gp-form gestao-tarefa__painel" onSubmit={submit}>
      {painel === "REPROGRAMAR" && (
        <>
          <strong>Reprogramar prazo</strong>
          <p className="dashboard-muted" style={{ margin: 0 }}>A nova data vale imediatamente e a consultoria é notificada com a justificativa.</p>
          <div className="gp-form__grid">
            <div><label htmlFor={`dt-${tarefa.id}`}>Nova data</label><input id={`dt-${tarefa.id}`} name="dataNova" type="date" min={amanha} required /></div>
            <div className="gp-form__wide"><label htmlFor={`mot-${tarefa.id}`}>Justificativa</label><input id={`mot-${tarefa.id}`} name="motivo" required minLength={10} placeholder="Ex.: licitação deserta, nova sessão em 15 dias" /></div>
          </div>
        </>
      )}
      {painel === "CONCLUIR" && (
        <>
          <strong>Informar conclusão</strong>
          <p className="dashboard-muted" style={{ margin: 0 }}>A consultoria valida a entrega com base na evidência. Enquanto isso, a tarefa fica “aguardando validação”.</p>
          <div><label htmlFor={`just-${tarefa.id}`}>O que foi entregue</label><textarea id={`just-${tarefa.id}`} name="descricao" rows={2} required minLength={5} placeholder="Ex.: contrato assinado e publicado no Diário Oficial" /></div>
          <CampoEvidencia id={tarefa.id} />
        </>
      )}
      {painel === "EVIDENCIA" && (
        <>
          <strong>Anexar evidência</strong>
          <div><label htmlFor={`desc-${tarefa.id}`}>Descrição</label><input id={`desc-${tarefa.id}`} name="descricao" required minLength={3} placeholder="Ex.: fotos da obra em 12/11" /></div>
          <CampoEvidencia id={tarefa.id} obrigatorio />
        </>
      )}
      {erro && <p role="alert" className="gp-erro">{erro}</p>}
      <div className="chip-row">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Enviando…" : painel === "CONCLUIR" ? "Enviar para validação" : painel === "REPROGRAMAR" ? "Reprogramar" : "Anexar"}
        </Button>
        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
      </div>
    </form>
  );
}

function tarefasParaFiltro(tarefa: TarefaGestaoItem, filtro: Filtro) {
  if (filtro === "TODAS") return true;
  if (filtro === "ABERTAS") {
    return !["CONCLUIDO", "ENCERRADO_SEM_SOLUCAO"].includes(tarefa.status);
  }
  if (filtro === "MINHAS") return !!tarefa.minha && !encerrada(tarefa);
  if (filtro === "VALIDACAO") return !!tarefa.aguardandoValidacao;
  if (filtro === "ATRASADAS") return tarefa.status === "VENCIDO";
  if (filtro === "SEM_PRAZO") return tarefa.status === "SEM_PRAZO";
  return tarefa.status === "CONCLUIDO";
}

function TarefaCard({ tarefa, token }: { tarefa: TarefaGestaoItem; token: string }) {
  const [painel, setPainel] = useState<Painel>(null);
  const tone =
    tarefa.status === "VENCIDO"
      ? "danger"
      : tarefa.status === "CONCLUIDO"
        ? "success"
        : tarefa.status === "NO_PRAZO"
          ? "info"
          : "warning";
  const aberta = !encerrada(tarefa);

  return (
    <article className="gestao-tarefa">
      <div className="gestao-tarefa__main">
        <div className="gestao-tarefa__title-row">
          <strong>{tarefa.codigo ? `${tarefa.codigo} · ` : ""}{tarefa.descricao}</strong>
          <span className="chip-row">
            {tarefa.minha && <Badge tone="violet">Minha</Badge>}
            {tarefa.aguardandoValidacao && <Badge tone="gold">Aguardando validação</Badge>}
            <Badge tone={tone}>{statusLabel[tarefa.status] || tarefa.status}</Badge>
          </span>
        </div>
        <Link
          href={`/iniciativas/${tarefa.iniciativaId}?aba=andamento`}
          className="gestao-tarefa__project"
        >
          {tarefa.iniciativaCodigo} · {tarefa.iniciativaNome}
        </Link>
        <div className="gestao-tarefa__meta">
          <span>{tarefa.meta || "Sem meta vinculada"}</span>
          <span>
            {tarefa.subtarefas.concluidas}/{tarefa.subtarefas.total} subtarefas
          </span>
        </div>
      </div>
      <div className="gestao-tarefa__details">
        <span className="gestao-tarefa__detail-label">Responsável</span>
        <strong>{tarefa.responsavel || "A definir"}</strong>
      </div>
      <div className="gestao-tarefa__details">
        <span className="gestao-tarefa__detail-label">Prazo</span>
        <strong>{dataCurta(tarefa.prazo)}</strong>
      </div>
      {aberta && (
        <div className="gestao-tarefa__acoes">
          {!tarefa.aguardandoValidacao && (
            <button type="button" className="gestao-tarefa__action" aria-expanded={painel === "CONCLUIR"} onClick={() => setPainel(painel === "CONCLUIR" ? null : "CONCLUIR")}>
              Concluir
            </button>
          )}
          <button type="button" className="gestao-tarefa__action gestao-tarefa__action--soft" aria-expanded={painel === "EVIDENCIA"} onClick={() => setPainel(painel === "EVIDENCIA" ? null : "EVIDENCIA")}>
            Evidência
          </button>
          <button type="button" className="gestao-tarefa__action gestao-tarefa__action--soft" aria-expanded={painel === "REPROGRAMAR"} onClick={() => setPainel(painel === "REPROGRAMAR" ? null : "REPROGRAMAR")}>
            Reprogramar
          </button>
        </div>
      )}
      <AcoesTarefa tarefa={tarefa} token={token} painel={painel} fechar={() => setPainel(null)} />
    </article>
  );
}

export function TarefasGestao({
  tarefas,
  token,
}: {
  tarefas: TarefaGestaoItem[];
  token: string;
}) {
  const [filtro, setFiltro] = useState<Filtro>("ABERTAS");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("LISTA");
  const [busca, setBusca] = useState("");

  const normalizedSearch = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = tarefas.filter((tarefa) => {
    if (!tarefasParaFiltro(tarefa, filtro)) return false;
    if (!normalizedSearch) return true;
    return [
      tarefa.codigo,
      tarefa.descricao,
      tarefa.iniciativaCodigo,
      tarefa.iniciativaNome,
      tarefa.meta,
      tarefa.responsavel,
    ]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  });

  const abertas = tarefas.filter((tarefa) =>
    tarefasParaFiltro(tarefa, "ABERTAS"),
  ).length;
  const atrasadas = tarefas.filter((tarefa) => tarefa.status === "VENCIDO").length;
  const semPrazo = tarefas.filter((tarefa) => tarefa.status === "SEM_PRAZO").length;
  const concluidas = tarefas.filter((tarefa) => tarefa.status === "CONCLUIDO").length;
  const aguardando = tarefas.filter((tarefa) => tarefa.aguardandoValidacao).length;

  return (
    <section
      className="pasta-section gestao-tarefas"
      aria-labelledby="gestao-tarefas-title"
    >
      <div className="pasta-section__head">
        <div>
          <h2 id="gestao-tarefas-title">Tarefas da secretaria</h2>
          <p>
            As tarefas são definidas pela consultoria. Você anexa evidências
            (documento, foto ou vídeo), reprograma com justificativa e informa a
            conclusão para validação.
          </p>
        </div>
        <div className="gestao-tarefas__summary" aria-label="Resumo das tarefas">
          <span><strong>{abertas}</strong> em aberto</span>
          <span><strong>{atrasadas}</strong> atrasadas</span>
          <span><strong>{semPrazo}</strong> sem prazo</span>
          <span><strong>{aguardando}</strong> em validação</span>
          <span><strong>{concluidas}</strong> concluídas</span>
        </div>
      </div>

      <div className="gestao-tarefas__toolbar">
        <label className="gestao-tarefas__search">
          <span className="sr-only">Buscar tarefa</span>
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar tarefa, projeto, meta ou responsável"
          />
        </label>
        <div className="gestao-tarefas__views" aria-label="Modo de visualização">
          <button
            type="button"
            aria-pressed={visualizacao === "LISTA"}
            onClick={() => setVisualizacao("LISTA")}
          >
            Lista
          </button>
          <button
            type="button"
            aria-pressed={visualizacao === "QUADRO"}
            onClick={() => setVisualizacao("QUADRO")}
          >
            Quadro
          </button>
        </div>
      </div>

      <div className="gestao-tarefas__filters" aria-label="Filtrar tarefas">
        {filtros.map((item) => {
          const count = tarefas.filter((tarefa) =>
            tarefasParaFiltro(tarefa, item.id),
          ).length;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={filtro === item.id}
              onClick={() => setFiltro(item.id)}
            >
              {item.label} <span>{count}</span>
            </button>
          );
        })}
      </div>

      {visualizacao === "LISTA" ? (
        <div className="gestao-tarefas__list">
          {filtradas.map((tarefa) => (
            <TarefaCard key={tarefa.id} tarefa={tarefa} token={token} />
          ))}
        </div>
      ) : (
        <div className="gestao-tarefas__board">
          {colunas.map((coluna) => {
            const itens = filtradas.filter(
              (tarefa) => tarefa.status === coluna.id,
            );
            return (
              <section key={coluna.id} className="gestao-tarefas__column">
                <h3>
                  <span data-tone={coluna.tone} />
                  {coluna.titulo}
                  <small>{itens.length}</small>
                </h3>
                <div className="gestao-tarefas__column-list">
                  {itens.map((tarefa) => (
                    <TarefaCard key={tarefa.id} tarefa={tarefa} token={token} />
                  ))}
                  {!itens.length && (
                    <p className="dashboard-muted">Nenhuma tarefa</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!filtradas.length && (
        <div className="pasta-empty">
          <p>
            {tarefas.length
              ? "Nenhuma tarefa corresponde a esta busca e filtro."
              : "Ainda não há tarefas vinculadas a esta secretaria."}
          </p>
        </div>
      )}
    </section>
  );
}
