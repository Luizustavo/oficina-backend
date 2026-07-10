import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { LoginResponseDto } from '@application/dtos/response/auth.dto';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { LoginRequestDto } from '@application/dtos/request/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@infrastructure/presentation/decorators/current-user.decorator';

import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  async execute(dto: LoginRequestDto): Promise<LoginResponseDto> {
    this.logger.log(`Attempting login for email: ${dto.email}`);

    const user = await this.userRepository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Verifying password for user: ${user.id}`);
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as StringValue,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as StringValue,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
