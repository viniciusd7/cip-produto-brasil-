"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@cip/ui";
import { API_URL } from "@/lib/api";
import { secretariaChipLabel } from "@/lib/secretaria-label";

type Secretaria = { id: string; nome: string; sigla?: string | null };
type Pessoa = { id: string; nome: string; cargo: string; papel: string };

const TEXTO_LIVRE = "__texto__";

/**
 * Edição, depois da criação, do responsável do projeto e das secretarias
 * correlacionadas. O responsável pode ser de qualquer pasta envolvida.
 */
export function VinculosEditor({
  token,
  iniciativaId,
  secretariaPrincipal,
  secretariasAtuais,
  todasSecretarias,
  responsavel,
  responsavelPessoaId,
  canWrite,
}: {
  token: string;
  iniciativaId: string;
  secretariaPrincipal: Secretaria;
  secretariasAtuais: Secretaria[];
  todasSecretarias: Secretaria[];
  responsavel?: string | null;
  responsavelPessoaId?: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [correlatas, setCorrelatas] = useState<string[]>(
    secretariasAtuais.map((s) => s.id),
  );
  const [pessoaId, setPessoaId] = useState<string>(
    responsavelPessoaId || (responsavel ? TEXTO_LIVRE : ""),
  );
  const [equipe, setEquipe] = useState<Record<string, Pessoa[]>>({});
  const [carregandoEquipe, setCarregandoEquipe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const envolvidas = [secretariaPrincipal.id, ...correlatas];

  // Carrega a equipe de todas as pastas ao abrir a edição, por clique (sem effect):
  // assim trocar as correlacionadas não exige nova busca.
  async function abrirEdicao() {
    setErro("");
    setEditando(true);
    setCarregandoEquipe(true);
    try {
      const ids = [secretariaPrincipal.id, ...todasSecretarias.map((x) => x.id)];
      const unicos = Array.from(new Set(ids));
      const entradas = await Promise.all(
        unicos.map(async (id) => {
          const res = await fetch(`${API_URL}/admin/secretarias/${id}/pessoas`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          return [id, (json?.data || []) as Pessoa[]] as const;
        }),
      );
      setEquipe(Object.fromEntries(entradas));
    } catch {
      setEquipe({});
    } finally {
      setCarregandoEquipe(false);
    }
  }

  function alternarCorrelata(id: string) {
    setCorrelatas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const body: Record<string, unknown> = {
        secretariaIds: correlatas.filter((id) => id !== secretariaPrincipal.id),
      };
      if (pessoaId === TEXTO_LIVRE) {
        body.responsavel = responsavel ?? "";
      } else if (pessoaId) {
        body.responsavelPessoaId = pessoaId;
      }
      const res = await fetch(`${API_URL}/iniciativas/${iniciativaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao salvar");
      setEditando(false);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  if (!canWrite) {
    return (
      <div className="chip-row">
        {secretariasAtuais.map((s) => (
          <Badge key={s.id} tone="neutral">
            {secretariaChipLabel(s)} · correlacionada
          </Badge>
        ))}
      </div>
    );
  }

  if (!editando) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="chip-row">
          <Badge tone="info">{secretariaChipLabel(secretariaPrincipal)} · principal</Badge>
          {secretariasAtuais.map((s) => (
            <Badge key={s.id} tone="neutral">
              {secretariaChipLabel(s)} · correlacionada
            </Badge>
          ))}
        </div>
        <div>
          <button type="button" className="linkish" onClick={abrirEdicao}>
            Editar responsável e secretarias envolvidas
          </button>
        </div>
      </div>
    );
  }

  const opcoesEquipe = envolvidas.map((id) => {
    const rows = equipe[id] || [];
    const s = [secretariaPrincipal, ...todasSecretarias].find((x) => x.id === id);
    if (!rows.length) return null;
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
  });

  return (
    <div className="stack">
      <div>
        <label>Secretarias correlacionadas</label>
        <div className="chip-row" style={{ marginTop: 8 }}>
          {todasSecretarias
            .filter((s) => s.id !== secretariaPrincipal.id)
            .map((s) => {
              const ativa = correlatas.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={ativa ? "cip-btn cip-btn--primary" : "cip-btn cip-btn--secondary"}
                  style={{ padding: "8px 10px", minHeight: 36, fontSize: 12 }}
                  aria-pressed={ativa}
                  onClick={() => alternarCorrelata(s.id)}
                >
                  {secretariaChipLabel(s)}
                </button>
              );
            })}
        </div>
      </div>

      <div>
        <label>Responsável do projeto</label>
        <select
          value={pessoaId}
          onChange={(e) => setPessoaId(e.target.value)}
          disabled={carregandoEquipe}
        >
          <option value="">{carregandoEquipe ? "Carregando equipes..." : "Selecione"}</option>
          {responsavel && !responsavelPessoaId && (
            <option value={TEXTO_LIVRE}>{responsavel} (texto livre)</option>
          )}
          {opcoesEquipe}
        </select>
      </div>

      {erro && <p style={{ color: "var(--cip-danger)", margin: 0 }}>{erro}</p>}
      <div className="chip-row">
        <Button type="button" onClick={salvar} disabled={salvando || !pessoaId}>
          {salvando ? "Salvando..." : "Salvar vínculos"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
