# Aderência ao doc 01 — RF e AT

## Camadas de completude

1. **MVP operacional** (RF-01…RF-13 da matriz inicial): cadastro, marcos, evidências, import, auditoria — **implementado**.
2. **Completude de produto (dossiê + modelo executivo):** hierarquia, metas de execução, subtarefas, painel/relatório quinzenal — **em evolução nesta entrega**.

## Requisitos funcionais

| ID | Prior. | Status | Onde |
|---|---|---|---|
| RF-01 | P0 | Implementado | Município/Secretaria + vínculo |
| RF-02 | P0 | Implementado | NextAuth + RBAC |
| RF-03 | P0 | Implementado | `/iniciativas` + Carteira |
| RF-04 | P0 | Implementado | Secretarias/compromissos/equipamentos |
| RF-05 | P0 | Implementado | Marcos com prazo original/vigente |
| RF-06 | P0 | Implementado | Reprogramação imutável |
| RF-07 | P0 | Implementado | Verificações |
| RF-08 | P0 | Implementado | Impedimentos |
| RF-09 | P0 | Implementado | Decisões |
| RF-10 | P0 | Implementado | Evidências + validação |
| RF-11 | P0 | Implementado | Painel executivo (visão governo + secretarias) |
| RF-12 | P0 | Implementado | AuditLog |
| RF-13 | P0 | Implementado | Import amostral |
| Desdobramento | P0 | Implementado | `MetaExecucao` + subtarefas + ficha hierárquica |
| Relatório secretaria | P0 | Implementado | `/relatorios` + CSV com gravidade/índice |
| RF-14 papéis | P1 | Implementado | Homes distintas: prefeito/gestor/analista/admin + logo CIP |
| Titulares pasta | P0 | Implementado | `titularNome/Telefone` + seleção principal/correlacionadas no projeto |
| Gráficos executivos | P0 | Implementado | Board Azimov em `/painel` (AreaChart + radar + barras de entraves/gravidade/metas); cockpit `/minha-pasta` |
| RF-15…17 | P1 | Parcial | Export/alertas |
| RF-18…20 | P2 | Roadmap | Integrações/IA |

## Critérios de aceite

| ID | Status |
|---|---|
| AT-01…AT-10 | Cobertos por seed + API (ver docs anteriores) |
| Mobile-first | Shell drawer + cards/table-scroll |
| Identidade CIP | Tokens azul/branco/rosa alinhados ao site e ao modelo |
