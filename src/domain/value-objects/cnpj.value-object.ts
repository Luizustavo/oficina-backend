import { InvalidCnpjException } from '../../shared/exceptions/domain.exceptions';

export class Cnpj {
  private readonly value: string;

  constructor(cnpj: string) {
    const cleaned = cnpj.replace(/\D/g, '');
    if (!Cnpj.isValid(cleaned)) {
      throw new InvalidCnpjException();
    }
    this.value = cleaned;
  }

  static isValid(cnpj: string): boolean {
    const cleaned = cnpj.replace(/\D/g, '');

    if (cleaned.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cleaned)) return false;

    const calcDigit = (digits: string, weights: number[]): number => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += parseInt(digits[i]) * weights[i];
      }
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const digit1 = calcDigit(cleaned, weights1);
    if (digit1 !== parseInt(cleaned[12])) return false;

    const digit2 = calcDigit(cleaned, weights2);
    if (digit2 !== parseInt(cleaned[13])) return false;

    return true;
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Cnpj): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
