import {
  ServiceOrderStatusVO,
  ServiceOrderStatus,
} from '@domain/validators/value-objects/service-order-status.value-object';
import { ServiceItem, PartItem } from './service-order-items.value-object';
import { DomainException } from '@shared/exceptions/domain.exceptions';

export interface ServiceOrderProps {
  orderNumber: string;
  customerId: string;
  vehicleId: string;
  problemDescription: string;
  status: ServiceOrderStatus;
  services: ServiceItem[];
  parts: PartItem[];
  totalAmount: number;
  notes?: string;
  approvedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceOrderProps {
  orderNumber: string;
  customerId: string;
  vehicleId: string;
  problemDescription: string;
  notes?: string;
}

export class ServiceOrderEntity {
  private readonly props: ServiceOrderProps;
  private _id: string = '';
  private statusVO: ServiceOrderStatusVO;

  private constructor(props: ServiceOrderProps, id?: string) {
    this.props = props;
    if (id) this._id = id;
    this.statusVO = new ServiceOrderStatusVO(props.status);
  }

  static create(props: CreateServiceOrderProps): ServiceOrderEntity {
    if (
      !props.problemDescription ||
      props.problemDescription.trim().length === 0
    ) {
      throw new DomainException('Problem description is required');
    }
    if (!props.customerId) {
      throw new DomainException('Customer ID is required');
    }
    if (!props.vehicleId) {
      throw new DomainException('Vehicle ID is required');
    }

    const now = new Date();
    return new ServiceOrderEntity({
      ...props,
      status: ServiceOrderStatus.RECEIVED,
      services: [],
      parts: [],
      totalAmount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(
    props: ServiceOrderProps,
    id?: string,
  ): ServiceOrderEntity {
    return new ServiceOrderEntity(props, id);
  }

  private recalculateTotal(): void {
    const servicesTotal = this.props.services.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const partsTotal = this.props.parts.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    this.props.totalAmount =
      Math.round((servicesTotal + partsTotal) * 100) / 100;
  }

  canModifyItems(): boolean {
    return (
      this.props.status === ServiceOrderStatus.RECEIVED ||
      this.props.status === ServiceOrderStatus.IN_DIAGNOSIS ||
      this.props.status === ServiceOrderStatus.AWAITING_APPROVAL
    );
  }

  addService(item: ServiceItem): void {
    if (!this.canModifyItems()) {
      throw new DomainException(
        `Cannot add services to an order with status ${this.props.status}`,
      );
    }
    this.props.services.push(item);
    this.recalculateTotal();
    this.props.updatedAt = new Date();
  }

  addPart(item: PartItem): void {
    if (!this.canModifyItems()) {
      throw new DomainException(
        `Cannot add parts to an order with status ${this.props.status}`,
      );
    }
    this.props.parts.push(item);
    this.recalculateTotal();
    this.props.updatedAt = new Date();
  }

  startDiagnosis(): void {
    this.statusVO = this.statusVO.transitionTo(ServiceOrderStatus.IN_DIAGNOSIS);
    this.props.status = this.statusVO.getValue();
    this.props.updatedAt = new Date();
  }

  requestApproval(): void {
    this.statusVO = this.statusVO.transitionTo(
      ServiceOrderStatus.AWAITING_APPROVAL,
    );
    this.props.status = this.statusVO.getValue();
    this.props.updatedAt = new Date();
  }

  approve(): void {
    this.statusVO = this.statusVO.transitionTo(ServiceOrderStatus.IN_PROGRESS);
    this.props.status = this.statusVO.getValue();
    this.props.approvedAt = new Date();
    this.props.startedAt = new Date();
    this.props.updatedAt = new Date();
  }

  complete(): void {
    this.statusVO = this.statusVO.transitionTo(ServiceOrderStatus.COMPLETED);
    this.props.status = this.statusVO.getValue();
    this.props.finishedAt = new Date();
    this.props.updatedAt = new Date();
  }

  deliver(): void {
    this.statusVO = this.statusVO.transitionTo(ServiceOrderStatus.DELIVERED);
    this.props.status = this.statusVO.getValue();
    this.props.deliveredAt = new Date();
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    this.statusVO = this.statusVO.transitionTo(ServiceOrderStatus.CANCELED);
    this.props.status = this.statusVO.getValue();
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this._id;
  }
  get orderNumber(): string {
    return this.props.orderNumber;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get problemDescription(): string {
    return this.props.problemDescription;
  }
  get status(): ServiceOrderStatus {
    return this.props.status;
  }
  get services(): ServiceItem[] {
    return [...this.props.services];
  }
  get parts(): PartItem[] {
    return [...this.props.parts];
  }
  get totalAmount(): number {
    return this.props.totalAmount;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }
  get approvedAt(): Date | undefined {
    return this.props.approvedAt;
  }
  get startedAt(): Date | undefined {
    return this.props.startedAt;
  }
  get finishedAt(): Date | undefined {
    return this.props.finishedAt;
  }
  get deliveredAt(): Date | undefined {
    return this.props.deliveredAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toObject(): ServiceOrderProps {
    return {
      ...this.props,
      services: [...this.props.services],
      parts: [...this.props.parts],
    };
  }
}
