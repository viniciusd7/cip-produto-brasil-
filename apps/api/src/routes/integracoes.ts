import { Router } from "express";
import { prisma } from "@cip/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { HttpError } from "../middleware/error";

export const integracoesRouter = Router();
integracoesRouter.use(requireAuth);

const TRANSFEREGOV =
  "https://api-publica.transferegov.gestao.gov.br/discricionarias";
const PNCP = "https://pncp.gov.br/api/consulta";

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 10 * 60 * 1000;

function digits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

async function cachedFetch(key: string, url: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new HttpError(
        502,
        "UPSTREAM_ERROR",
        `Falha ao consultar serviço externo (${res.status})`,
      );
    }
    const data = await res.json().catch(() => null);
    if (data == null) {
      throw new HttpError(502, "UPSTREAM_ERROR", "Resposta inválida do serviço externo");
    }
    cache.set(key, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function cnpjDoUsuario(user: Express.Request["user"]) {
  const municipioId = user?.municipioId;
  if (!municipioId) throw new HttpError(400, "NO_MUNICIPIO", "Município não vinculado");
  const m = await prisma.municipio.findUnique({ where: { id: municipioId } });
  const cnpj = digits(m?.cnpjOrgao);
  if (!cnpj || cnpj.length !== 14) {
    throw new HttpError(
      422,
      "CNPJ_MISSING",
      "Cadastre o CNPJ do órgão no município para consultar dados externos",
    );
  }
  return { cnpj, municipio: m! };
}

integracoesRouter.get(
  "/transferegov/propostas",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const { cnpj } = await cnpjDoUsuario(req.user);
      const pagina = Math.max(1, Number(req.query.pagina) || 1);
      const url = `${TRANSFEREGOV}/propostas?cd_identif_proponente=${cnpj}&pagina=${pagina}&tamanho_da_pagina=20`;
      const raw = (await cachedFetch(`tg:${cnpj}:${pagina}`, url)) as
        | Array<Record<string, unknown>>
        | {
            items?: Array<Record<string, unknown>>;
            data?: Array<Record<string, unknown>>;
            total_items?: number;
          };
      const items = Array.isArray(raw)
        ? raw
        : raw.items || raw.data || [];
      const list = items.slice(0, 20).map((p) => ({
        id: p.id_proposta || p.id || p.nr_proposta,
        numero: p.nr_proposta || p.numero || p.codigo || "—",
        situacao: p.situacao_proposta || p.situacao || p.desc_situacao || "—",
        valor: p.vl_global || p.valor_global || p.vl_repasse || null,
        orgao: p.nome_orgao || p.orgao_concedente || p.nm_orgao || null,
        modalidade: p.modalidade || p.desc_modalidade || null,
        link: "https://www.gov.br/transferegov/pt-br",
      }));
      res.json({
        data: {
          fonte: "Transferegov",
          cnpj,
          total: Array.isArray(raw) ? list.length : (raw.total_items ?? list.length),
          itens: list,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

integracoesRouter.get(
  "/pncp/contratacoes",
  requirePermission("iniciativa:read"),
  async (req, res, next) => {
    try {
      const { cnpj } = await cnpjDoUsuario(req.user);
      const ano = Number(req.query.ano) || new Date().getFullYear();
      // Consulta pública por CNPJ (endpoint de compra/contratação pode variar; fallback seguro)
      const url = `${PNCP}/v1/orgaos/${cnpj}/compras?ano=${ano}&pagina=1&tamanhoPagina=15`;
      let list: Array<Record<string, unknown>> = [];
      try {
        const raw = (await cachedFetch(`pncp:${cnpj}:${ano}`, url)) as
          | Array<Record<string, unknown>>
          | { data?: Array<Record<string, unknown>>; content?: Array<Record<string, unknown>> };
        list = Array.isArray(raw)
          ? raw
          : raw.data || raw.content || [];
      } catch {
        list = [];
      }
      const itens = list.slice(0, 15).map((p) => ({
        id: p.numeroControlePNCP || p.id || p.numeroCompra,
        numero: p.numeroCompra || p.numeroControlePNCP || "—",
        objeto: p.objetoCompra || p.objeto || p.descricao || "—",
        situacao: p.situacaoCompra || p.situacao || "—",
        valor: p.valorTotalEstimado || p.valorGlobal || null,
        modalidade: p.modalidadeNome || p.modalidade || null,
        link: "https://pncp.gov.br/",
      }));
      res.json({
        data: {
          fonte: "PNCP",
          cnpj,
          ano,
          total: itens.length,
          itens,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
