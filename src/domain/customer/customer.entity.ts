import { CustomerType } from './customer-type.enum';
import { DomainException } from '../../shared/exceptions/domain.exceptions';

export interface CustomerProps {
  id: string;
  name: string;
  document: string;
  type: CustomerType;
  email: string;
  phone: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerProps {
  id: string;
  name: string;
  document: string;
  type: CustomerType;
  email: string;
  phone: string;
  address?: string;
}

export class Customer {
  private readonly props: CustomerProps;

  private constructor(props: CustomerProps) {
    this.props = props;
  }

  static create(props: CreateCustomerProps): Customer {
    Customer.validate(props);

    const now = new Date();
    return new Customer({
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  private static validate(props: CreateCustomerProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new DomainException('Customer name is required');
    }
    if (props.name.trim().length < 2) {
      throw new DomainException(
        'Customer name must have at least 2 characters',
      );
    }

    if (!props.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new DomainException('Invalid email format');
    }

    if (!props.phone || props.phone.trim().length === 0) {
      throw new DomainException('Customer phone is required');
    }

    if (
      props.type !== CustomerType.INDIVIDUAL &&
      props.type !== CustomerType.COMPANY
    ) {
      throw new DomainException('Invalid customer type');
    }
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get document(): string {
    return this.props.document;
  }

  get type(): CustomerType {
    return this.props.type;
  }

  get email(): string {
    return this.props.email;
  }

  get phone(): string {
    return this.props.phone;
  }

  get address(): string | undefined {
    return this.props.address;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(
    data: Partial<Pick<CustomerProps, 'name' | 'email' | 'phone' | 'address'>>,
  ): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 2) {
        throw new DomainException(
          'Customer name must have at least 2 characters',
        );
      }
      this.props.name = data.name.trim();
    }
    if (data.email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw new DomainException('Invalid email format');
      }
      this.props.email = data.email;
    }
    if (data.phone !== undefined) {
      this.props.phone = data.phone;
    }
    if (data.address !== undefined) {
      this.props.address = data.address;
    }
    this.props.updatedAt = new Date();
  }

  toObject(): CustomerProps {
    return { ...this.props };
  }
}
