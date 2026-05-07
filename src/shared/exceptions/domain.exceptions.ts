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
