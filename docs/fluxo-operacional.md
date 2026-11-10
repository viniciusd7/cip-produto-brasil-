# Fluxo operacional municipal

A navegação principal de projetos segue secretaria → pasta do projeto → metas de execução → tarefas → subtarefas. A referência funcional é o README do repositório viniciusd7/cip-projeto: pastas estruturantes e ações do dia a dia.

## Cadastro

Escolher o tipo, registrar a entrega e responsável, responder condições aplicáveis e organizar o escopo. Compromissos do plano podem selecionar uma meta estratégica existente ou criar meta e plano no próprio assistente. Esses registros só são gravados na confirmação, na mesma transação do projeto.

A meta estratégica representa o compromisso do governo; as metas de execução organizam as entregas dentro da pasta do projeto. O cadastro inicial não pede previsão de atraso. O primeiro prazo é definido na tarefa; mudanças posteriores são reprogramações.

## Prazos

Uma tarefa sem prazo permite definir o prazo inicial. Uma tarefa aberta com prazo permite reprogramar, informando data futura diferente da atual e motivo/providência. O prazo original nunca é substituído. A alteração e o aviso são gravados na mesma transação. Alterações simultâneas geram conflito em vez de sobrescrever o prazo de outra pessoa. O histórico fica disponível inclusive para consulta do prefeito.

## Comunicação interna

Avisos e conversas têm caixa de entrada, contador de não lidos, confirmação de leitura e registro na pasta do projeto. Secretários e analistas podem enviar orientações a usuários ativos do mesmo município e responder pelo projeto.

Reprogramação, definição de prazo, evidência enviada e bloqueios avisam a secretaria. O titular é localizado pelo e-mail cadastrado na secretaria, vinculado a usuário ativo com papel gestor no mesmo município. Se não houver esse vínculo, o aviso entra na caixa compartilhada dos secretários do município, explicitamente identificada. Para entrega individual, cadastre o e-mail de acesso do titular na secretaria.

Validação ou devolução de evidência avisa seu autor identificado pelo registro de criação; sem esse registro, entra na caixa da equipe. Os avisos são internos ao sistema; não são envio por e-mail, WhatsApp ou push externo. A tela consulta atualizações a cada 30 segundos.

## Banco e verificação

A migração `20261110180000_comunicacao_interna` cria comunicados e leituras. Foi aplicada no MySQL local. Outros ambientes precisam executar `pnpm --filter @cip/db migrate:deploy` antes de iniciar a nova API.

Teste integrado: após compilar a API, executar `node --env-file=packages/db/.env apps/api/scripts/verify-gestao.cjs`. O script exige banco local e cria e remove município e usuários temporários. Cobre meta no cadastro, preservação de prazo, aviso ao titular, leitura, resposta, primeiro prazo, evidências e isolamento entre municípios.
