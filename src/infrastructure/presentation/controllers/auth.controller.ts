import { Controller, Post, Body, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LoginUseCase } from '../../../application/use-cases/auth/login.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/auth/refresh-token.use-case';
import { CreateUserUseCase } from '../../../application/use-cases/auth/create-user.use-case';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../decorators/current-user.decorator';
import { UserRole } from '../../../domain/user/user-role.enum';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/user/user.repository.interface';
import { Inject } from '@nestjs/common';
import {
  LoginRequestDto,
  RefreshTokenRequestDto,
  CreateUserRequestDto,
} from '../../../application/dtos/request/auth.dto';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: LoginRequestDto) {
    return this.loginUseCase.execute(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenRequestDto) {
    return this.refreshTokenUseCase.execute(dto.refreshToken);
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user (ADMIN only)' })
  async createUser(@Body() dto: CreateUserRequestDto) {
    return this.createUserUseCase.execute(dto);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (ADMIN only)' })
  async listUsers() {
    const users = await this.userRepository.findAll();
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user data' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
