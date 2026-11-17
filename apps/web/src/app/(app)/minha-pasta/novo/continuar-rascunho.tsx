"use client";

import { useEffect, useState } from "react";
import { chaveRascunho, lerRascunho } from "./rascunho-projeto";

export function ContinuarRascunho({
  usuarioId,
  municipioId,
  classificacao,
}: {
  usuarioId: string;
  municipioId: string;
  classificacao: string;
}) {
  const [resumo, setResumo] = useState<string | null>(null);

  useEffect(() => {
    function atualizar() {
      try {
        const dados = lerRascunho(
          window.localStorage,
          chaveRascunho(usuarioId, municipioId, classificacao),
        );
        setResumo(dados ? dados.nome.trim() || "Projeto sem nome" : null);
      } catch {
        setResumo("Rascunho disponível para recuperação");
      }
    }

    atualizar();
    window.addEventListener("pageshow", atualizar);
    window.addEventListener("focus", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("pageshow", atualizar);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, [usuarioId, municipioId, classificacao]);

  return (
    <span className="wizard-draft-choice">
      {resumo && <small>{resumo}</small>}
      <span>{resumo ? "Continuar rascunho →" : "Iniciar criação"}</span>
    </span>
  );
}
