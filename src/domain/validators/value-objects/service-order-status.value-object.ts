import { InvalidStatusTransitionException } from '../../../shared/exceptions/domain.exceptions';

export enum ServiceOrderStatus {
  RECEIVED = 'RECEIVED',
  IN_DIAGNOSIS = 'IN_DIAGNOSIS',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
}

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
