import { METODOLOGIA_SECRETARIAS } from "@cip/shared";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { toneClassPasta as classTone } from "@cip/shared";
import { Badge, Breadcrumbs, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { canManageSecretariaRole } from "@/lib/roles";
import { NovaSecretariaForm } from "./nova-secretaria-form";

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
      abertas: number;
      semPrazo: number;
      tarefasTotal: number;
      motivosClassificacao: string[];
      atualizadoEm: string | null;
      diasSemAtualizacao: number | null;
    }>;
  };
  meta: { dataReferencia: string };
};

const regras = METODOLOGIA_SECRETARIAS;
const percentual = (valor: number) => `${valor.toLocaleString("pt-BR")}%`;
const dataFormatada = (valor: string) =>
  new Date(valor).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

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
  const canManage = canManageSecretariaRole(session?.user?.role);

  const list = payload.data.porSecretaria.filter((s) =>
    sp.class ? s.classificacao === sp.class : true,
  );

  return (
    <div className="stack">
      <Breadcrumbs
        items={[
          { label: "Visão geral", href: "/painel" },
          { label: "Pastas" },
        ]}
      />
      <PageHeader
        eyebrow={
          session?.user?.role === "gestor"
            ? "Sua home · Pastas da prefeitura"
            : session?.user?.role === "prefeito"
              ? "Gabinete · Organograma"
              : "Passo 2 do fluxo · Quem cobrar"
        }
        title={
          session?.user?.role === "gestor"
            ? "Minhas pastas e prioridades"
            : session?.user?.role === "prefeito"
              ? "Pastas da prefeitura"
              : "Saúde de cada secretaria"
        }
        description="A classificação é calculada automaticamente com os prazos e a gravidade das tarefas dos projetos de cada secretaria. Confira o motivo em cada pasta."
      />

      <details className="secretaria-methodology">
        <summary>De onde vêm os indicadores e o que define cada classificação?</summary>
        <div className="secretaria-methodology__content">
          <p>
            <strong>Fonte:</strong> tarefas cadastradas nos projetos em que a secretaria
            é a responsável principal. Tarefas abertas são todas as que ainda não
            foram concluídas, incluindo as que estão sem prazo.
            A classificação segue regras fixas de acompanhamento do sistema,
            aplicadas na ordem abaixo.
          </p>
          <dl className="secretaria-methodology__rules">
            <div>
              <dt>Dados defasados</dt>
              <dd>Mais de {regras.diasSemAtualizacao} dias desde a atualização mais recente dos projetos da pasta. Essa regra tem prioridade sobre as demais.</dd>
            </div>
            <div>
              <dt>Intervenção prioritária</dt>
              <dd>Atraso em {regras.intervencao.pctAtraso}% ou mais das tarefas abertas <strong>ou</strong> índice ponderado de atraso de {regras.intervencao.indicePonderado}% ou mais.</dd>
            </div>
            <div>
              <dt>Acompanhamento próximo</dt>
              <dd>Sem atingir intervenção: atraso em {regras.acompanhamento.pctAtraso}% ou mais das tarefas abertas <strong>ou</strong> {regras.acompanhamento.pctSemPrazo}% ou mais das tarefas abertas sem prazo.</dd>
            </div>
            <div>
              <dt>Rotina de monitoramento</dt>
              <dd>Nenhum dos limites acima foi atingido. Confira também se há tarefas cadastradas para avaliar.</dd>
            </div>
          </dl>
          <p>
            <strong>Percentual de atraso:</strong> tarefas atrasadas ÷ tarefas abertas × 100.
            Uma tarefa está atrasada quando não foi concluída e seu prazo vigente
            já passou na data de referência usada no cálculo.
          </p>
          <p>
            <strong>Índice ponderado de atraso:</strong> soma dos pesos das tarefas
            atrasadas ÷ tarefas abertas × 100. Pesos: leve {regras.pesosGravidade.LEVE.toLocaleString("pt-BR")},
            moderada {regras.pesosGravidade.MODERADA.toLocaleString("pt-BR")},
            grave {regras.pesosGravidade.GRAVE.toLocaleString("pt-BR")} e
            crítica {regras.pesosGravidade.CRITICA}. Quanto mais grave o atraso, maior o peso.
            Por exemplo: 1 atraso grave em 2 tarefas abertas resulta em 50% de atraso
            e índice ponderado de 37,5%.
          </p>
          <p>
            A gravidade é a registrada na tarefa; quando não foi informada, o sistema
            a calcula a partir dos dias de atraso e das reprogramações.
            Os prazos usam a data de referência de cada projeto ou, se ausente,
            a do painel: {dataFormatada(payload.meta.dataReferencia)}.
            A defasagem compara essa data do painel com a atualização mais recente
            dos projetos da pasta. Critérios da versão {regras.versao}.
          </p>
        </div>
      </details>

      {canManage && (
        <Card
          title="Cadastro de pastas"
          subtitle="Nome, sigla e titular entram aqui. A pauta abre com esses dados já preenchidos"
        >
          <NovaSecretariaForm token={session?.accessToken || ""} />
        </Card>
      )}

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
                  {s.sigla || "pasta"} · {s.projetos} {s.projetos === 1 ? "projeto" : "projetos"}
                </p>
              </div>
              <Badge tone={classTone(s.classificacao)}>
                {classLabel(s.classificacao)}
              </Badge>
            </div>
            <div className="secretaria-card__reason">
              <strong>Por que essa classificação?</strong>
              {s.motivosClassificacao.map((motivo) => (
                <p className="secretaria-card__signal" key={motivo}>{motivo}</p>
              ))}
              {s.tarefasTotal === 0 && (
                <p className="secretaria-card__signal">Sem tarefas cadastradas para avaliar a execução.</p>
              )}
              {s.tarefasTotal > 0 && s.abertas === 0 && (
                <p className="secretaria-card__signal">Todas as tarefas cadastradas foram concluídas.</p>
              )}
            </div>
            <dl className="secretaria-card__indicators">
              <div><dt>Tarefas atrasadas</dt><dd className={s.atrasadas ? "text-rose" : undefined}>{s.atrasadas} de {s.abertas} abertas ({percentual(s.pctAtraso)})</dd></div>
              <div><dt>Tarefas sem prazo</dt><dd>{s.semPrazo} de {s.abertas} abertas</dd></div>
              <div><dt>Índice ponderado de atraso</dt><dd>{percentual(s.indicePonderado)}</dd></div>
            </dl>
            <p className="secretaria-card__updated">
              {s.atualizadoEm
                ? `Última atualização dos projetos: ${dataFormatada(s.atualizadoEm)}`
                : "Sem atualização de projetos registrada"}
            </p>
            <span className="secretaria-card__cta">Ver projetos e tarefas ↗</span>
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
