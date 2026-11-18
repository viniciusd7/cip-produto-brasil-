"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import {
  getRequiredKnowledgeDocumentStatus,
  isKnowledgeDocumentType,
  KNOWLEDGE_DOCUMENT_TYPES,
  type KnowledgeDocumentType,
} from "@cip/shared";
import { API_URL } from "@/lib/api";
import { prepararDocumento } from "./documento-upload";
import { salvarMedicao } from "./medicao";

const knowledgeDocumentLabels: Record<KnowledgeDocumentType, string> = {
  PLANO_GOVERNO: "Plano de Governo",
  PPA: "PPA",
  LDO: "LDO",
  LOA: "LOA",
  DIAGNOSTICO: "Diagnóstico",
  OUTRO: "Outro",
};

type Doc = {
  id: string;
  tipo: string;
  titulo: string;
  observacao?: string | null;
  vigencia?: string | null;
  statusConferencia: string;
  arquivoNome?: string | null;
};

type MedicaoFormMeta = { id: string; nome: string };

export function ConhecimentoForm({
  token,
  metas,
  somenteDocumentos = false,
  podeAnexar = true,
  podeConferir = true,
}: {
  token: string;
  metas: MedicaoFormMeta[];
  somenteDocumentos?: boolean;
  podeAnexar?: boolean;
  podeConferir?: boolean;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [tipoDocumento, setTipoDocumento] =
    useState<"PLANO_GOVERNO" | "AUTO">("PLANO_GOVERNO");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [textoAbertoId, setTextoAbertoId] = useState<string | null>(null);
  const [textoExtraido, setTextoExtraido] = useState("");
  const requiredPlanStatus =
    docs === null ? null : getRequiredKnowledgeDocumentStatus(docs);

  async function load() {
    const res = await fetch(`${API_URL}/conhecimento/documentos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || "Falha ao carregar documentos");
    }
    setDocs(json.data);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Não foi possível carregar os documentos."),
      );
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSucesso("");
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    try {
      prepararDocumento(form);
      const res = await fetch(`${API_URL}/conhecimento/documentos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Falha ao salvar documento");
        return;
      }
      formElement.reset();
      setTipoDocumento("PLANO_GOVERNO");
      setSucesso("Documento enviado com sucesso.");
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o documento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function baixarArquivo(doc: Doc) {
    setDownloadingId(doc.id);
    setError("");
    try {
      const res = await fetch(`${API_URL}/conhecimento/documentos/${doc.id}/arquivo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json?.error?.message || "Falha ao baixar arquivo");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.arquivoNome || doc.titulo;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível baixar o arquivo. Tente novamente.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function alternarTexto(docId: string) {
    if (textoAbertoId === docId) {
      setTextoAbertoId(null);
      setTextoExtraido("");
      return;
    }
    setError("");
    try {
      const res = await fetch(`${API_URL}/conhecimento/documentos/${docId}/conteudo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Falha ao carregar texto extraído");
        return;
      }
      setTextoExtraido(
        json.data.texto ||
          json.data.mensagem ||
          "Nenhum texto foi extraído deste documento.",
      );
      setTextoAbertoId(docId);
    } catch {
      setError("Não foi possível carregar o texto extraído.");
    }
  }

  async function submitMedicao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    setSaving(true);
    setError("");
    try {
      await salvarMedicao(new FormData(formElement), token);
      formElement.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a medição.");
    } finally {
      setSaving(false);
    }
  }

  async function conferir(id: string) {
    setError("");
    try {
      const res = await fetch(`${API_URL}/conhecimento/documentos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statusConferencia: "CONFERIDO" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message || "Falha ao conferir documento");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conferir o documento.");
    }
  }

  async function corrigirTipo(id: string, tipo: string) {
    if (!isKnowledgeDocumentType(tipo)) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/conhecimento/documentos/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tipo, statusConferencia: "PENDENTE" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message || "Falha ao corrigir o tipo do documento");
      }
      await load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível corrigir o tipo do documento.");
    }
  }

  return (
    <div className="stack">
      <Card
        title="Documentos da base de conhecimento"
        subtitle="O Plano de Governo é o único documento obrigatório. Documentos adicionais são identificados automaticamente."
      >
        {requiredPlanStatus && (
          <section
            aria-label="Status do Plano de Governo obrigatório"
            role="status"
            style={{
              borderLeft: `4px solid ${
                requiredPlanStatus.status === "complete"
                  ? "var(--cip-success)"
                  : "var(--cip-warning, #b45309)"
              }`,
              marginBottom: 16,
              padding: "8px 12px",
            }}
          >
            <strong>
              Plano de Governo obrigatório:{" "}
              {requiredPlanStatus.status === "complete"
                ? "cadastrado"
                : "pendente"}
            </strong>
            <p className="dashboard-muted" style={{ margin: "4px 0 0" }}>
              {requiredPlanStatus.status === "missing"
                ? "O documento ainda não foi cadastrado."
                : requiredPlanStatus.status === "file-missing"
                  ? `“${requiredPlanStatus.titulo}” está cadastrado, mas falta anexar o arquivo obrigatório.`
                  : `“${requiredPlanStatus.titulo}” está cadastrado com arquivo.`}{" "}
              A pendência não bloqueia o uso dos demais recursos da plataforma.
            </p>
          </section>
        )}
        <ul className="stack" style={{ gap: 8 }}>
          {docs?.map((d) => (
            <li key={d.id} className="chip-row" style={{ justifyContent: "space-between" }}>
              <span>
                {isKnowledgeDocumentType(d.tipo)
                  ? knowledgeDocumentLabels[d.tipo]
                  : d.tipo} · {d.titulo}
                {d.vigencia ? ` (${d.vigencia})` : ""}
                {" · "}{d.statusConferencia === "PENDENTE" ? "Aguardando conferência" : d.statusConferencia === "CONFERIDO" ? "Conferido" : d.statusConferencia === "DESATUALIZADO" ? "Desatualizado" : d.statusConferencia}
                {d.arquivoNome ? <><br />Arquivo: {d.arquivoNome}</> : ""}
                {d.observacao && <span style={{ display: "block", whiteSpace: "pre-wrap", marginTop: 4 }}>{d.observacao}</span>}
              </span>
              <span className="chip-row">
                {podeConferir && isKnowledgeDocumentType(d.tipo) && (
                  <label>
                    Corrigir tipo de {d.titulo}
                    <select
                      value={d.tipo}
                      onChange={(event) => void corrigirTipo(d.id, event.currentTarget.value)}
                    >
                      {KNOWLEDGE_DOCUMENT_TYPES.map((tipo) => (
                        <option key={tipo} value={tipo}>{knowledgeDocumentLabels[tipo]}</option>
                      ))}
                    </select>
                  </label>
                )}
                {d.arquivoNome && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={downloadingId === d.id}
                    onClick={() => void baixarArquivo(d)}
                  >
                    {downloadingId === d.id ? "Baixando..." : "Baixar arquivo"}
                  </Button>
                )}
                {d.arquivoNome && (
                  <Button
                    type="button"
                    variant="secondary"
                    aria-expanded={textoAbertoId === d.id}
                    onClick={() => void alternarTexto(d.id)}
                  >
                    {textoAbertoId === d.id ? "Ocultar texto" : "Ver texto extraído"}
                  </Button>
                )}
                {podeConferir && d.statusConferencia !== "CONFERIDO" && (
                  <Button type="button" variant="secondary" onClick={() => void conferir(d.id)}>
                    Marcar conferido
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {docs && !docs.length && <p className="dashboard-muted">Nenhum documento cadastrado.</p>}
        {textoAbertoId && (
          <pre
            className="dashboard-muted"
            style={{ maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap", marginTop: 12 }}
          >
            {textoExtraido}
          </pre>
        )}
        {sucesso && <p role="status">{sucesso}</p>}
        {podeAnexar ? <form onSubmit={submitDoc} className="stack" style={{ marginTop: 16 }}>
          <div>
            <label htmlFor="tituloConhecimento">Título do documento (obrigatório)</label>
            <input
              id="tituloConhecimento"
              name="titulo"
              required
              minLength={3}
              placeholder="Ex.: Diagnóstico da educação municipal"
            />
          </div>
          <div>
            <label htmlFor="descricaoConhecimento">Descrição: do que trata o documento (obrigatória)</label>
            <textarea
              id="descricaoConhecimento"
              name="observacao"
              required
              minLength={3}
              rows={3}
              placeholder="Ex.: Apresenta a situação das escolas e as principais necessidades da rede municipal."
            />
          </div>
          <div>
            <label htmlFor="tipo">Documento a anexar</label>
            <select
              id="tipo"
              name="tipo"
              value={tipoDocumento}
              onChange={(event) => {
                const tipo = event.currentTarget.value;
                if (tipo === "PLANO_GOVERNO" || tipo === "AUTO") setTipoDocumento(tipo);
              }}
            >
              <option value="PLANO_GOVERNO">Plano de Governo (obrigatório)</option>
              <option value="AUTO">Outro documento (identificação automática)</option>
            </select>
          </div>
          <div>
            <label htmlFor="arquivoConhecimento">
              Arquivo PDF, DOC ou DOCX (até 4 MB)
            </label>
            <input
              id="arquivoConhecimento"
              name="arquivo"
              type="file"
              required
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
            <p className="dashboard-muted">
              A identificação automática é uma sugestão e depende do texto extraído.
              Documentos não identificados ficam como &quot;Outro&quot;; confira o resultado.
              PDFs digitalizados sem texto podem ser baixados, mas não são identificados.
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Incluir documento"}
          </Button>
        </form> : <p className="dashboard-muted">Seu perfil permite consultar documentos, mas não anexá-los.</p>}
      </Card>

      {!somenteDocumentos && <>
      <Card title="Medição de Meta Estratégica" subtitle="Registra realizado e esperado na data de corte">
        {!metas.length ? (
          <p className="dashboard-muted">Cadastre uma meta estratégica antes de medir.</p>
        ) : (
          <form onSubmit={submitMedicao} className="stack">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="metaEstrategicaId">Meta</label>
                <select id="metaEstrategicaId" name="metaEstrategicaId" required>
                  {metas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dataCorte">Data de corte</label>
                <input id="dataCorte" name="dataCorte" type="date" required />
              </div>
              <div>
                <label htmlFor="valorRealizado">Realizado</label>
                <input id="valorRealizado" name="valorRealizado" required />
              </div>
              <div>
                <label htmlFor="valorEsperado">Esperado</label>
                <input id="valorEsperado" name="valorEsperado" />
              </div>
            </div>
            <div>
              <label htmlFor="fonteMed">Fonte</label>
              <input id="fonteMed" name="fonte" placeholder="Relatório quinzenal / SEPLAN" />
            </div>
            <Button type="submit" disabled={saving}>
              Registrar medição
            </Button>
          </form>
        )}
      </Card>

      <Card title="Tramitação de validação" subtitle="Solicitação e decisão humanas (RN-V)">
        <TramitacaoMini token={token} metas={metas} />
      </Card>
      </>}

      {error && <p role="alert" style={{ color: "var(--cip-danger)" }}>{error}</p>}
    </div>
  );
}

function TramitacaoMini({
  token,
  metas,
}: {
  token: string;
  metas: MedicaoFormMeta[];
}) {
  const [lista, setLista] = useState<
    Array<{
      id: string;
      entidadeTipo: string;
      entidadeId: string;
      status: string;
      justificativa: string;
      decisoes: Array<{ resultado: string; parecer: string }>;
    }>
  >([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`${API_URL}/conhecimento/validacoes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || "Falha ao carregar tramitações");
    }
    setLista(json.data || []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((err: unknown) =>
        setMsg(err instanceof Error ? err.message : "Não foi possível carregar as tramitações."),
      );
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    setMsg("");
    const form = new FormData(formElement);
    try {
      const res = await fetch(`${API_URL}/conhecimento/validacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entidadeTipo: "META_ESTRATEGICA",
          entidadeId: String(form.get("entidadeId")),
          tipo: "REVISAO",
          justificativa: String(form.get("justificativa")),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Falha ao abrir solicitação");
      }
      formElement.reset();
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível abrir a solicitação.");
    }
  }

  async function decidir(id: string, resultado: "APROVADA" | "REJEITADA") {
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/conhecimento/validacoes/${id}/decidir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resultado,
          parecer: resultado === "APROVADA" ? "Aprovado na revisão municipal" : "Devolvido para ajuste",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Falha ao decidir a solicitação");
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível decidir a solicitação.");
    }
  }

  return (
    <div className="stack">
      <ul className="stack" style={{ gap: 8 }}>
        {lista.slice(0, 8).map((s) => (
          <li key={s.id} className="chip-row" style={{ justifyContent: "space-between" }}>
            <span>
              {s.entidadeTipo} · {s.status} · {s.justificativa.slice(0, 80)}
              {s.decisoes[0] ? ` → ${s.decisoes[0].resultado}` : ""}
            </span>
            {s.status === "ABERTA" && (
              <span className="chip-row">
                <Button type="button" onClick={() => void decidir(s.id, "APROVADA")}>
                  Aprovar
                </Button>
                <Button type="button" variant="secondary" onClick={() => void decidir(s.id, "REJEITADA")}>
                  Rejeitar
                </Button>
              </span>
            )}
          </li>
        ))}
        {!lista.length && <p className="dashboard-muted">Nenhuma tramitação aberta.</p>}
      </ul>
      {metas.length > 0 && (
        <form onSubmit={abrir} className="stack">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label htmlFor="entidadeId">Meta para revisão</label>
              <select id="entidadeId" name="entidadeId" required>
                {metas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="justificativa">Justificativa</label>
              <input id="justificativa" name="justificativa" required minLength={5} />
            </div>
          </div>
          <Button type="submit">Abrir solicitação</Button>
        </form>
      )}
      {msg && <p role="alert" style={{ color: "var(--cip-danger)" }}>{msg}</p>}
    </div>
  );
}
