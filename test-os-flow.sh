#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✔ $1${NC}"; }
fail() { echo -e "${RED}✖ $1${NC}"; exit 1; }
step() { echo -e "\n${CYAN}▶ $1${NC}"; }

jq_or_fail() {
  local val; val=$(echo "$1" | jq -r "$2" 2>/dev/null)
  [[ "$val" == "null" || -z "$val" ]] && fail "Campo '$2' não encontrado em: $1"
  echo "$val"
}

# ── 1. LOGIN ──────────────────────────────────────────────────────────────────
step "1. Login como admin"
LOGIN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@oficina.com","password":"Admin123!"}')
TOKEN=$(jq_or_fail "$LOGIN" ".accessToken")
ok "Token obtido"

AUTH="-H 'Authorization: Bearer $TOKEN'"
get()   { curl -sf -X GET   "$BASE_URL$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"; }
post()  { curl -sf -X POST  "$BASE_URL$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2"; }
patch() { curl -sf -X PATCH "$BASE_URL$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" ${2:+-d "$2"}; }

# ── 2. BUSCAR CLIENTE ─────────────────────────────────────────────────────────
step "2. Buscar cliente Carlos Silva"
CUSTOMERS=$(get "/api/customers")
CUSTOMER_ID=$(echo "$CUSTOMERS" | jq -r '.data[] | select(.name=="Carlos Silva") | .id' | head -1)
[[ -z "$CUSTOMER_ID" ]] && fail "Cliente não encontrado. Execute o seed primeiro."
ok "Cliente: $CUSTOMER_ID"

# ── 3. BUSCAR VEÍCULO ─────────────────────────────────────────────────────────
step "3. Buscar veículo do cliente (Toyota Corolla)"
VEHICLES=$(get "/api/vehicles/customer/$CUSTOMER_ID")
VEHICLE_ID=$(echo "$VEHICLES" | jq -r '.[] | select(.model=="Corolla") | .id' | head -1)
[[ -z "$VEHICLE_ID" ]] && fail "Veículo não encontrado."
ok "Veículo: $VEHICLE_ID"

# ── 4. BUSCAR SERVIÇO ─────────────────────────────────────────────────────────
step "4. Buscar serviço 'Troca de Óleo'"
SERVICES=$(get "/api/services")
SERVICE_ID=$(echo "$SERVICES" | jq -r '.data[] | select(.name=="Troca de Óleo") | .id' | head -1)
[[ -z "$SERVICE_ID" ]] && fail "Serviço não encontrado."
ok "Serviço: $SERVICE_ID"

# ── 5. BUSCAR PEÇA ────────────────────────────────────────────────────────────
step "5. Buscar peça 'Filtro de Óleo' (código FO001)"
PARTS=$(get "/api/parts")
PART_ID=$(echo "$PARTS" | jq -r '.data[] | select(.code=="FO001") | .id' | head -1)
[[ -z "$PART_ID" ]] && fail "Peça não encontrada."
PART_STOCK=$(echo "$PARTS" | jq -r '.data[] | select(.code=="FO001") | .stockQuantity')
ok "Peça: $PART_ID (estoque: $PART_STOCK)"

# ── 6. CRIAR OS ───────────────────────────────────────────────────────────────
step "6. Criar Ordem de Serviço"
OS=$(post "/api/service-orders" "{
  \"customerId\": \"$CUSTOMER_ID\",
  \"vehicleId\": \"$VEHICLE_ID\",
  \"problemDescription\": \"Carro fazendo barulho ao frear e perda de potência\",
  \"notes\": \"Cliente relatou início dos sintomas há 1 semana\"
}")
OS_ID=$(jq_or_fail "$OS" ".id")
OS_STATUS=$(jq_or_fail "$OS" ".status")
ok "OS criada: $OS_ID | Status: $OS_STATUS"
[[ "$OS_STATUS" != "RECEIVED" ]] && fail "Status esperado: RECEIVED, obtido: $OS_STATUS"

# ── 7. ADICIONAR SERVIÇO À OS ─────────────────────────────────────────────────
step "7. Adicionar serviço à OS"
OS_WITH_SVC=$(patch "/api/service-orders/$OS_ID/services" "{\"serviceId\":\"$SERVICE_ID\",\"quantity\":1}")
SVC_COUNT=$(echo "$OS_WITH_SVC" | jq '.services | length')
ok "Serviços na OS: $SVC_COUNT"
[[ "$SVC_COUNT" -lt 1 ]] && fail "Serviço não foi adicionado"

# ── 8. ADICIONAR PEÇA À OS ────────────────────────────────────────────────────
step "8. Adicionar peça à OS (Filtro de Óleo, qtd: 2)"
OS_WITH_PART=$(patch "/api/service-orders/$OS_ID/parts" "{\"partId\":\"$PART_ID\",\"quantity\":2}")
PART_COUNT=$(echo "$OS_WITH_PART" | jq '.parts | length')
ok "Peças na OS: $PART_COUNT"
[[ "$PART_COUNT" -lt 1 ]] && fail "Peça não foi adicionada"

# ── 9. VERIFICAR ESTOQUE DECREMENTADO ─────────────────────────────────────────
step "9. Verificar decremento de estoque"
PART_AFTER=$(get "/api/parts/$PART_ID")
NEW_STOCK=$(jq_or_fail "$PART_AFTER" ".stockQuantity")
EXPECTED=$((PART_STOCK - 2))
ok "Estoque: $PART_STOCK → $NEW_STOCK (esperado: $EXPECTED)"
[[ "$NEW_STOCK" -ne "$EXPECTED" ]] && fail "Estoque não foi decrementado corretamente"

# ── 10. TRANSIÇÕES DE STATUS ──────────────────────────────────────────────────
step "10. RECEIVED → IN_DIAGNOSIS (start-diagnosis)"
R=$(patch "/api/service-orders/$OS_ID/start-diagnosis")
S=$(jq_or_fail "$R" ".status")
ok "Status: $S"
[[ "$S" != "IN_DIAGNOSIS" ]] && fail "Esperado IN_DIAGNOSIS, obtido $S"

step "11. IN_DIAGNOSIS → AWAITING_APPROVAL (request-approval)"
R=$(patch "/api/service-orders/$OS_ID/request-approval")
S=$(jq_or_fail "$R" ".status")
ok "Status: $S"
[[ "$S" != "AWAITING_APPROVAL" ]] && fail "Esperado AWAITING_APPROVAL, obtido $S"

step "12. AWAITING_APPROVAL → IN_PROGRESS (approve)"
R=$(patch "/api/service-orders/$OS_ID/approve")
S=$(jq_or_fail "$R" ".status")
ok "Status: $S"
[[ "$S" != "IN_PROGRESS" ]] && fail "Esperado IN_PROGRESS, obtido $S"

step "13. IN_PROGRESS → COMPLETED (complete)"
R=$(patch "/api/service-orders/$OS_ID/complete")
S=$(jq_or_fail "$R" ".status")
ok "Status: $S"
[[ "$S" != "COMPLETED" ]] && fail "Esperado COMPLETED, obtido $S"

step "14. COMPLETED → DELIVERED (deliver)"
R=$(patch "/api/service-orders/$OS_ID/deliver")
S=$(jq_or_fail "$R" ".status")
ok "Status: $S"
[[ "$S" != "DELIVERED" ]] && fail "Esperado DELIVERED, obtido $S"

# ── 11. LEITURA FINAL ─────────────────────────────────────────────────────────
step "15. Leitura final da OS"
FINAL=$(get "/api/service-orders/$OS_ID")
TOTAL=$(echo "$FINAL" | jq -r '.totalCost // .total // "N/A"')
echo -e "${YELLOW}OS final:${NC}"
echo "$FINAL" | jq '{id:.id, status:.status, services:(.services|length), parts:(.parts|length)}'

echo -e "\n${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  FLUXO COMPLETO DE OS: APROVADO ✔     ${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
