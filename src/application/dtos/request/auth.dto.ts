import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@domain/enums/user-role.enum';

export class LoginRequestDto {
  @ApiProperty({ example: 'admin@oficina.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class RefreshTokenRequestDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refreshToken!: string;
}

export class CreateUserRequestDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'joao@oficina.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Senha123!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'MECHANIC', enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}
