import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IUserRepository } from '../../../domain/user/user.repository.interface';
import { User } from '../../../domain/user/user.entity';
import { UserRole } from '../../../domain/user/user-role.enum';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<User> {
    const data = await this.prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        isActive: user.isActive,
      },
    });
    return this.toDomain(data);
  }

  async findById(id: string): Promise<User | null> {
    const data = await this.prisma.user.findUnique({ where: { id } });
    return data ? this.toDomain(data) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const data = await this.prisma.user.findUnique({ where: { email } });
    return data ? this.toDomain(data) : null;
  }

  async findAll(): Promise<User[]> {
    const records = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r: any) => this.toDomain(r));
  }

  async update(user: User): Promise<User> {
    const data = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
    return this.toDomain(data);
  }

  private toDomain(data: {
    id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return User.reconstitute({
      id: data.id,
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role as UserRole,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
