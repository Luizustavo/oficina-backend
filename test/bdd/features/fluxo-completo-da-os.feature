# language: pt
Funcionalidade: Fluxo completo de uma ordem de serviço
  A OS atravessa orçamento (Billing), pagamento (Billing e Mercado Pago) e execução
  (Execution), coordenada pela saga orquestrada do OS Service. As respostas dos outros
  serviços chegam pela fila os.saga-events, como chegariam pelo RabbitMQ.

  Cenário: Caminho feliz, da abertura à entrega
    Dado um cliente com um veículo e a peça "Filtro de óleo" com 10 unidades em estoque
    E uma OS aberta com um serviço e 2 peças, já em diagnóstico
    Quando a equipe pede a aprovação do orçamento
    Então a OS fica "AWAITING_APPROVAL"
    E o comando "billing.budget.create" é enviado
    Quando o Billing informa "billing.budget.created"
    E o Billing informa "billing.budget.approved"
    Então a OS fica "AWAITING_PAYMENT"
    E o estoque da peça fica em 8
    Quando o Billing informa "billing.payment.confirmed"
    Então a OS fica "PAID"
    E o comando "execution.job.enqueue" é enviado
    Quando o Execution informa "execution.job.queued"
    E o Execution informa "execution.job.started"
    Então a OS fica "IN_PROGRESS"
    Quando o Execution informa "execution.job.completed"
    Então a OS fica "COMPLETED"
    E a saga termina "COMPLETED"
    Quando a equipe entrega o veículo
    Então a OS fica "DELIVERED"

  Cenário: Falha na execução depois do pagamento: estorno e peças de volta ao estoque
    Dado um cliente com um veículo e a peça "Filtro de óleo" com 10 unidades em estoque
    E uma OS aberta com um serviço e 2 peças, já em diagnóstico
    E a OS já paga e com o job em execução
    Quando o Execution informa "execution.job.failed" com o motivo "PART_UNAVAILABLE"
    Então a OS fica "CANCELED"
    E o estoque da peça fica em 10
    E o comando "billing.payment.refund" é enviado
    Quando o Billing informa "billing.payment.refunded"
    Então a saga termina "COMPENSATED"
