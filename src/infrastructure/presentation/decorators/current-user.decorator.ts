import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenRole } from '@domain/enums/token-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  /**
   * Pode ser um papel de funcionário (`UserRole`) ou `CUSTOMER`, emitido pela
   * função serverless de autenticação por CPF. Tipar como `UserRole` puro
   * seria mentira: o valor `CUSTOMER` não existe naquele enum.
   */
  role: TokenRole;
  name: string;
  /** Presente apenas em token de cliente: o CPF usado na autenticação. */
  document?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
