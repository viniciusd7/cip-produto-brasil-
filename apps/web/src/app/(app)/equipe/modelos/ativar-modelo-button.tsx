"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

export function AtivarModeloButton({
  token,
  catalogoId,
}: {
  token: string;
  catalogoId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function ativar() {
    setLoading(true);
    await fetch(`${API_URL}/modelos-projeto/ativar/${catalogoId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button type="button" onClick={ativar} disabled={loading}>
      {loading ? "Ativando..." : "Ativar"}
    </Button>
  );
}