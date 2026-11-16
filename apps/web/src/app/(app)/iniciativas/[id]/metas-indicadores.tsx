"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";

type Indicador = {
  id: string;
  nome: string;
  descricao?: string | null;
  unidade?: string | null;
  valorBase?: string | null;
  alvo?: string | null;
  valorAtual?: string | null;
  periodicidade?: string | null;
};

type Meta = {
  id: string;
  nome: string;
  descricao?: string | null;
  indicadores: Indicador[];
};

type Plano = { id: string; nome: string; periodo?: string | null };

export function ListaIndicadoresEstrategicos({ indicadores }: { indicadores: Indicador[] }) {
  return indicadores.length ? (
    <ul>
      {indicadores.map((ind) => (
        <li key={ind.id}>
          <strong>{ind.nome}</strong>
          {ind.descricao && ` · ${ind.descricao}`}
          {ind.unidade && ` · Unidade: ${ind.unidade}`}
          {ind.valorBase && ` · Base: ${ind.valorBase}`}
          {ind.alvo && ` · Alvo: ${ind.alvo}`}
          {ind.valorAtual && ` · Atual: ${ind.valorAtual}`}
          {ind.periodicidade && ` · Periodicidade: ${ind.periodicidade}`}
        </li>
      ))}
    </ul>
  ) : <p>Nenhum indicador cadastrado para esta meta.</p>;
}

async function respostaJson(res: Response) {
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`O servidor retornou uma resposta inesperada (${res.status}).`);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Erro na solicitação (${res.status}).`);
  return json;
}

export function MetasIndicadores({
  iniciativaId,
  token,
  canWrite,
}: {
  iniciativaId: string;
  token: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let cancelado = false;
    fetch(`${API_URL}/iniciativas/${encodeURIComponent(iniciativaId)}/estrategia`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(respostaJson)
      .then(async (json) => {
        if (!json.data || !("meta" in json.data) ||
          (json.data.meta !== null && !Array.isArray(json.data.meta.indicadores))) {
          throw new Error("Resposta inválida ao carregar a meta e os indicadores.");
        }
        let planosDisponiveis: Plano[] = [];
        if (json.data.meta === null && canWrite) {
          const resposta = await respostaJson(await fetch(
            `${API_URL}/iniciativas/${encodeURIComponent(iniciativaId)}/estrategia/planos`,
            { headers: { Authorization: `Bearer ${token}` } },
          ));
          if (!Array.isArray(resposta.data?.planos)) {
            throw new Error("Resposta inválida ao carregar os planos de governo.");
          }
          planosDisponiveis = resposta.data.planos;
        }
        if (!cancelado) {
          setMeta(json.data.meta);
          setPlanos(planosDisponiveis);
          setErroCarga("");
          setCarregando(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErroCarga(err instanceof Error ? err.message : "Não foi possível carregar a meta e os indicadores.");
          setCarregando(false);
        }
      });
    return () => { cancelado = true; };
  }, [canWrite, iniciativaId, token, versao]);

  async function salvar(event: React.FormEvent<HTMLFormElement>, caminho: string, campos: string[], mensagem: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const valores = new FormData(form);
    const dados = Object.fromEntries(campos.map((campo) => [campo, String(valores.get(campo) || "").trim()]));
    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      await respostaJson(await fetch(`${API_URL}/iniciativas/${encodeURIComponent(iniciativaId)}/estrategia${caminho}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(dados),
      }));
      form.reset();
      setSucesso(mensagem);
      setCarregando(true);
      setVersao((v) => v + 1);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="stack">
      <Card title="Meta estratégica e indicadores" subtitle="Acompanhe a meta vinculada a este projeto e os indicadores que medem seus resultados.">
        <div className="stack">
          {erro && <p role="alert">{erro}</p>}
          {sucesso && <p role="status">{sucesso}</p>}
          {carregando ? <p>Carregando meta e indicadores...</p> : erroCarga ? (
            <div role="alert">
              <p>Não foi possível carregar a meta e os indicadores: {erroCarga}</p>
              <Button type="button" variant="ghost" onClick={() => {
                setCarregando(true);
                setVersao((v) => v + 1);
              }}>Tentar novamente</Button>
            </div>
          ) : !meta ? (
            <>
              <p>Este projeto ainda não possui meta estratégica. {canWrite ? "Cadastre uma meta para acompanhar seus resultados." : "A consultoria poderá cadastrá-la."}</p>
              {canWrite && planos.length === 0 && <p>Cadastre um plano de governo para esta prefeitura antes de adicionar a meta.</p>}
              {canWrite && planos.length > 0 && (
                <form className="quick-task-form" onSubmit={(event) => void salvar(event, "", ["nome", "descricao", ...(planos.length > 1 ? ["planoId"] : [])], "Meta estratégica cadastrada e vinculada ao projeto.")}>
                  <strong className="quick-task-form__title">Adicionar meta estratégica</strong>
                  {planos.length > 1 && (
                    <label>Plano de governo
                      <select name="planoId" required defaultValue="">
                        <option value="" disabled>Selecione o plano</option>
                        {planos.map((plano) => (
                          <option key={plano.id} value={plano.id}>{plano.nome}{plano.periodo ? ` (${plano.periodo})` : ""}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>Nome da meta estratégica
                    <input name="nome" required minLength={3} maxLength={191} placeholder="Ex.: ampliar o acesso à atenção primária" />
                  </label>
                  <label>Descrição
                    <textarea name="descricao" maxLength={2000} placeholder="Descreva o resultado que se pretende alcançar" />
                  </label>
                  <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Adicionar meta estratégica"}</Button>
                </form>
              )}
            </>
          ) : (
            <article className="entity-card">
              <h3>{meta.nome}</h3>
              {meta.descricao && <p>{meta.descricao}</p>}
              <h4>Indicadores da meta</h4>
              <ListaIndicadoresEstrategicos indicadores={meta.indicadores} />
              {canWrite && (
                <details>
                  <summary>Adicionar indicador</summary>
                  <form className="quick-task-form" onSubmit={(event) => void salvar(event, "/indicadores", ["nome", "descricao", "unidade", "valorBase", "alvo", "valorAtual", "periodicidade"], "Indicador cadastrado para a meta estratégica do projeto.")}>
                    <label>Nome do indicador
                      <input name="nome" required minLength={3} maxLength={191} placeholder="Ex.: atendimentos realizados" />
                    </label>
                    <label>Descrição
                      <textarea name="descricao" maxLength={2000} />
                    </label>
                    <label>Unidade
                      <input name="unidade" maxLength={100} placeholder="Ex.: atendimentos" />
                    </label>
                    <label>Valor inicial
                      <input name="valorBase" maxLength={100} placeholder="Ex.: 0" />
                    </label>
                    <label>Resultado esperado
                      <input name="alvo" maxLength={100} placeholder="Ex.: 500" />
                    </label>
                    <label>Valor atual
                      <input name="valorAtual" maxLength={100} placeholder="Ex.: 120" />
                    </label>
                    <label>Periodicidade
                      <input name="periodicidade" maxLength={100} placeholder="Ex.: mensal" />
                    </label>
                    <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Adicionar indicador"}</Button>
                  </form>
                </details>
              )}
            </article>
          )}
        </div>
      </Card>
    </div>
  );
}
