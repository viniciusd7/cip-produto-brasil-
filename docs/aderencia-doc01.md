# Aderência ao dossiê Izabela (08/11/2026)

Fonte: `CIP_Dossie_Tecnico_Integral_VF_comentarios Izabela_0811.pdf` (v0.2, NÃO HOMOLOGADO).

Esta matriz usa **a numeração RF/RN do dossiê**. A matriz antiga (RF-01…13 = evidências/import) foi aposentada e não deve ser citada à gestora.

## Camadas

1. **Organização** — município, plano, secretarias, Meta Estratégica, base de conhecimento.
2. **Execução** — projeto/iniciativa, meta de execução, tarefas, dependências, evidências.
3. **Inteligência** — medições, painel do prefeito (realizado/esperado/desvio), BSC/OKR, tramitação.

## Requisitos funcionais (dossiê)

| ID | Exigência | Status | Onde |
|---|---|---|---|
| RF-01 | Estrutura por município + isolamento | **Atende** | `Municipio`, `assertMunicipioAccess` |
| RF-02 | Mandato/plano de governo + origem do compromisso | **Parcial** | `PlanoGoverno` (início/fim mandato), `Compromisso`; mandato ainda acoplado ao plano |
| RF-03 | Secretarias antes de metas/projetos; participantes | **Atende** | `Secretaria`, `IniciativaSecretaria`, Pastas |
| RF-04 | Meta Estratégica com base, alvo, indicador, periodicidade, validação | **Atende** | `MetaEstrategica` + campos KPI + BSC/OKR |
| RF-05 | Projeto estratégico vinculado à meta; rascunho até ativação | **Atende** | `Iniciativa.metaEstrategicaId`, ciclo `RASCUNHO` |
| RF-06 | Escopo + ≥1 meta de execução para concluir escopo | **Atende** | Gate no wizard (cliente + API) |
| RF-07 | Tarefa ⊂ projeto; subtarefa ⊂ tarefa | **Atende** | `MetaExecucao` → `MarcoEntrega` → `Subtarefa` |
| RF-08 | Conclusão de atividade ≠ alcance de meta | **Parcial** | Dimensões de status + painel estratégico separado; faixas oficiais ainda abertas no dossiê |
| RF-09 | Histórico de alterações relevantes | **Atende** | `AuditLog`, `Reprogramacao`, timeline na ficha |
| RF-10 | Visão do prefeito: indicadores, realizado×esperado×desvio | **Atende** | `/dashboard/resumo` bloco `estrategia` + `/painel` |
| RF-11 | Participantes + dependências tipadas entre atividades/projetos | **Atende** | `IniciativaSecretaria` + `DependenciaVinculo` (anti-ciclo) |
| RF-12 | Pendências/importados/IA não como validados | **Atende** | Import + `SugestaoIA` separada dos registros validados |

## Regras de negócio (amostra crítica)

| ID | Status | Nota |
|---|---|---|
| RN-01 | Atende | Ativação exige secretaria + meta; legado pode ficar pendente |
| RN-02 / RN-17 | Atende | `EquipamentoPublico` transversal + vínculo na ficha + alerta cruzado no painel |
| RN-07 / RN-08 | Atende | Vínculos tipados com estado; ciclos bloqueados na API |
| RN-10 / RN-11 / RN-12 | Atende | Prazo original imutável; atraso ≠ vigente; sem prazo explícito |
| RN-15 / RN-25 | Atende | `Medicao` com fonte, período, realizado/esperado |
| RN-19 / RN-V06 | Atende | Sugestões de IA persistidas e revisáveis |
| RN-21 / RN-22 | Atende | RBAC + município; import com origem/conflito |
| RN-23 | Parcial | `GRAVIDADE_METODO_VERSAO` versionada; política local ainda configurável |
| RN-03 | Parcial | Uma Meta Estratégica padrão por projeto; multi-contribuição ainda em discussão no dossiê |
| RN-V01…V10 | Parcial | Tramitação mínima (`SolicitacaoValidacao` / `DecisaoValidacao`); motor completo de fluxos evolutivo |

## Orientações Izabela

| Orientação | Status |
|---|---|
| Três núcleos Organização / Execução / Inteligência | Atende (modelo + painéis) |
| Hierarquia Meta Estratégica → Projeto → metas de execução → tarefas | Atende |
| PPA/LDO/LOA na base de conhecimento + alerta sem bloquear | Atende (`DocumentoConhecimento`) |
| Ajuda (?) + apoio de IA | Parcial (ajuda no wizard; IA heurística revisável) |
| Dashboard BSC + OKR + desvio | Atende (campos + bloco no painel) |
| Dependências entre projetos distintos | Atende |
| Faixas de desempenho oficiais | Aberto no dossiê (limites municipais pendentes) |

## Critérios de aceite do piloto

| Item | Status |
|---|---|
| Seed Alça Viária / Escola João Lima | Presente em `packages/db/prisma/seed.ts` |
| Isolamento multi-município | Atende |
| Documento NÃO HOMOLOGADO | Homologação municipal permanece fora do software |
