import { DomainException } from '@shared/exceptions/domain.exceptions';
import { UserRole } from '@domain/enums/user-role.enum';

export interface UserProps {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProps {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export class UserEntity {
  private readonly props: UserProps;
  private _id: string = '';

  constructor(props: UserProps, id?: string) {
    this.props = props;
    if (id) this._id = id;
  }

  static create(props: CreateUserProps, id?: string): UserEntity {
    UserEntity.validate(props);
    const now = new Date();
    return new UserEntity(
      {
        ...props,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      id,
    );
  }

  static reconstitute(props: UserProps, id?: string): UserEntity {
    return new UserEntity(props, id);
  }

  private static validate(props: CreateUserProps): void {
    if (!props.name || props.name.trim().length === 0) {
      throw new DomainException('User name is required');
    }
    if (!props.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new DomainException('Invalid email format');
    }
    if (!props.password || props.password.length === 0) {
      throw new DomainException('User password is required');
    }
    if (!Object.values(UserRole).includes(props.role)) {
      throw new DomainException('Invalid user role');
    }
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this.props.name;
  }
  get email(): string {
    return this.props.email;
  }
  get password(): string {
    return this.props.password;
  }
  get role(): UserRole {
    return this.props.role;
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

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  toObject(): UserProps {
    return { ...this.props };
  }
}
