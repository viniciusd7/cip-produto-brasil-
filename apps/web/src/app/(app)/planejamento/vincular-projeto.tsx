"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { apiFetch } from "@/lib/api";

type Projeto = { id: string; codigo: string; nome: string };

export function VincularProjeto({ metaId, token }: { metaId: string; token: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function abrir() {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await apiFetch<{ data: Projeto[] }>("/iniciativas", { token });
      setProjetos(resposta.data);
      setAberto(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os projetos.");
    } finally {
      setOcupado(false);
    }
  }

  async function vincular(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projetoId = String(new FormData(event.currentTarget).get("projetoId"));
    setOcupado(true);
    setErro("");
    try {
      await apiFetch(`/iniciativas/${encodeURIComponent(projetoId)}`, {
        token, method: "PATCH", body: JSON.stringify({ metaEstrategicaId: metaId }),
      });
      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível vincular o projeto.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="stack">
      {!aberto ? <Button variant="secondary" disabled={ocupado} onClick={() => void abrir()}>{ocupado ? "Carregando…" : "Vincular projeto existente"}</Button> : (
        <form className="stack" onSubmit={vincular}>
          <label>Projeto<select name="projetoId" required disabled={ocupado} defaultValue=""><option value="">Selecione o projeto</option>{projetos.map((projeto) => <option key={projeto.id} value={projeto.id}>{projeto.codigo} · {projeto.nome}</option>)}</select></label>
          <div className="chip-row">
            <Button type="submit" disabled={ocupado || !projetos.length}>{ocupado ? "Vinculando…" : "Vincular à meta"}</Button>
            <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button>
          </div>
        </form>
      )}
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
