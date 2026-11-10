import Link from "next/link";
import { getServerSession } from "next-auth";
import { toneClassPasta as classTone } from "@cip/shared";
import { Badge, Breadcrumbs, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type Dash = {
  data: {
    porSecretaria: Array<{
      id: string;
      nome: string;
      sigla?: string | null;
      projetos: number;
      pctAtraso: number;
      classificacao: string;
      indicePonderado: number;
      atrasadas: number;
      diasSemAtualizacao: number | null;
    }>;
  };
};

function classLabel(c: string) {
  const map: Record<string, string> = {
    INTERVENCAO: "Intervenção prioritária",
    ACOMPANHAMENTO: "Acompanhamento próximo",
    ROTINA: "Rotina de monitoramento",
    DADOS_DEFASADOS: "Dados defasados",
  };
  return map[c] || c;
}

export default async function SecretariasPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<Dash>("/dashboard/resumo", {
    token: session?.accessToken,
  });

  const list = payload.data.porSecretaria.filter((s) =>
    sp.class ? s.classificacao === sp.class : true,
  );

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: "Cenário", href: "/painel" },
          { label: "Saúde das secretarias" },
        ]}
      />
      <PageHeader
        eyebrow={
          session?.user?.role === "gestor"
            ? "Sua home · Pastas da prefeitura"
            : "Passo 2 do fluxo · Quem cobrar"
        }
        title={
          session?.user?.role === "gestor"
            ? "Minhas pastas e prioridades"
            : "Saúde de cada secretaria"
        }
        description="Identifique o sinal, entenda a causa e abra a pauta de acompanhamento de cada pasta. Fluxo: Cenário → Pasta → Projeto → Cobrança."
      />

      <div className="chip-row">
        <Link href="/secretarias">
          <Badge tone={!sp.class ? "info" : "neutral"}>Todas</Badge>
        </Link>
        {[
          "INTERVENCAO",
          "ACOMPANHAMENTO",
          "ROTINA",
          "DADOS_DEFASADOS",
        ].map((c) => (
          <Link key={c} href={`/secretarias?class=${c}`}>
            <Badge tone={sp.class === c ? classTone(c) : "neutral"}>
              {classLabel(c)}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="secretaria-card-grid">
        {list.map((s) => (
          <Link key={s.id} href={`/secretarias/${s.id}`} className="secretaria-card">
            <div className="secretaria-card__top">
              <div>
                <h3>{s.nome}</h3>
                <p>
                  {s.sigla || "pasta"} · {s.projetos} projetos
                </p>
              </div>
              <Badge tone={classTone(s.classificacao)}>
                {classLabel(s.classificacao)}
              </Badge>
            </div>
            <p className="secretaria-card__signal">
              {s.classificacao === "DADOS_DEFASADOS"
                ? `${s.diasSemAtualizacao ?? "—"} dias sem atualizar. Validar antes de decidir.`
                : `${s.pctAtraso}% de atraso nas abertas · índice ${s.indicePonderado}%.`}
            </p>
            <div className="secretaria-card__metrics">
              <span>
                <b className="text-rose">{s.atrasadas}</b> atrasadas
              </span>
              <span>
                <b>{s.indicePonderado}%</b> índice
              </span>
            </div>
            <span className="secretaria-card__cta">Abrir pauta ↗</span>
          </Link>
        ))}
      </div>

      {!list.length && (
        <Card>
          <p className="dashboard-muted">Nenhuma secretaria neste filtro.</p>
        </Card>
      )}
    </div>
  );
}
