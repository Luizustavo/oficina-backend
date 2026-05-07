import { DomainException } from '../../shared/exceptions/domain.exceptions';

export interface ServiceProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  estimatedDurationMinutes: number;
}

export class Service {
  private readonly props: ServiceProps;

  private constructor(props: ServiceProps) {
    this.props = props;
  }

  static create(props: CreateServiceProps): Service {
    Service.validate(props);
    const now = new Date();
    return new Service({
      ...props,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ServiceProps): Service {
    return new Service(props);
  }

  private static validate(props: CreateServiceProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new DomainException('Service name is required');
    }
    if (props.price <= 0) {
      throw new DomainException('Service price must be positive');
    }
    if (props.estimatedDurationMinutes <= 0) {
      throw new DomainException('Estimated duration must be positive');
    }
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get price(): number {
    return this.props.price;
  }
  get estimatedDurationMinutes(): number {
    return this.props.estimatedDurationMinutes;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(
    data: Partial<
      Pick<
        ServiceProps,
        'name' | 'description' | 'price' | 'estimatedDurationMinutes'
      >
    >,
  ): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new DomainException('Service name is required');
      }
      this.props.name = data.name.trim();
    }
    if (data.description !== undefined) {
      this.props.description = data.description;
    }
    if (data.price !== undefined) {
      if (data.price <= 0) {
        throw new DomainException('Service price must be positive');
      }
      this.props.price = data.price;
    }
    if (data.estimatedDurationMinutes !== undefined) {
      if (data.estimatedDurationMinutes <= 0) {
        throw new DomainException('Estimated duration must be positive');
      }
      this.props.estimatedDurationMinutes = data.estimatedDurationMinutes;
    }
    this.props.updatedAt = new Date();
  }

  toggleActive(): void {
    this.props.isActive = !this.props.isActive;
    this.props.updatedAt = new Date();
  }

  toObject(): ServiceProps {
    return { ...this.props };
  }
}
