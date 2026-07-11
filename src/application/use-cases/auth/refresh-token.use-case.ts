import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { RefreshResponseDto } from '@application/dtos/response/auth.dto';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@infrastructure/presentation/decorators/current-user.decorator';
import { UserMapper } from '@application/mappers/user.mapper';
import { jwtConfig } from '@infrastructure/config/jwt.config';

import type { StringValue } from 'ms';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResponseDto> {
    this.logger.log('Attempting to refresh access token');
    const { jwt } = jwtConfig();

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: jwt.refreshSecret,
      });
    } catch {
      this.logger.warn('Refresh token verification failed');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      this.logger.warn(
        `Refresh token rejected - user not found or inactive: ${payload.sub}`,
      );
      throw new UnauthorizedException('User not found or inactive');
    }

    const newPayload = UserMapper.toJwtPayload(user);

    const accessToken = this.jwtService.sign(newPayload, {
      secret: jwt.secret,
      expiresIn: jwt.expiresIn as StringValue,
    });

    this.logger.log(`Access token refreshed successfully for user: ${user.id}`);

    const response: RefreshResponseDto = { accessToken };
    return response;
  }
}
