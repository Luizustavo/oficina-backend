import { CreateUserRequestDto } from '@application/dtos/request/auth.dto';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { UserResponseDto } from '@application/dtos/response/auth.dto';
import { Injectable, Logger } from '@nestjs/common';
import { UserEntity } from '@domain/entities/user/user.entity';
import { UserMapper } from '@application/mappers/user.mapper';
import { ConflictException } from '@shared/exceptions/domain.exceptions';

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly logger: Logger,
  ) {}

  async execute(dto: CreateUserRequestDto): Promise<UserResponseDto> {
    this.logger.log(`Creating user with email: ${dto.email}`);

    const entity = UserMapper.toEntity(dto);

    const existing = await this.userRepository.findByEmail(entity.email);
    if (existing) {
      this.logger.warn(
        `Attempt to create user with existing email: ${dto.email}`,
      );
      throw new ConflictException(`Email is already in use`);
    }

    const created: UserEntity = await this.userRepository.create(entity);
    this.logger.log(`User created successfully with ID: ${created.id}`);

    if (!created) {
      this.logger.error(`Failed to create user with email: ${dto.email}`);
      throw new Error('Failed to create user');
    }

    const response: UserResponseDto = UserMapper.toResponse(created);
    this.logger.log('Use case execution completed successfully');

    return response;
  }
}
