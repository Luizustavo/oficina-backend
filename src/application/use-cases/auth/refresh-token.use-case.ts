import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { JwtPayload } from '../../../infrastructure/presentation/decorators/current-user.decorator';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/user/user.repository.interface';
import { RefreshResponseDto } from '../../dtos/response/auth.dto';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(refreshToken: string): Promise<RefreshResponseDto> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as StringValue,
    });

    return { accessToken };
  }
}
