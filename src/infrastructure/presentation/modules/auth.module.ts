import { RefreshTokenUseCase } from '@application/use-cases/auth/refresh-token.use-case';
import { CreateUserUseCase } from '@application/use-cases/auth/create-user.use-case';
import { USER_REPOSITORY } from '@domain/repositories/user.repository.interface';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from '../controllers/auth.controller';
import { UserRepository } from '@infrastructure/database/prisma/repositories/user.repository';
import { LoginUseCase } from '@application/use-cases/auth/login.use-case';
import { JwtStrategy } from '@infrastructure/config/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';

import type { StringValue } from 'ms';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    RefreshTokenUseCase,
    CreateUserUseCase,
    LoginUseCase,
    JwtStrategy,
    { provide: USER_REPOSITORY, useClass: UserRepository },
  ],
  exports: [
    JwtStrategy,
    PassportModule,
    { provide: USER_REPOSITORY, useClass: UserRepository },
  ],
})
export class AuthModule {}
