import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RefreshResponseDto } from '@application/dtos/response/auth.dto';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@infrastructure/presentation/decorators/current-user.decorator';

import type { StringValue } from 'ms';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
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
