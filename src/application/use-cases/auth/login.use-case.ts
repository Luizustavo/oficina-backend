import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import * as bcrypt from 'bcrypt';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/user/user.repository.interface';
import { JwtPayload } from '../../../infrastructure/presentation/decorators/current-user.decorator';
import { LoginRequestDto } from '../../dtos/request/auth.dto';
import { LoginResponseDto } from '../../dtos/response/auth.dto';

export type { LoginResponseDto };

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
