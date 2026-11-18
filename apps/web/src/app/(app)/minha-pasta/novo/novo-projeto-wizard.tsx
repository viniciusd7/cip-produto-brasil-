"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@cip/ui";
import {
  GRUPOS_ACAO,
  GRUPOS_CONDICOES,
  GRUPOS_PLANO,
  buildCatalogoPerguntas,
  MODELO_ACAO_DIARIA,
  MODELO_PLANO_GOVERNO,
  adicionarImpedimentosComuns,
  adicionarImpedimentosPersonalizados,
  type ImpedimentoPersonalizado,
  GRUPO_IMPEDIMENTOS,
  parseCondicaoResposta,
  visibleQuestions,
  type ModeloPerguntaDef,
  type RespostaViabilidade,
  type TreeNode,
} from "@cip/shared";
import { API_URL } from "@/lib/api";
import { secretariaChipLabel, secretariaLabel } from "@/lib/secretaria-label";
import { CondicaoCard, type CondicaoValorState } from "@/components/condicao-card";
import { ImpedimentosEditor } from "@/components/impedimentos-editor";
import { AjudaCampo, RotuloComAjuda } from "@/components/ajuda-campo";
import { EscopoEditor, temResponsavel, type EscopoNo } from "./escopo-editor";
import { mesclarEscopo } from "./mesclar-escopo";
import { PreviaProjeto, type CondicaoPrevia } from "./previa-projeto";
import { normalizarEscopo, type NoApi } from "./normalizar-escopo";
import { chaveRascunho, lerRascunho, salvarRascunho } from "./rascunho-projeto";

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

type PreviewData = {
  cicloInicial: string;
  bloqueios: Array<{ perguntaCodigo: string; rotulo: string }>;
  avisos: string[];
};

type Classificacao =
  | "ESTRUTURANTE"
  | "PRIORITARIO"
  | "PLANO_GOVERNO"
  | "ACAO_DIARIA";

const STEPS_ESTRUT = [
  "Identidade",
  GRUPO_IMPEDIMENTOS.nome,
  ...(GRUPOS_CONDICOES ?? []).map((g) => g.nome),
  "Urgência",
  "Tarefas",
  "Prévia",
];
const STEPS_PLANO = [
  "Identidade",
  GRUPO_IMPEDIMENTOS.nome,
  ...(GRUPOS_PLANO ?? []).map((g) => g.nome),
  "Tarefas",
  "Prévia",
];
const STEPS_ACAO = [
  "Identidade",
  GRUPO_IMPEDIMENTOS.nome,
  ...(GRUPOS_ACAO ?? []).map((g) => g.nome),
  "Tarefas",
  "Prévia",
];
const NOVO_VALOR = "__novo__";
const PERGUNTAS_ESTRUTURANTE = buildCatalogoPerguntas();

function perguntasComImpedimentos(perguntas: ModeloPerguntaDef[]) {
  return adicionarImpedimentosComuns({
    codigo: "WIZARD",
    nome: "Assistente",
    perguntas,
    estrutura: [],
  }).perguntas;
}

function paraTreeNode(n: EscopoNo): TreeNode {
  return {
    codigo: n.codigo,
    nivel: n.nivel,
    nome: n.nome.trim(),
    responsavel: n.responsavel?.trim() || null,
    prazo: n.prazo ?? null,
    origemPerguntaCodigo: n.origemPerguntaCodigo ?? null,
    origemValor: n.origemValor ?? null,
    children: n.children.map(paraTreeNode),
  };
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
  usuarioId,
  municipioId,
  initialClassification,
  defaultSecretariaId,
  defaultMetaId,
  secretarias,
  modelos,
  metas,
  planos,
}: {
  token: string;
  usuarioId: string;
  municipioId: string;
  initialClassification: Classificacao;
  defaultSecretariaId?: string;
  defaultMetaId?: string;
  secretarias: Secretaria[];
  modelos: Modelo[];
  metas: Array<{ id: string; label: string }>;
  planos: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const cabecalhoRef = useRef<HTMLElement>(null);
  const passoAnteriorRef = useRef(step);
  const classificacao = initialClassification;
  const classificacoes: Classificacao[] = [classificacao];
  const [modeloCarregado, setModeloCarregado] = useState<{
    id: string;
    perguntas: ModeloPerguntaDef[];
    erro?: string;
  } | null>(null);
  const [tentativaModelo, setTentativaModelo] = useState(0);
  const [impedimentosPersonalizados, setImpedimentosPersonalizados] = useState<ImpedimentoPersonalizado[]>([]);
  const [respostas, setRespostas] = useState<Record<string, CondicaoValorState>>({});
  const [secretariaId, setSecretariaId] = useState(
    secretarias.find((s) => s.id === defaultSecretariaId)?.id || secretarias[0]?.id || "",
  );
  const [secretariasCorrelatas, setSecretariasCorrelatas] = useState<string[]>([]);
  // Equipe carregada para um conjunto de secretarias envolvidas (chave = ids).
  const [equipeCarregada, setEquipeCarregada] = useState<{
    key: string;
    mapa: Record<string, PessoaPasta[]>;
    erro?: string;
  } | null>(null);
  const [tentativaEquipe, setTentativaEquipe] = useState(0);
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
  const [metaId, setMetaId] = useState(defaultMetaId || "");
  const [novaMetaNome, setNovaMetaNome] = useState("");
  const [planoId, setPlanoId] = useState(planos[0]?.id || "__novo__");
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [escopo, setEscopo] = useState<EscopoNo[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [ultimoPassoGerado, setUltimoPassoGerado] = useState("");
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const operacaoEmCursoRef = useRef(false);
  const busy = saving || advancing;
  const [error, setError] = useState("");
  const rascunhoKey = chaveRascunho(usuarioId, municipioId, initialClassification);
  const [rascunhoPronto, setRascunhoPronto] = useState(false);
  const [rascunhoMensagem, setRascunhoMensagem] = useState("Carregando rascunho…");
  const [rascunhoErro, setRascunhoErro] = useState("");
  const rascunhoBloqueado = useRef(false);
  const concluido = useRef(false);

  const estruturante =
    classificacao === "ESTRUTURANTE" || classificacao === "PRIORITARIO";
  const steps = estruturante
    ? STEPS_ESTRUT
    : classificacao === "PLANO_GOVERNO"
      ? STEPS_PLANO
      : STEPS_ACAO;
  const totalPassos = steps.length;

  useEffect(() => {
    if (!rascunhoPronto || passoAnteriorRef.current === step) return;
    passoAnteriorRef.current = step;

    const frame = window.requestAnimationFrame(() => {
      const cabecalho = cabecalhoRef.current;
      if (!cabecalho) return;
      cabecalho.focus({ preventScroll: true });
      cabecalho.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, rascunhoPronto]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const dados = lerRascunho(window.localStorage, rascunhoKey);
        if (dados) {
          setStep(Math.min(dados.step, totalPassos - 2));
          setRespostas(dados.respostas);
          setImpedimentosPersonalizados(dados.impedimentosPersonalizados || []);
          setSecretariaId(dados.secretariaId);
          setSecretariasCorrelatas(dados.secretariasCorrelatas);
          setResponsavelPessoaId(dados.responsavelPessoaId);
          setNovoNome(dados.novoNome);
          setNovoCargo(dados.novoCargo);
          setNovoTelefone(dados.novoTelefone);
          setNovoEmail(dados.novoEmail);
          setNome(dados.nome);
          setCodigo(dados.codigo);
          setDescricao(dados.descricao);
          setEntrega(dados.entrega);
          setForaEscopo(dados.foraEscopo);
          setBeneficiariosTxt(dados.beneficiariosTxt);
          setMetaId(defaultMetaId || dados.metaId);
          setNovaMetaNome(dados.novaMetaNome);
          setPlanoId(dados.planoId);
          setNovoPlanoNome(dados.novoPlanoNome);
          setEscopo(dados.escopo);
          setUltimoPassoGerado(dados.ultimoPassoGerado);
          setRascunhoMensagem("Rascunho recuperado. Suas alterações são salvas automaticamente neste navegador.");
        } else {
          setRascunhoMensagem("Rascunho salvo automaticamente neste navegador.");
        }
      } catch (err) {
        rascunhoBloqueado.current = true;
        const mensagem = err instanceof Error ? err.message : "Não foi possível recuperar o rascunho.";
        setRascunhoErro(`${mensagem} O salvamento automático está pausado; descarte o rascunho para recomeçar.`);
      }
      setRascunhoPronto(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [rascunhoKey, totalPassos, defaultMetaId]);

  useLayoutEffect(() => {
    if (!rascunhoPronto || concluido.current || rascunhoBloqueado.current) return;
    let ativo = true;
    try {
      salvarRascunho(window.localStorage, rascunhoKey, {
        step, respostas, secretariaId, secretariasCorrelatas, responsavelPessoaId,
        novoNome, novoCargo, novoTelefone, novoEmail, nome, codigo, descricao,
        entrega, foraEscopo, beneficiariosTxt, metaId, novaMetaNome, planoId,
        novoPlanoNome, escopo, ultimoPassoGerado, impedimentosPersonalizados,
      });
      queueMicrotask(() => { if (ativo) setRascunhoErro(""); });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Armazenamento indisponível.";
      queueMicrotask(() => {
        if (ativo) setRascunhoErro(`Não foi possível salvar o rascunho. Não saia desta página antes de concluir. ${mensagem}`);
      });
    }
    return () => { ativo = false; };
  }, [
    rascunhoPronto, rascunhoKey, step, respostas, secretariaId, secretariasCorrelatas,
    responsavelPessoaId, novoNome, novoCargo, novoTelefone, novoEmail, nome, codigo,
    descricao, entrega, foraEscopo, beneficiariosTxt, metaId, novaMetaNome, planoId,
    novoPlanoNome, escopo, ultimoPassoGerado, impedimentosPersonalizados,
  ]);

  function descartarRascunho() {
    if (!window.confirm("Descartar o rascunho deste tipo de projeto e recomeçar?")) return;
    try {
      window.localStorage.removeItem(rascunhoKey);
      concluido.current = true;
      window.location.reload();
    } catch (err) {
      setRascunhoErro(err instanceof Error ? err.message : "Não foi possível descartar o rascunho.");
    }
  }
  // Grupos do catálogo ativo, buscados dentro do próprio fluxo. Um mapa global
  // nome→id colidia ("Recursos" existe no estruturante e no Plano de Governo).
  const gruposAtivos = estruturante
    ? [GRUPO_IMPEDIMENTOS, ...GRUPOS_CONDICOES]
    : classificacao === "PLANO_GOVERNO"
      ? [GRUPO_IMPEDIMENTOS, ...GRUPOS_PLANO]
      : [GRUPO_IMPEDIMENTOS, ...GRUPOS_ACAO];
  const grupoAtualMeta = gruposAtivos.find((g) => g.nome === steps[step]);
  const exigeMeta = true;
  const modeloPadrao = useMemo(
    () =>
      modelos.find((m) => m.codigo === "PROJETO_ESTRUTURANTE_PADRAO") ||
      modelos.find((m) => m.codigo.startsWith("PROJETO_ESTRUTURANTE")) ||
      modelos[0],
    [modelos],
  );
  const modeloPersonalizado = estruturante && modeloPadrao?.codigo !== "PROJETO_ESTRUTURANTE_PADRAO"
    ? modeloPadrao
    : undefined;
  const modeloLoading = Boolean(modeloPersonalizado && modeloCarregado?.id !== modeloPersonalizado.id);
  const erroModelo = modeloPersonalizado && !modeloLoading ? modeloCarregado?.erro : undefined;
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
  const erroEquipe = !pessoasLoading ? equipeCarregada?.erro : undefined;
  const registrandoNovo = responsavelPessoaId === NOVO_VALOR;
  const equipeNomes = Array.from(
    new Set(Object.values(equipePorSecretaria).flat().map((p) => p.nome)),
  ).sort();

  const perguntasBase: ModeloPerguntaDef[] = estruturante
    ? modeloPadrao?.codigo === "PROJETO_ESTRUTURANTE_PADRAO"
      ? PERGUNTAS_ESTRUTURANTE
      : modeloCarregado && modeloPadrao && modeloCarregado.id === modeloPadrao.id ? modeloCarregado.perguntas : []
    : classificacao === "PLANO_GOVERNO"
      ? MODELO_PLANO_GOVERNO.perguntas
      : MODELO_ACAO_DIARIA.perguntas;
  const perguntasAtivas = adicionarImpedimentosPersonalizados({
    codigo: "WIZARD", nome: "Assistente", perguntas: perguntasComImpedimentos(perguntasBase), estrutura: [],
  }, impedimentosPersonalizados).perguntas;

  // Checklist do modelo estruturante (Plano e Ação usam catálogo fixo no código).
  useEffect(() => {
    if (!modeloPersonalizado) return;
    let cancelled = false;
    fetch(`${API_URL}/modelos-projeto/${modeloPersonalizado.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Não foi possível carregar o modelo.");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const snap = json?.data?.snapshot;
        const perguntas = snap?.perguntas || json?.data?.perguntas;
        if (!Array.isArray(perguntas)) throw new Error("O modelo não contém perguntas válidas.");
        setModeloCarregado({ id: modeloPersonalizado.id, perguntas });
      })
      .catch((err: unknown) => {
        if (!cancelled) setModeloCarregado({
          id: modeloPersonalizado.id,
          perguntas: [],
          erro: err instanceof Error ? err.message : "Não foi possível carregar o modelo.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [modeloPersonalizado, token, tentativaModelo]);

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
      estruturante && beneficiariosTxt.trim() && `Beneficiários: ${beneficiariosTxt.trim()}`,
      estruturante && foraEscopo.trim() && `Fora de escopo: ${foraEscopo.trim()}`,
    ].filter(Boolean);
    return parts.join("\n\n") || undefined;
  }, [classificacao, descricao, entrega, beneficiariosTxt, foraEscopo, estruturante]);

  // Mesma regra do servidor: uma única fonte de verdade para mostrar/ocultar perguntas.
  const visiblePerguntas = useMemo(
    () => visibleQuestions(perguntasAtivas, respostaList),
    [perguntasAtivas, respostaList],
  );

  // Equipe de todas as pastas envolvidas (principal + correlacionadas).
  // Responsável do projeto pode vir de qualquer uma delas.
  useEffect(() => {
    if (!rascunhoPronto || !token || !secretariaId) return;
    let cancelled = false;
    Promise.all(
      envolvidasKey.split(",").map(async (id) => {
        const res = await fetch(`${API_URL}/admin/secretarias/${id}/pessoas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Não foi possível carregar as equipes.");
        if (!Array.isArray(json?.data)) throw new Error("Resposta inválida ao carregar as equipes.");
        return [id, json.data as PessoaPasta[]] as const;
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
      .catch((err: unknown) => {
        if (!cancelled) setEquipeCarregada({
          key: envolvidasKey,
          mapa: {},
          erro: err instanceof Error ? err.message : "Não foi possível carregar as equipes.",
        });
      });
    return () => {
      cancelled = true;
    };
    // secretariaId já está representado em envolvidasKey.
  }, [rascunhoPronto, envolvidasKey, secretariaId, token, tentativaEquipe]);

  async function runPreview(atualizarEscopo = true) {
    const res = await fetch(`${API_URL}/iniciativas/wizard/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        modeloProjetoId: estruturante ? modeloPadrao?.id || undefined : undefined,
        classificacaoPrincipal: classificacao,
        classificacoes,
        respostas: respostaList,
        impedimentosPersonalizados,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Falha no preview");
    setPreview({
      cicloInicial: json.data.cicloInicial,
      bloqueios: json.data.bloqueios || [],
      avisos: json.data.avisos || [],
    });
    // A prévia deve respeitar as remoções e edições feitas no passo Tarefas.
    if (!atualizarEscopo) return;
    const estruturaModelo = normalizarEscopo((json.data.estrutura || []) as NoApi[]);
    const proximoPasso = classificacao === "ACAO_DIARIA"
      ? respostas.acao_providencia
      : classificacao === "PLANO_GOVERNO"
        ? respostas.plano_proximo_marco
        : undefined;
    if (typeof proximoPasso === "string" && proximoPasso.trim()) {
      const codigoTarefa = classificacao === "ACAO_DIARIA" ? "META_ACAO_PROXIMO" : "META_PLANO_PROXIMO";
      estruturaModelo.push({
        codigo: codigoTarefa,
        nivel: "TAREFA",
        nome: proximoPasso.trim(),
        responsavel: null,
        prazo: null,
        origemPerguntaCodigo: null,
        origemValor: null,
        manual: false,
        children: [],
      });
    }
    setEscopo((anterior) => {
      const mesclado = mesclarEscopo(anterior, estruturaModelo);
      if (typeof proximoPasso !== "string" || !proximoPasso.trim() || proximoPasso.trim() === ultimoPassoGerado) {
        return mesclado;
      }
      const codigoTarefa = classificacao === "ACAO_DIARIA" ? "META_ACAO_PROXIMO" : "META_PLANO_PROXIMO";
      return mesclado.map((tarefa) =>
        tarefa.codigo === codigoTarefa ? { ...tarefa, nome: proximoPasso.trim() } : tarefa,
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
    if (pessoasLoading) return "Aguarde o carregamento das equipes.";
    if (erroEquipe) return "Não foi possível carregar as equipes. Tente novamente antes de continuar.";
    if (registrandoNovo) {
      if (novoNome.trim().length < 2 || novoCargo.trim().length < 2) {
        return "Informe o nome e o cargo do responsável pelo projeto com pelo menos 2 caracteres em cada campo";
      }
      if (novoEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail.trim())) {
        return "Informe um e-mail válido para o responsável pelo projeto";
      }
      return null;
    }
    if (!responsavelPessoaId) {
      return "Selecione ou cadastre o responsável pelo projeto";
    }
    return null;
  }

  async function next() {
    if (operacaoEmCursoRef.current || concluido.current) return;
    operacaoEmCursoRef.current = true;
    setAdvancing(true);
    setError("");
    try {
      const label = steps[step];
      if (label === GRUPO_IMPEDIMENTOS.nome || label === "Tarefas" || label === "Prévia") validarItensPersonalizados();
      if (label === "Identidade") {
        if (estruturante && !modeloPadrao?.id) {
          setError("Modelo padrão estruturante não encontrado. Peça ao admin para ativar o modelo CIP.");
          return;
        }
        if (modeloLoading || erroModelo) {
          setError(modeloLoading ? "Aguarde o carregamento do modelo." : "Não foi possível carregar o modelo. Tente novamente.");
          return;
        }
        if (!nome.trim() || !secretariaId) {
          setError("Informe o nome do projeto e selecione a secretaria principal");
          return;
        }
        if (nome.trim().length < 3) {
          setError("Informe o nome do projeto com pelo menos 3 caracteres");
          return;
        }
        if (codigo.trim() && codigo.trim().length < 2) {
          setError("Informe o código do projeto com pelo menos 2 caracteres ou deixe vazio para gerar automaticamente");
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
        setStep((s) => s + 1);
        return;
      }
      // Demais passos (grupos de condição, urgência, escopo): avança e,
      // ao entrar no escopo ou na prévia, recalcula o modelo com as respostas atuais.
      if (grupoAtualMeta) {
        const pendente = visiblePerguntas.find((p) => {
          const valor = respostas[p.codigo];
          return p.grupo === grupoAtualMeta.id && p.obrigatoria &&
            (valor === undefined || (typeof valor === "string" && !valor.trim()) ||
              (p.metadados?.impedimento === true &&
                parseCondicaoResposta(p.codigo, valor).aplicabilidade === "a_avaliar"));
        });
        if (pendente) {
          setError(`Responda: ${pendente.pergunta || pendente.texto}`);
          return;
        }
      }
      const nextLabel = steps[step + 1];
      if (label === "Tarefas") {
        if (!escopo.length) throw new Error("Inclua ao menos uma tarefa antes de continuar");
        if (escopoComNomeVazio(escopo)) throw new Error("Dê nome a todas as tarefas e subtarefas antes de continuar");
      }
      if (nextLabel === "Tarefas" || nextLabel === "Prévia") {
        await runPreview(nextLabel === "Tarefas");
      }
      setStep((s) => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      operacaoEmCursoRef.current = false;
      setAdvancing(false);
    }
  }

  function validarItensPersonalizados() {
    const invalido = impedimentosPersonalizados.find((item) => item.nome.trim().length < 3);
    if (invalido) throw new Error("Dê um nome com pelo menos 3 caracteres a cada impedimento ou pré-requisito adicionado, ou remova o item vazio.");
    const semResposta = impedimentosPersonalizados.find((item) => parseCondicaoResposta(item.codigo, respostas[item.codigo]).aplicabilidade === "a_avaliar");
    if (semResposta) throw new Error(`Defina se o item se aplica ao projeto: ${semResposta.nome}`);
  }

  function removerImpedimento(codigo: string) {
    setImpedimentosPersonalizados((itens) => itens.filter((item) => item.codigo !== codigo));
    setRespostas((anteriores) => Object.fromEntries(Object.entries(anteriores).filter(([chave]) => chave !== codigo)));
  }

  function escopoComNomeVazio(nos: EscopoNo[]): boolean {
    return nos.some((n) => n.nome.trim().length < 2 || escopoComNomeVazio(n.children));
  }

  async function confirm() {
    if (operacaoEmCursoRef.current || concluido.current) return;
    if (metaId === "__nova__" ? novaMetaNome.trim().length < 3 || (planoId === "__novo__" && novoPlanoNome.trim().length < 3) : !metaId) {
      setError("Selecione uma meta estratégica ou preencha os dados da nova meta na etapa de identificação.");
      setStep(0);
      return;
    }
    operacaoEmCursoRef.current = true;
    setSaving(true);
    setError("");
    try {
      const respErr = validateResponsavel();
      if (respErr) throw new Error(respErr);
      validarItensPersonalizados();
      if (escopoComNomeVazio(escopo)) {
        throw new Error("Dê nome a todas as tarefas e subtarefas");
      }
      if (!escopo.length) {
        throw new Error("Inclua ao menos uma tarefa antes de concluir");
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
          codigo: codigo.trim() || undefined,
          nome,
          descricao: descricaoCompleta,
          secretariaPrincipalId: secretariaId,
          secretariaIds: secretariasCorrelatas.filter((id) => id !== secretariaId),
          classificacaoPrincipal: classificacao,
          classificacoes,
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
          impedimentosPersonalizados,
          estruturaOverride: escopo.map(paraTreeNode),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao criar");
      concluido.current = true;
      try {
        window.localStorage.removeItem(rascunhoKey);
      } catch (err) {
        window.alert(`Projeto criado, mas não foi possível limpar o rascunho: ${err instanceof Error ? err.message : "armazenamento indisponível"}. Descarte o rascunho antes de iniciar outro cadastro deste tipo.`);
      }
      router.push(`/iniciativas/${json.data.id}?aba=andamento`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      if (!concluido.current) {
        operacaoEmCursoRef.current = false;
        setSaving(false);
      }
    }
  }

  function setResposta(codigoPergunta: string, valor: CondicaoValorState) {
    setRespostas((r) => ({ ...r, [codigoPergunta]: valor }));
  }

  function renderPerguntas(lista: ModeloPerguntaDef[]) {
    return (
      <div className="stack condicao-lista">
        {lista.map((p) => (
          <CondicaoCard
            key={p.codigo}
            pergunta={p}
            valor={respostas[p.codigo]}
            mostrarAjuda
            onChange={(next) => setResposta(p.codigo, next)}
          />
        ))}
      </div>
    );
  }

  const condicoesPrevia = new Map<string, CondicaoPrevia>();
  for (const bloqueio of preview?.bloqueios || []) {
    const pergunta = perguntasAtivas.find((p) => p.codigo === bloqueio.perguntaCodigo);
    const resposta = parseCondicaoResposta(bloqueio.perguntaCodigo, respostas[bloqueio.perguntaCodigo]);
    condicoesPrevia.set(bloqueio.perguntaCodigo, {
      codigo: bloqueio.perguntaCodigo,
      nome: pergunta?.rotulo || pergunta?.texto || bloqueio.rotulo.replace(/^Aguardando:\s*/i, ""),
      atendida: false,
      impedeInicio: true,
      proximaProvidencia: resposta.proximoPasso,
      responsavel: resposta.responsavel,
    });
  }
  for (const pergunta of visiblePerguntas) {
    if (!pergunta.metadados?.impedimento || condicoesPrevia.has(pergunta.codigo)) continue;
    const resposta = parseCondicaoResposta(pergunta.codigo, respostas[pergunta.codigo]);
    if (resposta.aplicabilidade !== "sim") continue;
    condicoesPrevia.set(pergunta.codigo, {
      codigo: pergunta.codigo,
      nome: pergunta.rotulo || pergunta.texto,
      atendida: resposta.situacao === "atendida",
      impedeInicio: pergunta.impacto === "BLOQUEANTE",
      proximaProvidencia: resposta.proximoPasso,
      responsavel: resposta.responsavel,
    });
  }
  const responsavelSelecionado = Object.values(equipePorSecretaria).flat().find((p) => p.id === responsavelPessoaId);

  const triagem = visiblePerguntas.filter((p) => p.etapa == null);
  const semResponsavel = contarSemResponsavel(escopo);
  const totalItens = contarItens(escopo);

  function irPara(indice: number) {
    if (operacaoEmCursoRef.current || busy || indice < 0 || indice > step) return;
    setError("");
    setStep(indice);
  }

  if (!rascunhoPronto) return <p role="status">Carregando rascunho…</p>;

  return (
    <div className="wizard stack">
      <div>
        <p role={rascunhoErro ? "alert" : "status"}>{rascunhoErro || rascunhoMensagem}</p>
        <p className="dashboard-muted">Um rascunho por tipo, usuário e prefeitura. Disponível somente neste navegador; não é sincronizado entre dispositivos.</p>
        <Button type="button" variant="ghost" disabled={busy} onClick={descartarRascunho}>Descartar rascunho e recomeçar</Button>
      </div>
      {estruturante && !modeloPadrao && (
        <p role="alert">Modelo estruturante não encontrado nesta prefeitura. Peça ao administrador para ativar o modelo CIP antes de concluir o cadastro. Seu rascunho pode ser mantido neste navegador.</p>
      )}
      <header
        ref={cabecalhoRef}
        className="wizard-head"
        tabIndex={-1}
        aria-label={`Etapa ${step + 1} de ${totalPassos}: ${steps[step]}`}
      >
        <p className="section-kicker">
          {classificacao === "PLANO_GOVERNO"
            ? "Plano de governo"
            : classificacao === "ACAO_DIARIA"
              ? "Ação diária"
              : classificacao === "PRIORITARIO"
                ? "Projeto prioritário"
                : "Projeto estruturante"}
        </p>
        <h1>Assistente de criação</h1>
        <div className="wizard-stepper">
          <button
            type="button"
            className="wizard-step-back"
            aria-label="Etapa anterior"
            disabled={step === 0 || busy}
            onClick={() => irPara(step - 1)}
          >
            <span aria-hidden="true">←</span>
          </button>
          <ol className="wizard-steps wizard-steps--nav">
            {steps.map((s, i) => {
              const atual = i === step;
              const alcancada = i <= step;
              return (
                <li key={s} className={atual ? "is-active" : i < step ? "is-done" : ""}>
                  {alcancada ? (
                    <button
                      type="button"
                      aria-current={atual ? "step" : undefined}
                      disabled={busy}
                      onClick={() => irPara(i)}
                    >
                      <span>{i + 1}</span>
                      {s}
                    </button>
                  ) : (
                    <>
                      <span>{i + 1}</span>
                      {s}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <fieldset className="wizard-fields stack" disabled={busy} aria-label={steps[step]} aria-busy={busy}>
      {steps[step] === "Identidade" && (
        <Card title="Identidade do projeto">
          <div className="stack">
            {erroModelo && (
              <div role="alert">
                <p>Não foi possível carregar o modelo: {erroModelo}</p>
                <Button type="button" variant="ghost" onClick={() => {
                  setModeloCarregado(null);
                  setTentativaModelo((n) => n + 1);
                }}>
                  Tentar carregar modelo novamente
                </Button>
              </div>
            )}
            <div>
              <RotuloComAjuda htmlFor="projeto-secretaria" campo="Secretaria principal" ajuda="Escolha a secretaria que coordena e responde pelo projeto." />
              <select
                id="projeto-secretaria"
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
              <RotuloComAjuda htmlFor="projeto-nome" campo="Nome do projeto" ajuda="Dê um nome claro e breve que identifique o projeto." />
              <input id="projeto-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div>
              <div className="rotulo-com-ajuda">
                <span id="projeto-secretarias-label">Secretarias correlacionadas</span>
                <AjudaCampo campo="Secretarias correlacionadas">Selecione as outras secretarias que participam da entrega. A seleção é opcional.</AjudaCampo>
              </div>
              <p className="dashboard-muted" style={{ margin: "4px 0 8px", fontSize: 12 }}>
                Pastas que participam da entrega (ex.: planejamento, administração/recursos, obras).
                O responsável pelo projeto e os responsáveis pelas tarefas podem ser de qualquer uma delas.
              </p>
              <div className="chip-row" role="group" aria-labelledby="projeto-secretarias-label">
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
                <RotuloComAjuda htmlFor="projeto-codigo" campo="Código do projeto" ajuda="Identificador opcional do projeto. Se ficar vazio, será gerado automaticamente." />
                <input
                  id="projeto-codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Gerado automaticamente ao confirmar"
                />
              </div>
              <div>
                <RotuloComAjuda htmlFor="projeto-responsavel" campo="Responsável pelo projeto" ajuda="Selecione a pessoa que coordena o projeto ou cadastre um novo responsável na secretaria principal." />
                <select
                  id="projeto-responsavel"
                  value={responsavelPessoaId}
                  onChange={(e) => setResponsavelPessoaId(e.target.value)}
                  disabled={pessoasLoading || Boolean(erroEquipe)}
                >
                  <option value="">
                    {pessoasLoading ? "Carregando equipes..." : "Selecione o responsável pelo projeto"}
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
                  <option value={NOVO_VALOR}>Cadastrar novo responsável na secretaria principal…</option>
                </select>
              </div>
            </div>
            {erroEquipe && (
              <div role="alert">
                <p>Não foi possível carregar as equipes: {erroEquipe}</p>
                <Button type="button" variant="ghost" onClick={() => {
                  setEquipeCarregada(null);
                  setTentativaEquipe((n) => n + 1);
                }}>
                  Tentar carregar equipes novamente
                </Button>
              </div>
            )}
            {!pessoasLoading && !erroEquipe && equipeNomes.length === 0 && (
              <p className="dashboard-muted">
                Nenhuma equipe cadastrada nas secretarias envolvidas. Cadastre o responsável pelo projeto abaixo.
              </p>
            )}
            {registrandoNovo && (
              <div className="form-grid form-grid--2">
                <div>
                  <RotuloComAjuda htmlFor="projeto-novo-responsavel" campo="Nome do responsável" ajuda="Informe o nome completo da pessoa que será cadastrada como responsável." />
                  <input
                    id="projeto-novo-responsavel"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <RotuloComAjuda htmlFor="projeto-novo-cargo" campo="Cargo do responsável" ajuda="Informe o cargo ou função da pessoa responsável pelo projeto." />
                  <input
                    id="projeto-novo-cargo"
                    value={novoCargo}
                    onChange={(e) => setNovoCargo(e.target.value)}
                    placeholder="Ex.: Coordenador de obras"
                    required
                  />
                </div>
                <div>
                  <RotuloComAjuda htmlFor="projeto-novo-telefone" campo="Telefone do responsável" ajuda="Telefone de contato do responsável pelo projeto, se disponível. É opcional." />
                  <input
                    id="projeto-novo-telefone"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    placeholder="(31) 90000-0000"
                  />
                </div>
                <div>
                  <RotuloComAjuda htmlFor="projeto-novo-email" campo="E-mail do responsável" ajuda="E-mail de contato do responsável pelo projeto, se disponível. É opcional." />
                  <input
                    id="projeto-novo-email"
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="nome@prefeitura.gov.br"
                  />
                </div>
              </div>
            )}
            <div>
              <RotuloComAjuda htmlFor="projeto-descricao"
                campo={estruturante
                  ? "Problema público *"
                  : classificacao === "PLANO_GOVERNO"
                    ? "Compromisso do plano e resultado esperado *"
                    : "Necessidade e local da ação *"}
                ajuda={estruturante
                  ? "Descreva o problema, quem é afetado e onde ele acontece."
                  : classificacao === "PLANO_GOVERNO"
                    ? "Explique o compromisso assumido no plano e o resultado que se espera alcançar."
                    : "Descreva a necessidade e o local em que a ação será realizada."}
              />
              <textarea
                id="projeto-descricao"
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
                  <RotuloComAjuda htmlFor="projeto-entrega" campo={estruturante ? "Entrega prevista e público beneficiado *" : "Entrega prevista neste ciclo *"} ajuda="Descreva o produto ou serviço concreto que será entregue e, quando aplicável, quem o receberá." />
                  <textarea
                    id="projeto-entrega"
                    rows={3}
                    value={entrega}
                    onChange={(e) => setEntrega(e.target.value)}
                    placeholder="Ex.: escola de seis salas no Bairro Novo, com acessibilidade e equipamentos."
                  />
                </div>
                {estruturante && <div>
                  <RotuloComAjuda htmlFor="projeto-beneficiarios" campo="Público beneficiado" ajuda="Informe os grupos de pessoas ou comunidades beneficiadas pela entrega. É opcional." />
                  <input
                    id="projeto-beneficiarios"
                    value={beneficiariosTxt}
                    onChange={(e) => setBeneficiariosTxt(e.target.value)}
                    placeholder="Ex.: ~400 crianças da região norte"
                  />
                </div>}
                {estruturante && <div>
                  <RotuloComAjuda htmlFor="projeto-fora-escopo" campo="Fora do escopo do projeto" ajuda="Registre entregas ou atividades que não fazem parte deste projeto, para evitar dúvidas. É opcional." />
                  <textarea
                    id="projeto-fora-escopo"
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
                <RotuloComAjuda htmlFor="projeto-meta" campo="Meta estratégica do projeto" ajuda="Todo projeto precisa pertencer a uma meta estratégica. Selecione uma meta cadastrada ou crie uma nova para vincular ao projeto." />
                <select
                  id="projeto-meta"
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
                  <div><RotuloComAjuda htmlFor="projeto-nova-meta" campo="Nome da meta estratégica" ajuda="Descreva o resultado estratégico que se pretende alcançar no plano de governo." /><input id="projeto-nova-meta" value={novaMetaNome} onChange={(e) => setNovaMetaNome(e.target.value)} placeholder="Ex.: ampliar em 200 as vagas em creches" /></div>
                  <div><RotuloComAjuda htmlFor="projeto-plano" campo="Plano de governo" ajuda="Escolha o plano ao qual a nova meta pertence ou crie um plano." /><select id="projeto-plano" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}<option value="__novo__">+ Criar plano de governo</option></select></div>
                  {planoId === "__novo__" && <div><RotuloComAjuda htmlFor="projeto-novo-plano" campo="Nome e período do plano de governo" ajuda="Identifique o plano de governo e o período de gestão a que se refere." /><input id="projeto-novo-plano" value={novoPlanoNome} onChange={(e) => setNovoPlanoNome(e.target.value)} placeholder="Ex.: Plano de Governo 2025–2028" /></div>}
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
          subtitle="Estas respostas definem a prioridade. O projeto só é criado ao confirmar; o rascunho é mantido neste navegador."
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
                (p) => p.grupo === grupoAtualMeta.id && p.etapa != null && !impedimentosPersonalizados.some((item) => item.codigo === p.codigo),
              ),
            )
          )}
          {grupoAtualMeta.id === GRUPO_IMPEDIMENTOS.id && (
            <ImpedimentosEditor
              itens={impedimentosPersonalizados}
              respostas={respostas}
              onChange={setImpedimentosPersonalizados}
              onResposta={(codigo, valor) => setRespostas((anteriores) => ({ ...anteriores, [codigo]: valor }))}
              onRemover={removerImpedimento}
              exemplo={classificacao === "ACAO_DIARIA" ? "disponibilidade de equipe, material ou acesso ao local" : classificacao === "PLANO_GOVERNO" ? "pactuação entre secretarias ou aprovação de cronograma" : "licença ambiental, aprovação técnica ou liberação de área"}
            />
          )}
        </Card>
      )}

      {steps[step] === "Tarefas" && (
        <Card
          title="Tarefas e responsáveis"
          subtitle="Desdobre o projeto em tarefas e subtarefas e defina quem responde por cada uma. O projeto só é criado ao confirmar; o rascunho é mantido neste navegador."
        >
          <div className="stack">
            <div className="chip-row">
              <Badge tone={semResponsavel ? "warning" : "success"}>
                {semResponsavel
                  ? `${semResponsavel} item(ns) sem responsável`
                  : "Todos os itens têm responsável"}
              </Badge>
              <Badge tone="neutral">{totalItens} tarefa(s) e subtarefa(s)</Badge>
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
        <Card title="Confira antes de criar" subtitle="Se precisar ajustar alguma informação, use os botões de edição abaixo.">
          <PreviaProjeto
            nome={nome}
            tipo={classificacao === "ACAO_DIARIA" ? "Ação diária" : classificacao === "PLANO_GOVERNO" ? "Plano de governo" : classificacao === "PRIORITARIO" ? "Projeto prioritário" : "Projeto estruturante"}
            secretaria={sec ? secretariaLabel(sec) : ""}
            outrasSecretarias={secretariasCorrelatas.filter((id) => id !== secretariaId).flatMap((id) => {
              const secretaria = secretarias.find((s) => s.id === id);
              return secretaria ? [secretariaLabel(secretaria)] : [];
            })}
            responsavel={registrandoNovo ? novoNome.trim() : responsavelSelecionado?.nome || ""}
            meta={metaId === "__nova__" ? novaMetaNome : metas.find((meta) => meta.id === metaId)?.label || ""}
            novoPlano={metaId === "__nova__" ? planoId === "__novo__" ? novoPlanoNome : planos.find((plano) => plano.id === planoId)?.nome : undefined}
            descricao={descricao}
            entrega={classificacao === "ACAO_DIARIA" ? "" : entrega}
            beneficiarios={estruturante ? beneficiariosTxt : ""}
            foraEscopo={estruturante ? foraEscopo : ""}
            tarefas={escopo}
            condicoes={[...condicoesPrevia.values()]}
            avisos={(preview?.avisos || []).filter((aviso) => aviso.startsWith("Pergunta obrigatória sem resposta: ")).map(traduzirAviso)}
            avaliacaoPronta={preview !== null}
            aguardaPreRequisito={preview?.cicloInicial === "AGUARDANDO_PRE_REQUISITO"}
            onEditar={(secao) => irPara(steps.indexOf(secao === "identidade" ? "Identidade" : secao === "condicoes" ? GRUPO_IMPEDIMENTOS.nome : "Tarefas"))}
          />
        </Card>
      )}

      </fieldset>

      {error && <p role="alert" style={{ color: "var(--cip-danger)" }}>{error}</p>}

      <footer className="wizard-foot">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || busy}
          onClick={() => irPara(step - 1)}
        >
          Voltar
        </Button>
        {steps[step] !== "Prévia" ? (
          <Button type="button" onClick={next} disabled={busy}>
            {advancing ? "Preparando..." : "Continuar"}
          </Button>
        ) : (
          <Button type="button" onClick={confirm} disabled={busy}>
            {saving ? "Gravando..." : "Confirmar e abrir projeto"}
          </Button>
        )}
      </footer>
    </div>
  );
}
