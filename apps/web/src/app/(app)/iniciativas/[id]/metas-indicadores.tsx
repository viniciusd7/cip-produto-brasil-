"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
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

function valorInformado(valor?: string | null) {
  return Boolean(valor?.trim());
}

function frequenciaLabel(valor?: string | null) {
  const texto = valor?.trim();
  if (!texto) return "Não informada";
  const labels: Record<string, string> = { DIARIA: "Diária", DIÁRIA: "Diária", SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal", BIMESTRAL: "Bimestral", TRIMESTRAL: "Trimestral", SEMESTRAL: "Semestral", ANUAL: "Anual" };
  return labels[texto.toLocaleUpperCase("pt-BR")] || texto;
}

function ValorIndicador({ valor, unidade }: { valor?: string | null; unidade?: string | null }) {
  const texto = valor?.trim() || "";
  const unidadeMedida = unidade?.trim();
  // Os campos também aceitam texto. Preserve o que foi cadastrado e acrescente
  // a unidade apenas a valores numéricos, sem duplicar "25%" ou "R$ 100".
  const exibirUnidade = texto && unidadeMedida && /^[+-]?\d[\d.,\s]*$/.test(texto);
  return (
    <dd className={!texto ? "pj-indicator__missing" : undefined}>
      <span>{texto || "Não informado"}</span>
      {exibirUnidade && <small>{unidadeMedida}</small>}
    </dd>
  );
}

export function ResumoMetaEstrategica({ nome, descricao }: { nome: string; descricao?: string | null }) {
  return (
    <div className="pj-results__goal">
      <p>Meta que este projeto ajuda a alcançar</p>
      <h3>{nome}</h3>
      {descricao && <p className="pj-results__goal-description">{descricao}</p>}
    </div>
  );
}

export function ListaIndicadoresEstrategicos({ indicadores }: { indicadores: Indicador[] }) {
  return indicadores.length ? (
    <ul className="pj-indicators" aria-label="Indicadores vinculados à meta">
      {indicadores.map((ind) => (
        <li key={ind.id} className="pj-indicator">
          <article aria-labelledby={`indicador-${ind.id}`}>
            <header className="pj-indicator__heading">
              <div>
                <h4 id={`indicador-${ind.id}`}>{ind.nome}</h4>
                {ind.descricao && <p>{ind.descricao}</p>}
              </div>
              <p className="pj-indicator__frequency">
                <span>Atualização prevista</span>
                <strong>{frequenciaLabel(ind.periodicidade)}</strong>
              </p>
            </header>
            <dl className="pj-indicator__values">
              <div>
                <dt>Ponto de partida</dt>
                <ValorIndicador valor={ind.valorBase} unidade={ind.unidade} />
              </div>
              <div className="pj-indicator__current">
                <dt>Valor atual informado</dt>
                <ValorIndicador valor={ind.valorAtual} unidade={ind.unidade} />
              </div>
              <div>
                <dt>Resultado esperado</dt>
                <ValorIndicador valor={ind.alvo} unidade={ind.unidade} />
              </div>
            </dl>
            {!valorInformado(ind.valorAtual) && <p className="pj-indicator__note">O valor atual ainda não foi informado para este indicador.</p>}
          </article>
        </li>
      ))}
    </ul>
  ) : (
    <div className="pj-results__empty">
      <strong>Nenhum indicador cadastrado para esta meta.</strong>
      <p>Os indicadores mostram como o resultado da meta será acompanhado.</p>
    </div>
  );
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
  const salvandoRef = useRef(false);
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
    if (salvandoRef.current) return;
    const form = event.currentTarget;
    const valores = new FormData(form);
    const dados = Object.fromEntries(campos.map((campo) => [campo, String(valores.get(campo) || "").trim()]));
    salvandoRef.current = true;
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
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <section className="pj-results" aria-label="Metas e indicadores do projeto">
      <header className="pj-results__header">
        <h2>Metas e indicadores</h2>
        <p>Veja o resultado que este projeto ajuda a alcançar e os valores informados para acompanhá-lo.</p>
      </header>
      {erro && <p className="pj-results__feedback pj-results__feedback--error" role="alert">{erro}</p>}
      {sucesso && <p className="pj-results__feedback" role="status">{sucesso}</p>}
      {carregando ? <p className="pj-results__state" role="status">Carregando meta e indicadores...</p> : erroCarga ? (
        <div className="pj-results__state" role="alert">
          <h3>Não foi possível carregar os resultados</h3>
          <p>{erroCarga}</p>
          <Button type="button" variant="secondary" onClick={() => {
            setCarregando(true);
            setVersao((v) => v + 1);
          }}>Tentar novamente</Button>
        </div>
      ) : !meta ? (
        <>
          <div className="pj-results__empty">
            <h3>Este projeto ainda não tem uma meta estratégica</h3>
            <p>{canWrite ? "Defina o resultado que o projeto deve ajudar a alcançar. Depois, adicione os indicadores para acompanhá-lo." : "A consultoria poderá vincular uma meta e os indicadores de resultado a este projeto."}</p>
          </div>
          {canWrite && planos.length === 0 && <p>Cadastre um plano de governo para esta prefeitura antes de adicionar a meta.</p>}
          {canWrite && planos.length > 0 && (
            <form className="pj-results__form" onSubmit={(event) => void salvar(event, "", ["nome", "descricao", ...(planos.length > 1 ? ["planoId"] : [])], "Meta estratégica cadastrada e vinculada ao projeto.")}>
              <fieldset className="pj-results__form-fields" disabled={salvando}>
                <legend>Adicionar meta estratégica</legend>
                {planos.length > 1 && (
                  <label className="pj-results__wide">Plano de governo
                    <select name="planoId" required defaultValue="">
                      <option value="" disabled>Selecione o plano</option>
                      {planos.map((plano) => (
                        <option key={plano.id} value={plano.id}>{plano.nome}{plano.periodo ? ` (${plano.periodo})` : ""}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="pj-results__wide">Nome da meta estratégica
                  <input name="nome" required minLength={3} maxLength={191} placeholder="Ex.: ampliar o acesso à atenção primária" />
                </label>
                <label className="pj-results__wide">Resultado que se pretende alcançar
                  <textarea name="descricao" maxLength={2000} rows={3} placeholder="Descreva o resultado esperado e quem será beneficiado" />
                </label>
                <div className="pj-results__wide"><Button type="submit">{salvando ? "Salvando..." : "Adicionar meta estratégica"}</Button></div>
              </fieldset>
            </form>
          )}
        </>
      ) : (
        <>
          <ResumoMetaEstrategica nome={meta.nome} descricao={meta.descricao} />
          <div className="pj-results__indicators-heading">
            <h3>Como os resultados são acompanhados</h3>
            <p>Compare o ponto de partida, o valor atual informado e o resultado esperado de cada indicador desta meta.</p>
          </div>
          <ListaIndicadoresEstrategicos indicadores={meta.indicadores} />
          {canWrite && (
            <details className="pj-results__create">
              <summary>Adicionar indicador</summary>
              <form className="pj-results__form" onSubmit={(event) => void salvar(event, "/indicadores", ["nome", "descricao", "unidade", "valorBase", "alvo", "valorAtual", "periodicidade"], "Indicador cadastrado para a meta estratégica do projeto.")}>
                <fieldset className="pj-results__form-fields" disabled={salvando}>
                  <legend>Novo indicador da meta</legend>
                  <label className="pj-results__wide">O que será acompanhado
                    <input name="nome" required minLength={3} maxLength={191} placeholder="Ex.: pessoas atendidas pela unidade de saúde" />
                  </label>
                  <label className="pj-results__wide">Descrição do indicador
                    <textarea name="descricao" maxLength={2000} rows={2} placeholder="Explique o que este valor representa" />
                  </label>
                  <label>Unidade de medida
                    <input name="unidade" maxLength={100} placeholder="Ex.: pessoas, escolas ou %" />
                  </label>
                  <label>Frequência de atualização
                    <input name="periodicidade" maxLength={100} placeholder="Ex.: mensal" />
                  </label>
                  <div className="pj-results__form-values pj-results__wide">
                    <label>Ponto de partida
                      <input name="valorBase" maxLength={100} placeholder="Ex.: 0" />
                    </label>
                    <label>Valor atual informado
                      <input name="valorAtual" maxLength={100} placeholder="Ex.: 120" />
                    </label>
                    <label>Resultado esperado
                      <input name="alvo" maxLength={100} placeholder="Ex.: 500" />
                    </label>
                  </div>
                  <div className="pj-results__wide"><Button type="submit">{salvando ? "Salvando..." : "Salvar indicador"}</Button></div>
                </fieldset>
              </form>
            </details>
          )}
          {!!meta.indicadores.length && <p className="pj-results__source">Os valores exibidos são os informados para esta meta estratégica.</p>}
        </>
      )}
    </section>
  );
}
