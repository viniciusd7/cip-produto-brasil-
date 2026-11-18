# Relatório de infraestrutura e custos — CIP com IA local

**Data de referência:** 13/11/2026  
**Escopo:** duas prefeituras, 20 usuários conectados simultaneamente no total e 50 consultas à IA por dia no total.  
**Arquitetura pretendida:** web e API na Vercel; PostgreSQL e arquivos no Supabase; somente a inferência, a geração de embeddings e eventual OCR em equipamento da CIP.  
**Natureza dos valores:** preços públicos consultados em 13/11/2026, principalmente à vista por Pix; não são fatura observada nem proposta comercial vinculante. O total por peças soma anúncios de lojas distintas, não um carrinho validado nem uma estação montada e testada. Disponibilidade de oito módulos de RAM, frete, tributação por destino e compatibilidade final exigem confirmação do fornecedor. Os serviços em USD têm conversão separada pela PTAX apenas para referência. Contratação, implantação e equipe de operação ficam fora dos totais, salvo indicação expressa.

## 1. O que existe no projeto

O [repositório publicado no GitHub](https://github.com/viniciusd7/cip-produto-brasil-) é um monorepo com `apps/web` em Next.js, `apps/api` em Express/Node e `packages/db` em Prisma. A API é exportada para execução serverless na Vercel. O [schema publicado na `main`](https://github.com/viniciusd7/cip-produto-brasil-/blob/main/packages/db/prisma/schema.prisma) ainda declara **MySQL**. No ambiente local analisado em 13/11/2026, o schema foi alterado para **PostgreSQL/Supabase**, mas essa alteração não é a configuração publicada na `main`. Assim, o orçamento abaixo pressupõe a publicação e validação da migração para PostgreSQL; apontar o schema MySQL atual diretamente para o Supabase não funcionará.

O [serviço de sugestões](https://github.com/viniciusd7/cip-produto-brasil-/blob/main/apps/api/src/services/sugestoes.ts) usa heurísticas e textos definidos no código. Existe o contrato `SuggestionProvider`, mas ainda não há inferência de um modelo. A [base de conhecimento](https://github.com/viniciusd7/cip-produto-brasil-/blob/main/docs/base-conhecimento.md) recebe PDF/DOCX, extrai texto e prevê bucket privado no Supabase Storage; não realiza OCR, divisão em trechos, indexação para busca pela IA nem geração de respostas com fontes. As evidências de iniciativas ainda passam pelo [armazenamento local da API](https://github.com/viniciusd7/cip-produto-brasil-/blob/main/apps/api/src/services/storage.ts), que deve ser substituído por armazenamento durável em produção.

### Arquitetura proposta

```text
Usuário da prefeitura
  → Web Next.js / autenticação — Vercel
  → API Express / permissão por prefeitura — Vercel
       ├→ dados operacionais, trechos, vetores e auditoria — Supabase PostgreSQL
       ├→ PDF/DOCX e evidências originais — Supabase Storage privado
       └→ gateway autenticado e conexão cifrada
             → servidor de IA na CIP: modelo, embeddings e OCR opcional
```

Na consulta documental, a API verifica o usuário e o município, pesquisa apenas trechos autorizados no Supabase e envia ao modelo local a pergunta e os trechos necessários. O modelo devolve a resposta; a API apresenta fontes e registra uso/decisão. Na ingestão, documentos são extraídos, divididos em trechos, identificados por município/versão e indexados. O Supabase [suporta `pgvector`](https://supabase.com/docs/guides/ai/vector-columns) no PostgreSQL; o piloto também pode começar com busca textual antes de ativar busca vetorial. O endpoint de inferência não deve ficar aberto à internet: usar gateway privado, autenticação entre serviços e limites por usuário e prefeitura.

Para o enlace Vercel → CIP, o orçamento assume conexão empresarial e roteador já existentes. Um caminho técnico é Cloudflare Tunnel com política Access e **token de serviço** apresentado apenas pela API; [a Cloudflare documenta tokens para sistemas automatizados](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) e [um plano Zero Trust gratuito](https://www.cloudflare.com/plans/). Não atribuí custo de licença a esse caminho, mas não há SLA de suporte pago nessa hipótese. Domínio, link empresarial, eventual plano pago e implantação do gateway não foram cotados; a conexão local é um pré-requisito real do orçamento.

## 2. Premissas que afetam os números

| Premissa usada | Consequência |
|---|---|
| 20 pessoas conectadas, distribuídas entre duas prefeituras | Não equivale a 20 gerações de IA ao mesmo instante. O pico de consultas simultâneas precisa ser medido. |
| 50 consultas por dia **somando as duas prefeituras** | 1.500 consultas em um mês de 30 dias. Se forem 50 por prefeitura, dobre os custos de inferência por API. |
| Cada consulta usa uma chamada ao modelo | Reformulação da pergunta, segunda tentativa ou análise em etapas aumenta as chamadas. |
| Prompt base: 4.000 tokens de entrada e 800 de saída | Entrada inclui instruções, pergunta, histórico útil e trechos da base de conhecimento. |
| Exemplo de armazenamento: 1.000 documentos de 2 MB e 10 GB de evidências | Cerca de 12 GB de arquivos originais, além de texto, vetores e versões no banco. É hipótese, não medição do acervo CIP. |
| Produção e homologação com bancos isolados | Dois projetos Supabase; ambos na mesma organização Pro. |

Os 20 usuários afetam sobretudo os picos de API, banco e inferência. Os 50 pedidos/dia afetam o custo mensal de tokens, mas não demonstram que o servidor suportará uma rajada de 20 pedidos. Um teste com prompts e documentos reais deve medir tempo até a primeira resposta, duração total, fila, memória da GPU e erros.

## 3. Custos recorrentes de Vercel e Supabase

| Serviço | Por que é necessário | Conta mensal de referência |
|---|---|---:|
| Vercel Pro | Hospeda web e API, incluindo funções serverless; um assento com permissão de deploy | **US$ 20** |
| Supabase Pro | Banco PostgreSQL e Storage privado; mensalidade da organização | **US$ 25** |
| Produção no porte Small | 2 GB RAM; compute US$ 15 menos US$ 10 de crédito incluído no Pro | **US$ 5 adicionais** |
| Homologação no porte Micro | Projeto separado; compute Micro de US$ 10 | **US$ 10 adicionais** |
| **Base com produção Small + homologação Micro** | Antes de tráfego e complementos acima das franquias | **US$ 60/mês** |

O cenário mínimo com produção Micro e homologação Micro custa **US$ 55/mês**. Adotamos Small para produção como reserva inicial de memória do banco, **não como capacidade comprovada** para 20 usuários; o tamanho final depende de teste de carga e métricas do Supabase. Um único projeto Pro/Micro em produção, sem homologação separada, reduziria a base a **US$ 45/mês**. Preços e inclusões: [Vercel Pro](https://vercel.com/docs/plans/pro-plan) e [Supabase Pro](https://supabase.com/pricing).

O desenvolvimento pode usar banco local e dados fictícios. Se a CIP exigir **um terceiro projeto Supabase Micro** isolado para desenvolvimento remoto, acrescente **US$ 10/mês**: a base passa de US$ 60 para **US$ 70/mês** antes de excedentes. Pela [PTAX de venda do Banco Central de 13/11/2026, R$ 5,6518/US$](https://ptax.bcb.gov.br/ptax_internet/consultarTodasAsMoedas.do?method=consultaTodasMoedas), US$ 60 são **R$ 339,11** e US$ 70 são **R$ 395,63** apenas como conversão de referência. A fatura em reais pode diferir por câmbio de pagamento e tributos.

O Supabase Pro lista 8 GB de banco por projeto, 100 GB de arquivos e 250 GB de saída de dados antes de excedentes. No exemplo de 12 GB de arquivos, o armazenamento caberia na franquia; o tamanho real do banco e o tráfego continuam sem medição. O crédito de US$ 20 da Vercel e as franquias incluídas reduzem excedentes possíveis, mas não garantem fatura fixa. Cada assento adicional de deploy na Vercel, monitoramento pago, recuperação contínua, domínio, logs extras ou aumento de porte acrescenta custo. Os [backups diários do banco no Supabase não incluem os objetos do Storage](https://supabase.com/docs/guides/platform/backups); é preciso orçar uma cópia independente dos arquivos.

Há ainda uma restrição funcional: a [Vercel limita o corpo de uma função a 4,5 MB](https://vercel.com/docs/functions/limitations). O upload de conhecimento foi limitado a 4 MB, mas evidências podem chegar a 25 MB no código; arquivos maiores precisam de upload direto/resumível ao Storage, evitando passagem pelo corpo da API. Esse é custo de implementação, não uma nova mensalidade obrigatória.

## 4. IA física na empresa

### Lista de compra com preços publicados

| Item e oferta consultada | Quantidade × preço unitário | Subtotal | Motivo na arquitetura |
|---|---:|---:|---|
| [PNY RTX PRO 6000 Blackwell Workstation, 96 GB](https://www.waz.com.br/placa-de-video-nvidia-quadro-rtx-pro-6000-blackwell-workstation-edition-pny-vcnrtxpro6000b-pb-96gb-gddr7-pcie-5-0-x16-131172-html/p) | 1 × R$ 119.999,99 | **R$ 119.999,99** | Inferência local; 96 GB de VRAM para modelo 30B quantizado com margem de contexto. A [PNY informa 600 W máximos, 12 pol. de comprimento e resfriamento ativo](https://www.pny.com/nvidia-rtx-pro-6000-blackwell-ws?iscommercial=true). |
| [AMD Threadripper PRO 9955WX, 16 núcleos](https://www.waz.com.br/processador-amd-ryzen-threadripper-pro-9955wx-16-nucleos-32-threads-100-100000725wof-132976-html/p) | 1 × R$ 15.999,99 | **R$ 15.999,99** | Extração de documentos, OCR em lote, embeddings e serviços de apoio. |
| [ASUS Pro WS WRX90E-SAGE SE, sTR5, EEB](https://www.waz.com.br/placa-mae-asus-pro-ws-wrx90e-sage-se-ceb-127369-html/p) | 1 × R$ 17.999,99 | **R$ 17.999,99** | Suporta CPU PRO, memória RDIMM ECC, NVMe e rede; o [9955WX consta da lista da ASUS a partir do BIOS 1106](https://www.asus.com/tw/motherboards-components/motherboards/workstation/pro-ws-wrx90e-sage-se/helpdesk_qvl_cpu?model2Name=Pro-WS-WRX90E-SAGE-SE). |
| [Kingston Fury Renegade Pro 16 GB ECC RDIMM](https://www.pichau.com.br/memoria-kingston-fury-renegade-pro-16gb-1x16gb-ddr5-rdimm-ecc-6000mhz-cl32-preto-kf560r32rbe-16) | 8 × R$ 4.249,99 | **R$ 33.999,92** | 128 GB em oito canais para sistema, OCR e caches. Oito peças ocupam todos os slots; ampliar para 256 GB exige substituição dos módulos. Confirmar QVL e quantidade em estoque. |
| [Samsung 990 PRO NVMe 4 TB](https://www.pichau.com.br/ssd-samsung-990-pro-4tb-m-2-2280-pcie-nvme-leitura-7450-mb-s-gravacao-6900-mb-s-mz-v9p4t0) | 2 × R$ 3.599,99 | **R$ 7.199,98** | Sistema, pesos e cache em espelhamento; são SSDs de consumidor, sem promessa de proteção contra perda de energia. Documentos oficiais permanecem no Supabase. |
| [Noctua NH-U14S TR5-SP6](https://www.waz.com.br/cooler-p-processador-cpu-noctua-nh-u14s-tr5-sp6-strx5-swrx9-sp6-127118-html/p) | 1 × R$ 1.259,99 | **R$ 1.259,99** | Dissipador próprio para sTR5; validar temperatura sob carga sustentada. |
| [Fractal Meshify 3 XL Ambience Pro, SSI-EEB](https://www.waz.com.br/gabinete-e-atx-fractal-design-meshify-3-xl-ambience-pro-rgb-branco-fd-c-mes3x-05-130850-html/p) | 1 × R$ 1.499,99 | **R$ 1.499,99** | O [fabricante especifica placa SSI-EEB, GPU até 512 mm e cooler até 182 mm](https://www.fractal-design.com/products/cases/meshify-series/meshify-3-xl/meshify-3-xl-ambience-pro-rgb-white-tg-clear-tint/); a GPU PNY mede 305 mm e o [Noctua mede 165 mm](https://www.noctua.at/en/products/nh-u14s-tr5-sp6/specifications). Ainda validar fixação e cabos na montagem. |
| [ASRock Phantom Gaming 1600G, 1600 W](https://www.waz.com.br/fonte-atx-1-600w-asrock-1600g-phantom-gaming-80-plus-gold-pcie-5-1-full-modular-cybenetics-platinum-atx-3-1-132262-html/p) | 1 × R$ 3.199,99 | **R$ 3.199,99** | Reserva elétrica para uma GPU de 600 W e CPU de 350 W; validar cabos/conectores com a PNY e a ASUS. |
| **Subtotal da estação de IA** | | **R$ 201.159,84** | Peças, sem montagem e teste de carga. |
| [APC Easy UPS SRV3KI-BR, 3 kVA/2.400 W](https://www.apcloja.com.br/-Nobreak-Apc-3kva-Easy-Ups-Srv-3000va-230v-Srv3ki-Br/p/381/) | 1 × R$ 5.448,23 | **R$ 5.448,23** | Desligamento controlado; preço anunciado para SP contribuinte de ICMS, sujeito a estado. Autonomia com essa carga precisa de medição. |
| [Synology DS225+, duas baias](https://teitec.com.br/loja/nas-synology-ds225/) | 1 × R$ 3.525,00 | **R$ 3.525,00** | Equipamento separado para cópia de configuração e cópia independente dos arquivos do Supabase Storage. |
| [Synology HAT3300-4T, 4 TB](https://www.waz.com.br/hd-4tb-sata3-synology-plus-series-hat3300-4t-3-5pol-6gb-s-5-400-rpm-256mb-cache-127571-html/p) | 2 × R$ 2.929,99 | **R$ 5.859,98** | Discos [listados pela Synology para o DS225+](https://www.synology.com/en-us/products/DS225%2B), em RAID 1: cerca de 4 TB nominais disponíveis antes de formatação. |
| **Total com nobreak e backup** | | **R$ 215.993,05** | Sem reforma elétrica, instalação e serviço de backup configurado. |
| [Electrolux MaxComfort Inverter frio 12.000 BTU, 220 V](https://loja.electrolux.com.br/ar-condicionado-split-electrolux-maxcomfort-full-inverter-frio-12-000-btus-ni12f-ne12f/p) | 1 × R$ 2.399,00 | **R$ 2.399,00** | Somente se a sala não tiver climatização contínua adequada; dimensionamento e instalação por técnico. Não ligado ao nobreak acima. |
| **Total com compra adicional do ar-condicionado** | | **R$ 218.392,05** | Ainda exclui instalação, circuito, frete, configuração e impostos variáveis. |

O preço de R$ 89.999,99 para a mesma GPU [aparece na página da Pichau](https://www.pichau.com.br/placa-de-video-pny-geforce-rtx-pro-6000-blackwell-workstation-edition-96gb-gddr7-512-bit-vcnrtxpro6000b-pb), mas [a listagem atual da marca a indica como esgotada](https://www.pichau.com.br/marca/pny); por isso o total usa a oferta da Waz com botão de compra. Os R$ 140–220 mil informados na versão anterior eram uma extrapolação sem composição e não devem orientar a compra. A soma atual de preços publicados para a estação, proteção e backup é **R$ 215.993,05**. Para instalação e garantia de integração, pedir proposta fechada de workstation montada a fornecedores, com os componentes exatos e teste do modelo escolhido.

### Alternativa de entrada para a carga informada

Com **50 consultas por dia no total**, a GPU de 96 GB é uma escolha de crescimento, não uma necessidade demonstrada. Mantendo a estação da tabela e trocando apenas a GPU por [Palit RTX 5090 GameRock de 32 GB, anunciada a R$ 45.599,99](https://www.pichau.com.br/placa-de-video-palit-geforce-rtx-5090-gamerock-32gb-gddr7-512-bit-ne75090019r5-gb2020g-nac), a compra de peças com nobreak e backup soma **R$ 141.593,05**; com o aparelho de ar-condicionado, **R$ 143.992,05**. A placa mede cerca de 332 mm e o gabinete escolhido admite 512 mm, segundo os fabricantes, mas é necessário confirmar a folga para o cabo de energia e o fluxo de ar. É uma GPU de consumo com 12 meses de garantia anunciada, sem a memória ECC e o perfil de suporte da RTX PRO. A economia inicial ante a configuração de 96 GB é **R$ 74.400,00**.

Encontramos uma [workstation Teitec anunciada por R$ 99.526,00](https://teitec.com.br/loja/estacao-amd-threadripper-pro/) com ASUS WRX90E, Threadripper PRO 9965WX, 128 GB ECC RDIMM e RTX 5090. **Ela não entra no orçamento recomendado como anunciada**: o gabinete CM694 especificado pela loja [aceita placas até 12 × 10,7 pol.](https://www.aiuto-jp.co.jp/products/product_2620.php), enquanto a [placa WRX90E mede 12 × 13 pol.](https://www.asus.com/us/motherboards-components/motherboards/workstation/pro-ws-wrx90e-sage-se/techspec/). O fornecedor precisa corrigir a configuração, confirmar o SKU da GPU e informar o preço final da estação montada e testada. Não presumir que os R$ 99.526,00 permaneçam após a correção.

Para um piloto com GPU de 32 GB, testar primeiro um modelo quantizado menor, da classe 14B, com busca documental. Não há garantia de 20 gerações simultâneas nem de que um 30B com contexto longo caiba com folga. Se o piloto exigir mais VRAM, será necessária uma GPU maior ou um segundo nó. A GPU de consumo não oferece a mesma memória ECC e o mesmo perfil de suporte da RTX PRO.

O RAID 1 do NAS tolera a falha de um disco, mas não protege contra exclusão ou ataque. Configurar cópia versionada e testar restauração. A cópia local de objetos do Supabase requer rotina de exportação/sincronização; o NAS comprado não a faz por si. O acervo exemplo de 12 GB cabe com ampla folga em 4 TB úteis, mas o tamanho do NAS deve ser revisto após medir documentos e retenção. O NAS não é o banco de dados de produção nem a base de conhecimento consultada pela aplicação.

Um exemplo de modelo para prova de capacidade é o [Qwen3-32B-AWQ](https://huggingface.co/Qwen/Qwen3-32B-AWQ), com licença aberta. Os [benchmarks do próprio projeto Qwen](https://qwen.readthedocs.io/en/latest/getting_started/speed_benchmark.html) mostram que o uso de memória cresce com o contexto; não estabelecem a vazão desta configuração para o acervo e os 20 usuários da CIP. O motor [vLLM oferece API HTTP compatível](https://docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server/), mas precisa de proxy/gateway de segurança, pois sua chave embutida não protege todos os endpoints.

### Operação local e expansão

Em 36 meses, apenas a distribuição contábil da configuração por peças com 32 GB (**R$ 141.593,05**) equivale a **R$ 3.933,14/mês**; a de 96 GB (**R$ 215.993,05**) equivale a **R$ 5.999,81/mês**. Isso não é mensalidade nem custo total de propriedade. Como cenário de energia, 0,7 kW médios por 730 horas representam **511 kWh/mês para a estação**; a despesa é `511 × tarifa efetiva em R$/kWh`, mais o consumo medido do ar-condicionado, NAS e nobreak. A tarifa, o uso da GPU e o tempo do compressor ainda são desconhecidos; não há como dar uma conta elétrica real sem local e medições. Internet corporativa, refrigeração, manutenção, reposição de baterias e operação técnica também são recorrentes, mas não há preço contratual fornecido para somá-los.

O gabinete e a placa-mãe admitem expansão física, mas uma segunda GPU de 600 W exige novo cálculo de fonte, nobreak, dissipação e concorrência entre serviços; a configuração acima foi orçada para **uma GPU**. Um segundo nó é necessário para tolerar falha do servidor. Os 20 usuários podem estar ativos na aplicação, mas a quantidade de respostas de IA ao mesmo tempo e a latência só serão demonstradas por teste de carga com o acervo da CIP.

## 5. Alternativa de IA por API no OpenRouter

Esta opção substitui o servidor de IA local; Vercel e Supabase continuam. Para 50 chamadas/dia, mês de 30 dias e uma chamada ao modelo por consulta:

```text
chamadas mensais = 50 × 30 = 1.500
custo de inferência = chamadas × (tokens de entrada × preço de entrada
                                + tokens de saída × preço de saída) / 1.000.000
```

O OpenRouter cobra tokens pelos preços publicados de cada modelo. No plano Standard, há **5,5% sobre a compra de créditos**, não um acréscimo por requisição. A coluna “desembolso aproximado” distribui essa taxa sobre o consumo mensal, sem impostos e sem arredondamentos de recarga. Fontes: [preços do OpenRouter](https://openrouter.ai/pricing), [GPT-4.1](https://openrouter.ai/openai/gpt-4.1/pricing), [GPT-4o](https://openrouter.ai/openai/gpt-4o/pricing) e [GPT-4 original](https://openrouter.ai/openai/gpt-4/pricing).

| Modelo no OpenRouter | Entrada / saída por 1 milhão de tokens | Base: 4.000 entrada + 800 saída | Desembolso com 5,5% | Total com nuvem base de US$ 60 |
|---|---:|---:|---:|---:|
| `openai/gpt-4.1` | US$ 2 / US$ 8 | US$ 21,60 | **US$ 22,79/mês** | **US$ 82,79/mês** |
| `openai/gpt-4o` | US$ 2,50 / US$ 10 | US$ 27,00 | **US$ 28,49/mês** | **US$ 88,49/mês** |
| `openai/gpt-4` original | US$ 30 / US$ 60 | US$ 252,00 | **US$ 265,86/mês** | **US$ 325,86/mês** |

Na mesma PTAX de referência, o **total com Vercel + Supabase + OpenRouter** seria aproximadamente **R$ 467,91/mês** com GPT-4.1, **R$ 500,13/mês** com GPT-4o ou **R$ 1.841,70/mês** com o GPT-4 original. São conversões dos preços em dólar, não previsão do valor cobrado no cartão ou nota fiscal.

“GPT-4” é ambíguo: o modelo de ID exato `openai/gpt-4` é antigo, caro e tem janela de cerca de 8 mil tokens. Para consulta de documentos, `gpt-4.1` e `gpt-4o` aceitam contexto maior e têm preços publicados menores. Esses valores não incluem embeddings por API, OCR terceirizado, ferramentas, cache, tentativas adicionais ou respostas que precisem de mais de uma chamada.

### Sensibilidade ao tamanho da consulta

| Tokens por consulta | GPT-4.1 com taxa | GPT-4o com taxa | GPT-4 original com taxa |
|---|---:|---:|---:|
| 2.000 entrada + 500 saída | US$ 12,66/mês | US$ 15,83/mês | US$ 142,43/mês |
| **4.000 entrada + 800 saída — base** | **US$ 22,79/mês** | **US$ 28,49/mês** | **US$ 265,86/mês** |
| 6.000 entrada + 1.500 saída | US$ 37,98/mês | US$ 47,48/mês | US$ 427,28/mês |

Com 50 consultas/dia, o custo recorrente da API é pequeno diante da compra do servidor. A escolha local deve ser sustentada por requisitos de processamento e controle de dados, autonomia, latência e perspectiva de crescimento, além dos testes de qualidade. O uso de OpenRouter envia os trechos selecionados para provedores externos; política de dados e contrato devem ser avaliados antes de utilizar documentos municipais.

## 6. O que falta para fechar o orçamento

1. Confirmar se os 20 usuários simultâneos são no total ou por prefeitura e qual pico de **consultas de IA simultâneas** se quer suportar.
2. Medir quantidade, tamanho e crescimento dos PDFs/DOCX, evidências e proporção de documentos digitalizados que precisam de OCR.
3. Definir meta de latência, horário de operação e disponibilidade; um servidor único é um ponto único de falha.
4. Publicar e validar a versão PostgreSQL no GitHub, reconciliar migrations e testar o banco Supabase antes de contratar produção.
5. Medir tokens de entrada/saída e chamadas por pergunta em um piloto; configurar limites por prefeitura.
6. Solicitar ao menos duas cotações de máquina completa, garantia, nobreak, backup, circuito 220 V e instalação, com prova de carga no modelo escolhido. Confirmar BIOS 1106 ou superior, QVL de memória, conectores da GPU, dimensões internas e resfriamento.

**Referência de decisão:** a base Vercel + Supabase Small/Micro é **US$ 60/mês** antes de excedentes. Para IA local, a configuração por peças com 32 GB, nobreak e backup soma **R$ 141.593,05**; a profissional de 96 GB soma **R$ 215.993,05**. Aparelho de ar-condicionado acrescenta **R$ 2.399,00**, se necessário. Montagem, implantação e operação ainda precisam de cotação. A alternativa OpenRouter com GPT-4.1 acrescentaria cerca de **US$ 22,79/mês** nas premissas de 50 chamadas/dia. Ambos os caminhos exigem implementar busca documental, isolamento por município, fontes nas respostas e armazenamento durável das evidências.
