"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";
import type { ProjetoDocMeta } from "./projeto-documento";

type Indicador = {
  id: string;
  nome: string;
  unidade?: string | null;
  valorBase?: string | null;
  alvo?: string | null;
  valorAtual?: string | null;
};

async function respostaJson(res: Response) {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Erro na solicitação (${res.status}).`);
  return json;
}

export function MetasIndicadores({
  iniciativaId,
  metas,
  token,
  canWrite,
  equipe,
}: {
  iniciativaId: string;
  metas: ProjetoDocMeta[];
  token: string;
  canWrite: boolean;
  equipe: string[];
}) {
  const router = useRouter();
  const [indicadores, setIndicadores] = useState<Record<string, Indicador[]>>({});
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [erroIndicadores, setErroIndicadores] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);
  const metaIds = metas.map((m) => m.id).join(",");

  useEffect(() => {
    let cancelado = false;
    const ids = metaIds ? metaIds.split(",") : [];
    Promise.all(ids.map(async (id) => {
      const res = await fetch(`${API_URL}/planejamento/indicadores?metaExecucaoId=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await respostaJson(res);
      if (!Array.isArray(json.data)) throw new Error("Resposta inválida ao carregar indicadores.");
      return [id, json.data as Indicador[]] as const;
    })).then((resultados) => {
      if (cancelado) return;
      setIndicadores(Object.fromEntries(resultados));
      setErroIndicadores("");
      setCarregando(false);
    }).catch((err: unknown) => {
      if (cancelado) return;
      setErroIndicadores(err instanceof Error ? err.message : "Não foi possível carregar os indicadores.");
      setCarregando(false);
    });
    return () => { cancelado = true; };
  }, [metaIds, token, versao]);

  async function salvar(event: React.FormEvent<HTMLFormElement>, url: string, dados: Record<string, string>, mensagem: string) {
    event.preventDefault();
    const form = event.currentTarget;
    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      await respostaJson(await fetch(`${API_URL}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(dados),
      }));
      form.reset();
      setSucesso(mensagem);
      router.refresh();
      setCarregando(true);
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="stack">
      <Card title="Metas e indicadores do projeto" subtitle="Defina as entregas deste projeto e como acompanhar seus resultados. Estas metas não criam um vínculo com o plano de governo.">
        <div className="stack">
          {erro && <p role="alert">{erro}</p>}
          {sucesso && <p role="status">{sucesso}</p>}
          {canWrite && (
            <form className="quick-task-form" onSubmit={(event) => {
              const fd = new FormData(event.currentTarget);
              void salvar(event, `/iniciativas/${iniciativaId}/metas-execucao`, {
                nome: String(fd.get("nome") || "").trim(),
                responsavel: String(fd.get("responsavel") || "").trim(),
              }, "Meta adicionada ao projeto.");
            }}>
              <strong className="quick-task-form__title">Adicionar meta do projeto</strong>
              <label>O que o projeto precisa entregar?
                <input name="nome" required minLength={3} maxLength={500} placeholder="Ex.: construir uma unidade de saúde" />
              </label>
              <label>Responsável
                <input name="responsavel" list="equipe-metas-projeto" maxLength={200} placeholder="Nome ou equipe" />
              </label>
              <datalist id="equipe-metas-projeto">
                {equipe.map((nome) => <option key={nome} value={nome} />)}
              </datalist>
              <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Adicionar meta"}</Button>
            </form>
          )}
          {!metas.length && <p>Este projeto ainda não tem metas. {canWrite ? "Adicione a primeira meta para acompanhar suas entregas." : "A consultoria poderá cadastrá-las."}</p>}
          {erroIndicadores && (
            <div role="alert">
              <p>Não foi possível carregar os indicadores: {erroIndicadores}</p>
              <Button type="button" variant="ghost" onClick={() => {
                setCarregando(true);
                setVersao((v) => v + 1);
              }}>Tentar novamente</Button>
            </div>
          )}
          {metas.map((meta) => (
            <article key={meta.id} className="entity-card">
              <h3>{meta.nome}</h3>
              <p className="dashboard-muted">Responsável: {meta.responsavel || "Não informado"}</p>
              {meta.indicador && <p>Indicador da meta: {meta.indicador}{meta.alvo ? ` · Resultado esperado: ${meta.alvo}` : ""}{meta.valorAtual ? ` · Atual: ${meta.valorAtual}` : ""}</p>}
              <h4>Indicadores de acompanhamento</h4>
              {carregando ? <p>Carregando indicadores...</p> : !erroIndicadores && (
                indicadores[meta.id]?.length ? (
                  <ul>
                    {indicadores[meta.id].map((ind) => (
                      <li key={ind.id}>
                        <strong>{ind.nome}</strong>
                        {ind.unidade && ` · Unidade: ${ind.unidade}`}
                        {ind.valorBase && ` · Base: ${ind.valorBase}`}
                        {ind.alvo && ` · Alvo: ${ind.alvo}`}
                        {ind.valorAtual && ` · Atual: ${ind.valorAtual}`}
                      </li>
                    ))}
                  </ul>
                ) : <p>Nenhum indicador de acompanhamento cadastrado.</p>
              )}
              {canWrite && (
                <details>
                  <summary>Adicionar indicador</summary>
                  <form className="quick-task-form" onSubmit={(event) => {
                    const fd = new FormData(event.currentTarget);
                    void salvar(event, "/planejamento/indicadores", {
                      metaExecucaoId: meta.id,
                      nome: String(fd.get("nome") || "").trim(),
                      unidade: String(fd.get("unidade") || "").trim(),
                      valorBase: String(fd.get("valorBase") || "").trim(),
                      alvo: String(fd.get("alvo") || "").trim(),
                    }, "Indicador adicionado à meta.");
                  }}>
                    <label>Nome do indicador
                      <input name="nome" required minLength={3} maxLength={300} placeholder="Ex.: atendimentos realizados" />
                    </label>
                    <label>Unidade
                      <input name="unidade" placeholder="Ex.: atendimentos" />
                    </label>
                    <label>Valor inicial
                      <input name="valorBase" placeholder="Ex.: 0" />
                    </label>
                    <label>Resultado esperado
                      <input name="alvo" placeholder="Ex.: 500" />
                    </label>
                    <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Adicionar indicador"}</Button>
                  </form>
                </details>
              )}
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
