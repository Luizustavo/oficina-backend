#!/usr/bin/env bash
# Cenários S1 a S7 da saga (etapa 7), pelo API Gateway. Guia: docs/arquitetura/operacao-da-mensageria.md
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
LAMBDA_INFRA="$SCRIPT_DIR/../../oficina-lambda-auth/infra"

API_URL=${API_URL:-$(terraform -chdir="$LAMBDA_INFRA" output -raw api_gateway_url 2>/dev/null || true)}
CUSTOMER_CPF=${CUSTOMER_CPF:-52998224725}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@oficina.com}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Admin123!}
MECHANIC_EMAIL=${MECHANIC_EMAIL:-mechanic@oficina.com}
MECHANIC_PASSWORD=${MECHANIC_PASSWORD:-Mech123!}
SERVICE_NAME=${SERVICE_NAME:-Troca de Óleo}
PART_CODE=${PART_CODE:-FO001}
WAIT_SECONDS=${WAIT_SECONDS:-120}
PAYMENT_WAIT_SECONDS=${PAYMENT_WAIT_SECONDS:-1200}

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
info() { echo -e "${YELLOW}• $1${NC}"; }
fail() { echo -e "${RED}✖ $1${NC}" >&2; exit 1; }

usage() {
  cat <<EOF
Uso: $(basename "$0") <cenário>

  s1  Caminho feliz: orçamento, aprovação, pagamento (APRO), execução, entrega
  s2  Cliente recusa o orçamento
  s3  Pagamento recusado (cartão com titular OTHE)
  s4  Falha na execução: o mecânico registra a falha e a saga estorna
  s5  Prazo de pagamento vence sem pagamento
  s6  Billing fora do ar no meio do fluxo (precisa de kubectl)
  s7  Mensagem duplicada republicada no broker (precisa de kubectl)

Variáveis: API_URL (padrão: output do oficina-lambda-auth), CUSTOMER_CPF,
ADMIN_EMAIL/ADMIN_PASSWORD, MECHANIC_EMAIL/MECHANIC_PASSWORD, WAIT_SECONDS,
PAYMENT_WAIT_SECONDS.
EOF
  exit 1
}

# ── HTTP ─────────────────────────────────────────────────────────────────────

request() { # request MÉTODO CAMINHO TOKEN [CORPO] → corpo na saída, status em HTTP_STATUS
  local method=$1 path=$2 token=$3 body=${4:-} out
  out=$(mktemp)
  local args=(-sS -o "$out" -w '%{http_code}' -X "$method" "$API_URL$path" -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(--data "$body")
  HTTP_STATUS=$(curl "${args[@]}")
  cat "$out"; rm -f "$out"
}

api() { # como request, mas encerra o script em erro HTTP
  local response
  response=$(request "$@"; echo "|$HTTP_STATUS")
  local status=${response##*|}
  response=${response%|*}
  [[ $status -lt 400 ]] || fail "$1 $2 → HTTP $status: $response"
  echo "$response"
}

found() { # found MÉTODO CAMINHO TOKEN → 0 se a resposta não for erro, corpo em FOUND_BODY
  local response
  response=$(request "$@"; echo "|$HTTP_STATUS")
  [[ ${response##*|} -lt 400 ]] || return 1
  FOUND_BODY=${response%|*}
}

# ── Tokens (expiram em 15 min; renovados a cada 10, sempre no shell principal) ─

TOKENS_AT=-1000
ensure_tokens() {
  (( SECONDS - TOKENS_AT < 600 )) && return
  ADMIN_TOKEN=$(api POST /api/auth/login "" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r .accessToken)
  MECHANIC_TOKEN=$(api POST /api/auth/login "" "{\"email\":\"$MECHANIC_EMAIL\",\"password\":\"$MECHANIC_PASSWORD\"}" | jq -r .accessToken)
  CUSTOMER_TOKEN=$(api POST /auth/cpf "" "{\"cpf\":\"$CUSTOMER_CPF\"}" | jq -r .accessToken)
  TOKENS_AT=$SECONDS
}

as_admin()    { api "$1" "$2" "$ADMIN_TOKEN" "${3:-}"; }
as_mechanic() { api "$1" "$2" "$MECHANIC_TOKEN" "${3:-}"; }
as_customer() { api "$1" "$2" "$CUSTOMER_TOKEN" "${3:-}"; }

# ── Espera ───────────────────────────────────────────────────────────────────

wait_until() { # wait_until "o que" SEGUNDOS comando...
  local what=$1 timeout=$2 start=$SECONDS
  shift 2
  info "Aguardando: $what"
  until ensure_tokens && "$@"; do
    (( SECONDS - start > timeout )) && fail "Tempo esgotado ($timeout s) esperando: $what"
    sleep 3
  done
}

order_status() { as_admin GET "/api/service-orders/$ORDER_ID" | jq -r .status; }
order_is()     { [[ "$(order_status)" == "$1" ]]; }
order_left()   { [[ "$(order_status)" != "$1" ]]; }
saga_status()  { as_admin GET "/api/service-orders/$ORDER_ID/saga" | jq -r .status; }
saga_is()      { [[ "$(saga_status)" == "$1" ]]; }
saga_step_is() { [[ "$(as_admin GET "/api/service-orders/$ORDER_ID/saga" | jq -r .step)" == "$1" ]]; }
part_stock()   { as_admin GET "/api/parts/$PART_ID" | jq -r .stockQuantity; }

budget_ready() {
  found GET "/api/billing/orders/$ORDER_ID/budget" "$CUSTOMER_TOKEN" || return 1
  BUDGET_ID=$(jq -r .id <<<"$FOUND_BODY")
}

job_queued() {
  JOB_ID=$(as_mechanic GET /api/execution/queue | jq -r --arg o "$ORDER_ID" '.[] | select(.orderId == $o) | .id')
  [[ -n "$JOB_ID" ]]
}

# ── Passos do fluxo ──────────────────────────────────────────────────────────

prepare_order() {
  ensure_tokens
  step "Abrindo a OS (cliente CPF $CUSTOMER_CPF)"
  local customer vehicle service order
  customer=$(as_admin GET "/api/customers/document/$CUSTOMER_CPF" | jq -r .id)
  vehicle=$(as_admin GET "/api/vehicles/customer/$customer" | jq -r '.[0].id')
  service=$(as_admin GET '/api/services?limit=100' | jq -r --arg n "$SERVICE_NAME" '.data[] | select(.name == $n) | .id' | head -1)
  PART_ID=$(as_admin GET '/api/parts?limit=100' | jq -r --arg c "$PART_CODE" '.data[] | select(.code == $c) | .id' | head -1)
  [[ -n "$customer" && -n "$vehicle" && -n "$service" && -n "$PART_ID" ]] || fail "Dados do seed não encontrados (cliente, veículo, serviço ou peça)"

  order=$(as_admin POST /api/service-orders "{\"customerId\":\"$customer\",\"vehicleId\":\"$vehicle\",\"problemDescription\":\"Demonstração da saga\"}")
  ORDER_ID=$(jq -r .id <<<"$order")
  ok "OS $(jq -r .orderNumber <<<"$order") ($ORDER_ID)"

  as_admin PATCH "/api/service-orders/$ORDER_ID/services" "{\"serviceId\":\"$service\",\"quantity\":1}" >/dev/null
  as_admin PATCH "/api/service-orders/$ORDER_ID/parts" "{\"partId\":\"$PART_ID\",\"quantity\":2}" >/dev/null
  as_admin PATCH "/api/service-orders/$ORDER_ID/start-diagnosis" >/dev/null
  STOCK_BEFORE=$(part_stock)
  ok "Serviço e 2 peças $PART_CODE na OS, diagnóstico iniciado (estoque da peça: $STOCK_BEFORE)"
}

request_approval() {
  step "Pedindo aprovação: a saga começa e o OS manda billing.budget.create"
  as_admin PATCH "/api/service-orders/$ORDER_ID/request-approval" >/dev/null
  wait_until "orçamento gerado pelo Billing" "$WAIT_SECONDS" budget_ready
  ok "Orçamento $BUDGET_ID: R$ $(as_customer GET "/api/billing/orders/$ORDER_ID/budget" | jq -r .totalAmount)"
}

approve_budget() {
  step "Cliente aprova o orçamento (token da Lambda de CPF)"
  local approved
  approved=$(as_customer POST "/api/billing/budgets/$BUDGET_ID/approve")
  CHECKOUT_URL=$(jq -r '.sandboxCheckoutUrl // .checkoutUrl' <<<"$approved")
  wait_until "OS em AWAITING_PAYMENT (peças reservadas)" "$WAIT_SECONDS" order_is AWAITING_PAYMENT
  ok "Estoque da peça: $STOCK_BEFORE → $(part_stock)"
}

ask_payment() { # ask_payment TITULAR
  step "Pagamento no sandbox do Mercado Pago"
  echo "  Numa janela anônima, entre em mercadopago.com.br com o USUÁRIO do comprador de teste"
  echo "  (TESTUSER..., não o e-mail; código de verificação: 6 últimos dígitos do ID da conta). Depois abra:"
  echo -e "\n  ${CYAN}$CHECKOUT_URL${NC}\n"
  echo "  Cartão de teste com titular $1 e CPF 12345678909."
}

run_execution() {
  step "Execution: o mecânico assume o job"
  wait_until "job na fila do Execution" "$WAIT_SECONDS" job_queued
  as_mechanic PATCH "/api/execution/jobs/$JOB_ID/start-diagnosis" >/dev/null
  wait_until "OS em IN_PROGRESS" "$WAIT_SECONDS" order_is IN_PROGRESS
  as_mechanic PATCH "/api/execution/jobs/$JOB_ID/start-repair" '{"diagnosisNotes":"Filtro saturado"}' >/dev/null
  as_mechanic PATCH "/api/execution/jobs/$JOB_ID/finish" '{"note":"Teste de rodagem ok"}' >/dev/null
  wait_until "OS em COMPLETED" "$WAIT_SECONDS" order_is COMPLETED
  as_admin PATCH "/api/service-orders/$ORDER_ID/deliver" >/dev/null
  ok "OS entregue: $(order_status)"
}

show_saga() {
  step "Saga da OS"
  as_admin GET "/api/service-orders/$ORDER_ID/saga" | jq -r '
    "  status: \(.status)   passo: \(.step)\(if .lastError then "   erro: \(.lastError)" else "" end)",
    (.history[] | "  \(.createdAt[11:19])  \(.eventType | . + " " * (34 - length)) \(.outcome | . + " " * (16 - length)) → \(.step)")'
}

expect_saga() { # expect_saga STATUS
  wait_until "saga em $1" "$WAIT_SECONDS" saga_is "$1"
  ok "Saga $1"
}

expect_paid() {
  wait_until "pagamento (OS sair de AWAITING_PAYMENT)" "$PAYMENT_WAIT_SECONDS" order_left AWAITING_PAYMENT
  order_is PAID || fail "OS em $(order_status): o pagamento não foi confirmado a tempo"
  ok "Pagamento confirmado pelo webhook"
}

expect_stock_restored() {
  local now
  now=$(part_stock)
  [[ "$now" == "$STOCK_BEFORE" ]] || fail "Estoque da peça em $now, esperado $STOCK_BEFORE"
  ok "Peças devolvidas ao estoque ($now)"
}

# ── Cenários ─────────────────────────────────────────────────────────────────

s1() {
  prepare_order; request_approval; approve_budget
  ask_payment APRO
  expect_paid
  run_execution
  expect_saga COMPLETED; show_saga
}

s2() {
  prepare_order; request_approval
  step "Cliente recusa o orçamento"
  as_customer POST "/api/billing/budgets/$BUDGET_ID/reject" '{"reason":"Valor acima do esperado"}' >/dev/null
  wait_until "OS em CANCELED" "$WAIT_SECONDS" order_is CANCELED
  expect_saga COMPENSATED
  ok "Orçamento no Billing: $(as_customer GET "/api/billing/orders/$ORDER_ID/budget" | jq -r .status)"
  show_saga
}

s3() {
  prepare_order; request_approval; approve_budget
  ask_payment OTHE
  info "O titular só muda num cartão novo: o cartão já salvo no comprador de teste continua com o nome antigo."
  info "Limitação do sandbox: o Checkout Pro mostra erro com OTHE sem criar o pagamento recusado (ver o guia)."
  wait_until "pagamento recusado (OS em CANCELED)" "$PAYMENT_WAIT_SECONDS" order_is CANCELED
  expect_saga COMPENSATED
  local payment
  payment=$(as_customer GET "/api/billing/orders/$ORDER_ID/payment" | jq -r .status)
  [[ "$payment" == "REJECTED" || "$payment" == "CANCELLED" ]] \
    || fail "Pagamento em $payment: a OS foi cancelada pelo prazo (como no S5), não pela recusa"
  ok "Pagamento: $payment"
  expect_stock_restored
  show_saga
}

s4() {
  prepare_order; request_approval; approve_budget
  ask_payment APRO
  expect_paid
  wait_until "job na fila do Execution" "$WAIT_SECONDS" job_queued
  step "Mecânico registra a falha: peça indisponível"
  as_mechanic PATCH "/api/execution/jobs/$JOB_ID/start-diagnosis" >/dev/null
  as_mechanic PATCH "/api/execution/jobs/$JOB_ID/fail" '{"reason":"PART_UNAVAILABLE","detail":"Filtro em falta no fornecedor"}' >/dev/null
  wait_until "OS em CANCELED" "$WAIT_SECONDS" order_is CANCELED
  ok "Job: $(as_mechanic GET "/api/execution/jobs/$JOB_ID" | jq -r .status)"
  expect_stock_restored
  local start=$SECONDS payment
  while (( SECONDS - start < WAIT_SECONDS )); do
    ensure_tokens
    payment=$(as_customer GET "/api/billing/orders/$ORDER_ID/payment" | jq -r .status)
    [[ "$payment" == "REFUNDED" || "$payment" == "REFUND_FAILED" ]] && break
    sleep 5
  done
  info "Pagamento: $payment (o estorno real exige as credenciais de produção ativadas no Mercado Pago; ver o README do Billing)"
  show_saga
}

s5() {
  prepare_order; request_approval; approve_budget
  step "Ninguém paga: a saga compensa quando vencer SAGA_PAYMENT_TIMEOUT_SECONDS"
  info "Prazo vence em $(as_admin GET "/api/service-orders/$ORDER_ID/saga" | jq -r .deadlineAt)"
  wait_until "prazo vencer (OS em CANCELED)" "$PAYMENT_WAIT_SECONDS" order_is CANCELED
  expect_saga COMPENSATED
  expect_stock_restored
  show_saga
}

billing_commands_depth() {
  kubectl exec -n messaging rabbitmq-0 -- rabbitmqctl list_queues -p oficina -q name messages \
    | awk '$1 == "billing.commands" { print $2 }'
}

s6() {
  command -v kubectl >/dev/null || fail "Este cenário precisa de kubectl apontando para o cluster"
  prepare_order
  step "Derrubando o Billing"
  kubectl scale deployment/oficina-billing-service -n billing --replicas=0
  kubectl wait --for=delete pod -l app=oficina-billing-service -n billing --timeout=120s || true
  step "Pedindo aprovação com o Billing fora do ar"
  as_admin PATCH "/api/service-orders/$ORDER_ID/request-approval" >/dev/null
  sleep 10
  ok "OS em $(order_status); mensagens esperando em billing.commands: $(billing_commands_depth)"
  step "Billing de volta"
  kubectl scale deployment/oficina-billing-service -n billing --replicas=1
  kubectl rollout status deployment/oficina-billing-service -n billing --timeout=180s
  wait_until "orçamento gerado com o comando que esperou na fila" "$WAIT_SECONDS" budget_ready
  ok "Orçamento $BUDGET_ID; mensagens em billing.commands: $(billing_commands_depth)"
  as_customer POST "/api/billing/budgets/$BUDGET_ID/reject" '{"reason":"Fim do cenário S6"}' >/dev/null
  wait_until "OS em CANCELED" "$WAIT_SECONDS" order_is CANCELED
  show_saga
}

rabbit() { # rabbit MÉTODO CAMINHO [CORPO]: API de gerenciamento (a mesma que o painel usa)
  curl -sS -u "oficina:$RABBIT_PASSWORD" -H 'Content-Type: application/json' -X "$1" \
    "http://localhost:$RABBIT_PORT/api$2" ${3:+--data "$3"}
}

captured() { # captured ROUTING_KEY → primeira mensagem capturada com essa routing key, ou null
  rabbit POST "/queues/oficina/$CAPTURE_QUEUE/get" '{"count":50,"ackmode":"ack_requeue_true","encoding":"auto"}' \
    | jq -c --arg k "$1" '[.[] | select(.routing_key == $k)][0]'
}

republish() { # republish ROUTING_KEY: publica de novo, idêntica, a mensagem capturada
  local message start=$SECONDS
  # O outbox publica até 1 s depois do commit: espera a mensagem chegar à captura.
  until message=$(captured "$1") && [[ "$message" != "null" ]]; do
    (( SECONDS - start > 20 )) && fail "Mensagem $1 não capturada"
    sleep 1
  done
  rabbit POST "/exchanges/oficina/$(jq -r .exchange <<<"$message")/publish" \
    "$(jq -c '{properties, routing_key, payload, payload_encoding: "string"}' <<<"$message")" | jq -e .routed >/dev/null
  ok "Republicada $1 com o mesmo messageId $(jq -r .properties.message_id <<<"$message")"
}

s7() {
  command -v kubectl >/dev/null || fail "Este cenário precisa de kubectl apontando para o cluster"
  RABBIT_PASSWORD=$(kubectl get secret rabbitmq-credentials -n messaging -o jsonpath='{.data.password}' | base64 -d)
  RABBIT_PORT=15673
  CAPTURE_QUEUE="demo.s7.$$"
  kubectl port-forward -n messaging svc/rabbitmq "$RABBIT_PORT:15672" >/dev/null 2>&1 &
  local forward=$!
  trap 'rabbit DELETE "/queues/oficina/$CAPTURE_QUEUE" >/dev/null 2>&1 || true; kill '"$forward"' 2>/dev/null || true' EXIT
  sleep 3

  step "Fila de captura: uma cópia de tudo que passa por saga.commands e saga.events"
  rabbit PUT "/queues/oficina/$CAPTURE_QUEUE" '{"durable":false,"auto_delete":false}' >/dev/null
  rabbit POST "/bindings/oficina/e/saga.commands/q/$CAPTURE_QUEUE" '{"routing_key":"#"}' >/dev/null
  rabbit POST "/bindings/oficina/e/saga.events/q/$CAPTURE_QUEUE" '{"routing_key":"#"}' >/dev/null

  prepare_order; request_approval
  wait_until "OS processar o billing.budget.created original" "$WAIT_SECONDS" saga_step_is AWAITING_APPROVAL
  local history_before
  history_before=$(as_admin GET "/api/service-orders/$ORDER_ID/saga" | jq '.history | length')

  step "Republicando o comando e o evento já processados"
  republish billing.budget.create
  republish billing.budget.created
  sleep 10

  local history_after budget_now
  history_after=$(as_admin GET "/api/service-orders/$ORDER_ID/saga" | jq '.history | length')
  budget_now=$(as_customer GET "/api/billing/orders/$ORDER_ID/budget" | jq -r .id)
  [[ "$history_after" == "$history_before" ]] || fail "A saga registrou passos novos ($history_before → $history_after)"
  [[ "$budget_now" == "$BUDGET_ID" ]] || fail "O Billing criou outro orçamento"
  ok "Nenhum efeito duplicado: mesmo orçamento e saga com os mesmos $history_after passos"
  info "Duplicatas nos logs:"
  local ns deploy ns_deploy
  for ns_deploy in oficina/oficina-backend billing/oficina-billing-service; do
    ns=${ns_deploy%/*}; deploy=${ns_deploy#*/}
    kubectl logs -n "$ns" "deployment/$deploy" --since=1m | grep -i duplicate | tail -1 \
      | jq -r --arg s "$deploy" '"  \($s): \(.msg)"' || true
  done

  as_customer POST "/api/billing/budgets/$BUDGET_ID/reject" '{"reason":"Fim do cenário S7"}' >/dev/null
  wait_until "OS em CANCELED" "$WAIT_SECONDS" order_is CANCELED
}

# ── Início ───────────────────────────────────────────────────────────────────

[[ $# -eq 1 ]] || usage
command -v jq >/dev/null || fail "Instale o jq"
[[ -n "$API_URL" ]] || fail "API_URL vazio: suba o oficina-lambda-auth ou exporte API_URL"
case "$1" in
  s1|s2|s3|s4|s5|s6|s7) ;;
  *) usage ;;
esac

SCENARIO=$(tr '[:lower:]' '[:upper:]' <<<"$1")
echo -e "${CYAN}Cenário $SCENARIO em $API_URL${NC}"
"$1"
echo -e "\n${GREEN}Cenário $SCENARIO concluído.${NC}"
