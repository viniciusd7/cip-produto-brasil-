"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@cip/ui";
import {
  GRUPOS_ACAO,
  GRUPOS_CONDICOES,
  GRUPOS_PLANO,
  buildCatalogoPerguntas,
  MODELO_ACAO_DIARIA,
  MODELO_PLANO_GOVERNO,
  quizItem,
  tonePrioridade,
  toneEtapa,
  visibleQuestions,
  type ModeloPerguntaDef,
  type RespostaViabilidade,
  type TreeNode,
} from "@cip/shared";
import { API_URL } from "@/lib/api";
import { secretariaChipLabel, secretariaLabel } from "@/lib/secretaria-label";
import { CondicaoCard, type CondicaoValorState } from "@/components/condicao-card";
import { FluxoArvore, type FluxoNode } from "@/components/fluxo-arvore";
import { EscopoEditor, temResponsavel, type EscopoNo } from "./escopo-editor";

type Secretaria = {
  id: string;
  nome: string;
  sigla?: string | null;
  titularNome?: string | null;
};

type PessoaPasta = {
  id: string;
  nome: string;
  cargo: string;
  papel: string;
};

type Modelo = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
};

type EtapaPreview = {
  ordem: number;
  codigo: string;
  nome: string;
  status: string;
  respondidas: number;
  favoraveis: number;
  total: number;
};

type PreviewData = {
  cicloInicial: string;
  bloqueioLabel: string | null;
  bloqueios: Array<{ perguntaCodigo: string; rotulo: string }>;
  prioridade: string;
  motivosPrioridade: string[];
  prontidaoPct: number | null;
  etapas: EtapaPreview[];
  etapaAtual: string | null;
  avisos: string[];
};

/** Nó do escopo como devolvido pela API (preview). */
type NoApi = {
  codigo: string;
  nivel: string;
  nome: string;
  indicador?: string | null;
  alvo?: string | null;
  responsavel?: string | null;
  prazo?: string | null;
  origemPerguntaCodigo?: string | null;
  origemValor?: string | null;
  children?: NoApi[];
};

type Classificacao = "ESTRUTURANTE" | "PLANO_GOVERNO" | "ACAO_DIARIA";

const STEPS_ESTRUT = [
  "Tipo",
  "Identidade",
  ...(GRUPOS_CONDICOES ?? []).map((g) => g.nome),
  "Urgência",
  "Escopo",
  "Prévia",
];
const STEPS_PLANO = [
  "Tipo",
  "Identidade",
  ...(GRUPOS_PLANO ?? []).map((g) => g.nome),
  "Escopo",
  "Prévia",
];
const STEPS_ACAO = [
  "Tipo",
  "Identidade",
  ...(GRUPOS_ACAO ?? []).map((g) => g.nome),
  "Escopo",
  "Prévia",
];
const NOVO_VALOR = "__novo__";
const PERGUNTAS_ESTRUTURANTE = buildCatalogoPerguntas();

const PRIORIDADE_LABEL: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

const ETAPA_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADA: "Bloqueada",
  CONCLUIDA: "Concluída",
  NAO_APLICAVEL: "Não se aplica",
};

function paraEscopo(n: NoApi): EscopoNo {
  return {
    codigo: n.codigo,
    nivel: n.nivel as EscopoNo["nivel"],
    nome: n.nome,
    indicador: n.indicador ?? null,
    alvo: n.alvo ?? null,
    responsavel: n.responsavel ?? null,
    prazo: n.prazo ?? null,
    origemPerguntaCodigo: n.origemPerguntaCodigo ?? null,
    origemValor: n.origemValor ?? null,
    manual: false,
    children: (n.children || []).map(paraEscopo),
  };
}

function paraTreeNode(n: EscopoNo): TreeNode {
  return {
    codigo: n.codigo,
    nivel: n.nivel,
    nome: n.nome.trim(),
    indicador: n.indicador ?? null,
    alvo: n.alvo ?? null,
    responsavel: n.responsavel?.trim() || null,
    prazo: n.nivel === "TAREFA" ? (n.prazo ?? null) : null,
    origemPerguntaCodigo: n.origemPerguntaCodigo ?? null,
    origemValor: n.origemValor ?? null,
    children: n.children.map(paraTreeNode),
  };
}

/**
 * Ao reavaliar (voltar e mudar uma resposta), o modelo pode incluir ou tirar
 * tarefas. Mantém o que a equipe já editou (responsável, prazo, nome) e os
 * itens criados à mão; só remove itens do modelo que deixaram de valer.
 */
function mesclarEscopo(anterior: EscopoNo[], novo: EscopoNo[]): EscopoNo[] {
  const antigos = new Map(anterior.map((n) => [n.codigo, n]));
  const doModelo = novo.map((n) => {
    const antigo = antigos.get(n.codigo);
    if (!antigo) return n;
    return {
      ...n,
      nome: antigo.nome,
      responsavel: antigo.responsavel,
      prazo: antigo.prazo,
      children: mesclarEscopo(antigo.children, n.children),
    };
  });
  const codigosNovos = new Set(novo.map((n) => n.codigo));
  const manuais = anterior.filter((n) => n.manual && !codigosNovos.has(n.codigo));
  return [...doModelo, ...manuais];
}

function contarSemResponsavel(nos: EscopoNo[]): number {
  return nos.reduce(
    (acc, n) => acc + (temResponsavel(n) ? 0 : 1) + contarSemResponsavel(n.children),
    0,
  );
}

function contarItens(nos: EscopoNo[]): number {
  return nos.reduce((acc, n) => acc + 1 + contarItens(n.children), 0);
}

export function NovoProjetoWizard({
  token,
  defaultSecretariaId,
  secretarias,
  modelos,
  metas,
  planos,
}: {
  token: string;
  defaultSecretariaId?: string;
  secretarias: Secretaria[];
  modelos: Modelo[];
  metas: Array<{ id: string; label: string }>;
  planos: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [classificacao, setClassificacao] = useState<Classificacao>("ESTRUTURANTE");
  const [vinculoPlanoExtra, setVinculoPlanoExtra] = useState(false);
  const [perguntas, setPerguntas] = useState<ModeloPerguntaDef[]>([]);
  const [respostas, setRespostas] = useState<Record<string, CondicaoValorState>>({});
  const [secretariaId, setSecretariaId] = useState(
    defaultSecretariaId || secretarias[0]?.id || "",
  );
  const [secretariasCorrelatas, setSecretariasCorrelatas] = useState<string[]>([]);
  // Equipe carregada para um conjunto de secretarias envolvidas (chave = ids).
  const [equipeCarregada, setEquipeCarregada] = useState<{
    key: string;
    mapa: Record<string, PessoaPasta[]>;
  } | null>(null);
  const [responsavelPessoaId, setResponsavelPessoaId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [entrega, setEntrega] = useState("");
  const [foraEscopo, setForaEscopo] = useState("");
  const [beneficiariosTxt, setBeneficiariosTxt] = useState("");
  const [metaId, setMetaId] = useState("");
  const [novaMetaNome, setNovaMetaNome] = useState("");
  const [planoId, setPlanoId] = useState(planos[0]?.id || "__novo__");
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [escopo, setEscopo] = useState<EscopoNo[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [ultimoPassoGerado, setUltimoPassoGerado] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const estruturante = classificacao === "ESTRUTURANTE";
  const steps =
    classificacao === "ESTRUTURANTE"
      ? STEPS_ESTRUT
      : classificacao === "PLANO_GOVERNO"
        ? STEPS_PLANO
        : STEPS_ACAO;
  // Grupos do catálogo ativo, buscados dentro do próprio fluxo. Um mapa global
  // nome→id colidia ("Recursos" existe no estruturante e no Plano de Governo).
  const gruposAtivos =
    classificacao === "ESTRUTURANTE"
      ? GRUPOS_CONDICOES
      : classificacao === "PLANO_GOVERNO"
        ? GRUPOS_PLANO
        : GRUPOS_ACAO;
  const grupoAtualMeta = gruposAtivos.find((g) => g.nome === steps[step]);
  const exigeMeta =
    classificacao === "PLANO_GOVERNO" ||
    (classificacao === "ESTRUTURANTE" && vinculoPlanoExtra);
  const modeloPadrao = useMemo(
    () =>
      modelos.find((m) => m.codigo === "PROJETO_ESTRUTURANTE_PADRAO") ||
      modelos.find((m) => m.codigo.startsWith("PROJETO_ESTRUTURANTE")) ||
      modelos[0],
    [modelos],
  );
  const sec = useMemo(
    () => secretarias.find((s) => s.id === secretariaId),
    [secretarias, secretariaId],
  );
  const envolvidasIds = useMemo(
    () =>
      [secretariaId, ...secretariasCorrelatas.filter((id) => id !== secretariaId)].filter(
        Boolean,
      ),
    [secretariaId, secretariasCorrelatas],
  );
  const envolvidasKey = envolvidasIds.join(",");
  const equipePorSecretaria =
    equipeCarregada && equipeCarregada.key === envolvidasKey ? equipeCarregada.mapa : {};
  const pessoasLoading = !equipeCarregada || equipeCarregada.key !== envolvidasKey;
  const registrandoNovo = responsavelPessoaId === NOVO_VALOR;
  const equipeNomes = Array.from(
    new Set(Object.values(equipePorSecretaria).flat().map((p) => p.nome)),
  ).sort();

  const perguntasAtivas: ModeloPerguntaDef[] =
    classificacao === "ESTRUTURANTE"
      ? modeloPadrao?.codigo === "PROJETO_ESTRUTURANTE_PADRAO"
        ? PERGUNTAS_ESTRUTURANTE
        : perguntas
      : classificacao === "PLANO_GOVERNO"
        ? MODELO_PLANO_GOVERNO.perguntas
        : MODELO_ACAO_DIARIA.perguntas;

  // Checklist do modelo estruturante (Plano e Ação usam catálogo fixo no código).
  useEffect(() => {
    if (classificacao !== "ESTRUTURANTE" || !modeloPadrao?.id) return;
    let cancelled = false;
    fetch(`${API_URL}/modelos-projeto/${modeloPadrao.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const snap = json?.data?.snapshot;
        setPerguntas(snap?.perguntas || json?.data?.perguntas || []);
      })
      .catch(() => {
        if (!cancelled) setPerguntas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [classificacao, modeloPadrao?.id, token]);

  const respostaList: RespostaViabilidade[] = useMemo(
    () =>
      Object.entries(respostas).map(([perguntaCodigo, valor]) => ({
        perguntaCodigo,
        valor: valor as RespostaViabilidade["valor"],
      })),
    [respostas],
  );

  const descricaoCompleta = useMemo(() => {
    const prefixo = classificacao === "ACAO_DIARIA"
      ? "Demanda"
      : classificacao === "PLANO_GOVERNO"
        ? "Compromisso"
        : "Problema";
    const parts = [
      descricao.trim() && `${prefixo}: ${descricao.trim()}`,
      classificacao !== "ACAO_DIARIA" && entrega.trim() && `Entrega: ${entrega.trim()}`,
      classificacao === "ESTRUTURANTE" && beneficiariosTxt.trim() && `Beneficiários: ${beneficiariosTxt.trim()}`,
      classificacao === "ESTRUTURANTE" && foraEscopo.trim() && `Fora de escopo: ${foraEscopo.trim()}`,
    ].filter(Boolean);
    return parts.join("\n\n") || undefined;
  }, [classificacao, descricao, entrega, beneficiariosTxt, foraEscopo]);

  // Mesma regra do servidor: uma única fonte de verdade para mostrar/ocultar perguntas.
  const visiblePerguntas = useMemo(
    () => visibleQuestions(perguntasAtivas, respostaList),
    [perguntasAtivas, respostaList],
  );

  // Equipe de todas as pastas envolvidas (principal + correlacionadas).
  // Responsável do projeto pode vir de qualquer uma delas.
  useEffect(() => {
    if (!token || !secretariaId) return;
    let cancelled = false;
    Promise.all(
      envolvidasKey.split(",").map(async (id) => {
        const res = await fetch(`${API_URL}/admin/secretarias/${id}/pessoas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        return [id, (json?.data || []) as PessoaPasta[]] as const;
      }),
    )
      .then((entradas) => {
        if (cancelled) return;
        const mapa = Object.fromEntries(entradas) as Record<string, PessoaPasta[]>;
        setEquipeCarregada({ key: envolvidasKey, mapa });
        const todas = entradas.flatMap(([, rows]) => rows);
        const principal = mapa[secretariaId] || [];
        setResponsavelPessoaId((current) => {
          if (current === NOVO_VALOR) return current;
          if (current && todas.some((p) => p.id === current)) return current;
          const titular = principal.find((p) => p.papel === "TITULAR");
          // Pasta sem equipe cadastrada: já abre o cadastro do responsável.
          return titular?.id || principal[0]?.id || NOVO_VALOR;
        });
      })
      .catch(() => {
        if (!cancelled) setEquipeCarregada({ key: envolvidasKey, mapa: {} });
      });
    return () => {
      cancelled = true;
    };
    // secretariaId já está representado em envolvidasKey.
  }, [envolvidasKey, secretariaId, token]);

  async function runPreview() {
    const res = await fetch(`${API_URL}/iniciativas/wizard/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        modeloProjetoId: estruturante ? modeloPadrao?.id || undefined : undefined,
        classificacaoPrincipal: classificacao,
        respostas: respostaList,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Falha no preview");
    setPreview({
      cicloInicial: json.data.cicloInicial,
      bloqueioLabel: json.data.bloqueioLabel,
      bloqueios: json.data.bloqueios || [],
      prioridade: json.data.prioridade,
      motivosPrioridade: json.data.motivosPrioridade || [],
      prontidaoPct: json.data.prontidaoPct ?? null,
      etapas: json.data.etapas || [],
      etapaAtual: json.data.etapaAtual ?? null,
      avisos: json.data.avisos || [],
    });
    const estruturaModelo = ((json.data.estrutura || []) as NoApi[]).map(paraEscopo);
    const proximoPasso = classificacao === "ACAO_DIARIA"
      ? respostas.acao_providencia
      : classificacao === "PLANO_GOVERNO"
        ? respostas.plano_proximo_marco
        : undefined;
    if (typeof proximoPasso === "string" && proximoPasso.trim()) {
      const codigoMeta = classificacao === "ACAO_DIARIA" ? "META_ACAO" : "META_PLANO";
      estruturaModelo.push({
        codigo: codigoMeta,
        nivel: "META",
        nome: classificacao === "ACAO_DIARIA" ? "Executar ação" : "Cumprir compromisso",
        indicador: null,
        alvo: null,
        responsavel: null,
        prazo: null,
        origemPerguntaCodigo: null,
        origemValor: null,
        manual: false,
        children: [{
          codigo: `${codigoMeta}_PROXIMO`,
          nivel: "TAREFA",
          nome: proximoPasso.trim(),
          indicador: null,
          alvo: null,
          responsavel: null,
          prazo: null,
          origemPerguntaCodigo: null,
          origemValor: null,
          manual: false,
          children: [],
        }],
      });
    }
    setEscopo((anterior) => {
      const mesclado = mesclarEscopo(anterior, estruturaModelo);
      if (typeof proximoPasso !== "string" || !proximoPasso.trim() || proximoPasso.trim() === ultimoPassoGerado) {
        return mesclado;
      }
      const codigoMeta = classificacao === "ACAO_DIARIA" ? "META_ACAO" : "META_PLANO";
      return mesclado.map((meta) =>
        meta.codigo !== codigoMeta ? meta : {
          ...meta,
          children: meta.children.map((tarefa) =>
            tarefa.codigo === `${codigoMeta}_PROXIMO`
              ? { ...tarefa, nome: proximoPasso.trim() }
              : tarefa,
          ),
        },
      );
    });
    if (typeof proximoPasso === "string") setUltimoPassoGerado(proximoPasso.trim());
  }

  function traduzirAviso(aviso: string) {
    const prefixo = "Pergunta obrigatória sem resposta: ";
    if (aviso.startsWith(prefixo)) {
      const codigoPergunta = aviso.slice(prefixo.length);
      const p = perguntasAtivas.find((x) => x.codigo === codigoPergunta);
      return `Responda: ${p?.texto ?? codigoPergunta}`;
    }
    return aviso;
  }

  function validateResponsavel(): string | null {
    if (registrandoNovo) {
      if (!novoNome.trim() || !novoCargo.trim()) {
        return "Informe nome e cargo do novo responsável";
      }
      return null;
    }
    if (!responsavelPessoaId) {
      return "Selecione ou cadastre o responsável do projeto";
    }
    return null;
  }

  async function next() {
    setError("");
    try {
      const label = steps[step];
      if (label === "Tipo") {
        if (estruturante && !modeloPadrao?.id) {
          setError("Modelo padrão estruturante não encontrado. Peça ao admin para ativar o modelo CIP.");
          return;
        }
        setStep(1);
        return;
      }
      if (label === "Identidade") {
        if (!nome.trim() || !secretariaId) {
          setError("Informe nome e secretaria");
          return;
        }
        if (!descricao.trim() || (classificacao !== "ACAO_DIARIA" && !entrega.trim())) {
          setError(classificacao === "ACAO_DIARIA"
            ? "Informe o que precisa ser feito e onde"
            : "Informe o problema ou compromisso e a entrega esperada");
          return;
        }
        const respErr = validateResponsavel();
        if (respErr) {
          setError(respErr);
          return;
        }
        if (exigeMeta && (metaId === "__nova__" ? novaMetaNome.trim().length < 3 || (planoId === "__novo__" && novoPlanoNome.trim().length < 3) : !metaId)) {
          setError(metaId === "__nova__" ? "Preencha o nome da meta e escolha ou nomeie o plano de governo" : "Selecione uma meta ou escolha Criar meta neste cadastro");
          return;
        }
        if (!codigo.trim() && sec?.sigla) {
          setCodigo(`${sec.sigla}-${String(Date.now()).slice(-4)}`);
        }
        setStep((s) => s + 1);
        return;
      }
      // Demais passos (grupos de condição, urgência, escopo): avança e,
      // ao entrar no escopo ou na prévia, recalcula o modelo com as respostas atuais.
      if (grupoAtualMeta) {
        const pendente = visiblePerguntas.find((p) => {
          const valor = respostas[p.codigo];
          return p.grupo === grupoAtualMeta.id && p.obrigatoria &&
            (valor === undefined || (typeof valor === "string" && !valor.trim()));
        });
        if (pendente) {
          setError(`Responda: ${pendente.pergunta || pendente.texto}`);
          return;
        }
      }
      const nextLabel = steps[step + 1];
      if (nextLabel === "Escopo" || nextLabel === "Prévia") {
        await runPreview();
      }
      setStep((s) => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  function escopoComNomeVazio(nos: EscopoNo[]): boolean {
    return nos.some((n) => n.nome.trim().length < 2 || escopoComNomeVazio(n.children));
  }

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const respErr = validateResponsavel();
      if (respErr) throw new Error(respErr);
      if (escopoComNomeVazio(escopo)) {
        throw new Error("Dê nome a todas as metas, tarefas e subtarefas do escopo");
      }

      const selected = Object.values(equipePorSecretaria)
        .flat()
        .find((p) => p.id === responsavelPessoaId);
      const res = await fetch(`${API_URL}/iniciativas/wizard/confirmar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          codigo: codigo || `${sec?.sigla || "P"}-NEW`,
          nome,
          descricao: descricaoCompleta,
          secretariaPrincipalId: secretariaId,
          secretariaIds: secretariasCorrelatas.filter((id) => id !== secretariaId),
          classificacaoPrincipal: classificacao,
          vinculoPlanoGoverno: exigeMeta,
          metaEstrategicaId: exigeMeta && metaId !== "__nova__" ? metaId || undefined : undefined,
          novaMeta: exigeMeta && metaId === "__nova__" ? { nome: novaMetaNome.trim(), planoId: planoId !== "__novo__" ? planoId : undefined, novoPlanoNome: planoId === "__novo__" ? novoPlanoNome.trim() : undefined } : undefined,
          modeloProjetoId: estruturante ? modeloPadrao?.id || undefined : undefined,
          responsavel: registrandoNovo ? novoNome.trim() : selected?.nome,
          responsavelPessoaId: registrandoNovo ? undefined : responsavelPessoaId,
          novaPessoa: registrandoNovo
            ? {
                nome: novoNome.trim(),
                cargo: novoCargo.trim(),
                telefone: novoTelefone.trim() || null,
                email: novoEmail.trim() || null,
                papel: "EQUIPE",
              }
            : undefined,
          respostas: respostaList,
          estruturaOverride: escopo.map(paraTreeNode),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao criar");
      router.push(`/iniciativas/${json.data.id}?aba=andamento`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setSaving(false);
    }
  }

  function setResposta(codigoPergunta: string, valor: CondicaoValorState) {
    setRespostas((r) => ({ ...r, [codigoPergunta]: valor }));
  }

  function escolherClassificacao(valor: Classificacao) {
    setClassificacao(valor);
    setRespostas({});
    setUltimoPassoGerado("");
    setEscopo([]);
    setPreview(null);
    setStep(0);
  }

  function renderPerguntas(lista: ModeloPerguntaDef[]) {
    return (
      <div className="stack condicao-lista">
        {lista.map((p) => (
          <CondicaoCard
            key={p.codigo}
            pergunta={p}
            valor={respostas[p.codigo]}
            onChange={(next) => setResposta(p.codigo, next)}
          />
        ))}
      </div>
    );
  }

  function origemLabel(codigo?: string | null) {
    if (!codigo) return null;
    const p = perguntasAtivas.find((x) => x.codigo === codigo);
    const quiz = quizItem(codigo);
    return p?.rotulo || quiz?.rotulo || codigo;
  }

  function paraFluxo(nos: EscopoNo[]): FluxoNode[] {
    return nos.map((n) => ({
      codigo: n.codigo,
      nome: n.nome,
      nivel: n.nivel,
      indicador: n.indicador,
      alvo: n.alvo,
      responsavel: n.responsavel,
      prazo: n.prazo,
      origemPerguntaCodigo: origemLabel(n.origemPerguntaCodigo) || n.origemPerguntaCodigo,
      children: paraFluxo(n.children),
    }));
  }

  const triagem = visiblePerguntas.filter((p) => p.etapa == null);
  const semResponsavel = contarSemResponsavel(escopo);
  const totalItens = contarItens(escopo);

  return (
    <div className="wizard stack">
      <header className="wizard-head">
        <p className="section-kicker">Novo projeto</p>
        <h1>Assistente de criação</h1>
        <ol className="wizard-steps">
          {steps.map((s, i) => (
            <li key={s} className={i === step ? "is-active" : i < step ? "is-done" : ""}>
              <span>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </header>

      {steps[step] === "Tipo" && (
        <Card title="Como classificar este projeto?">
          <div className="wizard-choice">
            <button
              type="button"
              className={classificacao === "ESTRUTURANTE" ? "is-on" : ""}
              onClick={() => escolherClassificacao("ESTRUTURANTE")}
            >
              <strong>Projeto estruturante</strong>
              <p>
                Obra ou entrega de grande porte. Passa pela sequência legal (recursos, terreno,
                projeto, licitação, execução) e recebe prioridade.
              </p>
            </button>
            <button
              type="button"
              className={classificacao === "PLANO_GOVERNO" ? "is-on" : ""}
              onClick={() => {
                setVinculoPlanoExtra(false);
                escolherClassificacao("PLANO_GOVERNO");
              }}
            >
              <strong>Plano de Governo</strong>
              <p>Compromisso do plano. Exige vínculo com a meta estratégica.</p>
            </button>
            <button
              type="button"
              className={classificacao === "ACAO_DIARIA" ? "is-on" : ""}
              onClick={() => {
                setVinculoPlanoExtra(false);
                escolherClassificacao("ACAO_DIARIA");
              }}
            >
              <strong>Ação diária</strong>
              <p>Rotina operacional de curto prazo. Triagem rápida de urgência, sem checklist.</p>
            </button>
          </div>
          {classificacao === "ESTRUTURANTE" && (
            <label className="wizard-check">
              <input
                type="checkbox"
                checked={vinculoPlanoExtra}
                onChange={(e) => setVinculoPlanoExtra(e.target.checked)}
              />
              Também está no Plano de Governo
            </label>
          )}
        </Card>
      )}

      {steps[step] === "Identidade" && (
        <Card title="Identidade do projeto">
          <div className="stack">
            <div>
              <label>Secretaria principal</label>
              <select
                value={secretariaId}
                onChange={(e) => {
                  setSecretariaId(e.target.value);
                  setSecretariasCorrelatas((prev) => prev.filter((id) => id !== e.target.value));
                  setResponsavelPessoaId("");
                  setNovoNome("");
                  setNovoCargo("");
                }}
              >
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {secretariaLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <label>Secretarias correlacionadas</label>
              <p className="dashboard-muted" style={{ margin: "4px 0 8px", fontSize: 12 }}>
                Pastas que participam da entrega (ex.: planejamento, administração/recursos, obras).
                O responsável e as tarefas podem ser de qualquer uma delas.
              </p>
              <div className="chip-row">
                {secretarias
                  .filter((s) => s.id !== secretariaId)
                  .map((s) => {
                    const ativa = secretariasCorrelatas.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={ativa ? "cip-btn cip-btn--primary" : "cip-btn cip-btn--secondary"}
                        style={{ padding: "8px 10px", minHeight: 36, fontSize: 12 }}
                        aria-pressed={ativa}
                        onClick={() =>
                          setSecretariasCorrelatas((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((x) => x !== s.id)
                              : [...prev, s.id],
                          )
                        }
                      >
                        {secretariaChipLabel(s)}
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="form-grid form-grid--2">
              <div>
                <label>Código</label>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Sugestão automática na próxima etapa"
                />
              </div>
              <div>
                <label>Responsável do projeto</label>
                <select
                  value={responsavelPessoaId}
                  onChange={(e) => setResponsavelPessoaId(e.target.value)}
                  disabled={pessoasLoading}
                >
                  <option value="">
                    {pessoasLoading ? "Carregando equipes..." : "Selecione o responsável"}
                  </option>
                  {envolvidasIds.map((id) => {
                    const rows = equipePorSecretaria[id] || [];
                    if (!rows.length) return null;
                    const s = secretarias.find((x) => x.id === id);
                    return (
                      <optgroup key={id} label={s ? secretariaChipLabel(s) : id}>
                        {rows.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} — {p.cargo}
                            {p.papel === "TITULAR" ? " (titular)" : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  <option value={NOVO_VALOR}>Registrar novo na pasta principal…</option>
                </select>
              </div>
            </div>
            {!pessoasLoading && equipeNomes.length === 0 && (
              <p className="dashboard-muted">
                Nenhuma equipe cadastrada nas pastas envolvidas. Registre o responsável abaixo.
              </p>
            )}
            {registrandoNovo && (
              <div className="form-grid form-grid--2">
                <div>
                  <label>Nome do responsável</label>
                  <input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <label>Cargo</label>
                  <input
                    value={novoCargo}
                    onChange={(e) => setNovoCargo(e.target.value)}
                    placeholder="Ex.: Coordenador de obras"
                    required
                  />
                </div>
                <div>
                  <label>Telefone</label>
                  <input
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    placeholder="(31) 90000-0000"
                  />
                </div>
                <div>
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="nome@prefeitura.gov.br"
                  />
                </div>
              </div>
            )}
            <div>
              <label>
                {estruturante
                  ? "Problema público *"
                  : classificacao === "PLANO_GOVERNO"
                    ? "Compromisso do plano e resultado esperado *"
                    : "O que precisa ser feito e onde? *"}
              </label>
              <textarea
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={estruturante
                  ? "Qual problema público será resolvido? Quem é afetado e onde?"
                  : classificacao === "PLANO_GOVERNO"
                    ? "Ex.: ampliar vagas de creche no Bairro Novo"
                    : "Ex.: reparar o gerador da UBS Centro"}
              />
            </div>
            {classificacao !== "ACAO_DIARIA" && (
              <>
                <div>
                  <label>{estruturante ? "O que será entregue e para quem *" : "Entrega concreta deste ciclo *"}</label>
                  <textarea
                    rows={3}
                    value={entrega}
                    onChange={(e) => setEntrega(e.target.value)}
                    placeholder="Ex.: escola de seis salas no Bairro Novo, com acessibilidade e equipamentos."
                  />
                </div>
                {estruturante && <div>
                  <label>Público beneficiado</label>
                  <input
                    value={beneficiariosTxt}
                    onChange={(e) => setBeneficiariosTxt(e.target.value)}
                    placeholder="Ex.: ~400 crianças da região norte"
                  />
                </div>}
                {estruturante && <div>
                  <label>O que fica fora deste projeto</label>
                  <textarea
                    rows={2}
                    value={foraEscopo}
                    onChange={(e) => setForaEscopo(e.target.value)}
                    placeholder="Ex.: contratação de professores será outra iniciativa."
                  />
                </div>}
              </>
            )}
            {exigeMeta && (
              <div>
                <label>Meta estratégica do Plano de Governo</label>
                <select
                  value={metaId}
                  onChange={(e) => setMetaId(e.target.value)}
                  required
                >
                  <option value="">Selecione a meta</option>
                  <option value="__nova__">+ Criar meta neste cadastro</option>
                  {metas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {metaId === "__nova__" && <div className="stack" style={{ marginTop: 12 }}>
                  <label>Nome da nova meta<input value={novaMetaNome} onChange={(e) => setNovaMetaNome(e.target.value)} placeholder="Ex.: ampliar em 200 as vagas em creches" /></label>
                  <label>Plano de governo<select value={planoId} onChange={(e) => setPlanoId(e.target.value)}>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}<option value="__novo__">+ Criar plano de governo</option></select></label>
                  {planoId === "__novo__" && <label>Nome e período do plano<input value={novoPlanoNome} onChange={(e) => setNovoPlanoNome(e.target.value)} placeholder="Ex.: Plano de Governo 2025–2028" /></label>}
                  <p className="dashboard-muted">A meta será criada junto com o projeto ao confirmar.</p>
                </div>}
              </div>
            )}
          </div>
        </Card>
      )}

      {steps[step] === "Urgência" && (
        <Card
          title="Urgência e impacto"
          subtitle="Estas respostas definem a prioridade. Nada é salvo até a confirmação."
        >
          {renderPerguntas(
            estruturante
              ? triagem.length
                ? triagem
                : visiblePerguntas.filter((p) => !p.grupo || p.etapa == null)
              : visiblePerguntas,
          )}
        </Card>
      )}

      {grupoAtualMeta && (
        <Card title={grupoAtualMeta.nome} subtitle={grupoAtualMeta.ajuda}>
          {estruturante && !perguntasAtivas.length ? (
            <p className="dashboard-muted">
              Carregando checklist do modelo padrão CIP…
            </p>
          ) : (
            renderPerguntas(
              visiblePerguntas.filter(
                (p) => p.grupo === grupoAtualMeta.id && p.etapa != null,
              ),
            )
          )}
        </Card>
      )}

      {steps[step] === "Escopo" && (
        <Card
          title="Escopo e responsáveis"
          subtitle="Desdobre o projeto em metas, tarefas e subtarefas e defina quem responde por cada uma. Nada é salvo até a confirmação."
        >
          <div className="stack">
            <div className="chip-row">
              <Badge tone={semResponsavel ? "warning" : "success"}>
                {semResponsavel
                  ? `${semResponsavel} item(ns) sem responsável`
                  : "Todos os itens têm responsável"}
              </Badge>
              <Badge tone="neutral">{totalItens} item(ns) no escopo</Badge>
            </div>
            <EscopoEditor
              nodes={escopo}
              onChange={setEscopo}
              equipe={equipeNomes}
              listId="equipe-escopo"
            />
          </div>
        </Card>
      )}

      {steps[step] === "Prévia" && (
        <Card
          title="Pré-visualização"
          subtitle="Revise antes de gravar. Nada foi salvo ainda."
        >
          <div className="stack">
            <div className="chip-row">
              <Badge tone={tonePrioridade(preview?.prioridade)}>
                Prioridade {PRIORIDADE_LABEL[preview?.prioridade || "BAIXA"]}
              </Badge>
              {preview?.prontidaoPct != null && (
                <Badge tone="info">Prontidão {preview.prontidaoPct}%</Badge>
              )}
              <Badge tone={preview?.cicloInicial === "AGUARDANDO_PRE_REQUISITO" ? "danger" : "neutral"}>
                {preview?.cicloInicial === "AGUARDANDO_PRE_REQUISITO"
                  ? "Aguardando pré-requisito"
                  : "Em planejamento"}
              </Badge>
            </div>

            <div>
              <p className="section-kicker">Secretarias envolvidas</p>
              <div className="chip-row">
                {sec && <Badge tone="info">{secretariaChipLabel(sec)} · principal</Badge>}
                {secretariasCorrelatas
                  .filter((id) => id !== secretariaId)
                  .map((id) => {
                    const s = secretarias.find((x) => x.id === id);
                    return s ? (
                      <Badge key={id} tone="neutral">
                        {secretariaChipLabel(s)} · correlacionada
                      </Badge>
                    ) : null;
                  })}
              </div>
            </div>

            {preview?.motivosPrioridade?.length ? (
              <ul className="dashboard-muted" style={{ margin: 0, paddingLeft: 18 }}>
                {preview.motivosPrioridade.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}

            {preview?.bloqueioLabel && (
              <div className="bloqueio-alert">
                <strong>{preview.bloqueioLabel}</strong>
                <p>O responsável será alertado ao confirmar.</p>
              </div>
            )}

            {preview && preview.etapas.length > 0 && (
              <div>
                <p className="section-kicker">Condições por grupo</p>
                <ol className="wizard-steps" style={{ flexWrap: "wrap" }}>
                  {preview.etapas.map((e) => (
                    <li key={e.codigo} className={e.codigo === preview.etapaAtual ? "is-active" : ""}>
                      <span>{e.ordem}</span>
                      {e.nome}{" "}
                      <Badge tone={toneEtapa(e.status)}>{ETAPA_LABEL[e.status] || e.status}</Badge>
                      <span className="dashboard-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                        {e.favoraveis}/{e.total}
                      </span>
                    </li>
                  ))}
                </ol>
                {preview.etapaAtual && (
                  <p className="dashboard-muted">
                    Grupo atual:{" "}
                    {preview.etapas.find((e) => e.codigo === preview.etapaAtual)?.nome}
                  </p>
                )}
              </div>
            )}

            {estruturante && preview?.bloqueios?.length ? (
              <div>
                <p className="section-kicker">Condicionantes a tratar</p>
                <ul className="pasta-fila">
                  {preview.bloqueios.map((b) => (
                    <li key={b.perguntaCodigo} className="pasta-fila__item">
                      <div>
                        <strong>{origemLabel(b.perguntaCodigo)}</strong>
                        <p className="dashboard-muted">{b.rotulo}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview?.avisos?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--cip-danger)" }}>
                {preview.avisos.map((a) => (
                  <li key={a}>{traduzirAviso(a)}</li>
                ))}
              </ul>
            ) : null}

            <div>
              <p className="section-kicker">Escopo e responsáveis</p>
              {escopo.length ? (
                <FluxoArvore
                  nodes={paraFluxo(escopo)}
                  defaultExpandedDepth={2}
                  showOrigemLabel={estruturante}
                />
              ) : (
                <p className="dashboard-muted">Nenhuma meta no escopo. Volte ao passo Escopo para adicionar.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {error && <p style={{ color: "var(--cip-danger)" }}>{error}</p>}

      <footer className="wizard-foot">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Voltar
        </Button>
        {steps[step] !== "Prévia" ? (
          <Button type="button" onClick={next}>
            Continuar
          </Button>
        ) : (
          <Button type="button" onClick={confirm} disabled={saving}>
            {saving ? "Gravando..." : "Confirmar e abrir projeto"}
          </Button>
        )}
      </footer>
    </div>
  );
}
