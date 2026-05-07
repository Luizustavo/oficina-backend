import { User } from './user.entity';

export interface IUserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  update(user: User): Promise<User>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
