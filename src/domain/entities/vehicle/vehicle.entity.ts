import { DomainException } from '@shared/exceptions/domain.exceptions';

export interface VehicleProps {
  customerId: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleProps {
  customerId: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
}

export class VehicleEntity {
  private readonly props: VehicleProps;
  private _id: string = '';

  constructor(props: VehicleProps, id?: string) {
    this.props = props;
    if (id) this._id = id;
  }
  static create(props: CreateVehicleProps, id?: string): VehicleEntity {
    VehicleEntity.validate(props);
    const normalizedPlate = props.licensePlate
      .toUpperCase()
      .replace(/-/g, '')
      .trim();
    const now = new Date();
    return new VehicleEntity(
      {
        ...props,
        licensePlate: normalizedPlate,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
  }

  static reconstitute(props: VehicleProps, id?: string): VehicleEntity {
    return new VehicleEntity(props, id);
  }

  private static validate(props: CreateVehicleProps): void {
    if (!props.brand || props.brand.trim().length === 0) {
      throw new DomainException('Vehicle brand is required');
    }
    if (!props.model || props.model.trim().length === 0) {
      throw new DomainException('Vehicle model is required');
    }
    if (!props.customerId) {
      throw new DomainException('Customer ID is required for vehicle');
    }
    const currentYear = new Date().getFullYear();
    if (props.year < 1900 || props.year > currentYear + 1) {
      throw new DomainException(
        `Vehicle year must be between 1900 and ${currentYear + 1}`,
      );
    }
  }

  get id(): string {
    return this._id;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get licensePlate(): string {
    return this.props.licensePlate;
  }
  get brand(): string {
    return this.props.brand;
  }
  get model(): string {
    return this.props.model;
  }
  get year(): number {
    return this.props.year;
  }
  get color(): string | undefined {
    return this.props.color;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(
    data: Partial<Pick<VehicleProps, 'brand' | 'model' | 'year' | 'color'>>,
  ): void {
    if (data.brand !== undefined) {
      if (!data.brand || data.brand.trim().length === 0) {
        throw new DomainException('Vehicle brand is required');
      }
      this.props.brand = data.brand.trim();
    }
    if (data.model !== undefined) {
      if (!data.model || data.model.trim().length === 0) {
        throw new DomainException('Vehicle model is required');
      }
      this.props.model = data.model.trim();
    }
    if (data.year !== undefined) {
      const currentYear = new Date().getFullYear();
      if (data.year < 1900 || data.year > currentYear + 1) {
        throw new DomainException(
          `Vehicle year must be between 1900 and ${currentYear + 1}`,
        );
      }
      this.props.year = data.year;
    }
    if (data.color !== undefined) {
      this.props.color = data.color;
    }
    this.props.updatedAt = new Date();
  }

  toObject(): VehicleProps {
    return { ...this.props };
  }
}
