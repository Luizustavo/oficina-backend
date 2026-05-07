import { UserRole } from './user-role.enum';
import { DomainException } from '../../shared/exceptions/domain.exceptions';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProps {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export class User {
  private readonly props: UserProps;

  private constructor(props: UserProps) {
    this.props = props;
  }

  static create(props: CreateUserProps): User {
    User.validate(props);
    const now = new Date();
    return new User({
      ...props,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
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
    return this.props.id;
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
