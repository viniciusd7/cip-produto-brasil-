# Importação da base de conhecimento

A área Planejamento permite cadastrar documentos PPA, LDO, LOA, diagnóstico e outros, com PDF ou DOCX opcional. O sistema valida o tipo do arquivo, extrai texto para consulta na interface e mantém o original disponível para download autenticado. PDFs digitalizados continuam armazenados, mas não têm OCR; nesses casos o texto extraído ficará vazio.

## Armazenamento

- Em desenvolvimento, sem as variáveis do Supabase, os arquivos ficam no diretório local `UPLOAD_DIR` (padrão: `uploads/` relativo ao processo da API).
- Em produção, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_KNOWLEDGE_BUCKET` no ambiente **da API**.
- Crie no Supabase Storage o bucket indicado em `SUPABASE_KNOWLEDGE_BUCKET` (`cip-conhecimento` por padrão) como **privado**. O acesso é intermediado pela API, que exige autenticação, permissão e vínculo com o município ativo.
- Nunca configure a chave de serviço em variáveis `NEXT_PUBLIC_*` nem no frontend.

O limite de upload pela API é 4 MB para permanecer abaixo do [limite de payload de 4,5 MB das Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size). Arquivos maiores devem ser reduzidos antes do envio; upload direto/resumível ao Storage não está implementado.

## Banco de dados

Os campos para o nome, chave privada de armazenamento e texto extraído são adicionados pela migration `packages/db/prisma/migrations/20261115120000_conhecimento_arquivos/migration.sql`. A migration não é aplicada automaticamente ao Supabase remoto; execute o fluxo normal de migrations do ambiente de destino após revisão.
