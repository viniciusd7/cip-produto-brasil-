# CIP — relatório de infraestrutura e segurança para avaliação independente

**Data de referência:** 16/11/2026  
**Destinatário:** profissional responsável pela avaliação de segurança da plataforma  
**Base da análise:** código e documentos do checkout local da CIP, mais páginas públicas dos fornecedores consultadas nesta data. Não houve auditoria das contas de produção, teste de intrusão, inspeção do banco remoto ou validação contratual. Valores comerciais precisam de proposta formal.

## 1. Resumo para o avaliador

A CIP é uma plataforma multi-prefeitura de gestão de planos de governo, projetos, metas, tarefas, evidências, relatórios e documentos. O desenho pretendido mantém **web e API na Vercel**, **PostgreSQL e arquivos privados no Supabase** e acrescenta **inferência de IA em um servidor GPU contratado**. A autenticação via Google é uma intenção; o código examinado ainda usa login por e-mail e senha com Auth.js e um JWT próprio na API. Também não existe integração com modelo generativo: as sugestões atuais são heurísticas.

Os maiores pontos a resolver antes de colocar dados municipais em produção são: (1) definir e testar a migração de identidade para Google sem conceder acesso municipal por simples coincidência de e-mail; (2) revisar exposição do PostgreSQL pelo Supabase Data API, pois a maior parte das tabelas das migrations não tem RLS explícito; (3) mover evidências do disco local da API para armazenamento durável e privado; (4) criar um canal autenticado e restrito entre a API e o servidor GPU; (5) confirmar localização, contratos, retenção, cópias de segurança e restauração dos dados em cada provedor.

**Interpretação adotada:** “Google Auth” significa *entrar com Google* via OAuth/OIDC. Google Authenticator/TOTP é um segundo fator e não substitui esse fluxo. O avaliador deve confirmar qual dos dois recursos será exigido e se o segundo fator será obrigatório para administradores.

## 2. Arquitetura e estado verificado

```text
Navegador do usuário municipal / equipe CIP
  │ HTTPS; sessão web
  ▼
Vercel: Next.js (apps/web) ── Bearer JWT ──► Vercel: Express (apps/api)
                                               │
                                               ├── Prisma / TLS / pooler ──► Supabase PostgreSQL
                                               ├── objetos privados ───────► Supabase Storage
                                               └── canal de serviço seguro ─► servidor GPU (a implementar)
                                                                         modelo / embeddings / OCR opcional
```

| Camada | Situação no checkout | Evidência e consequência |
|---|---|---|
| Web e API | Next.js 16 e Express separados; API exportada para Vercel Functions | [`apps/web/package.json`](../apps/web/package.json), [`apps/api/src/index.ts`](../apps/api/src/index.ts), arquivos `vercel.json`. Confirmar projetos, domínios e variáveis efetivos no painel Vercel. |
| Identidade | Auth.js Credentials chama `/auth/login`; senha conferida com bcrypt; API emite JWT de 8 horas | [`apps/web/src/lib/auth.ts`](../apps/web/src/lib/auth.ts), [`apps/api/src/routes/auth.ts`](../apps/api/src/routes/auth.ts), [`apps/api/src/middleware/auth.ts`](../apps/api/src/middleware/auth.ts). Google OAuth não está configurado no código. |
| Autorização | Papéis por vínculo usuário–município, escopo de secretaria e administrador CIP; a API reconsulta usuário e vínculo | [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma), middleware de autenticação e [ADR 0001](adr/0001-per-tenant-roles-and-platform-admin.md). Requer teste de negação para todos os recursos e para troca de município. |
| Banco | Schema Prisma local declara PostgreSQL; `DATABASE_URL` pelo pooler e `DIRECT_URL` para migrations | [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma), [`.env.example`](../.env.example). O `README` e `docs/arquitetura.md` ainda citam MySQL/HostGator; são documentação antiga. Estado do Supabase remoto não foi verificado. |
| Arquivos | Base de conhecimento usa Supabase Storage privado quando configurado; evidências ainda usam diretório local da API | [`apps/api/src/services/conhecimento-documentos.ts`](../apps/api/src/services/conhecimento-documentos.ts), [`apps/api/src/services/storage.ts`](../apps/api/src/services/storage.ts). Disco de função serverless não é repositório durável. |
| IA | Existe contrato `SuggestionProvider`, com provedor heurístico ativo | [`apps/api/src/services/sugestoes.ts`](../apps/api/src/services/sugestoes.ts), [validação de IA](validacao-ia-nativa-plataforma.md). Não há RAG, embeddings, OCR ou endpoint GPU implementados. |
| Auditoria | A API grava eventos de login e diversas operações críticas em `AuditLog` | [`apps/api/src/services/audit.ts`](../apps/api/src/services/audit.ts). É preciso validar cobertura, proteção, retenção e alerta. |

**Fronteiras de confiança:** navegador ↔ Vercel; web ↔ API; API ↔ PostgreSQL/Storage; API ↔ GPU; equipe CIP ↔ prefeituras; prefeitura A ↔ prefeitura B; ambientes de homologação ↔ produção. A autorização municipal deve ser feita pela API em cada operação. A futura busca documental e o servidor de IA também precisam receber somente dados autorizados para o usuário e município ativos.

## 3. Autenticação Google e controle de acesso propostos

1. **Escolher uma autoridade de sessão.** O caminho de menor mudança no código é acrescentar Google como provedor OIDC ao Auth.js e manter a API como emissora/validadora do token interno. Supabase pode ser apenas banco e Storage; adotar Supabase Auth é outra migração de sessão, que deve ser desenhada explicitamente para não manter dois sistemas de identidade sem vínculo claro. [Supabase documenta o fluxo Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
2. **Vincular identidade por identificador estável do Google**, com provisionamento e aprovação de usuário pela CIP. Verificar `issuer`, `audience`, assinatura, validade e `email_verified` no fluxo OIDC. O e-mail serve para contato e eventual convite; não deve, por si, criar vínculo municipal, conceder papel ou acesso de administrador. Planejar mudança de endereço de e-mail e recuperação de conta.
3. **Manter autorização no cadastro CIP.** Município, papel, secretaria, estado ativo e permissão de plataforma continuam no banco da aplicação. Um login Google bem-sucedido sem vínculo aprovado deve receber acesso negado. Revisar a regra especial de administrador CIP e a possibilidade de operar em contexto de prefeitura.
4. **Proteger o fluxo OAuth e a sessão.** Redirect URIs exatas para produção e homologação, `state`/`nonce` e PKCE quando aplicável ao fluxo escolhido; cookies `Secure`, `HttpOnly` e `SameSite` adequados; segredo forte e rotação documentada; sessões curtas e revogação efetiva após desligamento do usuário. Restringir escopos Google ao necessário. Exigir MFA para contas administrativas, com política de recuperação.
5. **Migrar as contas existentes.** Definir como senhas locais serão desativadas ou mantidas temporariamente, sem criar duplicatas de usuário nem herdar privilégios por e-mail. Testar os dois hosts (`app` e `gestao`) e logout. A separação de hosts está descrita no [ADR 0003](adr/0003-console-de-gestao-em-host-separado.md), mas a configuração real de domínio/cookie deve ser conferida.

## 4. Achados para revisão de segurança

| Prioridade | Achado verificável | Ação e prova solicitada |
|---|---|---|
| **Crítica, antes da exposição do banco** | A baseline PostgreSQL não habilita RLS na maioria das tabelas; só duas tabelas recebem `ENABLE ROW LEVEL SECURITY` em migration posterior. Prisma se conecta diretamente ao banco. | Inventariar grants e schemas expostos no Supabase. Se a aplicação não usa a Data API para dados operacionais, desabilitá-la; se usar, ativar RLS e políticas por município em **todas** as tabelas expostas. Testar `anon`, `authenticated` e acesso entre municípios. [Guia oficial](https://supabase.com/docs/guides/api/securing-your-api). Não presumir que o filtro do Prisma protege uma API de dados exposta separadamente. |
| **Alta** | Evidências de até 25 MB são gravadas e lidas do disco local da API (`localStorage`), enquanto a [Vercel limita o corpo/resposta da Function a 4,5 MB](https://vercel.com/docs/functions/limitations). | Armazenar originais em bucket privado durável. Implementar upload direto com autorização curta e vinculada a município/objeto, validação de tamanho e tipo real, varredura conforme classificação, e download autorizado. Testar arquivo grande e restauração. |
| **Alta** | A API usa `SUPABASE_SERVICE_ROLE_KEY` para arquivos de conhecimento; essa chave contorna RLS. | Guardar só no backend, limitar quem pode ler variáveis Vercel, separar por ambiente, rotacionar e registrar uso. Auditar cada rota que aciona essa chave. Jamais colocá-la em `NEXT_PUBLIC_*`. |
| **Alta** | A IA ainda não tem serviço, política de dados nem isolamento de requisições. | Construir gateway privado/autenticado entre Vercel e GPU, com TLS, identidade de serviço, limites, timeout, logs mínimos e revogação. Não expor vLLM/Ollama diretamente à internet. Testar SSRF, injeção de prompt, vazamento entre municípios e tratamento de arquivos maliciosos. |
| **Alta** | O login por senha atual não mostra limitador de taxa nas rotas examinadas; os testes de segurança visíveis cobrem poucos cenários. | Validar defesa contra tentativas de senha, enumeração de usuário, abuso de API, upload e consumo de IA. Revisar todas as rotas e operações por ID para BOLA/IDOR, inclusive exportação, anexos e administração. |
| **Alta** | O plano de backup do banco não recupera por si os objetos do Storage. | Definir RPO/RTO, backup independente e versionado dos objetos e do banco, cópia fora da conta principal e exercício de restauração. [Supabase confirma a separação](https://supabase.com/docs/guides/platform/backups). |
| **Média** | A API configura CORS por lista exata, mas não há cabeçalhos de segurança, proteção contra abuso ou observabilidade de produção demonstrados pelos arquivos examinados. | Conferir TLS, CSP, HSTS, limites de requisição, proteção de previews Vercel, alertas, retenção de logs, redaction e acesso administrativo nos painéis. CORS não substitui autenticação. |
| **Média** | Documentos da base de conhecimento são compartilhados por toda a prefeitura, e PDFs digitalizados ficam sem texto. | Definir classificação e escopo documental antes do RAG. Indexar por município, versão e permissão; remover índice ao revogar documento; responder com fonte verificável e revisão humana. Não enviar documentos sensíveis a embeddings ou inferência sem autorização. |

**Privacidade e localização:** a [GPU Studio informa servidores nos EUA](https://gpustudio.com.br/); a [Contabo oferece esse GPU VPS na Europa ou no centro dos EUA](https://contabo.com/en-us/gpu-vps-ai-training-inference/). O [Supabase oferece região São Paulo](https://supabase.com/docs/guides/platform/regions), mas a região efetiva do projeto não foi confirmada. Se dados pessoais ou de saúde de munícipes forem processados fora do Brasil, o responsável jurídico deve avaliar base legal, transferência internacional, suboperadores, contratos, retenção, resposta a incidentes e política de exclusão. A localização do banco em São Paulo não impede transferência ao servidor GPU estrangeiro.

## 5. Comparação dos servidores de IA

| Critério | Contabo GPU VPS | GPU Studio Enterprise Dedicated RTX 4090 |
|---|---|---|
| Tipo de servidor | VPS com GPU física exclusiva por passthrough; CPU em **vCPUs** | Servidor físico dedicado anunciado com dois Xeon E5-2697v4, **36 núcleos físicos** no total |
| GPU / memória de vídeo | NVIDIA RTX PRO 6000 Blackwell Server Edition; **96 GB GDDR7 ECC** | GeForce RTX 4090; **24 GB GDDR6X** |
| CPU / RAM | 18 vCPU AMD EPYC / 96 GB RAM | Dual E5-2697v4 / 256 GB RAM; geração de CPU mais antiga |
| Disco | 900 GB NVMe | 240 GB SSD + 2 TB NVMe + 8 TB SATA anunciados; confirmar RAID, desempenho e backup |
| Rede / local | Tráfego de saída sujeito a política de uso justo; Europa ou EUA central | 100 Mbps “unmetered” na página do plano; servidores anunciados nos EUA. Confirmar banda garantida, latência e política de uso. |
| Suporte / cobrança | Cobrança em moeda estrangeira, suporte e contrato da Contabo; operação do modelo é responsabilidade da CIP | Cobrança em reais, NF-e e suporte em português anunciados; confirmar SLA, horário de suporte e substituição de hardware no contrato |
| Melhor encaixe técnico provável | Modelos maiores, contexto longo, mais margem para concorrência e fine-tuning leve; precisa teste da carga CIP | Piloto com modelo menor ou quantizado e demanda moderada; RAM de 256 GB não elimina o limite de 24 GB de VRAM |

Especificações: [documentação técnica da Contabo](https://docs.contabo.com/docs/servers-hosting/gpu-vps/), [plano RTX 4090 da GPU Studio](https://gpustudio.com.br/gpu/servidor-rtx-4090-enterprise/), [NVIDIA RTX 4090](https://www.nvidia.com/en-me/geforce/graphics-cards/40-series/rtx-4090/). **96 GB de VRAM são 4 vezes 24 GB**; isso afeta quais pesos e tamanhos de contexto cabem na GPU. Os 256 GB de RAM do servidor GPU Studio podem ajudar em pré-processamento ou offload, mas offload aumenta latência e não equivale a VRAM. Núcleos físicos e vCPUs não são medidas diretamente comparáveis. Não há benchmark da aplicação CIP em nenhuma das máquinas.

### Preço e prazo: correção da interpretação

| Oferta pública em 16/11/2026 | Valor mensal publicado | Custo do prazo, sem extras |
|---|---:|---:|
| Contabo, 24 meses, desconto de 20% sobre US$ 1.199/mês | **aprox. US$ 959,20/mês** | **US$ 23.020,80 por 24 meses** |
| GPU Studio, contratação mensal | **R$ 4.650/mês** | R$ 4.650 por 1 mês; R$ 55.800 se renovado por 12 meses ao mesmo preço, sem garantia de manutenção do preço |
| GPU Studio, contrato anual | **R$ 3.850/mês** | **R$ 46.200 por 12 meses** |
| GPU Studio, contrato bianual | **R$ 3.500/mês** | **R$ 84.000 por 24 meses** |

O preço **R$ 4.650 não é a mensalidade do contrato de um ano** na [tabela pública da GPU Studio](https://gpustudio.com.br/gpu/servidor-rtx-4090-enterprise/); é a opção mensal. A [Contabo publica preço base de US$ 1.199 e desconto de 20% para 24 meses](https://contabo.com/blog/gpu-vps-is-here-dedicated-nvidia-gpu-power-without-the-hyperscaler-price/), chegando a US$ 959,20; os US$ 959 informados pelo solicitante são arredondamento. A página regional pode exibir outra moeda e impostos. Confirmar proposta, cobrança antecipada, câmbio efetivo, tributos, reajuste e cancelamento antes de contratar. **Vercel, Supabase, backups, monitoramento, implantação e operação não estão incluídos nesses valores.**

Para comparar o mesmo prazo de 24 meses, a mensalidade da Contabo em reais é `959,20 × câmbio efetivo em R$/US$`, mais encargos aplicáveis. Ela supera R$ 3.500/mês da GPU Studio quando o câmbio efetivo supera **R$ 3,65/US$**. A diferença de preço compra principalmente **mais VRAM e GPU profissional nova** na Contabo; a GPU Studio entrega mais RAM, disco e faturamento em reais. A contratação recomendável depende de um teste do modelo, tamanho de contexto, consultas simultâneas e latência, não apenas do número total de usuários conectados.

## 6. Requisitos de implantação e testes de aceite

1. **Identidade:** demonstrar login, convite, vínculo municipal, troca de município, desligamento, expiração/revogação e MFA administrativo. Provar que um usuário Google sem convite não recebe dados.
2. **Banco:** inventário de grants, schemas, roles, chaves, RLS e acesso pela Data API; testes negativos com duas prefeituras e dois papéis; migrations revisadas e aplicadas em homologação antes da produção.
3. **Arquivos:** bucket privado, upload autorizado e download por escopo; teste com arquivo maior que 4,5 MB, tipos inesperados, exclusão, retenção e restauração. Não depender do disco local da Vercel.
4. **IA:** escolher modelo e versão; medir VRAM, latência, fila, erros e concorrência em consultas representativas; testar falha do nó GPU e do enlace; desativar recurso sem afetar operações essenciais. A resposta deve mostrar fontes e exigir aprovação humana para qualquer alteração oficial.
5. **Rede e operação:** diagramar conexões, IPs, DNS, TLS, gateway, autenticação de serviço, portas expostas e rotação de credenciais. Aplicar atualização de SO, CUDA e containers, princípio do menor privilégio, monitoramento e plano de incidente no servidor GPU.
6. **Continuidade:** definir metas de disponibilidade, RPO/RTO e responsáveis; exercitar restauração de PostgreSQL e objetos em ambiente separado. Um único servidor GPU é ponto único de falha da IA; desenhar fila, indisponibilidade graciosa ou segundo provedor conforme meta contratada.
7. **Governança:** inventário dos dados por prefeitura e tipo, inclusive saúde; DPA/contratos dos três provedores, região, suboperadores, retenção de prompts/logs, exclusão e comunicação de incidentes.

## 7. Informações que o avaliador deve solicitar

- Diagrama e exportação **sem segredos** das configurações reais de Vercel, Supabase, DNS e GPU; plano/limites contratados e região de cada serviço.
- Lista de tabelas e permissões no banco remoto, políticas RLS e estado das migrations; inventário de buckets e políticas de Storage.
- Volume mensal de documentos/evidências, classificação dos dados, usuários e pico de perguntas de IA simultâneas; modelo, quantização, contexto e meta de latência.
- Contratos e propostas dos dois fornecedores GPU: prazo, preço final, SLA de disponibilidade, janela de suporte, proteção de rede, backup, substituição de hardware, local de processamento e saída de dados ao término.
- Política de identidade Google, provisionamento, MFA, encerramento de conta e resposta a incidente; política de logs, retenção e teste de restauração.

**Conclusão de escopo:** este relatório é uma base de diligência técnica. Os achados descrevem evidência no checkout e lacunas de comprovação; não constituem certificação de segurança, confirmação do ambiente remoto nem recomendação final de compra.
