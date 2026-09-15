import { SetMetadata } from '@nestjs/common';

export const CUSTOMER_SCOPE_KEY = 'customer-scope';

export interface CustomerScopeOptions {
  /**
   * Nome do parâmetro de rota que precisa ser o próprio id do cliente.
   * Ex.: `GET /api/service-orders/customer/:customerId` com
   * `{ param: 'customerId' }` só permite o cliente consultar a si mesmo.
   */
  param?: string;

  /**
   * Nome do parâmetro de rota que carrega o id de uma ordem de serviço. A
   * ordem é carregada e o `customerId` dela precisa ser o do token.
   * Ex.: `GET /api/service-orders/:id` com `{ order: 'id' }`.
   */
  order?: string;
}

/**
 * Libera a rota para token de cliente (`role: CUSTOMER`).
 *
 * Sem este decorator, o `CustomerScopeGuard` **nega** — a regra é negar por
 * padrão. Isso é deliberado: antes dele, qualquer rota sem `@Roles()` ficava
 * aberta a qualquer token autenticado, e um cliente conseguia listar todas as
 * ordens da oficina e até apagar outros clientes e veículos.
 *
 * Sem opções, libera sem restrição de dono — use apenas onde não existe dono,
 * como o catálogo de serviços e `/api/auth/me`.
 */
export const CustomerScope = (options: CustomerScopeOptions = {}) =>
  SetMetadata(CUSTOMER_SCOPE_KEY, options);
