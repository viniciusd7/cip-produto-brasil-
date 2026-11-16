# Importação da base de conhecimento

A aba **Base de conhecimento** está disponível a todos os perfis vinculados à prefeitura. Administradores, consultores, prefeitos e secretários podem cadastrar documentos PPA, LDO, LOA, diagnóstico e outros, com PDF, DOC ou DOCX de até 4 MB. O perfil somente leitura pode consultar e baixar documentos, sem anexar ou alterar a conferência. Consultores e administradores podem marcar documentos como conferidos.

Os documentos são compartilhados entre os usuários da mesma prefeitura; não inclua arquivos que devam ser restritos a uma secretaria. O sistema valida o arquivo, extrai texto para consulta e mantém o original disponível para download autenticado. PDFs digitalizados continuam armazenados, mas não têm OCR; nesses casos o texto extraído ficará vazio. A extração não conecta, por si só, um modelo de IA generativa.

## Armazenamento

- Em desenvolvimento, sem as variáveis do Supabase, os arquivos ficam no diretório local `UPLOAD_DIR` (padrão: `uploads/` relativo ao processo da API).
- Em produção, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_KNOWLEDGE_BUCKET` no ambiente **da API**.
- Crie no Supabase Storage o bucket indicado em `SUPABASE_KNOWLEDGE_BUCKET` (`cip-conhecimento` por padrão) como **privado**. O acesso é intermediado pela API, que exige autenticação, permissão e vínculo com o município ativo.
- Nunca configure a chave de serviço em variáveis `NEXT_PUBLIC_*` nem no frontend.

O limite de upload pela API é 4 MB para permanecer abaixo do [limite de payload de 4,5 MB das Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size). Arquivos maiores devem ser reduzidos antes do envio; upload direto/resumível ao Storage não está implementado.

## Banco de dados

Os campos para o nome, chave privada de armazenamento e texto extraído são adicionados pela migration `packages/db/prisma/migrations/20261115120000_conhecimento_arquivos/migration.sql`. A migration não é aplicada automaticamente ao Supabase remoto; execute o fluxo normal de migrations do ambiente de destino após revisão.

O histórico ativo em `packages/db/prisma/migrations/` é PostgreSQL; o histórico antigo de MySQL está preservado separadamente em `packages/db/prisma/migrations-mysql-legacy/`. A baseline PostgreSQL precisa conservar seu conteúdo e checksum originais, pois já foi registrada em ambientes existentes.

Antes de executar `prisma migrate deploy`, confirme o banco apontado por `DIRECT_URL`, faça backup e verifique seu histórico com `prisma migrate status`. Em um banco com dados criados fora do Prisma, não use `migrate resolve` sem primeiro comparar o esquema e verificar também os efeitos de dados e segurança das migrations. Não use `migrate reset` para reconciliar um banco com dados.

O build de preview com `CIP_INIT_DEMO_DB=true` verifica o histórico antes de executar o seed; ele não marca migrations como aplicadas nem as aplica automaticamente. Revise e aplique as migrations pendentes no ambiente de destino separadamente.

Antes de expor um banco PostgreSQL pelo Supabase Data API, revise as permissões e o RLS de todas as tabelas no schema exposto. A baseline histórica não habilita RLS automaticamente; o acesso à base de conhecimento deve continuar intermediado pela API autenticada.
