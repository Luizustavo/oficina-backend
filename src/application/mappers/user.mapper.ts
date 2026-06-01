import { CreateUserRequestDto } from '@application/dtos/request/auth.dto';
import { UserResponseDto } from '@application/dtos/response/auth.dto';
import { UserEntity } from '@domain/entities/user/user.entity';

export class UserMapper {
  private constructor() {
    throw new Error('UserMapper is a static class and cannot be instantiated');
  }

  public static toEntity(dto: CreateUserRequestDto): UserEntity {
    return UserEntity.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
      role: dto.role,
    });
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
}
