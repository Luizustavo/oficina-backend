import { InvalidStatusTransitionException } from '@shared/exceptions/domain.exceptions';

export enum ServiceOrderStatus {
  RECEIVED = 'RECEIVED',
  IN_DIAGNOSIS = 'IN_DIAGNOSIS',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
}

// Máquina de estados da Fase 4 (ADR-011): orçamento aprovado → pagamento →
// execução. CANCELED é alcançável de qualquer estado anterior a COMPLETED:
// serviço já executado não se cancela, se entrega.
const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  [ServiceOrderStatus.RECEIVED]: [
    ServiceOrderStatus.IN_DIAGNOSIS,
    ServiceOrderStatus.CANCELED,
  ],
  [ServiceOrderStatus.IN_DIAGNOSIS]: [
    ServiceOrderStatus.AWAITING_APPROVAL,
    ServiceOrderStatus.CANCELED,
  ],
  [ServiceOrderStatus.AWAITING_APPROVAL]: [
    ServiceOrderStatus.AWAITING_PAYMENT,
    // Compensação da saga: o Billing não conseguiu gerar o orçamento.
    ServiceOrderStatus.IN_DIAGNOSIS,
    ServiceOrderStatus.CANCELED,
  ],
  [ServiceOrderStatus.AWAITING_PAYMENT]: [
    ServiceOrderStatus.PAID,
    ServiceOrderStatus.CANCELED,
  ],
  [ServiceOrderStatus.PAID]: [
    ServiceOrderStatus.IN_PROGRESS,
    ServiceOrderStatus.CANCELED,
  ],
  [ServiceOrderStatus.IN_PROGRESS]: [
    ServiceOrderStatus.COMPLETED,
    ServiceOrderStatus.CANCELED,
  ],
  [ServiceOrderStatus.COMPLETED]: [ServiceOrderStatus.DELIVERED],
  [ServiceOrderStatus.DELIVERED]: [],
  [ServiceOrderStatus.CANCELED]: [],
};

// Ordem da listagem sem filtro: o que está mais perto de virar trabalho na
// oficina aparece primeiro. Status fora desta lista e de EXCLUDED não
// aparecem na listagem, então todo status novo precisa entrar em uma das duas.
export const SERVICE_ORDER_LIST_STATUS_PRIORITY: ServiceOrderStatus[] = [
  ServiceOrderStatus.IN_PROGRESS,
  ServiceOrderStatus.PAID,
  ServiceOrderStatus.AWAITING_PAYMENT,
  ServiceOrderStatus.AWAITING_APPROVAL,
  ServiceOrderStatus.IN_DIAGNOSIS,
  ServiceOrderStatus.RECEIVED,
  ServiceOrderStatus.CANCELED,
];

export const SERVICE_ORDER_LIST_EXCLUDED_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.COMPLETED,
  ServiceOrderStatus.DELIVERED,
];

export class ServiceOrderStatusVO {
  private readonly value: ServiceOrderStatus;

  constructor(status: ServiceOrderStatus) {
    this.value = status;
  }

  canTransitionTo(newStatus: ServiceOrderStatus): boolean {
    return VALID_TRANSITIONS[this.value].includes(newStatus);
  }

  transitionTo(newStatus: ServiceOrderStatus): ServiceOrderStatusVO {
    if (!this.canTransitionTo(newStatus)) {
      throw new InvalidStatusTransitionException(this.value, newStatus);
    }
    return new ServiceOrderStatusVO(newStatus);
  }

  getValue(): ServiceOrderStatus {
    return this.value;
  }

  equals(other: ServiceOrderStatusVO): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
