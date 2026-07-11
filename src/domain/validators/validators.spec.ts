import { IsValidDocument } from './is-valid-document.validator';
import { IsLicensePlate } from './is-license-plate.validator';
import { CustomerType } from '../enums/customer-type.enum';
import { validate } from 'class-validator';

class DocumentDto {
  type!: CustomerType;

  @IsValidDocument()
  document!: string;
}

class PlateDto {
  @IsLicensePlate()
  licensePlate!: string;
}

describe('IsValidDocument', () => {
  it('should pass for valid CPF on INDIVIDUAL', async () => {
    const dto = Object.assign(new DocumentDto(), {
      type: CustomerType.INDIVIDUAL,
      document: '529.982.247-25',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for invalid CPF on INDIVIDUAL', async () => {
    const dto = Object.assign(new DocumentDto(), {
      type: CustomerType.INDIVIDUAL,
      document: '000.000.000-00',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should pass for valid CNPJ on COMPANY', async () => {
    const dto = Object.assign(new DocumentDto(), {
      type: CustomerType.COMPANY,
      document: '11.222.333/0001-81',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for invalid CNPJ on COMPANY', async () => {
    const dto = Object.assign(new DocumentDto(), {
      type: CustomerType.COMPANY,
      document: '00.000.000/0000-00',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when type is unknown', async () => {
    const dto = Object.assign(new DocumentDto(), {
      type: 'UNKNOWN' as CustomerType,
      document: '529.982.247-25',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when document is not a string', async () => {
    const dto = Object.assign(new DocumentDto(), {
      type: CustomerType.INDIVIDUAL,
      document: 12345 as unknown as string,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('IsLicensePlate', () => {
  it('should pass for old-format plate (ABC1234)', async () => {
    const dto = Object.assign(new PlateDto(), { licensePlate: 'ABC1234' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass for Mercosul plate (ABC1D23)', async () => {
    const dto = Object.assign(new PlateDto(), { licensePlate: 'ABC1D23' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail for invalid plate', async () => {
    const dto = Object.assign(new PlateDto(), { licensePlate: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when plate is not a string', async () => {
    const dto = Object.assign(new PlateDto(), {
      licensePlate: 12345 as unknown as string,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
