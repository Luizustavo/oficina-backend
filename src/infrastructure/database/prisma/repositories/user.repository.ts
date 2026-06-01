import { PrismaUserMapper } from '../mappers/prisma-user.mapper';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { PrismaService } from '../prisma.service';
import { Injectable } from '@nestjs/common';
import { UserEntity } from '@domain/entities/user/user.entity';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: UserEntity): Promise<UserEntity> {
    const data = PrismaUserMapper.toPrisma(user);
    const created = await this.prisma.user.create({ data });
    return PrismaUserMapper.toEntity(created);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const data = await this.prisma.user.findUnique({ where: { id } });
    return data ? PrismaUserMapper.toEntity(data) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const data = await this.prisma.user.findUnique({ where: { email } });
    return data ? PrismaUserMapper.toEntity(data) : null;
  }

  async findAll(): Promise<UserEntity[]> {
    const records = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map((item) => PrismaUserMapper.toEntity(item));
  }

  async update(user: UserEntity): Promise<UserEntity> {
    const data = PrismaUserMapper.toPrisma(user);
    const updated = await this.prisma.user.update({
      where: { id: data.id },
      data,
    });
    return PrismaUserMapper.toEntity(updated);
  }
}
