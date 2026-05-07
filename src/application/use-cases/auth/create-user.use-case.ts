import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/user/user.repository.interface';
import { User } from '../../../domain/user/user.entity';
import { ConflictException } from '../../../shared/exceptions/domain.exceptions';
import { CreateUserRequestDto } from '../../dtos/request/auth.dto';
import { UserResponseDto } from '../../dtos/response/auth.dto';

export type { UserResponseDto };

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: CreateUserRequestDto): Promise<UserResponseDto> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already in use`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = User.create({
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
    });

    const created = await this.userRepository.create(user);
    return this.toResponse(created);
  }

  private toResponse(user: User): UserResponseDto {
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
