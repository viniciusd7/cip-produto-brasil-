# Documento de validação — IA nativa na plataforma CIP

**Data:** 13/11/2026  
**Situação:** proposta para validação de produto, tecnologia e proteção de dados. Não representa uma funcionalidade de IA generativa já entregue.  
**Objetivo:** definir o que é necessário para disponibilizar assistência de IA dentro do próprio sistema, nas jornadas dos usuários da CIP e das prefeituras.

## 1. O que significa IA nativa neste documento

O usuário acessa recursos de IA pelas telas da plataforma, utilizando seu login, suas permissões e o contexto da prefeitura. Ele não precisa acessar um chatbot ou sistema separado. A IA auxilia na elaboração e na análise; a decisão e a aprovação continuam sendo humanas.

**IA integrada à plataforma não significa necessariamente modelo hospedado pela CIP.** O processamento pode ocorrer por uma API contratada ou, alternativamente, por um modelo hospedado em infraestrutura controlada pela CIP. A escolha depende de custo, proteção de dados, qualidade, capacidade técnica e contrato. Não há fornecedor aprovado nesta proposta.

## 2. Situação identificada no projeto

- As telas já apresentam sugestões de tarefas e indicadores, com opções de aceitar ou descartar. A geração existente, entretanto, usa regras e textos pré-definidos, **não um modelo generativo**. Referências: [serviço de sugestões](../apps/api/src/services/sugestoes.ts) e [rota de planejamento](../apps/api/src/routes/planejamento.ts).
- Há um contrato `SuggestionProvider` que pode orientar a integração com outro provedor, mas é necessário implementar e validar a integração real.
- Existe registro de sugestões e decisões no modelo de dados. Isso é uma base para revisão humana, mas não comprova que toda a proveniência necessária para IA já esteja implementada. Referência: [schema Prisma](../packages/db/prisma/schema.prisma).
- A [base de conhecimento](./base-conhecimento.md) aceita PDF e DOCX, guarda o original e extrai texto. **A extração não significa que os documentos já sejam pesquisados ou usados automaticamente por IA.** PDFs digitalizados sem texto não recebem OCR.
- O upload da base de conhecimento é limitado a 4 MB pela implementação atual. Armazenamento remoto, bucket, configuração e migration precisam ser verificados no ambiente de destino.
- A `main` e o ambiente local apresentam diferenças relevantes de dependências e banco. Antes de publicar o recurso, estabilizar uma versão reproduzível e reconciliar o histórico de migrations com o Supabase, preservando o histórico existente.

Esta avaliação se baseia nos arquivos examinados, não em testes no fornecedor de IA, nas contas dos provedores ou com usuários reais.

## 3. Escopo proposto para a primeira validação

Recomendação para um piloto controlado, a ser aprovado pela CIP:

1. **Sugerir tarefas e indicadores:** usar a meta, a secretaria e dados autorizados para propor opções; exibir sugestões para revisão e manter aceite ou descarte individual.
2. **Consultar documentos autorizados:** responder perguntas sobre os documentos de uma prefeitura, mostrando a fonte e o trecho utilizado. Se não houver evidência suficiente, informar a limitação em vez de inventar uma resposta.
3. **Manter o usuário no controle:** conteúdo sugerido não altera metas, projetos, aprovações ou registros oficiais até que uma pessoa autorizada confirme.

Sugestões de riscos, justificativas, vínculos e relatórios podem ser avaliadas em etapas posteriores. Chat geral, consultas à internet, integração com sistemas externos, decisões automáticas e alteração autônoma de dados **não fazem parte do piloto proposto**.

## 4. O que será necessário

### 4.1 Serviço de IA e contratação

- Selecionar um fornecedor/modelo compatível com português e com os casos de uso. Avaliar qualidade, latência, disponibilidade, limites e custo com amostras autorizadas.
- Formalizar condições de uso de dados: finalidade, retenção de prompts e respostas, uso ou não para treinamento, suboperadores, região de processamento, exclusão e tratamento de incidentes. Não presumir que um serviço seja adequado à LGPD sem análise contratual e jurídica.
- Criar conta, credencial e limites de gastos por ambiente; guardar a chave exclusivamente no backend ou no gerenciador de segredos. Nunca incluí-la no código ou em variáveis públicas do frontend.
- Definir responsável pelo fornecedor, orçamento mensal, tratamento de indisponibilidade, atualização de modelo e procedimento de interrupção.

**Alternativa de modelo próprio:** exige servidores com capacidade adequada ao modelo e à demanda, possivelmente GPU, operação de inferência, atualizações de segurança, monitoramento e testes de desempenho. Evita depender da API externa para inferência, mas não elimina custos, riscos ou responsabilidades. O dimensionamento depende do modelo e da carga; não há dados para recomendar hardware agora.

### 4.2 Integração no sistema

- Implementar no backend um adaptador para o provedor escolhido, aproveitando o contrato existente quando apropriado. Configurar modelo, credenciais, timeout e limites sem expor segredos ao navegador.
- Enviar somente o contexto necessário, após autenticar o usuário e conferir permissões de prefeitura, secretaria e recurso. A API deve impor as mesmas regras também nas buscas e na aplicação de sugestões.
- Definir prompts versionados e saídas estruturadas; validar campos, tamanho e formato antes de salvar ou apresentar sugestões. Tratar respostas inválidas, recusas, lentidão e indisponibilidade com mensagens claras.
- Registrar a origem de cada sugestão: identificação e versão de modelo e prompt, data, fontes utilizadas, usuário, prefeitura e decisão humana, conforme política de retenção aprovada. Não apresentar uma pontuação de confiança como garantia de veracidade.
- Controlar quantidade de requisições e consumo por usuário e prefeitura, com alertas e limites de orçamento. Exibir que o resultado é uma sugestão e pode conter erros.
- Ativar o recurso primeiro em homologação e para prefeituras selecionadas, com possibilidade de desativação. Caso se mantenha a heurística atual, identificá-la claramente, sem apresentá-la como modelo generativo.

### 4.3 Conhecimento e documentos

Para consultas baseadas nos arquivos, implementar um fluxo adicional:

1. Receber documentos autorizados, classificar prefeitura, acesso, versão e situação de conferência.
2. Extrair texto; quando necessário, avaliar OCR separadamente para arquivos digitalizados.
3. Preparar trechos com referência ao documento e à localização disponível, respeitando a versão e as permissões.
4. Pesquisar **somente** os trechos autorizados para o usuário e a prefeitura, fornecer contexto mínimo ao modelo e apresentar referências verificáveis na resposta.
5. Ao atualizar, desautorizar ou excluir um documento, atualizar ou remover seus trechos e índices associados, conforme política de retenção.

Para um piloto pequeno, pesquisa textual pode ser suficiente. Se a qualidade ou o volume exigir busca semântica, avaliar embeddings e índice vetorial, inclusive no PostgreSQL/Supabase quando compatível com a arquitetura aprovada. **Embeddings, banco vetorial e OCR são opções a avaliar, não requisitos obrigatórios para toda IA nem funcionalidades já existentes.**

### 4.4 Infraestrutura e operação

- Web e API operacionais; banco PostgreSQL/Supabase e armazenamento de documentos configurados para cada ambiente. Não é necessário um novo container apenas para consumir uma API de IA.
- Ambientes de desenvolvimento, homologação e produção isolados; usar dados fictícios ou autorizados no piloto.
- Armazenamento durável e privado para documentos e evidências; a persistência de evidências em disco local da API precisa ser resolvida antes de depender dela em execução serverless.
- Logs e métricas de chamadas, tempo de resposta, erros, uso e custo, evitando registrar conteúdo sensível desnecessário. Definir alerta, suporte e procedimento para desativar o recurso.
- Backups testados do banco e dos objetos separadamente, além de política de retenção e exclusão. A disponibilidade e o plano contratado devem ser confirmados com os provedores.

### 4.5 Proteção de dados e governança

- Definir responsáveis da CIP e das prefeituras, bases legais aplicáveis, finalidade, classificação dos documentos, prazo de retenção e eventual transferência internacional, com avaliação jurídica adequada.
- Minimizar e, quando possível, anonimizar dados enviados. **Não enviar dados de saúde identificáveis ou outros dados pessoais sensíveis a um provedor externo sem avaliação e autorização específicas.**
- Tratar texto de documentos como conteúdo não confiável: instruções encontradas em arquivos não devem alterar as regras do sistema, liberar acesso ou executar ações.
- Testar isolamento entre municípios e permissões por perfil, inclusive nos trechos pesquisados, respostas, histórico, logs e sugestões aceitas.
- Documentar quem pode gerar, ler, aceitar e descartar sugestões, e manter auditoria das decisões humanas sem registrar segredos ou informações desnecessárias.

## 5. Roteiro de validação e aceite

Os critérios abaixo são **propostos**; responsáveis e metas numéricas precisam ser acordados antes do piloto.

- [ ] **Produto:** CIP aprova casos de uso, perfis, limites, mensagens e o que a IA não pode fazer.
- [ ] **Fornecedor:** responsável técnico e jurídico aprovam contrato, segurança, retenção, local de processamento e orçamento; credenciais ficam no servidor.
- [ ] **Versão e banco:** build e testes passam em uma versão reproduzível; migrations e estado do Supabase são reconciliados e testados sem apagar o histórico.
- [ ] **Segurança:** testes com dois municípios e perfis distintos demonstram ausência de acesso ou citação de dados não autorizados, inclusive quando solicitado explicitamente.
- [ ] **Documentos:** em homologação, anexar PDF e DOCX autorizados, consultar uma informação presente e verificar a fonte e o trecho. Testar documento sem texto, documento excluído e pergunta sem resposta nos arquivos.
- [ ] **Sugestões:** gerar tarefas e indicadores coerentes com exemplos municipais; testar aceitar, descartar, permissões e persistência. Nenhuma alteração oficial ocorre antes da confirmação.
- [ ] **Robustez:** simular resposta incorreta ou inválida, timeout, indisponibilidade e limite de uso; o usuário recebe aviso claro e não há publicação automática.
- [ ] **Qualidade:** equipe municipal avalia um conjunto documentado de perguntas e sugestões, incluindo respostas sem fonte, informações divergentes e tentativas de instrução maliciosa em documento. Definir antes do teste os percentuais mínimos de correção, citação e isolamento.
- [ ] **Operação:** medir latência e custo com volume representativo; confirmar alertas, limites, backups e plano de desligamento. Metas de tempo e custo devem ser aprovadas conforme a demanda.
- [ ] **Homologação:** consultor e representante da prefeitura registram aceite ou pendências; liberar produção apenas após fechamento dos critérios acordados.

## 6. Informações necessárias para dimensionamento e orçamento

Antes de contratar ou escolher entre API e infraestrutura própria, levantar:

- Quantas prefeituras, usuários habilitados e usuários simultâneos participarão.
- Quantas sugestões e perguntas por usuário/mês são esperadas, e quais telas terão IA.
- Quantidade, tamanho e crescimento dos documentos; proporção de PDFs digitalizados e necessidade de OCR.
- Categorias de dados permitidas, onde os dados podem ser processados e por quanto tempo podem ser retidos.
- Disponibilidade desejada, tempo máximo aceitável de resposta, horário de suporte e orçamento mensal.
- Quantas respostas serão revisadas por especialistas e qual taxa mínima de qualidade será exigida.

O custo dependerá, entre outros fatores, de chamadas, volume de entrada e saída do modelo, processamento de documentos, eventual indexação, armazenamento e operação. **Não há dados suficientes neste levantamento para estimar valores.**

## 7. Decisões para aprovação

1. Aprovar ou ajustar os dois casos de uso do piloto e as prefeituras participantes.
2. Escolher entre modelo via API contratada e modelo hospedado pela CIP, após avaliação comparativa.
3. Definir quais documentos e dados poderão ser utilizados, responsabilidades e política de retenção.
4. Definir orçamento, limites por prefeitura e critérios mensuráveis de qualidade.
5. Designar responsáveis por produto, tecnologia, proteção de dados e homologação.

**Resultado esperado da validação:** uma decisão documentada sobre escopo, fornecedor, dados e critérios de aceite. Este documento não provisiona serviços, não altera dados e não autoriza produção automaticamente.
