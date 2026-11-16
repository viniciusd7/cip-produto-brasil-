import { API_URL } from "@/lib/api";

export async function salvarMedicao(
  form: FormData,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  const dataCorte = new Date(String(form.get("dataCorte")));
  if (Number.isNaN(dataCorte.getTime())) {
    throw new Error("Informe uma data de corte válida.");
  }

  const res = await fetcher(`${API_URL}/planejamento/medicoes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      metaEstrategicaId: String(form.get("metaEstrategicaId")),
      dataCorte: dataCorte.toISOString(),
      valorRealizado: String(form.get("valorRealizado")),
      valorEsperado: String(form.get("valorEsperado") || "") || undefined,
      fonte: String(form.get("fonte") || "") || undefined,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || "Falha ao salvar medição");
  }
}
