# QA ECC — fluxo de criação de projetos

Data: 18/11/2026. Escopo: cadastro de projetos estruturantes, prioritários,
planos de governo e ações diárias, incluindo navegação, rascunho, condições,
responsáveis, tarefas, prévia e confirmação.

## Método e limites

Aplicadas as rotinas ECC `browser-qa`, `click-path-audit` e `verification-loop`.
O conector Chrome DevTools do ECC não iniciou porque seu perfil estava ocupado;
a interação visual usou a conexão disponível do Chrome.

O navegador executou o componente real `NovoProjetoWizard`, seus componentes
filhos, CSS e motor compartilhado em uma página temporária local, com pessoas,
secretarias e metas fictícias. Equipe e confirmação foram simuladas em memória;
a prévia usou `evaluateWizard`. Nenhum cadastro dessa página foi gravado no banco.
A persistência e as regras das rotas foram verificadas pelos testes da API, com
Prisma simulado. Isso não substitui um teste integrado autenticado contra um
banco de homologação.

## Defeitos corrigidos

1. Mudança de etapa mantinha a rolagem no fim da página. O cabeçalho recebe foco
   e rolagem após renderizar a etapa, com margem para a barra fixa no celular e
   respeito à preferência de movimento reduzido.
2. Dois cliques em Continuar durante a prévia disparavam duas requisições e
   pulavam Tarefas. Operações possuem trava imediata e estado de carregamento;
   campos e navegação ficam desabilitados durante o processamento. A confirmação
   também possui a trava.
3. A prévia regenerava tarefas removidas pelo usuário. Seu cálculo agora mantém
   as edições do escopo ao sair de Tarefas.
4. Tarefas vazias e nomes de subtarefas inválidos só eram rejeitados na confirmação.
   A validação ocorre antes de entrar na prévia.
5. Nome e código curtos, nome/cargo do novo responsável curtos e e-mail inválido
   podiam avançar até a rejeição pela API. O cadastro verifica esses dados na
   identificação.
6. Status e contadores da prévia recebiam o estilo dos círculos de numeração.
   O seletor foi limitado ao número, corrigindo o texto vertical no celular.

Foram preservados e incluídos os demais ajustes locais do fluxo: identificação
dos responsáveis por projeto/tarefa/subtarefa, nome Modelagem, tipo dos itens
personalizados no snapshot, resumo desses itens e validação do rascunho.

## Verificações no navegador

| Cenário | Resultado |
| --- | --- |
| Estruturante: identidade → modelagem → após a entrega → urgência → tarefas → prévia → confirmação | Aprovado com dados fictícios |
| Prioritário: todas as etapas e confirmação | Aprovado com dados fictícios |
| Plano de governo: todas as etapas e confirmação | Aprovado com dados fictícios |
| Ação diária: todas as etapas e confirmação | Aprovado com dados fictícios |
| Campos obrigatórios e nome curto | Bloqueio com mensagem |
| Pré-requisito personalizado vazio, depois preenchido e bloqueante | Validação e resumo corretos |
| Inclusão de tarefa e subtarefa; subtarefa sem nome | Edição preservada e avanço inválido bloqueado |
| Remoção de tarefa gerada; prévia e retorno a Tarefas | Tarefa removida não reaparece |
| Clique duplo durante prévia | Sem salto para a etapa seguinte a Tarefas |
| Clique duplo na confirmação | Uma requisição de confirmação |
| Recarregar e recuperar rascunho | Progresso e tarefas recuperados |
| Erro ao carregar equipe; tentar novamente; equipe vazia | Recuperação e cadastro do responsável disponíveis |
| E-mail inválido do novo responsável | Rejeitado antes de avançar |
| Criar meta, plano e responsável no mesmo cadastro | Dados corretos enviados à confirmação simulada |
| Erro de prévia e nova tentativa | Mantém etapa, exibe erro, libera controles e permite concluir |
| Telas de 375, 768 e 1440 px | Sem overflow horizontal nos pontos verificados |
| Rolagem final em 375 px | Cabeçalho a 80 px do topo, abaixo da barra de 56 px |
| Console durante os percursos isolados | Nenhum erro ou aviso registrado |

O foco no cabeçalho e o nome acessível da etapa foram conferidos. Não foi
executada uma auditoria axe completa nem uma avaliação manual de leitor de tela.
Regressão visual: **INCONCLUSIVE**, pois não existe baseline de screenshots para
comparação. Inspeção responsiva atual: aprovada nos pontos descritos. Core Web
Vitals de produção não foram medidos no ambiente simulado.

## Validação do repositório

| Verificação | Resultado |
| --- | --- |
| `pnpm build` e build web após os últimos ajustes | Aprovados |
| `pnpm typecheck` | Aprovado |
| `pnpm lint` | Aprovado nas regras configuradas; API e pacotes não possuem lint próprio |
| `pnpm test` | 375 testes: 373 aprovados, 2 ignorados, 0 falhas |
| `git diff --check` | Aprovado |
| Inspeção das linhas adicionadas: credenciais/chaves, logs de debug e supressões TypeScript | Nenhuma ocorrência |

Distribuição: shared 47/47; web 62/62; API 257/257; banco 7 aprovados e 2
ignorados. Os dois testes de integração de banco exigem uma configuração de
teste separada. Cobertura percentual não foi medida. Permanecem os avisos de
depreciação já existentes da configuração Prisma e da convenção middleware.

**Parecer:** correções aprovadas no escopo verificado para versionamento.
Homologação integrada, métricas de produção e comparação visual com baseline
permanecem fora da evidência desta execução.

## Revisão de clareza da prévia

Após a revisão de usabilidade, a prévia foi reorganizada em dados do projeto,
pendências informadas e tarefas com responsáveis e prazos. Foram retirados dessa
tela o percentual de prontidão, a prioridade calculada, as frações por grupo e
os avisos automáticos sobre sequência de etapas. Os cálculos da API permanecem
inalterados. Respostas obrigatórias ausentes e pré-requisitos bloqueantes
continuam sinalizados com orientação de revisão.

Foram adicionados atalhos para editar dados, condições e tarefas. A verificação
no navegador isolado confirmou que os atalhos preservam o preenchimento e que
a nova composição não excede a largura de 375 e 1440 px. As pendências mostram
a providência e o responsável informados; itens atendidos ficam em uma lista
recolhível. Nenhum erro ou aviso foi registrado no console durante a verificação.

Validação desta revisão: build web, tipos, lint dos arquivos alterados e os 67
testes web aprovados, incluindo cinco cenários novos de apresentação da prévia.
As mesmas limitações de ambiente simulado e ausência de baseline visual continuam
aplicáveis.

## Apresentação de metas e indicadores dentro do projeto

A aba Metas e indicadores passou a destacar o objetivo estratégico e sua
descrição. Cada indicador apresenta ponto de partida, valor atual informado,
resultado esperado, unidade e frequência prevista de atualização em campos
separados. A visão geral do projeto direciona para os indicadores vinculados,
sem repetir campos legados vazios como se fossem resultados atuais.

Não foram criados percentuais de progresso ou classificações automáticas: há
indicadores cujo objetivo é diminuir o valor, e os campos também aceitam texto.
Zero continua sendo um valor válido; campos vazios aparecem como não informados.
Unidades já escritas no valor não são duplicadas, e a frequência descritiva é
preservada. Os formulários de cadastro ficam separados da consulta e impedem
envios simultâneos.

Verificação no navegador com respostas simuladas: larguras de 375, 768 e 1440 px
sem overflow horizontal; cadastro de indicador com uma única requisição no
clique duplo; erro de carga e nova tentativa; erro ao salvar com preenchimento
preservado; cadastro de meta em projeto sem vínculo; modo leitura sem formulário;
ausência de valor atual sem substituição por zero. Console sem erros ou avisos.

Build web, tipos, lint dos arquivos alterados e 72 testes web aprovados. Seis
testes de indicadores cobrem valores informados, zero, ausência de dados,
unidades, texto livre, frequência, metas de redução e identificação do objetivo.
Nenhum banco foi alterado pela verificação visual; as limitações de homologação
integrada e de baseline visual descritas acima continuam aplicáveis.

## Visão de metas e indicadores do prefeito

A aba Resultados do painel do prefeito passou a se chamar Metas e indicadores.
A consulta apresenta uma meta por bloco, com a secretaria responsável, o
resultado registrado, o valor previsto para a data da medição, a data de
referência e a fonte. A medição anterior e os indicadores associados podem ser
abertos sob demanda. Os projetos vinculados possuem links para sua aba de metas.

Foram adicionados busca por meta, secretaria, projeto ou indicador e filtros por
existência de medição. Valores apenas cadastrados em indicadores permanecem
identificados separadamente de uma medição datada da meta. Não há classificação
automática a partir do desvio, percentual presumido nem troca de ausência por
zero. O mesmo componente atende a visão da secretaria; blocos de resultados de
projetos sem dados deixam de aparecer.

No navegador, o painel completo foi montado com dados fictícios para conferir
a troca de aba, os filtros, a busca sem acentos, a combinação sem resultados e a
limpeza dos filtros. Foram verificados a medição anterior, a abertura dos
indicadores, os destinos dos links e o contexto de secretaria. As larguras de
375, 768 e 1440 px não apresentaram overflow horizontal. No celular, as duas
colunas de valores mantiveram o alinhamento vertical. Console sem erros ou avisos.

Validação no checkout: build web, tipos, lint dos componentes alterados e 77
testes web aprovados. Quatro novos testes do painel cobrem zero, unidades,
indicadores de redução, ausência de medição, contexto da secretaria e estado
vazio. Permanecem as limitações de dados simulados e de comparação visual sem
baseline desta execução.
