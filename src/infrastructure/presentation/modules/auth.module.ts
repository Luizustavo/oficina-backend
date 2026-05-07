import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { AuthController } from '../controllers/auth.controller';
import { LoginUseCase } from '../../../application/use-cases/auth/login.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh-token.use-case';
import { CreateUserUseCase } from '../../../application/use-cases/auth/create-user.use-case';
import { JwtStrategy } from '../../config/jwt.strategy';
import { UserRepository } from '../../database/repositories/user.repository';
import { USER_REPOSITORY } from '../../../domain/user/user.repository.interface';

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
    LoginUseCase,
    RefreshTokenUseCase,
    CreateUserUseCase,
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
