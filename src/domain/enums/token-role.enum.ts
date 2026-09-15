import { UserRole } from './user-role.enum';

/**
 * Papel do cliente da oficina.
 *
 * Fica fora de `UserRole` de propósito: aquele enum espelha a coluna `role`
 * da tabela `users`, e cliente não é usuário do sistema — ele não tem
 * cadastro de acesso nem senha, só CPF. O token dele é emitido pela função
 * serverless de autenticação, não pelo login da aplicação.
 */
export const CUSTOMER_ROLE = 'CUSTOMER' as const;

/** Todo papel que pode aparecer no campo `role` de um JWT. */
export type TokenRole = UserRole | typeof CUSTOMER_ROLE;

export function isCustomer(role: TokenRole | undefined): boolean {
  return role === CUSTOMER_ROLE;
}
