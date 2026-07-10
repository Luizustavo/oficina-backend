import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserUseCase } from './create-user.use-case';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../../domain/entities/user/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { ConflictException } from '../../../shared/exceptions/domain.exceptions';

const makeUserRepo = (): jest.Mocked<IUserRepository> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
});

const makeLogger = (): jest.Mocked<Logger> =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as jest.Mocked<Logger>;

const makeUser = () =>
  UserEntity.reconstitute(
    {
      name: 'Admin',
      email: 'admin@oficina.com',
      password: '$2b$12$hashedpassword',
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    'u-1',
  );

describe('CreateUserUseCase', () => {
  it('should create a user when email is not taken', async () => {
    const repo = makeUserRepo();
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockImplementation(async (u) => u);

    const result = await new CreateUserUseCase(repo, makeLogger()).execute({
      name: 'Admin',
      email: 'admin@oficina.com',
      password: 'Admin123!',
      role: UserRole.ADMIN,
    });

    expect(result.email).toBe('admin@oficina.com');
    expect(result.role).toBe(UserRole.ADMIN);
  });

  it('should throw ConflictException when email is already taken', async () => {
    const repo = makeUserRepo();
    repo.findByEmail.mockResolvedValue(makeUser());

    await expect(
      new CreateUserUseCase(repo, makeLogger()).execute({
        name: 'Admin',
        email: 'admin@oficina.com',
        password: 'Admin123!',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('RefreshTokenUseCase', () => {
  const makeJwtService = (
    verifyResult: any,
    signResult = 'new-access-token',
  ): jest.Mocked<JwtService> =>
    ({
      verify: jest.fn().mockReturnValue(verifyResult),
      sign: jest.fn().mockReturnValue(signResult),
    }) as any;

  it('should return a new access token for a valid refresh token', async () => {
    const repo = makeUserRepo();
    const user = makeUser();
    repo.findById.mockResolvedValue(user);

    const jwt = makeJwtService({
      sub: 'u-1',
      email: 'admin@oficina.com',
      role: UserRole.ADMIN,
      name: 'Admin',
    });

    const result = await new RefreshTokenUseCase(
      repo,
      jwt,
      makeLogger(),
    ).execute('valid-token');
    expect(result.accessToken).toBe('new-access-token');
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    const repo = makeUserRepo();
    const jwt = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('invalid');
      }),
      sign: jest.fn(),
    } as any;

    await expect(
      new RefreshTokenUseCase(repo, jwt, makeLogger()).execute('bad-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user is not found', async () => {
    const repo = makeUserRepo();
    repo.findById.mockResolvedValue(null);
    const jwt = makeJwtService({
      sub: 'u-1',
      email: 'x',
      role: UserRole.ADMIN,
      name: 'X',
    });

    await expect(
      new RefreshTokenUseCase(repo, jwt, makeLogger()).execute('token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user is inactive', async () => {
    const repo = makeUserRepo();
    const user = UserEntity.reconstitute(
      {
        name: 'Admin',
        email: 'admin@oficina.com',
        password: 'x',
        role: UserRole.ADMIN,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'u-1',
    );
    repo.findById.mockResolvedValue(user);
    const jwt = makeJwtService({
      sub: 'u-1',
      email: 'admin@oficina.com',
      role: UserRole.ADMIN,
      name: 'Admin',
    });

    await expect(
      new RefreshTokenUseCase(repo, jwt, makeLogger()).execute('token'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
