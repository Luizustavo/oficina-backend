export interface AuthUserSummaryDto {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummaryDto;
}

export interface RefreshResponseDto {
  accessToken: string;
}

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}
