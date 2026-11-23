# Validacao do secretario — 23/11/2026

Revisao do perfil `gestor` sobre o conteudo exato preparado para publicacao. Alteracoes locais de outros trabalhos ficaram fora desta entrega.

## Correcoes

- A pagina de tarefas apresenta as acoes do secretario: evidencia, reprogramacao e solicitacao de conclusao, com orientacao adequada ao perfil.
- Subtarefas de uma tarefa concluida ou encerrada nao aceitam novos pedidos de conclusao.
- A evidencia selecionada deve pertencer a tarefa ou ser uma evidencia geral do mesmo projeto.
- Pedidos simultaneos de conclusao sao protegidos por transacao serializavel; conflitos retornam 409 para atualizar a pagina.
- Um pedido antigo nao pode ser aprovado se o item ja foi encerrado. A devolucao para revisao permanece disponivel.
- Novos arquivos de evidencia usam o armazenamento privado Supabase ja utilizado pela base de conhecimento. O download exige autenticacao e acesso ao projeto. Arquivos locais antigos mantem o caminho de leitura anterior.
- Se o registro da evidencia falhar, o arquivo enviado e removido do armazenamento.

## Validacao executada

- API: 303 testes aprovados, zero falhas; duas integracoes opcionais ignoradas na suite comum.
- Integracao especifica do secretario executada separadamente com PostgreSQL real descartavel: aprovada. Cinco pedidos concorrentes produziram uma unica solicitacao. Reprogramacao preservou o prazo original; devolucao, novo pedido e aprovacao atualizaram tarefa, subtarefa e notificacoes.
- Interface: 100 testes aprovados, incluindo acoes do secretario e ausencia de comandos administrativos.
- Build e verificacao de tipos da API aprovados. Build Webpack e lint da interface aprovados. Webpack foi usado na copia temporaria por causa das dependencias vinculadas fora da pasta.
- Login normal com conta ficticia local e 11 consultas autenticadas: resumo da pasta, agenda, cenario, metas, projetos, base de conhecimento, contador, avisos, projetos da conversa, destinatarios e historico. Todas responderam 200; o projeto de outra secretaria ficou fora da lista de conversas.
- Navegador em 390 x 844: reprogramacao com justificativa e solicitacao de conclusao realizadas. Novo prazo e estado aguardando validacao confirmados; largura do documento igual a largura da tela, sem rolagem horizontal.
- Testes HTTP verificaram upload multipart, leitura privada, limpeza de arquivo apos erro, bloqueio fora da pasta e ausencia de permissao para o secretario aprovar pedidos, concluir diretamente ou criar projetos.
- Chat e avisos tambem passam pela suite existente, com isolamento de destinatarios, leitura, idempotencia e revogacao de acesso.

## Limites da verificacao

Os testes operacionais do secretario usaram conta ficticia e banco local isolado, sem mensagens para pessoas reais. Nao foi utilizada uma senha de secretario de producao. O teste de armazenamento da suite simula o Supabase; a confirmacao do envio e download reais na Vercel deve ocorrer apos a publicacao. Arquivos antigos ja perdidos em disco efemero nao sao recuperados por esta alteracao. Nao foi validado upload de arquivos grandes em producao.
