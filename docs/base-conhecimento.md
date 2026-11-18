# Importação da base de conhecimento

A aba **Base de conhecimento** está disponível a todos os perfis vinculados à prefeitura. Todos, inclusive o perfil somente leitura, podem anexar o **Plano de Governo**, único documento obrigatório, e opcionalmente outros documentos em PDF, DOC ou DOCX de até 4 MB. Para cada envio é necessário selecionar um arquivo e preencher o **título** e a **descrição do conteúdo**, ambos com pelo menos 3 caracteres após remover espaços nas extremidades. O título é informado pelo usuário e não é substituído pelo nome do arquivo. A descrição é armazenada no campo `observacao` e exibida junto ao documento; registros antigos sem descrição ou arquivo são preservados.

O **consultor** pode enviar qualquer tipo de documento, mas sua lista, download e consulta de texto extraído permitem apenas o **Plano de Governo**. Ele também não pode editar ou conferir documentos adicionais por acesso direto à API. Os demais perfis continuam consultando os documentos da prefeitura. Administradores podem corrigir o tipo e marcar qualquer documento como conferido; consultores podem fazê-lo nos planos de governo visíveis. Os demais perfis não podem alterar a conferência.

Escolha explicitamente **Plano de Governo** para o documento obrigatório ou **Outro documento** para identificação automática. A identificação é feita localmente por regras sobre o texto extraído, sem enviar o conteúdo a um serviço externo. É uma sugestão, não uma verificação de autenticidade: texto insuficiente ou ambíguo é classificado como **Outro**. PDFs digitalizados sem texto não são identificados, pois não há OCR. A classificação automática nunca identifica um arquivo como Plano de Governo; um usuário precisa selecioná-lo explicitamente. A correção do tipo por consultor ou administrador retorna o documento para conferência.

A interface informa se o Plano de Governo está ausente, cadastrado sem arquivo ou cadastrado com arquivo. A pendência é informativa e não impede o acesso ou uso dos demais recursos da plataforma.

PPA, LDO, LOA e os demais documentos opcionais não geram alertas de pendência. Quando cadastrados, podem ter sua conferência acompanhada separadamente; o seed não cria mais registros demonstrativos desses documentos. Registros existentes são preservados.

Os documentos são compartilhados entre os usuários da mesma prefeitura, respeitando a restrição de consulta do consultor ao Plano de Governo; não inclua arquivos que devam ser restritos a uma secretaria. O sistema valida extensão, MIME, assinatura e leitura do arquivo, extrai texto para consulta e mantém o original disponível para download autenticado. Essas validações não equivalem a antivírus, análise de malware ou garantia de que o conteúdo seja confiável. A extração não conecta, por si só, um modelo de IA generativa.

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
