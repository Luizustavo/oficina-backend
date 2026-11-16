export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}

export class InvalidCpfException extends DomainException {
  constructor() {
    super('Invalid CPF document');
    this.name = 'InvalidCpfException';
  }
}

export class InvalidCnpjException extends DomainException {
  constructor() {
    super('Invalid CNPJ document');
    this.name = 'InvalidCnpjException';
  }
}

export class InvalidLicensePlateException extends DomainException {
  constructor(plate: string) {
    super(`Invalid license plate: ${plate}`);
    this.name = 'InvalidLicensePlateException';
  }
}

export class InvalidStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(`Cannot transition service order from ${from} to ${to}`);
    this.name = 'InvalidStatusTransitionException';
  }
}

export class InsufficientStockException extends DomainException {
  constructor(partName: string, requested: number, available: number) {
    super(
      `Insufficient stock for part "${partName}": requested ${requested}, available ${available}`,
    );
    this.name = 'InsufficientStockException';
  }
}

export class NotFoundException extends DomainException {
  constructor(entity: string, id: string) {
    super(`${entity} with id "${id}" not found`);
    this.name = 'NotFoundException';
  }
}

export class ConflictException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictException';
  }
}

export class BusinessRuleException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleException';
  }
}

/**
 * Mensagem da saga que nunca vai ser processada, por mais que se tente:
 * JSON quebrado, envelope incompleto, `type` ou `version` desconhecidos.
 * O consumidor manda direto para a DLQ, sem retentativa
 * (docs/arquitetura/contratos-de-mensagens.md, seção 4).
 */
export class InvalidMessageException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMessageException';
  }
}

/**
 * Evento da saga que chegou antes da hora (ex.: `job.completed` antes de
 * `job.started`). Não é erro do evento: o consumidor manda para a
 * retentativa, e quando o anterior chegar ele passa a ser válido (ADR-011).
 */
export class SagaEventOutOfOrderException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = 'SagaEventOutOfOrderException';
  }
}
