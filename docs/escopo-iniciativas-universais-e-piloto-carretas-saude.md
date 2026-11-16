# Escopo de iniciativas municipais e piloto Carretas da Saúde SUS

**Versão:** plano aprovado; piloto Carretas adiado e retirado do fluxo ativo da plataforma  
**Data:** 12/11/2026  
**Status:** a implementação exploratória do dossiê Carretas foi arquivada em `projeto-carretas/` para retomada futura e está desativada no fluxo de criação, na tela do projeto e na API. Catálogo, componente, validações, modelo Prisma, migration e seed local foram retirados do fluxo ativo. A migration/dados deste piloto são somente locais; nada foi aplicado ao Supabase remoto. Integrações oficiais, notificações externas, armazenamento de documentos do projeto e dados clínicos não fazem parte deste piloto.

**Limite de implantação:** o schema e a configuração de migration desta entrega são PostgreSQL. A migration não substitui nem reescreve o histórico; não aplicar no Supabase remoto nem no ambiente MySQL/Docker legado sem validar provedor, baseline e autorização de implantação.

**Local do material adiado:** [projeto-carretas/README.md](../projeto-carretas/README.md) registra o escopo preservado e as instruções para reativar a implementação.

## 1. Objetivo, método e limites

Este documento cruza:

1. o dossiê CIP / Inteligência de Gestão Municipal, V3, de 10/11/2026, fornecido em `documento atualizado.docx`;
2. o *Projeto-Referência para Atendimento Especializado em Unidades Móveis*, V2.0, de 10/11/2026;
3. o código, schema, APIs, telas, documentação e migrações presentes no repositório.

### Como ler as afirmações

- **Fato documentado:** aparece nos dois documentos de entrada; indicação de seção ou trecho é dada.
- **Fato implementado:** foi localizado no código ou documentação do repositório; os caminhos são relativos ao repositório.
- **Recomendação:** proposta de produto/arquitetura, ainda sujeita a validação.
- **A definir:** informação ausente, ambígua ou dependente de autoridade municipal, decisão de produto ou validação clínica/jurídica.

Os dois DOCX foram integralmente convertidos e lidos. O texto-base não oferece paginação estável na extração; por isso, as referências ao documento-base usam suas partes/seções e, quando citadas nele, as páginas do relatório REV04. O projeto de referência é citado por seção. Não foi feita validação externa das leis, notas técnicas, requisitos sanitários ou afirmações atribuídas às fontes citadas nos documentos.

O caso das Carretas é um **modelo metodológico e um piloto de adequação da plataforma**, não prova de oferta aprovada, obtenção de unidade móvel, autorização de atendimento, contratação, pactuação, execução ou homologação municipal. A referência expressamente condiciona a implantação à validação local e não substitui regulação oficial, prontuário ou decisão clínica.

## 2. Síntese do escopo atual

### 2.1 Documento-base

**Fato documentado —** o dossiê apresenta três núcleos — Organização, Execução e Inteligência — e uma hierarquia conceitual: Plano de Governo → Secretarias/unidades → Meta Estratégica → Projeto → Metas de execução/indicadores → Tarefas → Subtarefas. Relações entre unidades e projetos devem atravessar essa hierarquia sem duplicar registros. Equipamentos/locais são referências compartilhadas, não níveis da árvore.

**Fato documentado —** a proposta separa estado administrativo, prazo, validação, entrega/evidência, avanço administrativo, avanço físico-financeiro e resultado estratégico; mantém prazo original e histórico de reprogramações; exibe data de corte, origem, qualidade e confiabilidade; atribui à IA papel de sugestão, não de aprovação. A análise dos pilotos Alça Viária e Escola João Lima é conceitual, não demonstra execução nem homologação.

**Fato implementado —** o código atual organiza prefeitura/secretaria, plano, meta, iniciativa, meta de execução, tarefa (`MarcoEntrega`) e subtarefa; há entidades para indicadores e medições, participantes de secretaria, compromisso, equipamento, dependência, impedimento, decisão, evidência, validação, importação, auditoria, modelos do wizard, sugestões de IA e notificações. Evidência principal: `packages/db/prisma/schema.prisma`.

**Fato implementado —** a nomenclatura de domínio em uso é principalmente **Iniciativa** (na interface, “Projeto”), **Meta Estratégica**, **Meta de execução**, **Tarefa/Marco** e **Subtarefa**. Tipos operacionais de iniciativa atualmente incluem `ESTRUTURANTE`, `PLANO_GOVERNO` e `ACAO_DIARIA` (`packages/shared/src/status.ts`). O wizard escolhe uma classificação principal por vez (`apps/web/src/app/(app)/minha-pasta/novo/novo-projeto-wizard.tsx`; `apps/api/src/routes/wizard.ts`).

### 2.2 Código e arquitetura observados

- **Stack implementada:** monorepo pnpm; web Next.js/React; API Express/TypeScript; Prisma ORM; PostgreSQL no `schema.prisma` atual; pacotes compartilhados/UI. Referências: `package.json`, `apps/web/package.json`, `apps/api/package.json`, `packages/db/package.json`.
- **Atenção à documentação de arquitetura:** `docs/arquitetura.md` e `docs/fluxo-operacional.md` ainda descrevem MySQL/HostGator e fluxo de migração do ambiente anterior, enquanto o `schema.prisma` atual declara PostgreSQL com `DATABASE_URL` e `DIRECT_URL`; o lock da pasta de migrações está em PostgreSQL, há baseline Postgres, e o histórico MySQL foi separado em `packages/db/prisma/migrations-mysql-legacy/`. A configuração local `.env` também está no estado MySQL. Portanto, **o estado de banco efetivamente implantado em cada ambiente é a definir**; não inferir aplicação de migração apenas a partir do código.
- `Iniciativa` tem secretaria principal, responsável, compromisso/meta opcional, `estruturante`, `classificacaoPrincipal`, `vinculoPlanoGoverno`, modelo/snapshot e ciclo. `IniciativaCompromisso` é uma junção N:N; `metaEstrategicaId` é uma referência opcional unitária por iniciativa; `IniciativaSecretaria` registra secretarias correlatas.
- Há `DependenciaVinculo` para relações entre iniciativa/marco, com tipo, sentido, justificativa, estado pendente/validado/rejeitado e autores. As referências a origem/destino são discriminadores e IDs; o banco não modela uma relação tipada genérica entre duas iniciativas com chaves estrangeiras independentes.
- O wizard atual gera preview e confirma o cadastro; a confirmação valida município/secretaria/meta/responsável, grava o projeto, respostas e escopo em transação. Não foi localizada persistência de rascunho para retomada antes da confirmação.
- O catálogo do wizard suporta perguntas condicionais, grupos e configuração por modelo/snapshot (`packages/shared/src/wizard-engine.ts`; `packages/db/prisma/schema.prisma`). A interface separa tipo/classificação e exige descrição, secretaria, responsável e uma meta de execução; a etapa de classificação ainda é exclusiva.
- Existem indicadores, medições com fonte/data de corte/confiabilidade e exportação de relatórios de secretaria/prestação de contas. Não foi localizada uma função geral de consolidação entre múltiplas classificações e vínculos de iniciativa que evite duplicar contagem.
- Há documentos de conhecimento (incluindo PPA/LDO/LOA), documentos vinculados à iniciativa, evidências e auditoria. Armazenamento de arquivos e regras de retenção/acesso apropriadas a dados clínicos não são comprovados por esta análise.
- A camada de notificações internas está implementada. `apps/api/src/services/notifications.ts` mantém os adaptadores SMTP e WhatsApp Oficial como não implementados; as telas indicam esses canais como “em breve”. O provedor de sugestões atual é heurístico (`apps/api/src/services/sugestoes.ts`), não um LLM; a plataforma também possui registros de `SugestaoIA`.
- Há usuários/papéis e escopo por município/secretaria, além de papéis de prefeito, secretário/gestor, consultor/analista, leitura e administrador. A granularidade final para fila, prontuário, dados pessoais de saúde e integrações é a definir e não deve ser presumida com base nos papéis atuais.

## 3. Modelo geral de iniciativas e relações

### 3.1 Conceitos que não devem ser confundidos

1. **Iniciativa** é o registro único acompanhado pela plataforma. No modelo atual, a entidade persistida chama-se `Iniciativa`, embora algumas telas a apresentem como Projeto.
2. **Classificação da iniciativa** descreve dimensões aplicáveis à mesma iniciativa (por exemplo, ação diária, contribuição a compromisso do Plano de Governo, caráter estruturante). Não cria cópia.
3. **Vínculo com compromisso/meta** liga a iniciativa a um objeto de planejamento existente. Não é uma classificação e não deve ser inferido sem fonte/validação.
4. **Relação entre iniciativas distintas** descreve dependência, desdobramento, contribuição, acompanhamento ou outra relação explícita entre dois registros diferentes. Tem tipo, direção quando pertinente, justificativa, estado de validação e autoria.

**Fato documentado —** o documento-base mantém as dimensões da navegação e exige relações transversais auditáveis; descreve ação do dia a dia, plano de governo e projeto estruturante.  
**Fato implementado —** o schema contém campos legados que representam apenas parcialmente esse domínio; a interface ainda pede uma classificação exclusiva.  
**Recomendação —** tratar classificação, compromisso/meta e relação entre iniciativas como três conceitos distintos. Usar `IniciativaCompromisso` quando houver compromisso cadastrado; tratar a Meta Estratégica como meta de planejamento, não como classificação. Permitir mais de um marcador/classificação simultaneamente e não duplicar a iniciativa. As cardinalidades, estados e regras de atualização continuam **a definir**.

### 3.2 Diretriz proposta para vínculos e agregação

- Um vínculo deve identificar iniciativa de origem e destino, tipo, direção (se aplicável), justificativa, fonte, autor, data, estado e, quando necessário, validador/decisão.
- Sugestões de vínculo não contam como vínculos oficiais até revisão e aprovação cabíveis.
- Um cadastro pode mostrar várias dimensões e relacionamentos; agregações por compromisso, município ou secretaria contam cada iniciativa uma única vez por conjunto consultado, com regra transparente para contribuições compartilhadas.
- Não mesclar iniciativas por nome, local/equipamento, palavra-chave ou semelhança. Conflitos e relações duvidosas vão para validação.
- Não presumir que toda ação diária seja projeto-filho, nem que um projeto estruturante deva ter uma ação diária vinculada. Essas relações são opcionais e tipadas.
- A recomendação de tipos iniciais é: `CONTRIBUI_A`, `DESDOBRA`, `DEPENDE_DE`, `COMPARTILHA_ENTREGA` e `ACOMPANHA`. **A definir:** catálogo, direção, permissão para validar, restrição de ciclos e se relação reversível terá um único tipo canônico.

## 4. Lacunas — plataforma versus projeto de referência

Legenda de abrangência: **Geral** = capacidade reutilizável da plataforma; **Configuração** = comportamento selecionável/condicional; **Template** = conteúdo próprio do piloto de unidades móveis. Prioridades são recomendações, não decisões aprovadas.

| Elemento do modelo geral ou da referência | Situação (sim / parcial / não) | Evidência | O que falta | Dependência técnica | Dependência de gestão pública | Prioridade |
|---|---|---|---|---|---|---|
| Iniciativa única com cadastro simples ou complexo | parcial | `Iniciativa`; wizard atual em `apps/web/src/app/(app)/minha-pasta/novo/novo-projeto-wizard.tsx` | Permitir cadastro mínimo e aprofundamento opcional sem exigir o mesmo conjunto de etapas para toda iniciativa. **Geral/configuração.** | Estados de rascunho, configuração condicional e UI | Definir campos mínimos e quem ativa/publica | alta |
| Classificações simultâneas na mesma iniciativa | parcial | `classificacaoPrincipal`, `estruturante`, `vinculoPlanoGoverno` em `Iniciativa`; enum em `packages/shared/src/status.ts`; UI escolhe uma classificação | Representar várias dimensões sem cadastros duplicados; migração/compatibilidade do estado legado. **Geral.** | Modelo de classificações, API, interface e migração | Definir vocabulário e quem classifica/valida | alta |
| Relacionamento com compromissos do plano | parcial | `Compromisso`, `IniciativaCompromisso`; wizard vincula Meta Estratégica no fluxo PLANO_GOVERNO | UX opcional comum aos tipos; exibir vínculo, fonte e estado; não exigir meta falsa. **Geral.** | Reutilizar junção e corrigir fluxo/API | Identificar compromissos oficiais e política de validação | alta |
| Meta Estratégica e vínculo com Plano de Governo | parcial | `MetaEstrategica`, `PlanoGoverno`, `Iniciativa.metaEstrategicaId` | Separar compromisso e meta como objetos, permitir associação opcional quando aplicável e esclarecer agregação múltipla. **Geral.** | UI/API, integridade e agregação | Definir relação entre compromisso, meta e PPA | alta |
| Ações diárias que executam/apoiam outra iniciativa | não | `ACAO_DIARIA` existe como classificação principal; não há gestão geral da relação entre dois registros na UI | Relacionar registros distintos sem forçar hierarquia ou duplicação. **Geral.** | Relation edge, API e consulta | Definir papéis e tipo de vínculo | alta |
| Relações entre projetos (dependência/desdobramento/contribuição) | parcial | `DependenciaVinculo` com IDs polimórficos e `apps/web/.../vinculos-editor.tsx` | Relação entre iniciativas com tipo e validação uniforme, sem confundir dependência de tarefa com contribuição. **Geral.** | Evolução de modelo/API/UI e validação | Definir taxonomia/autoridade de validação | alta |
| Consolidação sem dupla contagem | parcial | relatórios por secretaria e carteira; `IniciativaSecretaria` e vínculos existem | Definir identidade única, consulta por dimensão, vínculo compartilhado e regras/indicadores de agregação. **Geral.** | Serviço de agregação e testes de invariantes | Aprovar denominadores e interpretação oficial | alta |
| Rascunho persistente e retomada do wizard | não | `POST /iniciativas/wizard/preview` e `/confirmar`; gravação final ocorre na confirmação | Persistir respostas incompletas, etapa, versão de template e retomada segura. **Geral.** | Schema/API/UI e política de expiração | Definir quem pode ver/editar rascunhos | alta |
| Cronograma, tarefas, prazos e reprogramações | sim | `MetaExecucao`, `MarcoEntrega`, `Subtarefa`, `Reprogramacao` | Para o piloto: configurar G0–G4 e associar tarefas a gates; durações permanecem sem valor padrão. **Configuração/template.** | Configuração do template e relacionamento | Ratificar responsáveis e agenda/modalidade | média |
| Indicadores e medições com fonte/data de corte | sim | `Indicador`, `Medicao`, `/planejamento/indicadores`; `apps/api/src/routes/reports.ts` | Configurar dicionário e fórmulas específicas do piloto; registrar denominador, limitações e resultado assistencial somente se fonte válida. **Template.** | Configurar template e relatório | Validar linha de base, definições e metas | alta |
| Orçamento, linhas de custo, pagador e fontes de recurso | parcial | Perguntas de viabilidade em `packages/shared/src/catalog/condicoes-estruturante.ts` guardam respostas; sem orçamento/custeio estruturado por linha no modelo de Iniciativa | Estimativa, custos incrementais, financiador/pagador, instrumento, situação do recurso e evidências; sem valores inventados. **Geral/configuração.** | Modelo de dados, API, auditoria e tela | Finanças/jurídico informam fontes e limites locais | alta |
| Riscos preventivos com gatilho, controle e condição de parada | parcial | `Impedimento` guarda entrave corrente; perguntas condicionais/etapas no wizard; não é registro preventivo completo | Cadastro de risco distinto de impedimento, com prevenção, evidência, gatilho, resposta, dono e parada. **Geral/configuração.** | Registro e ciclo de vida próprios | Nomear donos e aprovar suspensão/resposta | alta |
| Controles e gates de abertura/operação/encerramento | parcial | estados de viabilidade, verificações, solicitações/decisões de validação existem | Configurar gates e critérios, evidência, resultado (aprovar/corrigir/bloquear) e signatário competente. **Configuração/template.** | Workflow e vínculo entre decisão/gate | Designar autoridade por gate e competência local | alta |
| Responsáveis e participantes multidisciplinares | parcial | secretaria principal, secretarias correlatas, pessoas e responsáveis | Mapear funções do projeto de referência a usuários/unidades locais sem presumir nome ou competência. **Configuração/template.** | UI de papéis por projeto e API | Designação formal e RACI local | alta |
| Documentos e evidências rastreáveis | sim | `DocumentoConhecimento`, `IniciativaDocumento`, `Evidencia`, `ValidacaoEvidencia` | Regras de tipos/documentos do piloto, versão, acesso, retenção e evidência obrigatória por gate. **Configuração/template.** | Metadados, regras de acesso e storage | Definir documentos exigíveis e guarda | média |
| Auditoria de decisões e alterações | sim | `AuditLog`; eventos de reprogramação e validação; serviço `apps/api/src/services/audit.ts` | Registrar alterações em classificações, vínculos, custos/riscos e gates; snapshots de relatórios/data de corte. **Geral.** | Chamadas auditáveis nos novos fluxos e testes | Política de retenção e auditoria | alta |
| Fila oficial e agenda regulada | não | Não localizada entidade/API de fila/agendamento no escopo CIP | Não replicar prontuário/agenda oficial sem decisão; definir integração ou somente referência ao sistema-fonte. **A definir; integração.** | Contratos de API, segurança, identidade e sincronização | Autoridade reguladora informa fonte, dados e alçada | alta para decidir; desenvolvimento condicionado |
| Contato, confirmação, cancelamento e reposição de vagas | não | Não localizado fluxo de contato de usuários/agenda de saúde no código | Se escopo aprovado, modelar eventos administrativos mínimos, sem expor informação clínica; não substituir o sistema oficial. **Template/integr.** | Identificadores, trilha e integrações | Definir canais, executor autorizado e regras regulatórias | alta para decisão |
| Atendimento, prontuário, elegibilidade e resultado clínico | não | Não localizado, nem deve ser inferido do módulo Projeto | Fora do escopo recomendado do CIP; manter no sistema assistencial oficial. **Limite de produto.** | Se mudar: arquitetura clínica e segurança específica | Responsabilidade clínica/regulatória e validações formais | alta para definir limite |
| Contrarreferência e aceite pela rede | não | A plataforma tem decisões e evidências genéricas, não transferência/aceite assistencial | Registrar somente pendência/encaminhamento e comprovante de aceite se acordado; dados mínimos. **Template/integr.** | Evento, usuário autorizado, API e auditoria | Definir destinatário, aceitação e prazos locais | alta |
| Cadeia de custódia de materiais (ex.: óculos) | não | Não localizado registro de lote/transferências/recebimento | Só incluir se o piloto municipal confirmar a entrega de materiais e responsabilidade do CIP. **Template.** | Registro de item/lote, destinatário, recibo | Política patrimonial e evidência de entrega | baixa até confirmação |
| WhatsApp Oficial e SMTP | não | Portas/adaptadores stub em `apps/api/src/services/notifications.ts` | Implementar configuração, consentimento/canal, templates, entrega, falha e trilha, sem dados sensíveis no texto. **Geral/configuração.** | Adaptadores, credenciais, logs e filas/retry | Aprovação de conteúdo, destinatários e canal | média |
| IA generativa e proveniência | parcial | `SuggestionProvider` heurístico e `SugestaoIA`; não há LLM conectado no código verificado | Sugestões para justificativa/risco/indicador com fonte, versão, confiança, aceite/rejeição e revisão humana. **Geral/configuração.** | Provedor, armazenamento, proteção e avaliação | Revisão humana e política de uso/risco | média |
| Integração com bases públicas/sistemas do SUS | não | Há referências textuais a sistemas/fonte de indicadores, sem conectores confirmados | Definir fontes e escopo; nenhuma integração deve ser presumida. **Integração.** | API/ETL, autenticação, atualização e reconciliação | Autorização, dados, titularidade e fonte oficial | baixa até definição |
| Segurança, dados pessoais e segregação | parcial | Papéis, município, autorização e auditoria existem | Revisar mínimos privilégios, dados de saúde, retenção, acesso e incidentes antes de operar qualquer dado identificável. **Geral.** | Revisão de ameaça, autorização, storage e logs | Controlador/operador, encarregado e política local | alta |
| Prestação de contas, custo, equidade e limitações | parcial | Relatórios executivos e de prestação de contas, exportação CSV/JSON | Relatório específico com oferta, acesso/equidade, assistência/pendências, segurança, custo incremental e limitações. **Template.** | Views/consulta/exportação com data de corte | Aprovar definições, responsáveis e circulação | alta |

## 5. Caso piloto: Carretas da Saúde SUS na especificação

### 5.1 Enquadramento e limite

**Fato documentado —** a referência V2.0 descreve um ciclo municipal para organizar oferta temporária de atenção especializada móvel; não fixa modalidade, especialidades, número de unidades, capacidade, custo, contrato, calendário local ou acesso automático a carreta. Os dados operacionais do relato de Contagem incluem uma taxa declarada de 18% de ausências entre pessoas confirmadas, mas a referência classifica essa informação como não auditada e sem denominadores suficientes.

**Recomendação —** usar o caso como uma **única Iniciativa** de gestão do projeto, contendo campos comuns CIP e módulos condicionais do template Saúde/Unidade Móvel. Não cadastrar atendimentos/pessoas no piloto de plataforma até definir fonte oficial, autorização e regras de dados. Se necessário demonstrar o ciclo de usuário, usar apenas identificadores pseudonimizados e referências ao sistema regulador, sem diagnóstico, prontuário, preparo clínico ou conteúdo sensível.

**A definir —** se a iniciativa real será considerada estruturante; qual prefeitura/região, compromisso de plano, prestador, modalidade, especialidades, oferta, recursos, fila e autoridade. Não associar a compromisso real sem registro de fonte.

### 5.2 Distribuição proposta entre módulos/entidades

| Informação da referência | Registro CIP sugerido | Tratamento no piloto | Estado/fonte |
|---|---|---|---|
| Objetivo, problema público e limites | `Iniciativa.nome/descricao` e respostas do template | Registrar escopo municipal e exclusões; não criar metas/valores não fornecidos | Texto de projeto; aprovação local pendente |
| Caráter estruturante/plano de governo | classificação da própria `Iniciativa`; `IniciativaCompromisso`; Meta Estratégica | Selecionar dimensões separadamente e opcionalmente; vínculo só após identificar compromisso/meta | A definir |
| Parceria, prestador, responsável técnico, regulação, APS, vigilância, retaguarda | responsáveis/unidades participantes e campos do template | Papéis funcionais; nomes e competências locais não inventados | Requer designação |
| Etapas, entregas e gates G0–G4 | `MetaExecucao`, `MarcoEntrega`, `Subtarefa`, validações | Representar preparo, execução e encerramento por marcos; gates controlam passagem | V2.0 §§4, 6, 17 |
| Cronograma | tarefas/marcos e prazos originais/vigentes | Sequência relativa a D0; duração por fase sem padrão até planejamento local | V2.0 §6 |
| Orçamento e recursos | proposta de linhas de custo vinculadas à iniciativa e documentos | Capturar custo incremental, pagador, fonte e status; manter pendência quando desconhecido | V2.0 §10; sem valores locais |
| Indicadores | `Indicador` e `Medicao` | Configurar catálogo de métricas com fórmulas/denominadores; metas após linha de base | V2.0 §§11 e 18; sem meta numérica presumida |
| Riscos/controles | novo registro de risco (se aprovado), relacionado a marcos | Prevenção, evidência, gatilho, resposta, responsável e parada; criticidade qualitativa | V2.0 §§12 e 15; probabilidade não simulada |
| Documentos/autorizações | `DocumentoConhecimento`, `IniciativaDocumento`, `Evidencia`/validação | Registrar referências, versão, origem e evidência; ato formal fica com autoridade competente | V2.0 §§4, 9, 19–21 |
| Fila, agenda, contato, atendimento e resultados | somente referência a sistema oficial; eventual módulo futuro isolado | Não replicar agenda/prontuário no escopo inicial. Se autorizado depois, projeto guarda apenas dados mínimos e eventos administrativos | V2.0 §§7–9; sistema oficial a definir |
| Continuidade e contrarreferência | marcos, impedimento/pendência, evidência e aceite | Encerrar a operação somente após cuidado concluído ou transferência documentada, conforme validação clínica | V2.0 §§7–8 |
| Óculos ou outros materiais | eventual registro de item/lote/transferência | Só configurar se esse objeto estiver de fato no escopo municipal; o relato citado não prova entrega final a usuários | V2.0 §§3, 8, 15 |
| Prestação de contas | relatório dedicado com filtros/data de corte | Oferta executada, contato agregado, presença, continuidade, incidentes, custos, equidade, limitações e plano de melhoria | V2.0 §§11, 18–19 |

### 5.3 Estrutura de trabalho proposta para o piloto

**Template inicial — Saúde / Unidade Móvel (proposta):**

1. Diagnóstico e decisão da alternativa.
2. Pactuação, modalidade, autorização e governança.
3. Demanda regulada, capacidade e critérios — **somente metadados e referência à fonte oficial no escopo inicial**.
4. Preparação: local, acessibilidade, infraestrutura, equipe e prontidão.
5. Comunicação, agenda, cancelamentos e contingência — apenas como plano/marcos até decisão sobre integração.
6. Operação segura e reconciliação de produção.
7. Continuidade do cuidado/aceite pela rede.
8. Avaliação, custos, equidade, prestação de contas e encerramento.

Os gates G0–G4 da referência são critérios de passagem dentro desse ciclo, não etapas clínicas da plataforma:

- **G0:** demanda, alternativa, oferta/modalidade e governança validadas.
- **G1:** planejamento, infraestrutura, acessibilidade, equipe, recursos e contingência.
- **G2:** prontidão assistencial, retaguarda, resultados/retornos e registro definidos.
- **G3:** agenda/fonte oficial, contato acessível, regras de cancelamento/reposição e treinamento.
- **G4:** produção reconciliada, seguimento atribuído, materiais/custos conciliados e relatório aprovado.

Resultados de gate: **aprovado / aprovado com correções registradas / não aprovado**, conforme referência. Signatários, critérios locais e se um gate bloquear a operação são **a definir**; segurança clínica/sanitária não pode ser reduzida por decisão de conveniência da plataforma.

### 5.4 Implementação no sistema para validação do cliente

**Fato implementado —** a Iniciativa demonstrativa abre uma aba **Dossiê Carretas** na própria ficha. O dossiê é um documento administrativo versionado, validado na API, protegido pela autorização da iniciativa e salvo em tabela PostgreSQL vinculada à Iniciativa. Cada salvamento usa revisão otimista e registra auditoria com versão e seções alteradas.

O formulário reúne:

- 30 campos locais em grupos de identificação, oferta, prontidão, regulação/continuidade, governança, conformidade, dados/comunicação, custos e encerramento;
- 5 portões G0–G4, com 22 critérios, situação, justificativa de inaplicabilidade, responsável, evidência, autoridade, decisão, data e correção;
- 7 fases de cronograma relativo a D0, sem datas ou durações padrão;
- 7 categorias de custo, com memória de cálculo, valor, pagador, fonte, documento e estado de validação;
- 12 riscos preventivos qualitativos, com prevenção/gatilho/resposta de referência e campos para adaptação, evidência e estado local;
- 16 indicadores com fórmula e cautela de referência, espaço para unidade, fonte/corte, linha de base, meta, aprovação e valor observado;
- 8 POPs com o ciclo entrada → checagem → decisão → registro → saída → exceção;
- 8 grupos de prestação de contas e um registro de decisão final do piloto.

**Validações implementadas —** valores financeiros e medições são numéricos não negativos; valores monetários limitam-se a duas casas decimais. Datas devem ser datas de calendário válidas. Medições exigem data de corte e fonte; metas quantitativas exigem referência de aprovação; itens marcados como validados/atendidos exigem responsável e evidência; “não aplicável” requer justificativa; uma decisão de gate ou do piloto exige autoridade, data e justificativa/condições aplicáveis. Risco ocorrido, mitigado ou encerrado exige evidência, responsável e ação.

**Limites preservados —** todos os dados municipais começam vazios; “A definir” é uma indicação visual, não um valor gravado. O risco na matriz é uma hipótese de referência, não um incidente. Os 18% relatados em Contagem não preenchem linha de base nem meta. Não há nomes de pacientes, diagnósticos, prontuários, lista de atendimentos, agenda paralela ou promessa de oferta. A trilha de auditoria registra as revisões e seções alteradas, não duplica o conteúdo integral do dossiê.

**Seed local arquivado —** o seed protegido verifica `localhost:5434` e pode criar a Iniciativa “Carretas da Saúde SUS — planejamento e avaliação” para Conceição do Mato Dentro/MG, vinculada à Secretaria de Saúde. O registro de demonstração que havia sido criado no banco local, junto com seus dados dependentes, foi removido; por isso, o cartão não aparece mais na carteira do consultor. O seed permanece arquivado para eventual retomada, não atribui responsável, data de operação, capacidade, custo, fonte de recurso ou decisão e não é executado pelo fluxo normal.

### 5.5 Escopo ainda pendente

- Ativar o assistente do wizard com retomada de rascunho e transformar os campos atuais em template reutilizável e versionado.
- Anexar/selecionar documentos existentes para gates, controles, custos e prestação de contas; por enquanto, o formulário guarda referências textuais.
- Criar relatório consolidado do piloto com filtros, data de corte e exportação adequada.
- Avaliar SMTP/WhatsApp Oficial e sistemas públicos somente depois de aprovar canal, documentação, acesso e responsabilidade.
- Definir se algum módulo futuro armazenará dados de atendimento; esta entrega deliberadamente não o faz.

Cada criação ou adaptação remanescente tem item próprio no backlog da seção 8; a seção 8.4 identifica o que foi entregue neste recorte local.

## 6. Fluxo proposto do wizard

### 6.1 Princípios de funcionamento

- O wizard cria uma Iniciativa, não três registros em função de classificações.
- Ação diária / contribuição ao plano / caráter estruturante são marcadores selecionáveis independentemente; nenhuma dimensão é obrigatória para todas as iniciativas.
- Ligações a compromissos/metas e a outras iniciativas são etapas opcionais, editáveis posteriormente por perfil permitido.
- Um cadastro simples pode ser salvo com nome, secretaria/unidade responsável, pessoa responsável e descrição curta do que será feito/entregue. Campos adicionais aparecem conforme perfil de complexidade, área/template, relações selecionadas ou decisão de adicionar detalhes.
- Rascunho pode ser salvo e retomado; não aparece como oficial até revisão/ativação conforme regra municipal.
- IA pode sugerir texto, riscos ou indicadores; sempre deve exibir fonte e confiança quando disponíveis, preservar o rascunho e exigir revisão humana.
- Templates pré-preenchem perguntas/escopo/metadados e não criam fatos. Campos locais não conhecidos iniciam sem valor ou “a avaliar”; nenhuma duração, orçamento, meta ou autorização é inferida.

### 6.2 Etapas e regras condicionais

| Ordem | Etapa | Exibição | Objetivo / passagem | Backlog |
|---:|---|---|---|---|
| 0 | Classificações e porte | Sempre | Selecionar uma ou mais dimensões, sem exclusividade; escolher cadastro enxuto, acompanhado ou completo | W01 |
| 1 | Identificação e responsabilidade | Sempre | Identificar a única iniciativa e sua unidade/pessoa responsável | W02 |
| 2 | Plano de governo e relações | Sempre, pode pular | Escolher compromisso/meta ou iniciativa relacionada, somente se existente/identificada; classificar a relação | W03 |
| 3 | Contexto e viabilidade | Condicional ao porte/template | Diagnóstico, objetivo, escopo, beneficiários e condições de viabilidade | W04 |
| 4 | Entregas, cronograma e responsáveis | Se controle adicional ou template exigir | Estruturar metas de execução/tarefas e atribuir responsáveis; datas são definidas localmente | W05 |
| 5 | Recursos e orçamento | Se iniciativa completa, gasto/financiamento ou template exigir | Estimar custos incrementais e identificar fonte/pagador/instrumento quando conhecidos | W06 |
| 6 | Riscos e controles | Se iniciativa completa ou template exigir | Registrar risco, prevenção, gatilho, resposta, evidência, responsável e condição de parada | W07 |
| 7 | Indicadores e avaliação | Se houver resultado mensurável, template ou solicitação do consultor | Definir medida, base/alvo quando aprovados, unidade, fórmula, fonte e periodicidade | W08 |
| 8 | Documentos e evidências | Condicional a requisito, gate ou template | Ligar documentos com papel/fonte/versão e definir evidências esperadas | W09 |
| 9 | Revisão e ativação | Sempre antes de publicar/ativar | Mostrar pendências, vínculos, autoria, classificação e validações requeridas | W10 |

### 6.3 Campos por etapa

Tipos: `texto curto`, `texto longo`, `seleção`, `multi-seleção`, `data`, `número`, `moeda`, `referência`, `arquivo/referência documental`, `checkbox`, `repetição estruturada`.

| Etapa | Campo | Tipo | Obrigatório em quais condições | Validação | Padrão | Ajuda | Origem |
|---|---|---|---|---|---|---|---|
| 0 | Classificações aplicáveis | multi-seleção | Nenhuma classificação é mandatória; escolha pelo menos uma dimensão se aplicável, mas pode ficar sem marcador | Valores controlados; não gerar duplicata; manter compatibilidade do legado | Sem seleção | “Marque todas as dimensões que descrevem esta iniciativa; isso não cria novos projetos.” | Novo; `classificacaoPrincipal`/`estruturante` legados |
| 0 | Nível de detalhamento | seleção | Sempre | `ENXUTO`, `ACOMPANHADO`, `COMPLETO`; pode ser aumentado depois | `ENXUTO` | “Escolha quanto controle o cadastro precisa. A complexidade não altera a competência de aprovação.” | Novo |
| 1 | Nome | texto curto | Sempre | 3–200 caracteres; sem deduzir unicidade sem escopo definido | vazio | “Use um nome reconhecível pela equipe municipal.” | Existente |
| 1 | Código de referência | texto curto | Opcional no rascunho; exigido se política local exigir | Único por município conforme regra atual; aceitar chave legada separada | Gerado/ausente conforme código atual | “Preserve código de origem em importações; não use código externo como ID interno.” | Existente; regra de criação a adaptar |
| 1 | Descrição do problema/entrega | texto longo | Obrigatória para ativar; pode ser curta em cadastro enxuto | Texto não vazio para ativação | vazio | “Descreva o que precisa mudar ou ser entregue, sem presumir resultado.” | Existente |
| 1 | Secretaria/unidade principal | referência | Sempre para ativar | Deve pertencer ao município e estar ativa | Unidade do contexto, se aplicável | “Indique quem responde pela coordenação principal.” | Existente; estrutura geral de unidade é parcial |
| 1 | Responsável pessoa | referência a pessoa/usuário | Sempre para ativar, salvo regra local diferente | Deve ser ativo e pertencer à equipe/unidade autorizada | Nenhum | “Quem acompanha a iniciativa? A autoridade formal deve ser identificada separadamente quando necessário.” | Existente |
| 1 | Área/local/território de abrangência | texto/referência | Opcional; obrigatório somente se o template exigir localização | Formato e fonte locais; sem endereço de usuário | Nenhum | “Informe município, região ou estabelecimento relacionado ao projeto, não dados pessoais de usuários.” | Parcial; há Município/Equipamento |
| 2 | Compromissos do plano relacionados | seleção repetível de referência | Opcional; obrigatório apenas se o usuário declarar vínculo ao Plano de Governo | Compromisso deve pertencer ao município; gravar vínculo rastreável | Nenhum | “Selecione apenas compromisso existente; não crie um compromisso por inferência.” | Parcial; `IniciativaCompromisso` |
| 2 | Metas Estratégicas relacionadas | seleção repetível/referência | Opcional; política de ativação a definir | Meta deve pertencer ao município/Plano válido; controlar principalidade sem supor cardinalidade | Nenhuma | “Vincule uma meta existente quando pertinente; compromisso e meta são objetos distintos.” | Parcial; atual `metaEstrategicaId` singular |
| 2 | Iniciativas relacionadas | repetição de relação tipada | Opcional | Origem/destino distintos, mesmo município, tipo e justificativa; validar ciclos onde aplicável | Nenhuma | “Relacione somente registros diferentes; escolha dependência, desdobramento, contribuição ou acompanhamento.” | Parcial; `DependenciaVinculo` |
| 2 | Tipo, direção e justificativa do vínculo | seleção + texto longo | Obrigatório para cada relação entre iniciativas | Tipo controlado, direção coerente e justificativa mínima | Sem relação | “Explique a relação. Um vínculo pendente não deve alterar indicadores oficiais.” | Novo/adaptação |
| 3 | Objetivo e resultado pretendido | texto longo | Obrigatório em cadastro completo; opcional em enxuto | Não preencher automaticamente como fato; revisão humana | Vazio | “Descreva o resultado esperado sem criar metas numéricas não aprovadas.” | Parcial: descrição/perguntas |
| 3 | Escopo incluído/excluído | texto longo | Obrigatório para template complexo; opcional para enxuto | Listar inclusão/exclusão se aplicável | Vazio | “Registre limites e atividades que não fazem parte do projeto.” | Parcial: respostas do wizard |
| 3 | Beneficiários/grupo-alvo agregado | texto longo | Opcional; exigido por template quando autorizado | Não registrar nomes/identificadores individuais | Vazio | “Descreva grupos de forma agregada; dados pessoais de saúde ficam fora deste cadastro.” | Parcial |
| 3 | Template/setor aplicado | referência | Opcional | Template ativo e versão registrada no rascunho/iniciativa | Nenhum | “O template organiza perguntas e controles, sem substituir validação técnica.” | Parcial; `ModeloProjeto` |
| 3 | Condições de viabilidade e respostas | dinâmico conforme template | Conforme pergunta/configuração | Tipos e valores validados pelo snapshot; manter histórico de alteração | Não respondido | “Responda apenas ao que foi verificado; registre pendências como pendências.” | Existente, ampliável |
| 4 | Metas de execução/entregas | repetição estruturada | Obrigatória para iniciativa completa; no enxuto, pode-se adiar até ativação conforme política | Nome, critério/indicador, responsável e ordem; aceite conforme gate | Vazio | “Uma entrega é verificável e tem responsável.” | Existente: `MetaExecucao` |
| 4 | Tarefas e subtarefas | repetição estruturada | Condicional ao plano operacional | Prazo é opcional enquanto desconhecido; tarefa sem prazo não é “no prazo” | Vazio | “Mantenha prazo original e registre reprogramação como evento.” | Existente |
| 4 | Participantes e papel | referência repetível | Opcional; obrigatório quando houver corresponsabilidade | Unidade ativa, papel controlado e autorização | Nenhum | “Participar não cria cópia da iniciativa nem altera a unidade principal.” | Parcial: `IniciativaSecretaria` |
| 4 | Data de início e data-alvo do projeto | data | Opcional; obrigatório se cronograma tiver datas definidas | Início ≤ data-alvo; datas reais são locais, sem default | Nenhum | “Use apenas datas confirmadas; o cronograma da referência é relativo ao D0.” | Novo |
| 4 | Gate, critério, evidência e decisão | configuração repetível | Para cada gate definido pelo template | Decisão/autor/data e evidência requeridos conforme regra local | Estado pendente | “Somente a autoridade competente libera gate quando a regra exigir.” | Parcial: validações/decisões |
| 5 | Orçamento estimado total | moeda | Opcional até se haver estimativa formal; obrigatório para gate que exija orçamento | Moeda/unidade e data-base; zero só se confirmado | Sem valor | “Estimativa não equivale a dotação, empenho, caixa ou repasse.” | Novo |
| 5 | Linha de custo: categoria | seleção | Obrigatório para cada linha de custo | Catálogo configurável; categoria OUTRA exige descrição | Nenhuma | “Separe custo incremental por categoria para evitar dupla contagem.” | Novo |
| 5 | Linha de custo: descrição e memória de cálculo | texto longo | Obrigatório para cada linha | Explicitar quantidade × custo unitário ou método conhecido | Vazio | “Não registre valor sem fonte/memória de cálculo.” | Novo |
| 5 | Linha de custo: valor estimado | moeda | Obrigatório quando linha criada | Valor ≥ 0; registrar moeda e data de estimativa | Sem valor | “Use custo local validado, não valor de referência nacional inexistente.” | Novo |
| 5 | Linha de custo: valor realizado | moeda | Opcional até execução | Valor ≥ 0, período e fonte | Sem valor | “Registre despesa observada e fonte contábil quando disponível.” | Novo |
| 5 | Fonte de recurso/financiamento | texto/referência | Opcional; obrigatório se recursos forem declarados confirmados | Referência oficial ou “a definir”; separar fonte de instrumento | Nenhuma | “Recurso anunciado não comprova disponibilidade.” | Novo |
| 5 | Pagador/responsável pelo custeio | referência/texto | Obrigatório para registrar divisão de custeio confirmada | Órgão/ente identificável e município correto | Nenhum | “Registre quem custeia cada despesa, sem presumir responsabilidade.” | Novo |
| 5 | Instrumento de repasse/convênio/empenho | texto/referência documental | Condicional a repasse ou instrumento existente | ID/documento e vigência; sem inventar número | Nenhum | “Vincule instrumento formal; indicação não equivale a liberação.” | Novo |
| 5 | Situação do recurso | seleção | Quando valor/fonte forem preenchidos | `ESTIMADO`, `PREVISTO`, `FORMALIZADO`, `DISPONIVEL`, `EXECUTADO`, `A_CONFIRMAR` | `A_CONFIRMAR` | “Separe previsão, formalização, disponibilidade e execução.” | Novo |
| 6 | Risco: evento/causa/efeito | texto longo | Opcional em cadastro enxuto; para o template, riscos relevantes definidos antes do gate local | Descrever cenário, não registrar como ocorrência consumada | Vazio | “Risco futuro é diferente de impedimento/entrave já ocorrido.” | Novo; `Impedimento` não substitui |
| 6 | Risco: prevenção/controle | texto longo | Obrigatório para risco registrado | Controle verificável e responsável | Vazio | “Como reduzir a chance ou exposição? Cite controle executável.” | Novo |
| 6 | Risco: gatilho/alerta | texto longo | Obrigatório para risco registrado no template | Condição observável; limiar numérico só se aprovado | Vazio | “Que evidência indica que o risco exige ação?” | Novo |
| 6 | Risco: resposta/ação corretiva | texto longo | Obrigatório para risco registrado | Ação e escalonamento definidos | Vazio | “Descreva contenção, correção ou escalonamento.” | Novo |
| 6 | Risco: evidência de controle | referência documental/texto | Opcional no cadastro; exigida pelo gate conforme regra | Fonte/registro verificável; acesso adequado | Nenhuma | “Indique como será comprovada a prevenção ou resposta.” | Novo |
| 6 | Risco: responsável funcional | referência a unidade/pessoa | Obrigatório para risco ativo | Perfil autorizado; não inferir autoridade legal | Nenhum | “A função deve ser designada pela prefeitura.” | Novo |
| 6 | Risco: condição de parada | texto longo | Obrigatório para risco de segurança/continuidade do template | Deve identificar condição e quem tem competência para suspender | Vazio | “Registre quando parar e quem pode decidir conforme norma/pacto local.” | Novo |
| 6 | Risco: criticidade qualitativa e estado | seleção | Obrigatório para risco cadastrado | Severidade qualitativa; sem probabilidade inventada; estado controlado | A avaliar | “Criticidade qualitativa não é probabilidade estatística.” | Novo |
| 7 | Indicador: nome, unidade e descrição | texto | Obrigatório para cada indicador | Unidades e definições consistentes | Vazio | “Explique exatamente o que será contado/medido.” | Existente/parcial |
| 7 | Indicador: numerador, denominador e fórmula | texto longo | Obrigatório se indicador percentual/taxa | Fórmula testável; denominador e exceções expressos | Vazio | “Não publique percentual sem denominador.” | Parcial: fórmula existente; denominador estruturado novo |
| 7 | Indicador: linha de base, alvo e período | número/texto + data/período | Opcional até validação; metas aprovadas obrigatórias apenas quando definidas | Coerência da unidade/período; fonte exigida | Sem valores | “A linha de base precede a intervenção; meta requer aprovação.” | Existente/parcial |
| 7 | Indicador: fonte, data de corte e confiança | referência/texto + data + seleção | Obrigatório para medição publicada | Fonte rastreável, corte e confiança | Sem medição | “Diferencie dado declarado de dado conferido.” | Existente |
| 8 | Documento: tipo, título, versão, origem e vigência | referência/metadados | Obrigatório ao anexar documento | Tipos configuráveis, arquivo restrito e metadados mínimos | Nenhum | “Vincule documento oficial/fonte sem inferir homologação.” | Parcial/existente |
| 8 | Evidência e papel no gate/entrega | referência documental | Condicional ao critério de aceite | Validador/status/data e papel | Nenhuma | “Evidência declarada não equivale a validada.” | Existente |
| 9 | Resumo de pendências, relações e validações | leitura/checklist | Sempre | Não transformar pendência em aprovação | Calculado do estado | “Revise fatos, vínculos e pendências antes de ativar.” | Novo comportamento |
| 9 | Resultado da revisão/ativação | decisão/workflow | Sempre antes da publicação/ativação | Ator habilitado, decisão, escopo, fundamento e data | Rascunho | “A revisão consultiva não substitui ato da autoridade competente.” | Parcial: estados e validações existem |

### 6.4 Template, IA e notificações

**Templates reutilizáveis (recomendação):**

- **Saúde / Unidades Móveis:** gates G0–G4, papéis funcionais, prontidão, capacidade, riscos e indicadores da seção 5; não inclui paciente/prontuário no primeiro escopo.
- **Educação:** estrutura geral de objetivo, unidade/equipamento compartilhado, entregas e indicadores; parâmetros setoriais e requisitos legais ficam a definir.
- **Infraestrutura:** escopo/entrega, equipamento/local, tarefas, fontes, documentação e riscos; não inferir licenças, propriedade, contratação ou padrões de engenharia.
- Os templates devem ter versão, proprietário, estado de publicação, perguntas/campos condicionais e snapshot aplicado a cada iniciativa. Catálogos de indicadores são sugestões, não metas oficiais.

**IA (recomendação):** sugerir rascunhos de justificativa e escopo, riscos/controles, indicadores/fórmulas e possíveis vínculos, exibindo fonte/referência, nível de confiança e campos ainda não verificados. Nenhuma sugestão altera registro oficial sem aceitação humana; não enviar dados de saúde identificáveis a modelo externo. O provedor e a retenção de prompts são **a definir**.

**Gatilhos propostos (todos configuráveis e desligados por padrão até validação):**

| Evento/prazo | Destinatário funcional | Canal inicial | Canal externo | Condição/limite |
|---|---|---|---|---|
| Atribuição de responsável | Responsável da tarefa/risco/indicador | Interno, já disponível | SMTP/WhatsApp após consentimento/configuração | Não incluir dado clínico |
| Gate pendente ou prazo do gate próximo | Responsável do gate e coordenação | Interno | Opcional | Antecedência configurável; sem valor padrão |
| Gate devolvido/bloqueado/aprovado | Autor e responsável funcional | Interno | Opcional | Registrar decisão e link protegido |
| Risco atinge gatilho/condição de parada | Dono do risco e autoridade designada | Interno com escalonamento | Opcional, nunca única via | Confirmar destinatários/competência local |
| Tarefa/entrega vence ou é reprogramada | Responsável e consultor conforme permissão | Interno | Opcional | Preservar prazo original e histórico |
| Relatório/data de corte disponível | Responsáveis de monitoramento | Interno | E-mail opcional | Filtros e classificação de acesso |
| Falha de canal externo | Administrador de notificações | Interno/observabilidade | Não repetir sem política | Retry, deduplicação e trilha técnica |

## 7. Roadmap recomendado

### MVP — base universal e especificação executável do piloto

1. Separar classificação de relações entre registros e preservar a semântica legada.
2. Permitir classificações simultâneas e vínculos opcionais a compromissos/metas.
3. Modelar, validar e visualizar relações entre iniciativas distintas.
4. Implementar agregação sem duplicidade e testes de contagem.
5. Persistir rascunho e retomar wizard por etapa/template.
6. Oferecer wizard de cadastro enxuto e etapas condicionais.
7. Disponibilizar template Saúde/Unidade Móvel com campos administrativos não clínicos.
8. Configurar gates G0–G4, escopo, responsáveis, cronograma sem duração fictícia e revisão antes da ativação.
9. Criar linhas de custo/fontes/pagadores e registro preventivo de riscos/controles.
10. Configurar indicadores do piloto com fórmulas, denominadores, fonte e data de corte.
11. Estender auditoria e relatório de prestação de contas.
12. Definir decisão formal de fronteira de dados, papéis e integração com sistemas oficiais antes de armazenar qualquer dado de pessoa/saúde.

### Fase 2 — notificações e intercâmbio externo controlado

1. Implementar eventos de notificação interna configuráveis e deduplicados.
2. Integrar SMTP e API Oficial do WhatsApp após aprovar credenciais, templates, consentimento, segurança, falhas e destinatários.
3. Definir e implementar integrações específicas para sistemas oficiais somente com documentação técnica, autorização e fonte de verdade acordadas.
4. Incluir relatório consolidado do piloto com acesso, equidade, continuidade, custos e limitações, sem publicar dado identificável.

### Fase 3 — assistência de IA e ampliação de templates

1. Adicionar provedor LLM sob avaliação, limites de dados, segurança e monitoramento.
2. Sugerir riscos, justificativas, indicadores e relações; exigir revisão/aceite e manter proveniência.
3. Evoluir templates Saúde, Educação e Infraestrutura, cada um com governança, versão e validação técnica própria.
4. Automatizar snapshots comparáveis e painéis por dimensão, conservando regras de deduplicação e data de corte.

### 8.4 Status da implementação do piloto local

**Implementação exploratória arquivada, fora do produto ativo:** antes do adiamento, foram preparados P04–P09 (gates G0–G4 no dossiê); H01–H12 (campos da ficha local, sem agenda/usuários); F01–F04 e F06–F08 em formato de revisão administrativa de orçamento; R01–R09 como matriz preventiva (sem cálculo de probabilidade); I01–I09 e indicadores adicionais do painel de referência como dicionário configurável; W05 parcialmente (etapas/metas aparecem na ficha e no cronograma); W08 parcialmente (definição e campos locais; não há medições/importação); W09 parcialmente (referências em texto, sem anexação pelo dossiê). O código correspondente está preservado em `projeto-carretas/source/`, mas não é integrado ao wizard, à página do projeto ou à API ativos.

**Parcial ou ainda pendente:** rascunho retomável do wizard (U09–U11); vínculo relacional entre documentos e cada critério; captura de valores realizados e documentos contábeis; painel/relatório próprio e exportação de prestação de contas; notificações externas, conectores de sistemas oficiais e LLM. Esses itens não devem ser considerados entregues por existir a ficha de validação.

**Migração:** a migration PostgreSQL foi aplicada somente ao banco local isolado `localhost:5434` para validar a demonstração. Para adiar a funcionalidade, o arquivo foi movido para `projeto-carretas/source/packages/db/prisma/` e o modelo foi removido do schema Prisma ativo; a migration não será incluída em deploys normais. A tabela criada pela migration permanece no banco local, mas o registro demonstrativo foi removido. Não executar `db push`, migration deploy ou deploy de aplicação contra o Supabase remoto como parte desta validação.

## 8. Backlog de implementação

IDs são estáveis para discussão e ordenação. **MVP → Fase 2 → Fase 3** é a sequência aprovada. Cada nova etapa, campo, template, regra de vínculo e gatilho tem item próprio. Campos existentes aparecem como “adaptar” quando o comportamento precisa mudar. A execução deve preservar as migrations existentes e não aplicar alterações a ambientes remotos sem validar o estado e obter autorização de implantação.

### 8.1 MVP

| ID | Implementação | Tipo | Descrição do que deve ser feito | Módulo afetado | Dependências (IDs) | Prioridade | Complexidade | Critério de aceite |
|---|---|---|---|---|---|---|---|---|
| U01 | Classificações simultâneas: persistência | banco de dados | Adicionar coleção tipada de classificações por Iniciativa, mantendo leitura dos campos legados e plano de migração idempotente. | DB / Iniciativas | — | alta | G | Uma iniciativa pode ter 0..N marcadores sem duplicar sua identidade; dados legados seguem legíveis. |
| U02 | Classificações simultâneas: API | backend | Validar, autorizar, auditar e expor criação/edição/remoção lógica de classificações. | API Iniciativas | U01 | alta | M | Casos válidos persistem; tipo inválido e acesso fora do município falham explicitamente; histórico auditado. |
| U03 | Classificações simultâneas: UI | frontend | Adaptar etapa de “Tipo” e filtros para seleções independentes, sem apagar classificações ao mudar outra dimensão. | Wizard / Carteira | U02 | alta | M | Usuário associa duas ou mais dimensões ao mesmo ID e consulta suas etiquetas na ficha. |
| U04 | Compatibilidade de `classificacaoPrincipal` | backend | Definir e implementar tradução de legado para as novas classificações sem assumir que todos os registros antigos têm metadados corretos. | Migração / Iniciativas | U01, P01 | alta | M | Dry-run/relatório de conflitos; valores ambíguos ficam pendentes, não são convertidos silenciosamente. |
| U05 | Relação entre iniciativas: modelo | banco de dados | Criar relação tipada entre dois registros distintos com tipo, sentido, justificativa, fonte, estado, autor, validador e datas. | DB / Iniciativas | — | alta | G | Relação preserva origem/destino e trilha; não exige relação para toda iniciativa. |
| U06 | Relações entre iniciativas: regras/API | backend | Implementar CRUD autorizado, integridade municipal, estados de validação, auditoria e prevenção de ciclos nos tipos em que forem impeditivos. | API / Vínculos | U05 | alta | G | Testes cobrem permissões, relações pendentes, rejeição, ciclo impeditivo e cross-tenant. |
| U07 | Relações entre iniciativas: interface | frontend | Incluir seção consultável/gerenciável na ficha e no wizard, com tipo, sentido, justificativa e estado. | Wizard / Ficha | U06 | alta | M | Relações aparecem como registros distintos; usuário pode propor vínculo e acompanhar validação. |
| U08 | Consolidação sem dupla contagem | backend | Criar agregação por dimensões com identidade canônica da iniciativa e política explícita para contribuições compartilhadas. | Painéis / Relatórios | U01, U05 | alta | G | Testes com uma iniciativa multiclasse e relações cruzadas contam 1 por conjunto e explicam a regra. |
| U09 | Rascunho da Iniciativa: modelo | banco de dados | Persistir status de rascunho, etapa, respostas, classificação, relações provisórias e versão do template. | DB / Wizard | — | alta | M | Dados incompletos persistem sem aparecer como publicação/ativação oficial. |
| U10 | Rascunho: API e autorização | backend | Criar, consultar, salvar e retomar rascunhos por município e escopo de perfil; auditar mudanças relevantes. | API / Wizard | U09 | alta | G | Usuário autorizado retoma o rascunho; terceiro/município não autorizado não o acessa. |
| U11 | Rascunho: experiência de retomada | frontend | Incluir “salvar e sair”, retomada por etapa e resumo de rascunhos disponíveis. | Wizard | U10 | alta | M | Reabrir preserva respostas e versão do modelo; erro de salvamento é informado. |
| W01 | Etapa 0 — classificações e porte | frontend | Criar a etapa de seleção simultânea de dimensões e nível de detalhamento, sem exclusividade. | Wizard | U03 | alta | M | Usuário pode deixar classificação vazia ou selecionar várias e escolher o detalhamento. |
| W02 | Etapa 1 — identificação e responsabilidade | frontend | Adaptar etapa comum de identidade e exigir nome, secretaria/unidade e responsável para ativação; permitir rascunho incompleto. | Wizard / Iniciativas | U10 | alta | M | Cadastro enxuto não exige respostas do template complexo; ativação valida os mínimos aprovados. |
| W03 | Etapa 2 — plano e relações | frontend | Separar compromissos, metas estratégicas e relações entre iniciativas em controles distintos, todos opcionais quando pertinentes. | Wizard / Planejamento | U07, P02 | alta | M | Nenhum vínculo é inferido da classificação; seleção mantém origem e destino. |
| W04 | Etapa 3 — contexto e viabilidade | frontend | Reusar perguntas/snapshots condicionais, com escopo/beneficiários opcionais e obrigatoriedade variável por template. | Wizard / Shared | P03 | alta | M | Campos condicionais não aparecem indevidamente e respostas pendentes não são tratadas como fatos. |
| W05 | Etapa 4 — entregas e cronograma | frontend | Configurar metas de execução, tarefas, participantes e datas opcionais, com templates de gates. | Wizard / Execução | P04, P05 | alta | G | Escopo e prazos são editáveis; ausência de prazo não vira status “no prazo”. |
| W06 | Etapa 5 — recursos e orçamento | frontend | Adicionar editor de estimativa e linhas estruturadas de custo/fontes/pagadores. | Wizard / Planejamento | F01–F08 | alta | G | Pode salvar “a definir”; previsão, recurso formalizado, disponível e executado são estados distintos. |
| W07 | Etapa 6 — riscos e controles | frontend | Criar seção de riscos preventivos separada dos impedimentos ocorridos. | Wizard / Execução | R01–R08 | alta | G | Risco registra prevenção, gatilho, resposta, evidência, responsável e parada sem probabilidade inventada. |
| W08 | Etapa 7 — indicadores e avaliação | frontend | Adaptar criação de indicadores e medições para registrar definição, fórmula/denominador, fonte e data de corte. | Planejamento / Indicadores | I01–I04 | alta | M | Nenhuma taxa é publicada sem denominador/fonte definidos ou ressalva explícita. |
| W09 | Etapa 8 — documentos e evidências | frontend | Configurar papéis documentais e evidência por etapa/gate; preservar fluxo atual de validação. | Documentos / Evidências | P06 | média | M | Documento mantém fonte, versão, papel e estado; evidência declarada não se torna verificada. |
| W10 | Etapa 9 — revisão e ativação | frontend | Apresentar classificações, vínculos, pendências, riscos, gates e decisão antes da ativação. | Wizard / Validações | P07, U02, U06 | alta | M | Publicação/ativação não ocorre sem requisitos; a revisão não se apresenta como aprovação legal. |
| P01 | Perfil de complexidade e regras condicionais | backend | Definir metadado/configuração de detalhamento e condições reutilizáveis por template. | Shared / Modelos | U09 | alta | G | O mesmo motor suporta cadastro enxuto e formulário completo; regras são versionadas e testáveis. |
| P02 | Compromissos e metas opcionais em todos os tipos | backend | Reusar `IniciativaCompromisso` e revisar a validação do `metaEstrategicaId` para vínculo opcional sem forçar tipo PLANO_GOVERNO. | Planejamento / Wizard | U03 | alta | M | A mesma iniciativa pode ter vínculo de planejamento opcional e outras classificações sem novo cadastro. |
| P03 | Validação e migração dos vínculos de Meta Estratégica | banco de dados | Definir unicidade/cardinalidade e consistência entre município, Plano, compromisso e Meta; criar consulta de dados pendentes. | DB / Planejamento | P02 | alta | G | Vínculos históricos não são alterados sem relatório; inconsistências permanecem identificadas. |
| P04 | Template Saúde/Unidade Móvel: catálogo base | backend | Criar template versionado com etapas administrativas, gates G0–G4 e exclusões clínicas explícitas. | Modelos / Saúde | P01 | alta | G | Snapshot aplicado preserva versão; não cria campos/pessoas/valores não respondidos. |
| P05 | Gate G0 — demanda, modalidade e governança | backend | Configurar critério, evidência, decisão e estado do gate de decisão/pactuação inicial. | Template Saúde / Validações | P04 | alta | M | Gate só passa com critérios locais configurados e decisão registrada; nenhum dado ausente é presumido. |
| P06 | Gate G1 — planejamento e prontidão | backend | Configurar verificação de infraestrutura, acessibilidade, equipe, recursos e contingência. | Template Saúde / Validações | P04 | alta | M | Evidências e itens aplicáveis/não aplicáveis com fundamento ficam rastreáveis. |
| P07 | Gate G2 — prontidão assistencial e continuidade | backend | Configurar validação de retaguarda, resultados/retornos, contrarreferência e registro oficial. | Template Saúde / Validações | P04 | alta | M | Gate registra destinatário/responsável e pendências sem reproduzir prontuário. |
| P08 | Gate G3 — agenda, contato e treinamento | backend | Configurar check de fonte oficial, fluxo permitido de cancelamento/reposição, acessibilidade e treinamento. | Template Saúde / Validações | P04 | alta | M | Gate exige confirmação local da agenda/fonte e fluxo; não cria fila paralela. |
| P09 | Gate G4 — reconciliação e encerramento | backend | Configurar conciliação de produção, seguimento, custos/materiais e aprovação do relatório. | Template Saúde / Validações | P04 | alta | M | Encerramento mantém pendências de cuidado abertas até transferência/aceite definido. |
| H01 | Campo piloto: modalidade/programa de oferta | backend | Adicionar pergunta/campo do template para modalidade e programa/parceria, aceitando “a definir”. | Template Saúde | P04 | alta | P | Campo não sugere acesso garantido a unidade móvel; exige fonte para valor confirmado. |
| H02 | Campo piloto: região/estabelecimento de operação | backend | Adicionar referência ao local/unidade/território do projeto sem dados pessoais de usuários. | Template Saúde | P04 | média | M | Local pode ser compartilhado por mais de uma iniciativa e é rastreável ao município. |
| H03 | Campo piloto: especialidade autorizada | backend | Adicionar campo condicionado a modalidade confirmada, permitindo múltiplos valores autorizados. | Template Saúde | P04 | alta | P | Cada valor possui fonte/estado de confirmação; sem valor por padrão. |
| H04 | Campo piloto: procedimentos autorizados | backend | Adicionar campo condicionado à especialidade/modalidade, sem protocolo clínico embutido. | Template Saúde | H03 | alta | M | Procedimento não pode ser inferido; configuração exige autoridade/fonte local. |
| H05 | Campo piloto: prestador/unidade móvel | backend | Registrar organização prestadora e referência de unidade móvel sem presumir contrato ou designação. | Template Saúde | P04 | alta | M | Identidade e papel têm fonte/estado; pode permanecer “a definir”. |
| H06 | Campo piloto: responsável técnico | backend | Adicionar referência funcional/pessoal do responsável técnico conforme designação local. | Template Saúde | H05 | alta | M | Não atribui competência automaticamente; auditoria registra alterações. |
| H07 | Campo piloto: período operacional | backend | Registrar datas previstas/confirmadas da operação sem default federal/municipal. | Template Saúde | P04 | alta | P | Valida início/fim; valores ausentes permanecem pendentes. |
| H08 | Campo piloto: capacidade validada | backend | Registrar capacidade por período/procedimento e fonte de confirmação, se conhecida. | Template Saúde | H03, H04 | alta | M | Distingue estimativa de capacidade validada e não publica zero como capacidade. |
| H09 | Campo piloto: responsável pela regulação | backend | Adicionar vínculo funcional para autoridade reguladora definida localmente. | Template Saúde | P04 | alta | M | Sem pessoa/função indicada não se declara agenda autorizada. |
| H10 | Campo piloto: sistema-fonte e versão da fila/agenda | backend | Registrar sistema oficial, versão/data de corte e referência, sem importar usuários no MVP. | Template Saúde / Integração | P04 | alta | M | Referência não se apresenta como cópia/agenda oficial; contém data/fonte. |
| H11 | Campo piloto: retaguarda/referência assistencial | backend | Registrar unidade/rede responsável por urgência/seguimento conforme pactuação. | Template Saúde | P07 | alta | M | Gate G2 não passa sem designação exigida pelo protocolo local. |
| H12 | Campo piloto: acessibilidade e prontidão do local | backend | Adicionar checklist configurável de acessibilidade/infraestrutura com evidências e aplicabilidade. | Template Saúde | P06 | alta | M | Cada item tem status, fonte e justificativa; não fixa requisito universal sem validação. |
| F01 | Modelo de linha de custo | banco de dados | Criar registro filho da Iniciativa para orçamento/custeio, com origem e trilha. | DB / Planejamento | — | alta | G | Uma iniciativa aceita diversas linhas sem armazenar tudo em texto livre. |
| F02 | Campo financeiro: categoria de custo | banco de dados | Incluir categoria configurável por linha de custo. | DB / Planejamento | F01 | alta | P | Categoria validada; “outra” exige descrição. |
| F03 | Campo financeiro: descrição/memória de cálculo | banco de dados | Persistir descrição e método da estimativa por linha. | DB / Planejamento | F01 | alta | P | Toda linha tem método descrito antes de ser considerada estimativa utilizável. |
| F04 | Campo financeiro: valor estimado | banco de dados | Persistir valor estimado, moeda/unidade e data-base. | DB / Planejamento | F01 | alta | M | Valor não negativo e base temporal registrada; vazio não vira zero. |
| F05 | Campo financeiro: valor realizado | banco de dados | Persistir valor realizado e período/fonte associados. | DB / Planejamento | F01 | alta | M | Valores estimados e realizados permanecem separados e auditados. |
| F06 | Campo financeiro: fonte de recurso | banco de dados | Persistir fonte/financiamento e referência documental quando houver. | DB / Planejamento | F01 | alta | M | Fonte pode ficar desconhecida; confirmação exige documento/fonte. |
| F07 | Campo financeiro: pagador | banco de dados | Persistir ente/órgão responsável por cada parte do custeio. | DB / Planejamento | F01 | alta | M | Rateio de pagadores é representável sem duplicar custo total. |
| F08 | Campo financeiro: instrumento e situação | banco de dados | Persistir número/referência do instrumento e situação do recurso, com histórico. | DB / Planejamento | F01 | alta | M | Previsto, formalizado, disponível e executado são estados distintos. |
| R01 | Modelo de registro preventivo de risco | banco de dados | Criar entidade independente de `Impedimento`, ligada à Iniciativa e opcionalmente a marco/gate. | DB / Riscos | — | alta | G | Risco preventivo não é confundido com evento/impedimento ocorrido. |
| R02 | Campo risco: evento/causa/efeito | banco de dados | Adicionar descrição estruturada do evento e seus efeitos. | DB / Riscos | R01 | alta | P | Registro descreve risco futuro sem afirmar ocorrência. |
| R03 | Campo risco: prevenção/controle | banco de dados | Persistir medidas preventivas e dono do controle. | DB / Riscos | R01 | alta | M | Controle tem responsável e pode receber evidência. |
| R04 | Campo risco: gatilho | banco de dados | Persistir condição observável que dispara alerta/ação. | DB / Riscos | R01 | alta | M | Trigger pode ser qualitativo; regra numérica requer configuração validada. |
| R05 | Campo risco: resposta corretiva | banco de dados | Persistir resposta, contenção e escalonamento. | DB / Riscos | R01 | alta | M | Resposta disponível na ficha e com histórico. |
| R06 | Campo risco: evidência do controle | banco de dados | Referenciar documento/registro que comprova prevenção ou resposta. | DB / Riscos | R01, P06 | média | M | Evidência mantém papel, autor, status e permissão. |
| R07 | Campo risco: responsável funcional | banco de dados | Referenciar usuário/unidade responsável pelo risco. | DB / Riscos | R01 | alta | M | Só destinatários autorizados visualizam e recebem alerta. |
| R08 | Campo risco: condição de parada | banco de dados | Persistir condição e autoridade a acionar em risco crítico. | DB / Riscos | R01 | alta | M | Não atribui poder de suspensão ao consultor por inferência. |
| R09 | Campo risco: criticidade/estado | banco de dados | Persistir severidade qualitativa e ciclo de vida sem probabilidade presumida. | DB / Riscos | R01 | alta | P | Severidade qualitativa, estado e probabilidade não são confundidos. |
| I01 | Indicador Saúde: contatabilidade | backend | Configurar fórmula “contatos efetivos / convocados” com fonte e corte. | Indicadores / Template Saúde | P04 | média | P | Denominador, período e interpretação são exibidos. |
| I02 | Indicador Saúde: confirmação | backend | Configurar indicador de confirmações sobre agendamentos válidos convocados. | Indicadores / Template Saúde | P04 | média | P | Exclui registros inválidos conforme definição aprovada. |
| I03 | Indicador Saúde: absenteísmo geral | backend | Configurar faltas sobre agendamentos válidos na data. | Indicadores / Template Saúde | P04 | média | M | Cancelamentos elegíveis à exclusão seguem regra documentada. |
| I04 | Indicador Saúde: absenteísmo entre confirmados | backend | Configurar métrica distinta do absenteísmo geral. | Indicadores / Template Saúde | P04 | média | P | Não trata o número declarado de 18% como meta ou baseline oficial. |
| I05 | Indicador Saúde: ocupação efetiva | backend | Configurar atendimentos realizados sobre vagas ofertadas/operacionais. | Indicadores / Template Saúde | H08 | média | M | Define capacidade válida e não equipara volume a resultado clínico. |
| I06 | Indicador Saúde: reaproveitamento de vagas | backend | Configurar vagas liberadas e preenchidas sobre elegíveis à reposição. | Indicadores / Template Saúde | P04 | média | M | Janela e elegibilidade são parâmetros locais. |
| I07 | Indicador Saúde: espera mediana | backend | Configurar mediana entre solicitação válida e atendimento. | Indicadores / Template Saúde | H10 | média | M | Unidade de análise, fonte e estratos são informados. |
| I08 | Indicador Saúde: seguimento aceito | backend | Configurar casos que requerem seguimento e cujo destino foi confirmado. | Indicadores / Template Saúde | P07 | alta | M | Encaminhamento sem aceite não conta como seguimento concluído. |
| I09 | Indicador Saúde: entrega final de material | backend | Configurar indicador condicional para materiais incluídos no escopo. | Indicadores / Template Saúde | P04, P06 | baixa | M | Distingue recebimento por distrito, UBS e usuário; desativado se não aplicável. |
| I10 | Indicador Saúde: incidentes de segurança | backend | Configurar contagem por tipo e produção correspondente, com limites de acesso. | Indicadores / Template Saúde | P04 | alta | M | Variação é interpretada sem premiar subnotificação. |
| L01 | Auditoria dos novos domínios | backend | Auditar classificações, relações, orçamento, riscos, gates e decisão de ativação. | Auditoria | U02, U06, F01, R01, P05–P09 | alta | M | Antes/depois, ator, município, entidade e data aparecem em consulta autorizada. |
| L02 | Relatório de avaliação/contas do piloto | backend | Criar relatório com oferta, acesso, equidade, continuidade, segurança, custos e limitações. | Relatórios | I01–I10, F01, R01, P09 | alta | G | Filtra por data de corte, inclui fontes/denominadores e não expõe usuários. |
| L03 | Permissão e fronteira de dados do piloto | backend | Revisar autorização por perfil, segregação e trilha; bloquear dados identificáveis/clínicos fora do escopo aprovado. | RBAC / Segurança | H10, P07 | alta | G | Testes negativos asseguram escopo municipal/funcional e ausência de exposição indevida. |

### 8.2 Fase 2

| ID | Implementação | Tipo | Descrição do que deve ser feito | Módulo afetado | Dependências (IDs) | Prioridade | Complexidade | Critério de aceite |
|---|---|---|---|---|---|---|---|---|
| N01 | Gatilho: atribuição | notificação | Disparar aviso ao responsável de tarefa, risco ou indicador após atribuição válida. | Notificações | L03 | média | M | Destinatário e canal respeitam preferências/permissões; evento fica auditável. |
| N02 | Gatilho: gate pendente/próximo do prazo | notificação | Notificar responsável/coordenação antes de prazo configurado. | Notificações | P05–P09, L03 | média | M | Antecedência é configurável; sem prazo configurado não dispara. |
| N03 | Gatilho: decisão do gate | notificação | Avisar autor/responsável quando gate é aprovado, devolvido ou bloqueado. | Notificações | P05–P09, L03 | média | M | Mensagem não inclui dado sensível e leva a link protegido. |
| N04 | Gatilho: risco atinge alerta/parada | notificação | Escalonar evento ao responsável e autoridade designada. | Notificações / Riscos | R04, R07, R08, L03 | alta | G | Política de escalonamento validada; nenhuma condição de parada depende só de WhatsApp/e-mail. |
| N05 | Gatilho: vencimento/reprogramação | notificação | Reusar eventos de prazo, preservando prazo original e destinatários autorizados. | Notificações / Execução | W05, L03 | média | M | Disparo idempotente e consistente com histórico de reprogramação. |
| N06 | Gatilho: relatório/data de corte | notificação | Avisar perfis de monitoramento sobre relatório pronto. | Notificações / Relatórios | L02, L03 | baixa | M | Destinatários são configuráveis por município e perfil. |
| N07 | Falha de canal, retry e deduplicação | notificação | Implementar status, retentativa limitada, idempotência e logs sem conteúdo sensível. | Notificações | N01–N06 | média | G | Falha externa não apaga notificação interna nem cria duplicatas ilimitadas. |
| N08 | Adaptador SMTP | integração | Integrar serviço SMTP escolhido, segredos por ambiente, templates e monitoramento. | Notificações | N01–N07 | média | G | Testes verificam configuração ausente, falha, sucesso e sanitização do conteúdo. |
| N09 | API Oficial do WhatsApp | integração | Integrar provedor/API oficial escolhida, templates aprovados e gestão de opt-in aplicável. | Notificações | N01–N07 | média | G | Envio de teste autorizado, estado de entrega rastreável e nenhum conteúdo clínico indevido. |
| X01 | Decisão de fonte reguladora e interoperabilidade | integração | Registrar decisão técnica/gestão sobre sistema oficial, entidades, IDs, eventos e autorizações antes de desenvolver conector. | Integrações / Arquitetura | H10, L03 | alta | M | Decisão documenta fonte de verdade, proprietário, permissões e limites de dados. |
| X02 | Conector com sistema oficial escolhido | integração | Implementar integração somente após X01 e documentação/autorização do sistema escolhido. | Integrações | X01 | a definir | G | Sincronização é testada, reconciliável, autorizada e não cria agenda paralela. |
| X03 | Importação de dados agregados/operacionais aprovada | integração | Importar apenas campos e nível de detalhe aprovados, com origem, versão, corte e conflito. | Importação | X01, L03 | média | G | Não sobrescreve silenciosamente; conflitos e qualidade ficam visíveis. |

### 8.3 Fase 3

| ID | Implementação | Tipo | Descrição do que deve ser feito | Módulo afetado | Dependências (IDs) | Prioridade | Complexidade | Critério de aceite |
|---|---|---|---|---|---|---|---|---|
| A01 | Avaliação de provedor de IA | IA | Selecionar provedor, avaliar proteção, retenção, custo e qualidade antes de habilitar conteúdo municipal. | IA / Segurança | L03 | alta | G | Avaliação documentada e aprovada; sem dados pessoais/clínicos desnecessários. |
| A02 | Sugestão de justificativa/escopo | IA | Propor rascunhos com fontes e lacunas explícitas, vinculados a versão de prompt/modelo. | Wizard / IA | A01, U10 | média | G | Nenhum texto é publicado sem aceite humano; origem é consultável. |
| A03 | Sugestão de riscos/controles | IA | Sugerir riscos, gatilhos, controles e resposta com ressalva de revisão técnica. | Riscos / IA | A01, R01 | média | G | Conteúdo não representa risco validado até decisão humana. |
| A04 | Sugestão de indicadores/fórmulas | IA | Sugerir indicadores com numerador, denominador, fonte e limitações; evitar meta numérica presumida. | Indicadores / IA | A01, I01–I10 | média | G | Sugestão precisa de fonte e validação; sem fonte não é publicada. |
| A05 | Sugestão de relações entre iniciativas | IA | Recomendar possíveis relações sem criar vínculos automaticamente. | Vínculos / IA | A01, U06 | baixa | G | Sugestões ficam pendentes e não influenciam consolidação oficial. |
| T01 | Template reutilizável Educação | backend | Configurar etapas/campos gerais com versão; requisitos setoriais dependem de validação própria. | Modelos | P01, W01–W10 | baixa | M | Template não ativa regras legais ou metas não aprovadas. |
| T02 | Template reutilizável Infraestrutura | backend | Configurar entregas, locais/equipamentos, documentos e riscos com conteúdo validado localmente. | Modelos | P01, W01–W10 | baixa | M | Campos condicionais e evidências têm origem/versionamento. |
| T03 | Versionamento e publicação de templates | banco de dados | Definir ciclo de revisão, publicação, descontinuação e snapshot por Iniciativa. | Modelos / Auditoria | P01, P04, L01 | média | G | Iniciativa mantém o template/versão usado; atualização não altera rascunho publicado retroativamente. |
| T04 | Snapshots históricos de painéis | backend | Reconstituir indicadores e relatório em data de corte, com versão de regra e fontes. | Relatórios / Indicadores | U08, L02 | média | G | Reexecutar consulta histórica reproduz valores ou explicita mudança de fórmula/fonte. |

## 9. Requisitos não funcionais e riscos da própria plataforma

### Requisitos

- **Isolamento:** validar município e escopo funcional em toda leitura, gravação, vínculo e exportação.
- **Permissão mínima:** separar administração CIP, consultoria, gestor de secretaria, prefeito/leitura, responsável funcional e aprovador municipal; a autoridade legal não decorre de um papel genérico.
- **Auditoria:** autoria, data, origem, antes/depois, decisão e fundamento em alterações relevantes; não sobrescrever prazo original ou decisão.
- **Versionamento:** preservar versão de template, regra de cálculo, documento e data de corte.
- **Integridade:** impedir referência entre municípios sem autorização; não duplicar iniciativa ao associar dimensões; validar ciclos impeditivos.
- **Rastreabilidade:** todo indicador inclui definição/fórmula, fonte, unidade, período, data de corte e limitações.
- **Acessibilidade e linguagem:** formulários progressivos, termos compreensíveis, alternativas ao contato digital e validação de acessibilidade por responsáveis competentes.
- **Resiliência:** salvar rascunhos com feedback de erro; notificações externas devem tolerar falhas sem perder evento interno.
- **Privacidade:** minimização de dados; não armazenar prontuário, diagnóstico, consentimento clínico ou lista nominativa no caso piloto até deliberação, arquitetura e autorização próprias.
- **Conformidade:** a citação de lei/regra na referência não prova conformidade da plataforma; requisitos precisam de parecer do jurídico, encarregado de dados, regulação, vigilância sanitária e profissionais habilitados conforme o tema.

### Riscos da plataforma

| Risco | Consequência | Controle/recomendação |
|---|---|---|
| Tratar `classificacaoPrincipal` como domínio completo | Não permite classificações combinadas e induz duplicação | Migração auditável, controles de compatibilidade e testes de identidade |
| Confundir impedimento com risco | Controles preventivos ficam invisíveis ou entram tarde | Modelos/fluxos separados, mesmo que relacionados |
| Fila/agenda paralela | Iniquidade, erro operacional e conflito com regulador | Não importar/editar agenda sem fonte, autoridade e protocolo aprovados |
| Exposição de dados de saúde | Violação de privacidade e dano ao usuário | Exclusão do escopo inicial; minimização e revisão de segurança se houver mudança |
| Somar projetos por classificação/secretaria | Indicadores executivos incorretos | ID único e regras explícitas de agregação/testes |
| Gate confundido com ato jurídico | Falsa aparência de autorização | Registrar decisão/competência/fundamento; UI não simula competência |
| Sugestão de IA interpretada como fato | Risco jurídico/administrativo e viés | Proveniência, confiança, revisão e aceite explícito |
| Notificação externa indisponível | Atraso em evento crítico ou exposição acidental | Canal interno como registro; não depender de e-mail/WhatsApp para decisão crítica |
| Recurso ou capacidade fictícia | Orçamento/agenda não factíveis | Estados “a definir”, fontes e documentos; nunca defaults inventados |
| Migração inconsistência de legado | Corrupção semântica em produção | Dry-run, backup, relatório de ambiguidade e aprovação antes da migração |
| Documentação/deploy divergente | Executar migração errada ou confundir banco usado | Atualizar documentação de infraestrutura após decisões técnicas e verificar cada ambiente |

## 10. Perguntas abertas e decisões pendentes

| Pergunta | Por que não pode ser resolvida pelos insumos | Impacto |
|---|---|---|
| A plataforma usará “Iniciativa” como termo canônico, mantendo “Projeto” na UI, ou haverá mudança de nomenclatura? | O código mistura nome de entidade e rótulo de interface; o dossiê define ambos conforme contexto. | Glossário, contratos API, telas e importação. |
| Quais dimensões/classificações simultâneas serão oficiais, e elas terão vigência/histórico? | Documentos listam categorias, mas não determinam catálogo, regras de ativação ou temporalidade. | Schema, migração, filtros e agregação. |
| Uma iniciativa pode se ligar a quantas metas estratégicas/compromissos? Qual é o vínculo principal? | O documento-base deixa cardinalidade/meta principal pendente; código atual possui Meta singular e compromissos N:N. | Integridade, relatórios, associação e priorização. |
| Quais tipos de relação entre iniciativas existem e quais são direcionais, recíprocas ou impeditivas? | Nem texto nem código definem vocabulário final e ciclo para todos os tipos. | Schema, UI, motor de ciclo e consolidação. |
| Quem cria, valida, remove ou arquiva cada relação e classificação? | Papéis/regras municipais precisam de confirmação; remoção lógica e histórico podem ser obrigatórios. | Permissões, auditoria e fluxo de aprovação. |
| Como dados legados incompletos serão classificados? | Não é possível inferir toda classificação só de `classificacaoPrincipal`, `estruturante` e `vinculoPlanoGoverno`. | Migração e qualidade dos dados. |
| Carretas será apenas projeto gerencial do CIP ou incluirá fila, agenda e eventos de usuários? | O documento de referência atravessa regulação/atendimento; o produto atual não declara esse escopo. | Pode alterar substancialmente privacidade, segurança, dados e arquitetura. |
| Qual sistema é fonte oficial de fila, agenda, elegibilidade, produção e resultado clínico? | Não foi fornecido contrato/API ou autorização. | Integração, IDs, reconciliação, atualização e responsabilidades. |
| Quais dados podem circular entre prefeitura, prestador, APS, regulação e CIP? Quem é controlador/operador? | Insumos não fixam papéis de dados, base legal, retenção ou compartilhamento. | Bloqueia qualquer armazenamento nominativo e integração clínica. |
| A oferta/modalidade de carreta está pactuada para município específico? | Referência não garante oferta; documentos não identificam piloto operacional. | G0, escopo e cronograma. |
| Quais especialidades/procedimentos, prestador, responsável técnico e capacidade existem? | Dados locais estão em branco na referência. | Template e planejamento; não pode ser preenchido por suposição. |
| Quem pode aprovar G0–G4 e suspender operação? | Matriz descreve funções ilustrativas; autoridade competente varia por pacto e norma local. | Autorização, workflow, alertas e critério de encerramento. |
| Quais critérios de prontidão, documentos e requisitos sanitários se aplicam à modalidade real? | A referência exige validação local e cita normas/fontes sem substituir análise competente. | Gate G1/G2 e aceite do template. |
| Quais indicadores têm dados disponíveis, denominadores e linha de base? | Os 18% são um dado relatado e não auditado; não há série completa ou dados locais do piloto. | Catálogo, dashboard, avaliação de efeito e metas. |
| Qual orçamento, fonte, pagador e instrumentos de financiamento serão usados? | A referência explicitamente não traz orçamento local nem custo padrão. | Registro financeiro e G1/G4. |
| Materiais (óculos) estão incluídos no caso do município-piloto? | O relato menciona distribuição, mas não comprova cadeia de entrega individual nem define que o município atual fará isso. | Modelo de estoque/custódia e indicador de entrega. |
| SMTP e API Oficial do WhatsApp: qual provedor, credenciais, consentimento, templates e política de falhas? | Integrações são apenas previstas e adaptadores estão como stub. | Fase 2, segurança e custos. |
| Qual provedor de IA pode receber dados e qual a política de retenção/uso? | Não há LLM conectado; modelo/contrato não foram definidos. | Fase 3, risco e arquitetura de dados. |
| Qual será o estado efetivo das migrações e variáveis de banco por ambiente? | Repo tem PostgreSQL no schema e legado MySQL separado, docs/env inconsistentes; não foi confirmada a migração de todos os ambientes. | Deploy, dados, testes e rollback. |

## 11. Referências examinadas

### Insumos

- `documento atualizado.docx` — dossiê CIP V3, 10/11/2026; partes I–IV; inclui Documento Mestre, Caderno de Testes, atlas e registro de interações. O próprio dossiê afirma que os pilotos são conceituais e não homologados e que o relatório REV04 não foi fornecido separadamente.
- `Projeto_Referencia_Municipal_Carretas_Saude_SUS_V2_0_Controle_Riscos.docx` — versão 2.0, 10/11/2026; §§1–21 e anexos A–F.

### Código/documentação da plataforma

- `packages/db/prisma/schema.prisma` — entidades, relacionamentos, estado atual do schema.
- `packages/db/prisma/migrations/` e `packages/db/prisma/migrations-mysql-legacy/` — baseline PostgreSQL atual e legado MySQL separado; não confirmam isoladamente o estado remoto aplicado.
- `packages/shared/src/status.ts` e `packages/shared/src/roles.ts` — classificações/status e papéis/permissões.
- `packages/shared/src/wizard-engine.ts` e `packages/shared/src/catalog/condicoes-estruturante.ts` — campos condicionais, grupos e avaliação de wizard.
- `apps/web/src/app/(app)/minha-pasta/novo/novo-projeto-wizard.tsx` — wizard e confirmação atual.
- `apps/api/src/routes/wizard.ts`, `apps/api/src/services/wizard-persist.ts` — preview, confirmação, persistência de respostas/árvore.
- `apps/api/src/routes/planejamento.ts` — planos, metas, indicadores e medições.
- `apps/api/src/routes/reports.ts` — relatórios executivos e prestação de contas existente.
- `apps/api/src/services/notifications.ts` — notificações internas e stubs SMTP/WhatsApp.
- `apps/api/src/services/sugestoes.ts` — provedor heurístico de indicadores/tarefas.
- `apps/api/src/services/audit.ts` — gravação de trilha de auditoria.
- `docs/arquitetura.md`, `docs/fluxo-operacional.md`, `docs/piloto-cmd-importacao.md`, `GLOSSARY.md` — documentação existente; arquitetura/banco e orientações de migração precisam ser reconciliados com o schema atual antes de orientar implantação.

## 12. Aprovação necessária

Este entregável **não altera código, banco, migrações, deployments ou registros existentes**. A implementação só deve começar após aprovação explícita do plano e do backlog acima, além das decisões abertas que bloqueiam modelagem de dados, autorização e integração. Em especial, o piloto Saúde deve permanecer sem registro de pacientes, prontuário ou dados clínicos até definição formal de escopo e controles.
