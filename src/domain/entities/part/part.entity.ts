import { DomainException } from '@shared/exceptions/domain.exceptions';

export interface PartProps {
  name: string;
  code: string;
  description?: string;
  price: number;
  stockQuantity: number;
  minStockQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePartProps {
  name: string;
  code: string;
  description?: string;
  price: number;
  stockQuantity: number;
  minStockQuantity: number;
}

export class PartEntity {
  private readonly props: PartProps;
  private _id: string = '';

  constructor(props: PartProps, id?: string) {
    this.props = props;
    if (id) this._id = id;
  }

  static create(props: CreatePartProps, id?: string): PartEntity {
    PartEntity.validate(props);
    const now = new Date();
    return new PartEntity(
      {
        ...props,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
  }

  static reconstitute(props: PartProps): PartEntity {
    return new PartEntity(props);
  }

  private static validate(props: CreatePartProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new DomainException('Part name is required');
    }
    if (!props.code || props.code.trim().length === 0) {
      throw new DomainException('Part code (SKU) is required');
    }
    if (props.price <= 0) {
      throw new DomainException('Part price must be positive');
    }
    if (props.stockQuantity < 0) {
      throw new DomainException('Stock quantity cannot be negative');
    }
    if (props.minStockQuantity < 0) {
      throw new DomainException('Minimum stock quantity cannot be negative');
    }
  }

  get id(): string {
    return this._id;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): string {
    return this.props.code;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get price(): number {
    return this.props.price;
  }
  get stockQuantity(): number {
    return this.props.stockQuantity;
  }
  get minStockQuantity(): number {
    return this.props.minStockQuantity;
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

  get isLowStock(): boolean {
    return this.props.stockQuantity <= this.props.minStockQuantity;
  }

  hasEnoughStock(quantity: number): boolean {
    return this.props.stockQuantity >= quantity;
  }

  decrementStock(quantity: number): void {
    if (quantity <= 0) {
      throw new DomainException('Quantity to decrement must be positive');
    }
    if (this.props.stockQuantity < quantity) {
      throw new DomainException(
        `Insufficient stock: requested ${quantity}, available ${this.props.stockQuantity}`,
      );
    }
    this.props.stockQuantity -= quantity;
    this.props.updatedAt = new Date();
  }

  addStock(quantity: number): void {
    if (quantity <= 0) {
      throw new DomainException('Quantity to add must be positive');
    }
    this.props.stockQuantity += quantity;
    this.props.updatedAt = new Date();
  }

  removeStock(quantity: number): void {
    if (quantity <= 0) {
      throw new DomainException('Quantity to remove must be positive');
    }
    if (this.props.stockQuantity < quantity) {
      throw new DomainException(
        `Cannot remove ${quantity} from stock: only ${this.props.stockQuantity} available`,
      );
    }
    this.props.stockQuantity -= quantity;
    this.props.updatedAt = new Date();
  }

  update(
    data: Partial<
      Pick<PartProps, 'name' | 'description' | 'price' | 'minStockQuantity'>
    >,
  ): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new DomainException('Part name is required');
      }
      this.props.name = data.name.trim();
    }
    if (data.description !== undefined) {
      this.props.description = data.description;
    }
    if (data.price !== undefined) {
      if (data.price <= 0) {
        throw new DomainException('Part price must be positive');
      }
      this.props.price = data.price;
    }
    if (data.minStockQuantity !== undefined) {
      if (data.minStockQuantity < 0) {
        throw new DomainException('Minimum stock quantity cannot be negative');
      }
      this.props.minStockQuantity = data.minStockQuantity;
    }
    this.props.updatedAt = new Date();
  }

  toggleActive(): void {
    this.props.isActive = !this.props.isActive;
    this.props.updatedAt = new Date();
  }

  toObject(): PartProps {
    return { ...this.props };
  }
}
