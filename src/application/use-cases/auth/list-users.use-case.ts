import { Injectable, Logger } from '@nestjs/common';
import { UserResponseDto } from '@application/dtos/response/auth.dto';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { UserMapper } from '@application/mappers/user.mapper';

@Injectable()
export class ListUsersUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly logger: Logger,
  ) {}

  async execute(): Promise<UserResponseDto[]> {
    this.logger.log('Listing users');

    const users = await this.userRepository.findAll();

    this.logger.log(`Retrieved ${users.length} users`);

    const response: UserResponseDto[] = users.map((user) =>
      UserMapper.toResponse(user),
    );
    return response;
  }
}
