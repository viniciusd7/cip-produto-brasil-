# Projeto Carretas da Saúde SUS — implementação adiada

**Status:** adiado; não faz parte do fluxo ativo da plataforma.  
**Decisão:** preservar o trabalho para retomada futura sem disponibilizar o template, a aba do dossiê ou a API aos usuários.

## Conteúdo desta pasta

- Código preservado, fora dos pacotes compilados pelo monorepo: [`source/`](./source/).
- Catálogo do wizard e modelo de referência: `source/packages/shared/src/catalog/`.
- Regras e testes da API: `source/apps/api/src/services/`.
- Tela do dossiê e estilos: `source/apps/web/src/app/(app)/iniciativas/[id]/`.
- Seed de demonstração local: `source/packages/db/prisma/`.
- Especificação, análise de lacunas e backlog: [`../docs/escopo-iniciativas-universais-e-piloto-carretas-saude.md`](../docs/escopo-iniciativas-universais-e-piloto-carretas-saude.md).
- O modelo Prisma e a migration aditiva arquivada permanecem em `source/packages/db/prisma/`; a migration foi retirada do diretório ativo para não entrar em deploys futuros por engano.

## Estado da integração

- O wizard padrão não oferece o template Carretas.
- A página de iniciativa não expõe a aba Dossiê Carretas.
- A API não registra endpoints específicos para ler ou gravar o dossiê.
- O código em `source/` não é importado nem compilado pelos pacotes ativos.
- A migration e o modelo Prisma estão arquivados nesta pasta, fora do schema e do diretório de migrations ativos.
- A tabela demonstrativa permanece no banco local, mas o registro de demonstração e seus dados dependentes foram removidos. O seed arquivado pode recriá-los apenas se a validação local for retomada.
- O seed não é executado pelo fluxo normal de desenvolvimento.

## Retomada futura

Antes de reativar:

1. confirmar prioridade, escopo e autorização de produto;
2. revisar e validar localmente o provedor PostgreSQL, a baseline e o estado das migrations;
3. restaurar o modelo Prisma e migration de `source/packages/db/prisma/` com revisão da estratégia de aplicação;
4. mover de volta os arquivos de `source/` para os pacotes da aplicação e restaurar os exports e comandos de teste;
5. reintroduzir o template no wizard e seus contratos de preview/confirmação;
6. reintroduzir endpoints, permissões, auditoria e a aba do dossiê;
7. testar criação, leitura, gravação, concorrência e acesso por perfil;
8. revisar a documentação e só então decidir sobre qualquer implantação.

Não aplicar a migration nem o seed no Supabase remoto ou em ambiente MySQL/Docker legado sem validação e autorização explícitas. A existência do arquivo de migration não significa que ela foi implantada remotamente.
