import { Prisma, User as PrismaUser } from '@generated/prisma/client';
import { UserEntity } from '@domain/entities/user/user.entity';
import { UserRole } from '@domain/enums/user-role.enum';

export class PrismaUserMapper {
  private constructor() {
    throw new Error(
      'PrismaUserMapper is a static class and cannot be instantiated.',
    );
  }

  public static toPrisma(entity: UserEntity): Prisma.UserCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      role: entity.role,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      password: entity.password,
      isActive: entity.isActive,
    };
  }

  public static toEntity(prisma: PrismaUser): UserEntity {
    return UserEntity.reconstitute(
      {
        name: prisma.name,
        email: prisma.email,
        role: prisma.role as UserRole,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
        password: prisma.password,
        isActive: prisma.isActive,
      },
      prisma.id,
    );
  }
}
