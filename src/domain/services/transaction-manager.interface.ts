/**
 * Porta de transação do banco, para os casos de uso coordenarem várias
 * gravações (OS, saga, estoque, outbox) sem conhecer o Prisma.
 */
export abstract class ITransactionManager {
  /**
   * Executa `fn` numa transação. Chamada dentro de outra, participa dela
   * (ex.: o consumidor de mensagens já abriu uma).
   */
  abstract run<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Agenda `fn` para depois do commit da transação atual (ou roda agora, se
   * não houver transação). Para efeitos fora do banco, como e-mail e
   * métricas: se a transação for desfeita, eles não acontecem.
   */
  abstract afterCommit(fn: () => Promise<void> | void): void;
}
