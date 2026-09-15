import { CustomerScopeGuard } from './customer-scope.guard';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { IServiceOrderRepository } from '@domain/repositories/service-order.repository.interface';
import { CUSTOMER_ROLE } from '@domain/enums/token-role.enum';
import { UserRole } from '@domain/enums/user-role.enum';
import { Reflector } from '@nestjs/core';

const CLIENTE = 'customer-1';
const OUTRO = 'customer-2';

const contexto = (
  user: Record<string, unknown> | undefined,
  params: Record<string, string> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  }) as unknown as ExecutionContext;

const montar = (escopo: unknown, order: unknown = null) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(escopo),
  } as unknown as Reflector;
  const repo = {
    findById: jest.fn().mockResolvedValue(order),
  } as unknown as IServiceOrderRepository;
  return { guard: new CustomerScopeGuard(reflector, repo), repo };
};

describe('CustomerScopeGuard', () => {
  describe('não interfere em quem não é cliente', () => {
    it.each([UserRole.ADMIN, UserRole.MECHANIC, UserRole.ATTENDANT])(
      'libera %s mesmo sem @CustomerScope',
      async (role) => {
        const { guard } = montar(undefined);
        await expect(
          guard.canActivate(contexto({ sub: 'u1', role })),
        ).resolves.toBe(true);
      },
    );

    it('libera requisição sem usuário — rota pública, o JwtAuthGuard já decidiu', async () => {
      const { guard } = montar(undefined);
      await expect(guard.canActivate(contexto(undefined))).resolves.toBe(true);
    });
  });

  describe('nega por padrão', () => {
    it('bloqueia cliente em rota sem @CustomerScope', async () => {
      // É o coração da correção: antes, toda rota sem @Roles ficava aberta a
      // qualquer token autenticado, e o cliente listava a oficina inteira.
      const { guard } = montar(undefined);
      await expect(
        guard.canActivate(contexto({ sub: CLIENTE, role: CUSTOMER_ROLE })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('não consulta o banco quando já nega', async () => {
      const { guard, repo } = montar(undefined);
      await expect(
        guard.canActivate(contexto({ sub: CLIENTE, role: CUSTOMER_ROLE })),
      ).rejects.toThrow();
      expect(repo.findById).not.toHaveBeenCalled();
    });
  });

  describe('@CustomerScope() sem restrição', () => {
    it('libera cliente onde não existe dono', async () => {
      const { guard } = montar({});
      await expect(
        guard.canActivate(contexto({ sub: CLIENTE, role: CUSTOMER_ROLE })),
      ).resolves.toBe(true);
    });
  });

  describe('@CustomerScope({ param })', () => {
    it('libera quando o parâmetro é o próprio id', async () => {
      const { guard } = montar({ param: 'customerId' });
      await expect(
        guard.canActivate(
          contexto(
            { sub: CLIENTE, role: CUSTOMER_ROLE },
            { customerId: CLIENTE },
          ),
        ),
      ).resolves.toBe(true);
    });

    it('bloqueia quando o parâmetro é de outro cliente', async () => {
      const { guard } = montar({ param: 'customerId' });
      await expect(
        guard.canActivate(
          contexto(
            { sub: CLIENTE, role: CUSTOMER_ROLE },
            { customerId: OUTRO },
          ),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('bloqueia quando o parâmetro não veio', async () => {
      const { guard } = montar({ param: 'customerId' });
      await expect(
        guard.canActivate(contexto({ sub: CLIENTE, role: CUSTOMER_ROLE }, {})),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('@CustomerScope({ order })', () => {
    it('libera ordem do próprio cliente', async () => {
      const { guard } = montar({ order: 'id' }, { customerId: CLIENTE });
      await expect(
        guard.canActivate(
          contexto({ sub: CLIENTE, role: CUSTOMER_ROLE }, { id: 'so-1' }),
        ),
      ).resolves.toBe(true);
    });

    it('bloqueia ordem de outro cliente', async () => {
      const { guard } = montar({ order: 'id' }, { customerId: OUTRO });
      await expect(
        guard.canActivate(
          contexto({ sub: CLIENTE, role: CUSTOMER_ROLE }, { id: 'so-1' }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('responde igual para ordem inexistente e ordem alheia', async () => {
      // Diferenciar as duas deixaria descobrir quais ids existem.
      const inexistente = montar({ order: 'id' }, null);
      const alheia = montar({ order: 'id' }, { customerId: OUTRO });

      const erroA = await inexistente.guard
        .canActivate(
          contexto({ sub: CLIENTE, role: CUSTOMER_ROLE }, { id: 'x' }),
        )
        .catch((e: Error) => e.message);
      const erroB = await alheia.guard
        .canActivate(
          contexto({ sub: CLIENTE, role: CUSTOMER_ROLE }, { id: 'y' }),
        )
        .catch((e: Error) => e.message);

      expect(erroA).toBe(erroB);
    });
  });
});
