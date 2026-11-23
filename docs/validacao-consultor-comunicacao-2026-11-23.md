# Validação do consultor e da comunicação — 23/11/2026

A revisão usa o conteúdo exato preparado para publicação, isolado das demais alterações locais em desenvolvimento. O novo perfil de funcionário e as alterações da administração central não fazem parte desta publicação.

## Fluxos cobertos

- Login, seleção de prefeitura e permissões atuais revalidadas no servidor.
- Criação de metas, vínculo estratégico, indicadores, quatro classificações de projetos e responsável.
- Tarefas e subtarefas: criação, atribuição, prazos, histórico, conclusão, reabertura, pré-requisitos e isolamento municipal.
- Consulta e exportação de relatórios, base de conhecimento, evidências e aprovações pelos testes existentes.
- Chat: destinatários ativos com acesso ao projeto; consultor e secretário podem responder; prefeito e leitura consultam; texto obrigatório e limitado; auditoria do envio; repetição e concorrência sem duplicar a mensagem.
- Avisos: mensagens recebidas e notificações de execução na mesma central; contagem de não lidos; leitura individual e idempotente; acesso revogado não revela conteúdo; leitura não conclui tarefas nem decisões.
- Paginação: histórico anterior e avisos com cursor estável, incluindo datas empatadas e fontes distintas.

## Correções publicadas nesta revisão

- Permissão específica para responder à conversa, sem liberar edição do projeto à secretaria.
- Destinatários limitados às pessoas ativas que podem abrir o projeto; o envio não concede acesso.
- Central de comunicação e contador únicos para mensagens e notificações, incluindo atualização após leitura e ao retornar à janela.
- Falhas ao enviar ou registrar leitura aparecem para o usuário; o estado de leitura só muda após confirmação do servidor.
- Repetição do mesmo envio usa chave idempotente e preserva uma única mensagem e auditoria.
- O histórico deixa de depender de um limite fixo dos últimos registros e permite carregar páginas anteriores.
- Respostas antigas de atualização do contador não sobrescrevem uma contagem mais recente.
- Links de avisos aceitam somente caminhos internos, recusando URLs externas, barras invertidas e caracteres de controle.
- Uma falha ao carregar a próxima página de projetos preserva os resultados já carregados.

## Evidências

- Testes HTTP da API no conteúdo preparado: 293 aprovados; integração PostgreSQL opcional executada separadamente.
- Interface: 99 testes aprovados.
- Banco real descartável: teste de conversa de ida e volta, cinco envios concorrentes com a mesma chave, uma única auditoria, leitura concorrente e revogação após trocar a secretaria. Aprovado, sem usar dados de produção.
- Build de banco, compartilhado e API aprovados. Build da interface com Webpack aprovado; esse compilador foi usado porque o Turbopack impede dependências externas vinculadas na cópia temporária.

Não foram enviadas mensagens a pessoas reais durante a validação. E-mail e WhatsApp externos não integram o envio interno desta publicação.
