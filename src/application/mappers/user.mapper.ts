import {
  AuthUserSummaryDto,
  UserResponseDto,
} from '@application/dtos/response/auth.dto';
import { CreateUserRequestDto } from '@application/dtos/request/auth.dto';
import { UserEntity } from '@domain/entities/user/user.entity';
import { JwtPayload } from '@infrastructure/presentation/decorators/current-user.decorator';
import { randomUUID } from 'crypto';

export class UserMapper {
  private constructor() {
    throw new Error('UserMapper is a static class and cannot be instantiated');
  }

  public static toEntity(dto: CreateUserRequestDto): UserEntity {
    return UserEntity.create(
      {
        email: dto.email,
        name: dto.name,
        password: dto.password,
        role: dto.role,
      },
      randomUUID(),
    );
  }

  public static toResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  public static toJwtPayload(user: UserEntity): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }

  public static toAuthSummary(user: UserEntity): AuthUserSummaryDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
