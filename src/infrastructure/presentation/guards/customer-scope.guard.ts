import {
  ForbiddenException,
  ExecutionContext,
  CanActivate,
  Injectable,
} from '@nestjs/common';
import {
  CustomerScopeOptions,
  CUSTOMER_SCOPE_KEY,
} from '@infrastructure/presentation/decorators/customer-scope.decorator';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { JwtPayload } from '@infrastructure/presentation/decorators/current-user.decorator';
import { isCustomer } from '@domain/enums/token-role.enum';
import { Reflector } from '@nestjs/core';

/**
 * Restringe token de cliente aos próprios dados.
 *
 * Funciona por negação: se o token é de cliente e a rota não foi marcada com
 * `@CustomerScope(...)`, o acesso é negado. Só o que é explicitamente
 * liberado passa.
 *
 * Token de funcionário não é afetado — este guard devolve `true` na primeira
 * linha para qualquer papel que não seja `CUSTOMER`, deixando a autorização
 * de funcionário inteiramente a cargo do `RolesGuard`.
 */
@Injectable()
export class CustomerScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly orderRepository: IServiceOrderRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      params: Record<string, string>;
    }>();

    const user = request.user;
    if (!user || !isCustomer(user.role)) {
      return true;
    }

    const scope = this.reflector.getAllAndOverride<
      CustomerScopeOptions | undefined
    >(CUSTOMER_SCOPE_KEY, [context.getHandler(), context.getClass()]);

    if (!scope) {
      throw new ForbiddenException(
        'This resource is not available to customer accounts',
      );
    }

    if (scope.param) {
      if (request.params?.[scope.param] !== user.sub) {
        throw new ForbiddenException('You can only access your own data');
      }
    }

    if (scope.order) {
      const orderId = request.params?.[scope.order];
      const order = orderId
        ? await this.orderRepository.findById(orderId)
        : null;

      // Ordem inexistente e ordem de outro cliente devolvem a mesma resposta:
      // diferenciá-las permitiria descobrir quais ids existem.
      if (!order || order.customerId !== user.sub) {
        throw new ForbiddenException('You can only access your own data');
      }
    }

    return true;
  }
}
