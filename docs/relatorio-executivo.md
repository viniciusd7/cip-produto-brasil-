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
| Visão de governo | `/painel#visao` — hero + AreaChart (Recharts) + indicadores de projetos e tarefas |
| Saúde por secretaria | `/painel#secretarias` — radar + barras + filtros |
| Gravidade / entraves | `/painel#projetos` — barras de `agenda.gravidadeBuckets` e `entraves` |
| Agenda de decisão | `/painel#decisoes` — tarefas e pastas defasadas |
| Prestação | `/painel#prestacao` — concluídas, pendências, retrato |
| Cockpit do secretário | `/minha-pasta` (Azimov: hero · saúde · fila) + `PastaSaudeResumo`; role code `gestor` |
| Relatório por secretaria | `/relatorios` |
| Export CSV | `GET /reports/executivo.csv` |

## Dados históricos de metas de execução

As metas de execução e seus vínculos históricos continuam preservados nos dados. Os agregados de metas de execução não são mais retornados pelos payloads de apresentação do painel e da pasta da secretaria nem apresentados nos relatórios. As tarefas vinculadas continuam listadas e consultáveis como tarefas.

## Consulta plana e exportação fiel

- `/relatorios` oferece uma única tabela: tarefas, metas estratégicas e indicadores, projetos, secretarias ou evidências. As antigas URLs `/relatorios/tarefas`, `/relatorios/metas` etc. continuam abrindo o conteúdo correspondente.
- `GET /reports/prestacao.json` mantém os dados de compatibilidade e acrescenta `data.consulta` (colunas, linhas, total, busca e ordenação) e `data.csv`, gerados da mesma consulta. O botão exporta esse CSV já autorizado, sem uma segunda consulta que poderia divergir do retrato apresentado. A geração do retrato é auditada como `GERAR_RELATORIO`.
- `GET /reports/prestacao.csv` permanece disponível para integrações e gera um retrato atualizado, com os mesmos parâmetros e regras; o acesso é auditado como `EXPORT_CSV`. Ambos exigem `report:export`, respeitam município e projetos autorizados e retornam `Cache-Control: private, no-store`.
- Parâmetros: `tipo=tarefas|metas|projetos|secretarias|evidencias`, `secretariaId`, `projetoId`, `de`, `ate`, `status`, `busca`, `ordenar` (chave da coluna) e `direcao=asc|desc`. Busca e ordenação são aplicadas no servidor, sem corte de 500 linhas. Nulos ordenam por último; identificadores garantem desempate estável.
- Base, atual, alvo e medição são ordenados numericamente também para valores brasileiros (`2,05`, `2,5`, `R$ 1.234,50`, `35%`), sem alterar o texto exibido ou exportado.
- O período inclusivo considera prazo vigente **ou** conclusão nas tarefas e a data de envio nas evidências. Para metas estratégicas limita apenas as medições; base, atual e alvo continuam os valores cadastrados. Situação de tarefas não se aplica a metas/evidências. Datas inexistentes, períodos invertidos e ordenação inválida retornam erro de validação, não filtros silenciosamente ignorados.
- Datas e meses da evolução mensal do payload de compatibilidade usam UTC, assim como os limites do período e os dias da tabela; o fuso do servidor não desloca entregas do primeiro dia para o mês anterior.
- Metas estratégicas têm uma linha por indicador real e os projetos vinculados em uma célula, sem multiplicação por projeto. Metas sem indicadores também aparecem. Nenhuma meta histórica é convertida ou duplicada.
- O CSV usa UTF-8 com BOM, separador `;`, quebra CRLF, datas `AAAA-MM-DD` e células nulas vazias. Aspas, separadores e quebras internas são escapados; textos que poderiam executar fórmulas recebem apóstrofo de proteção. Valores numéricos permanecem numéricos.
- A consulta usa rótulos associados aos campos, foco visível, região de tabela acessível por teclado e `aria-sort` nos cabeçalhos. Resultados vazios são anunciados como estado; falhas da consulta exibem alerta, tentativa novamente e limpeza dos filtros, sem oferecer CSV de uma consulta que falhou.
