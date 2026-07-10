import { RefreshTokenUseCase } from '@application/use-cases/auth/refresh-token.use-case';
import { CreateUserUseCase } from '@application/use-cases/auth/create-user.use-case';
import { ListUsersUseCase } from '@application/use-cases/auth/list-users.use-case';
import { IUserRepository } from '@domain/repositories/user.repository.interface';
import { AuthController } from '@infrastructure/presentation/controllers/auth.controller';
import { UserRepository } from '@infrastructure/database/prisma/repositories/user.repository';
import { PassportModule } from '@nestjs/passport';
import { Module, Logger } from '@nestjs/common';
import { LoginUseCase } from '@application/use-cases/auth/login.use-case';
import { JwtStrategy } from '@infrastructure/config/jwt.strategy';
import { jwtConfig } from '@infrastructure/config/jwt.config';
import { JwtModule } from '@nestjs/jwt';

import type { StringValue } from 'ms';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtConfig().jwt.secret,
      signOptions: {
        expiresIn: jwtConfig().jwt.expiresIn as StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    Logger,
    RefreshTokenUseCase,
    CreateUserUseCase,
    ListUsersUseCase,
    LoginUseCase,
    JwtStrategy,
    { provide: IUserRepository, useClass: UserRepository },
  ],
  exports: [
    JwtStrategy,
    PassportModule,
    { provide: IUserRepository, useClass: UserRepository },
  ],
})
export class AuthModule {}
