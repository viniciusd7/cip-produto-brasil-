"use client";

import { useState } from "react";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";

const sample = {
  nomeArquivo: "amostra-cmd-piloto.json",
  dataReferencia: "2026-10-06T12:00:00.000Z",
  fonte: "BASE CMD amostra",
  linhas: [
    {
      idExterno: "DEMO-IMP-001",
      secretaria: "Educação",
      projeto: "Ampliação de transporte escolar",
      tarefa: "Elaborar plano operacional",
      responsavel: "Educação",
      prazoOriginal: "2026-11-30T12:00:00.000Z",
      origem: "IMPORT_DEMO",
    },
  ],
};

export function ImportForm({ token }: { token: string }) {
  const [json, setJson] = useState(JSON.stringify(sample, null, 2));
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setResult("");
    try {
      const body = JSON.parse(json);
      const res = await fetch(`${API_URL}/import/amostral`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Falha na importação");
      setResult(
        `OK: ${data.data.importadas} importadas, ${data.data.conflitos} conflitos (${data.data.resultado})`,
      );
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Enviar lote amostral (JSON)">
      <textarea
        rows={16}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
      />
      <div style={{ marginTop: 12 }} className="chip-row">
        <Button type="button" onClick={onSubmit} disabled={loading}>
          {loading ? "Importando..." : "Executar importação"}
        </Button>
        {result && <span style={{ fontSize: 13 }}>{result}</span>}
      </div>
    </Card>
  );
}
