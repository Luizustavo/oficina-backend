import { InvalidCpfException } from '../../../shared/exceptions/domain.exceptions';

export class Cpf {
  private readonly value: string;

  constructor(cpf: string) {
    const cleaned = cpf.replace(/\D/g, '');
    if (!Cpf.isValid(cleaned)) {
      throw new InvalidCpfException();
    }
    this.value = cleaned;
  }

  static isValid(cpf: string): boolean {
    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleaned[10])) return false;

    return true;
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Cpf): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
