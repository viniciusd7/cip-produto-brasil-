# Mobile e web app CIP

Implementação e verificação em 18/11/2026, com revisão ECC de produto,
arquitetura, desenvolvimento e QA.

## Experiência mobile

- Até 900 px, atalhos inferiores adaptados ao perfil e menu completo com
  indicação da prefeitura e do papel ativo. As rotas vêm da navegação já
  autorizada para cada perfil.
- O botão **Menu** na barra inferior é o único acesso ao menu completo no
  celular. O topo concentra a identificação da prefeitura e as notificações.
- Menu com foco contido, fechamento por Escape e clique externo, retorno ao
  botão de origem e conteúdo externo inerte. Ao navegar pelo menu, o foco vai
  para o conteúdo da página.
- Controles principais com pelo menos 44 px, campos com fonte de 16 px,
  consideração das áreas seguras do aparelho e barra inferior recolhida quando
  o teclado reduz a área visível.
- Login compacto, formulários em coluna, tabelas com rolagem própria, seções
  da ficha do projeto distribuídas em botões e etapas do assistente em faixa
  rolável. O assistente usa colunas que podem encolher para impedir que campos
  e perguntas longas alarguem a página.
- A navegação lateral e a composição desktop permanecem em telas maiores.

O CSS adicional está em `apps/web/src/app/mobile.css`; estilos de desktop
continuam nos arquivos existentes.

## Instalação e conexão

O manifest fornece nome CIP, ícones PNG de 192 e 512 px, ícone maskable,
ícone Apple de 180 px e abertura em modo standalone. A opção **Instalar
aplicativo CIP** fica no login e no menu completo. Quando o navegador fornece
um evento de instalação, o botão abre seu diálogo; nos demais casos, mostra
instruções. No Safari do iPhone/iPad, o caminho indicado é **Compartilhar →
Adicionar à Tela de Início**. A opção desaparece em modo standalone.

As abas do navegador usam o mesmo símbolo CIP do aplicativo, com favicon ICO
de 16, 32 e 48 px e versão SVG.

A instalação em produção precisa de HTTPS. O service worker registra-se apenas
no build de produção, em contexto seguro. `next dev` mantém o ciclo normal de
atualização sem registrar um worker.

Somente `/offline.html`, um documento público independente de outros recursos,
entra no Cache Storage. Navegações usam a rede com `cache: no-store`. Na falha
de rede, o worker apresenta esse documento com a opção de tentar novamente.
Respostas HTTP de erro continuam sendo tratadas pela aplicação. API, RSC,
POST e outros hosts não são interceptados. Nenhuma operação é reenviada
automaticamente. O acesso aos dados e o envio de alterações precisam de rede.

Essa política descreve o cache novo do worker; o assistente de criação já possui
seu mecanismo próprio de rascunhos locais, que foi preservado.

O middleware libera manifest e documento offline nos hosts da prefeitura e
da gestão CIP. O worker possui cabeçalhos que impedem seu cache HTTP. Versões
antigas apenas do cache público CIP são removidas na ativação.

## Teste no telefone pela rede local

O navegador acessa a API por `/api/backend`, no mesmo endereço do aplicativo.
O Next encaminha as chamadas para `API_URL` no servidor, preservando a
autenticação da API e a configuração CORS existente. Isso evita que o telefone
tente acessar sua própria porta `localhost:4000`.

Para testar, mantenha o Mac e o telefone no mesmo Wi-Fi e use
`http://<IP_DO_MAC>:3000/login`. Em `apps/web/.env.local`, configure
`NEXTAUTH_URL="http://<IP_DO_MAC>:3000"` para que os retornos de autenticação
usem esse endereço. O host configurado é aceito pelo servidor de desenvolvimento.
Em IPs privados, o console CIP continua em `/gestao` no mesmo host.

O teste HTTP pela rede local valida navegação e login; instalação do PWA e
service worker no telefone precisam de um ambiente HTTPS de produção.

## Verificações realizadas

| Verificação | Resultado |
| --- | --- |
| Painel do prefeito em 320, 375, 390, 768 e 1440 px | Largura do documento igual à viewport |
| Minha pasta do secretário nas mesmas cinco larguras | Sem rolagem horizontal da página |
| Modelagem do assistente do consultor nas mesmas cinco larguras | Campos contidos; excesso horizontal corrigido |
| Carteira, planejamento e ficha em 375 px | Inspeção visual e de largura; seções da ficha visíveis |
| Menu: abertura, Shift+Tab, Escape e retorno do foco | Conferido no Chrome |
| Reprogramação de tarefa | Formulário aberto, campos de 16 px e pelo menos 48 px; nenhum envio |
| Seleção de prefeitura do consultor | Acesso ao contexto de consultoria conferido |
| Manifest e três ícones no build de produção | HTTP 200, tipos corretos e standalone |
| Worker no navegador de produção local | Estado activated, escopo `/` |
| Cache Storage no navegador | Somente `/offline.html` no cache CIP |
| Cabeçalho do worker | `no-cache, no-store, must-revalidate` |
| Login e API pelo IP privado da rede | Painel autenticado e health HTTP 200 |
| Testes web do conteúdo isolado do commit | 84 aprovados, zero falhas |
| ESLint web e TypeScript | Aprovados |
| Build web de produção | Aprovado; aviso preexistente da convenção middleware |
| `git diff --check` | Aprovado |

Os testes novos cobrem permissões dos atalhos, seleção única em rotas
aninhadas, contexto de projetos, cache público sem credenciais, respostas
privadas e erros HTTP sem persistência, exclusão de API/RSC/POST/outros hosts
e remoção restrita de caches antigos.

As jornadas autenticadas foram verificadas no ambiente local em `:3000`,
incluindo o acesso pelo IP privado. A validação do worker usou o build de
produção em `:3002`. A página temporária de diagnóstico e o servidor de
produção de teste foram removidos/encerrados.

## Limites de homologação

Não foram feitos instalação em Android/iPhone físicos, auditoria axe completa,
teste manual de leitor de tela ou medição de Core Web Vitals de produção.
O comportamento sem rede foi testado no harness do worker; a ativação e o
conteúdo real do cache foram conferidos no Chrome. O teclado virtual e as áreas
seguras ainda precisam de homologação em aparelho físico.

Comparação de regressão visual: **INCONCLUSIVE**, pois não há baseline de
screenshots. A inspeção responsiva atual passou nos cenários descritos.
Nenhum cadastro ou reprogramação foi enviado durante esta verificação.
A homologação em aparelhos físicos continua pendente.
