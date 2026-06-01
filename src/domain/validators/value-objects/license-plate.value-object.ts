import { InvalidLicensePlateException } from '../../../shared/exceptions/domain.exceptions';

export class LicensePlate {
  private readonly value: string;

  // Mercosul: ABC1D23 | Old Brazilian: ABC1234 or ABC-1234
  private static readonly MERCOSUL_REGEX = /^[A-Z]{3}\d[A-Z]\d{2}$/;
  private static readonly OLD_REGEX = /^[A-Z]{3}\d{4}$/;

  constructor(plate: string) {
    const normalized = plate.toUpperCase().replace(/-/g, '').trim();
    if (!LicensePlate.isValid(normalized)) {
      throw new InvalidLicensePlateException(plate);
    }
    this.value = normalized;
  }

  static isValid(plate: string): boolean {
    const normalized = plate.toUpperCase().replace(/-/g, '').trim();
    return (
      LicensePlate.MERCOSUL_REGEX.test(normalized) ||
      LicensePlate.OLD_REGEX.test(normalized)
    );
  }

  getValue(): string {
    return this.value;
  }

  isMercosul(): boolean {
    return LicensePlate.MERCOSUL_REGEX.test(this.value);
  }

  equals(other: LicensePlate): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
