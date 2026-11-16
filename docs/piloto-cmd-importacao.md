# Piloto CMD — importação controlada

Base de referência citada no dossiê:

- Relatório Quinzenal REV04 (06/10/2026)
- Exportação BASE (27/10/2026) — não tratar como idêntica ao relatório

## Política

1. Sempre criar `ImportacaoSnapshot` com data/fonte.
2. Importar 3–5 iniciativas representativas no primeiro ciclo (não a carteira inteira).
3. Conflito de ID existente → registrar `ImportacaoConflito` e **não sobrescrever**.
4. Não converter “Dias de atraso” / “Andou” em progresso físico.
5. Usar dados anonimizados até autorização formal.

## Endpoint

`POST /import/amostral`

Body exemplo em `/importacao` na UI (admin).
`prazoOriginal`, `novoPrazo` e `conclusao`, quando informados, devem conter datas válidas.
O lote e seu snapshot são gravados atomicamente: falhas durante o processamento não deixam iniciativas parciais.

## Mapeamento sugerido

| Coluna origem | Destino |
|---|---|
| ID | `Iniciativa.codigo` / chave externa |
| Secretaria | `Secretaria` |
| Projeto | `Iniciativa.nome` |
| Tarefa | `MarcoEntrega.descricao` |
| Prazo original | `MarcoEntrega.prazoOriginal` |
| Novo prazo | `MarcoEntrega.prazoVigente` + `Reprogramacao` |
| Entrave / Próximo passo | `Impedimento` |
