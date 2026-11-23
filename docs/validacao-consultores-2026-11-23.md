# Validação dos cadastros para consultores — 23/11/2026

Ambiente: Prefeitura Demonstração CIP, no site de produção. Perfil: Consultor (`analista` na API). A autenticação foi feita pela tela normal com as credenciais fornecidas. Nenhuma credencial foi incluída neste relatório ou no código.

Os registros criados para esta verificação estão identificados com `[TESTE QA]`. Foram usados dados fictícios, sem alterar os projetos de outros consultores.

## Cadastros concluídos no navegador

| Fluxo | Resultado e registro |
| --- | --- |
| Meta estratégica | Criada `[TESTE QA] Ampliar o acesso à educação infantil`, com plano, secretaria, descrição, valor base, alvo e unidade. |
| Indicador | Criado `[TESTE QA] Vagas de educação infantil disponíveis`, com unidade, linha de base decimal, alvo, periodicidade, fonte, polaridade e responsável pela medição. |
| Projeto estruturante | Criado com código `QA-20261123-EST`: [abrir](https://cip-painel-web.vercel.app/iniciativas/cmwt8rblv0007k607zj86s8hh?aba=andamento). |
| Projeto prioritário | Criado [Oficinas educativas](https://cip-painel-web.vercel.app/iniciativas/cmwt8vhtq0001l608uz6bhqa2?aba=andamento), com geração automática do código e prazo opcional em branco. |
| Plano de Governo | Criado [Acesso à cultura](https://cip-painel-web.vercel.app/iniciativas/cmwt8yi5d000bl508rxipymfm?aba=andamento), incluindo nova meta e novo plano no mesmo cadastro. |
| Ação Diária | Criada [Reparar iluminação](https://cip-painel-web.vercel.app/iniciativas/cmwt90yio001fl5080uefwl6k?aba=andamento), vinculada à nova meta. |
| Tarefa no gerenciador | Criada `[TESTE QA] Conferir iluminação após reparo`, atribuída ao consultor, com prazo em 20/01/2027 e vínculo com a Ação Diária. |
| Subtarefa no gerenciador | Criada `[TESTE QA] Registrar conferência final`, vinculada à tarefa anterior, com responsável e prazo em 19/01/2027. |

## Campos e comportamentos verificados

| Área | Campos e verificações |
| --- | --- |
| Acesso | Login com conta de consultor; navegação e acesso aos cadastros sem perfil de administrador. |
| Meta | Plano, nome, secretaria, descrição, valor base, alvo e unidade; obrigatoriedade das seleções; criação antes do projeto. |
| Indicador | Nome, unidade, linha de base com vírgula decimal, alvo, periodicidade, fonte, polaridade e responsável. |
| Identidade dos projetos | Nome, secretaria principal, secretarias correlacionadas, código informado ou automático, descrição do problema/compromisso/necessidade, entrega, público e fora de escopo quando disponíveis. |
| Responsável | Seleção de pessoa existente e cadastro de nova pessoa com nome, cargo, telefone e e-mail; rejeição de e-mail inválido. |
| Vínculo estratégico | Seleção da meta existente; nova meta no assistente; plano existente ou novo plano; relação exibida no projeto salvo. |
| Condições comuns | Licitação, orçamento, imóvel/desapropriação, autorização e outro impedimento; Sim, Não e Não se aplica; situação pendente/atendida, fundamento, próxima providência e responsável. |
| Detalhes condicionais | Objeto da contratação, valor, fonte, endereço/matrícula, descrição de impedimento e licenças. |
| Estruturante e prioritário | Situação do imóvel, projeto técnico, licenças, custeio, risco imediato e prazo crítico; tarefas condicionais geradas. |
| Itens personalizados | Tipo, nome, descrição, condição que impede o avanço da execução, aplicabilidade, fundamento, providência e responsável; cadastro do projeto permitido com pendências. |
| Plano de Governo | Recurso previsto, valor, fonte, emenda/convênio, número do instrumento, próximo marco, origem do prazo, documento e dias restantes. |
| Ação Diária | Atendimento afetado, serviço afetado, estimativa de pessoas, prazo externo e próxima providência; providência convertida em tarefa. |
| Tarefas no assistente | Inclusão e remoção, nome, responsável e prazo; subtarefa com nome, responsável e prazo; rejeição de escopo sem tarefas; dados mantidos ao revisar a prévia. |
| Gerenciador de tarefas | Tipo tarefa/subtarefa, projeto, tarefa principal, descrição, responsável e prazo; campos obrigatórios; tarefa e subtarefa persistidas. |
| Rascunho e prévia | Salvamento automático sinalizado, retorno às etapas para edição e confirmação dos dados antes de gravar. |
| Celular | Fluxos prioritário, Plano de Governo e Ação Diária e gerenciador verificados em 390 × 844; largura do documento igual à viewport, sem rolagem horizontal nas telas verificadas. |

## Correções desta revisão

1. O orçamento negativo era sinalizado pelo campo, mas o botão Continuar permitia avançar. O assistente agora verifica a validade dos controles da etapa e apresenta o campo e a mensagem correspondentes.
2. A API agora rejeita números negativos, texto em campos numéricos e quantidades fracionadas nos campos inteiros, tanto na prévia quanto na confirmação. Campos opcionais continuam opcionais; detalhes ocultos após mudar a resposta não bloqueiam o cadastro.
3. Nomes com apenas espaços são rejeitados nos cadastros de planos, metas, projetos, responsáveis, tarefas e subtarefas. Os nomes de tarefas e subtarefas exigem o mesmo mínimo de três caracteres no assistente e nos cadastros posteriores. Mensagens indicam o que precisa ser corrigido.

## Verificação automatizada

- API: 300 testes aprovados; 1 integração opcional ignorada. Inclui testes HTTP com perfil de consultor, dados simulados, os quatro tipos de projeto, orçamento inválido, nomes, código e contato inválidos, isolamento municipal e modelo ausente.
- Compartilhado: 55 testes aprovados, incluindo números opcionais, zero, centavos, valores inválidos, quantidades inteiras e detalhes ocultos.
- Interface: 98 testes aprovados.
- Build completo, verificação de tipos da API e lint da interface aprovados.

Os testes automatizados de erro usam persistência simulada; os cadastros positivos acima foram gravados e conferidos no navegador. A verificação cobre os campos e os percursos descritos, sem afirmar que todas as combinações possíveis de respostas foram executadas manualmente. Não foram testados disparos de mensagens externas, anexos ou aprovação de entregas, que não fazem parte das três etapas solicitadas.
