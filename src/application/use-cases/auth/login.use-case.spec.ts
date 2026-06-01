import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from './login.use-case';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserRole } from '../../../domain/enums/user-role.enum';

const makeUserRepo = (): jest.Mocked<IUserRepository> => ({
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
});

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepo: jest.Mocked<IUserRepository>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  beforeEach(() => {
    userRepo = makeUserRepo();
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };
    useCase = new LoginUseCase(userRepo, jwtService as any);
  });

  const mockUser = {
    id: 'user-1',
    name: 'Administrator',
    email: 'admin@oficina.com',
    password: bcrypt.hashSync('Admin123!', 10),
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should return tokens and user info on valid credentials', async () => {
    userRepo.findByEmail.mockResolvedValue(mockUser as any);

    const result = await useCase.execute({
      email: 'admin@oficina.com',
      password: 'Admin123!',
    });

    expect(result.accessToken).toBe('mock-token');
    expect(result.refreshToken).toBe('mock-token');
    expect(result.user.email).toBe('admin@oficina.com');
    expect(result.user.role).toBe(UserRole.ADMIN);
  });

  it('should throw UnauthorizedException when user is not found', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'nobody@test.com', password: 'any' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user is inactive', async () => {
    userRepo.findByEmail.mockResolvedValue({
      ...mockUser,
      isActive: false,
    } as any);

    await expect(
      useCase.execute({ email: 'admin@oficina.com', password: 'Admin123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException on wrong password', async () => {
    userRepo.findByEmail.mockResolvedValue(mockUser as any);

    await expect(
      useCase.execute({ email: 'admin@oficina.com', password: 'WrongPass' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
