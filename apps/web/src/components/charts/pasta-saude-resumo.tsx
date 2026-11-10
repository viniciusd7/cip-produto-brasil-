type Status = {
  noPrazo: number;
  atrasadas: number;
  semPrazo: number;
  concluidas: number;
};

export function PastaSaudeResumo({ status }: { status: Status }) {
  const total =
    status.noPrazo + status.atrasadas + status.semPrazo + status.concluidas;

  if (!total) {
    return (
      <p className="dashboard-muted">
        Esta pasta ainda não tem tarefas para montar o status.
      </p>
    );
  }

  const items = [
    {
      key: "concluidas",
      label: "Concluídas",
      value: status.concluidas,
      tone: "ok" as const,
    },
    {
      key: "noPrazo",
      label: "No prazo",
      value: status.noPrazo,
      tone: "info" as const,
    },
    {
      key: "semPrazo",
      label: "Sem prazo",
      value: status.semPrazo,
      tone: "warn" as const,
    },
    {
      key: "atrasadas",
      label: "Atrasadas",
      value: status.atrasadas,
      tone: "danger" as const,
    },
  ];

  return (
    <div className="pasta-saude">
      <div className="pasta-saude__kpis">
        {items.map((item) => (
          <div key={item.key} className={`pasta-saude__kpi pasta-saude__kpi--${item.tone}`}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="pasta-saude__bar" role="img" aria-label="Proporção das tarefas">
        {items
          .filter((i) => i.value > 0)
          .map((item) => {
            const pct = Math.round((item.value / total) * 100);
            return (
              <div
                key={item.key}
                className={`pasta-saude__seg pasta-saude__seg--${item.tone}`}
                style={{ flexGrow: item.value, flexBasis: 0 }}
                title={`${item.label}: ${item.value} (${pct}%)`}
              >
                {pct >= 12 ? `${pct}%` : ""}
              </div>
            );
          })}
      </div>
      <p className="pasta-saude__total">Total: {total} tarefas</p>
    </div>
  );
}
