# Console de gestão CIP em host separado

A administração da plataforma (cadastro de prefeituras, consultores e prefeito responsável) é uma operação comercial da equipe CIP, não uma função da prefeitura. Por isso ela vive em um host próprio, `gestao.<domínio>`, e não em uma rota `/admin` dentro do app municipal. O middleware do Next decide pelo host: no host de gestão só existem o console (`/`) e `/login`, e qualquer rota municipal volta para o console, e `/gestao` no app redireciona para o host de gestão. Cada login rejeita contas do outro lado (equipe CIP no app, usuários municipais no console), e os cookies de sessão ficam separados por host.

O consultor (`analista`) não é administrador: ele monta a prefeitura que lhe foi atribuída — secretarias, equipe (`/equipe`), plano de governo, metas, indicadores e tarefas — sempre dentro do tenant selecionado. O prefeito tem leitura de toda a prefeitura e não gerencia secretarias (`SECRETARIA_MANAGE` saiu do papel `prefeito`).

Consequência: a API precisa aceitar as duas origens em `CORS_ORIGIN` (lista separada por vírgulas), e produção precisa de `NEXT_PUBLIC_GESTAO_URL`/`NEXT_PUBLIC_APP_URL` para montar os links entre os hosts.
