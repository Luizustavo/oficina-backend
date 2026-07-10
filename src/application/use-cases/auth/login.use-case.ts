import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { LoginResponseDto } from '@application/dtos/response/auth.dto';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { LoginRequestDto } from '@application/dtos/request/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@infrastructure/presentation/decorators/current-user.decorator';
import { jwtConfig } from '@infrastructure/config/jwt.config';

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
    const { jwt } = jwtConfig();
    this.logger.log(`Attempting login for email: ${dto.email}`);

    const user = await this.userRepository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      this.logger.warn(
        `Login failed - user not found or inactive: ${dto.email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Verifying password for user: ${user.id}`);
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed - invalid password for user: ${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwt.secret,
      expiresIn: jwt.expiresIn as StringValue,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: jwt.refreshSecret,
      expiresIn: jwt.refreshExpiresIn as StringValue,
    });

    this.logger.log(`Login successful for user: ${user.id}`);

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
