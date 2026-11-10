# Relatório executivo CIP — fórmulas e mapeamento

Referências: modelo [CIP Painel Executivo CMD](https://cip-painel-executivo-cmd-061026.viniciusmaroch.chatgpt.site/) e PDF `CIP-dashboard-executivo.pdf`.

## Versão metodológica

`GRAVIDADE_METODO_VERSAO = v1-2026-10`

## Unidades

| Conceito | Definição |
|---|---|
| Concluída | `concluidoEm` preenchido |
| Sem prazo | sem `prazoVigente` e não concluída |
| No prazo | `prazoVigente` ≥ data-base e não concluída |
| Atrasada | `prazoOriginal`/`prazoVigente` vencido sem conclusão (reprogramação **não** remove atraso histórico) |
| Abertas | total − concluídas |

## Indicadores

- **% atraso nas abertas** = atrasadas / abertas
- **Índice ponderado** = Σ(pesos dos atrasos) / abertas  
  Pesos: leve 25%, moderada 50%, grave 75%, crítica 100%
- **Carteira com atraso** = projetos com ≥1 tarefa atrasada / total projetos
- **Atenção executiva** = estruturantes com atraso **ou** atraso grave/crítico

## Classificação de secretaria

1. Dados defasados: >30 dias sem atualização
2. Intervenção: % atraso ≥50 **ou** índice ≥35
3. Acompanhamento: % atraso ≥35 **ou** sem prazo ≥25% das abertas
4. Rotina: demais

## Telas

| Bloco do modelo | Rota / UI |
|---|---|
| Visão de governo | `/painel#visao` — hero + AreaChart (Recharts) + KPIs de metas |
| Saúde por secretaria | `/painel#secretarias` — radar + barras + filtros |
| Gravidade / entraves | `/painel#projetos` — barras de `agenda.gravidadeBuckets` e `entraves` |
| Agenda de decisão | `/painel#decisoes` — tarefas, metas vencidas, pastas defasadas |
| Prestação | `/painel#prestacao` — concluídas, pendências, retrato |
| Cockpit do secretário | `/minha-pasta` (Azimov: hero · saúde · fila) + `PastaSaudeResumo`; role code `gestor` |
| Relatório por secretaria | `/relatorios` |
| Export CSV | `GET /reports/executivo.csv` |

## Metas de execução

`data.metas` no `/dashboard/resumo` agrega `MetaExecucao`: total, cobertura (`valorAtual`), atrasadas (prazo vs data-base), sem prazo, concluídas. Por secretaria: `metasTotal`, `metasComValor`, `metasAtrasadas`.
