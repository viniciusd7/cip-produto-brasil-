# Gestão municipal multi-prefeitura

Este contexto descreve como a CIP organiza o acesso e a operação de várias prefeituras na plataforma.

## Plataforma e acesso

**Prefeitura (tenant)**:
Uma prefeitura cliente e seu espaço isolado de dados e operação na plataforma.
_Avoid_: conta, município ativo (quando se refere à organização inteira)

**Vínculo municipal**:
Relação de uma pessoa com uma prefeitura, que determina seu papel e, quando aplicável, sua secretaria naquele espaço.
_Avoid_: papel global

**Contexto ativo**:
A prefeitura em que a pessoa está operando na sessão atual; só pode ser escolhida entre vínculos autorizados.
_Avoid_: tenant padrão (quando se refere à escolha atual da sessão)

**Administrador CIP**:
Pessoa da equipe da CIP com acesso de gestão da plataforma, capaz de cadastrar prefeituras e administrar seus vínculos.
_Avoid_: administrador municipal

## Operação municipal

**Consultor responsável**:
Consultor designado pela CIP para acompanhar uma prefeitura; pode ser responsável por mais de uma.
_Avoid_: tenant owner

**Prefeito**:
Responsável pelo governo municipal, com acesso ao cenário executivo da prefeitura a que está vinculado.
_Avoid_: usuário global prefeito

**Secretário**:
Responsável por uma secretaria de uma prefeitura, com acesso restrito a esse contexto e à sua secretaria.
_Avoid_: gestor global

## Plano de governo e execução

**Plano de governo**:
Compromissos do prefeito para o mandato, estruturados pela consultoria na implantação da prefeitura.
_Avoid_: planejamento (quando se refere ao documento do prefeito)

**Meta estratégica**:
Resultado do plano de governo atribuído a uma secretaria e a um responsável, medido por indicadores e desdobrado em projetos.
_Avoid_: objetivo, eixo

**Indicador**:
Medida de uma meta estratégica com linha de base, alvo, unidade, periodicidade e polaridade; seu valor atual vem das medições registradas.
_Avoid_: KPI, métrica solta na meta

**Projeto**:
Iniciativa que realiza uma meta estratégica; tem uma secretaria principal e pode ter secretarias correlacionadas.
_Avoid_: ação, programa

**Meta de execução**:
Entrega mensurável de um projeto, decomposta em tarefas.
_Avoid_: marco

**Tarefa / Subtarefa**:
Trabalho com responsável e prazo dentro de uma meta de execução; definido pela consultoria e executado pela secretaria.
_Avoid_: ação do secretário

**Evidência**:
Comprovação de execução anexada pela secretaria — documento, foto ou vídeo.
_Avoid_: anexo genérico

**Solicitação de conclusão**:
Pedido do secretário para concluir uma tarefa, com justificativa e evidência; a consultoria aprova (a tarefa é concluída) ou devolve com parecer.
_Avoid_: concluir direto

**Reprogramação**:
Alteração de prazo feita pelo secretário com justificativa obrigatória; vale imediatamente e notifica a consultoria.
_Avoid_: adiamento silencioso

**Notificação**:
Aviso interno a um responsável sobre atribuição, prazo, solicitação ou decisão; é a mesma fila que alimentará e-mail (SMTP) e WhatsApp.
_Avoid_: alerta de dashboard

**Sugestão da IA**:
Proposta de indicador ou tarefa gerada para uma meta; só passa a existir após aceite explícito do consultor.
_Avoid_: preenchimento automático
