# Papéis por prefeitura e administração CIP

Como a mesma pessoa pode atuar em diferentes prefeituras e em papéis distintos, o papel pertence ao vínculo municipal, não à conta global; a equipe CIP tem uma autorização de plataforma separada para operar o onboarding e a carteira de tenants sem obter acesso municipal implicitamente. A sessão seleciona explicitamente um tenant autorizado, e todas as operações municipais permanecem limitadas a esse contexto.

Na migração dos papéis antigos, contas com um único papel municipal preservam esse papel nos vínculos. Contas com múltiplos papéis globais não contêm informação suficiente para inferir o papel correto de cada prefeitura; esses vínculos permanecem em `leitura` e precisam ser revisados pela CIP. A migração não replica permissões elevadas para todos os tenants por suposição.
