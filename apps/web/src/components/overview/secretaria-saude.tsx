import { secretariaDimensions, secretariaStatus } from "./overview-model";
import type { SecretariaOverview } from "./types";

export function SecretariaSaude({ secretaria }: { secretaria: SecretariaOverview }) {
  const dimensions = secretariaDimensions(secretaria);
  const complete = dimensions.every((d) => d.value != null);
  const values = dimensions.map((d) => (d.value ?? 0) * .63);
  const polygon = `90,${90 - values[0]} ${90 + values[1]},90 90,${90 + values[2]} ${90 - values[3]},90`;
  return <div className={`gov-health gov-tone-${secretariaStatus(secretaria).tone}`}>
    {complete ? <svg viewBox="0 0 180 180" className="gov-health__radar" role="img" aria-label={`Saúde de ${secretaria.nome}: ${dimensions.map((d) => `${d.label}: ${Math.round(d.value!)}%`).join("; ")}`}>
      {[16,32,48,64].map((r) => <polygon key={r} points={`90,${90-r} ${90+r},90 90,${90+r} ${90-r},90`} fill="none" stroke="#aab6cc30" />)}
      <path d="M90 26v128M26 90h128" stroke="#aab6cc30" />
      <polygon points={polygon} fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeWidth="2" />
      <text x="90" y="16" textAnchor="middle">Execução</text><text x="178" y="94" textAnchor="end">Prazos</text><text x="90" y="173" textAnchor="middle">Definição</text><text x="2" y="94" textAnchor="start">Gravidade</text>
    </svg> : <p className="gov-health__empty">{secretaria.tarefasTotal ? "Sem tarefas abertas para comparar os prazos." : "A análise visual estará disponível com o cadastro de tarefas."}</p>}
    <dl className="gov-health__dimensions">{dimensions.map((d) => <div key={d.label}><dt>{d.label}</dt><dd>{d.value == null ? "—" : `${Math.round(d.value)}%`}</dd><div className="gov-health__bar" aria-hidden="true"><span style={{width:`${d.value ?? 0}%`}} /></div></div>)}</dl>
  </div>;
}
