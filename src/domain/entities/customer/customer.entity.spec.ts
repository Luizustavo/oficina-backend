import { DomainException } from '@shared/exceptions/domain.exceptions';
import { CustomerEntity } from './customer.entity';
import { CustomerType } from '@domain/enums/customer-type.enum';

const validIndividualProps = {
  name: 'Carlos Silva',
  document: '52998224725',
  type: CustomerType.INDIVIDUAL,
  email: 'carlos@email.com',
  phone: '11999990001',
};

const validCompanyProps = {
  name: 'Empresa Ltda',
  document: '11222333000181',
  type: CustomerType.COMPANY,
  email: 'contato@empresa.com',
  phone: '11999990002',
};

describe('Customer', () => {
  describe('create', () => {
    it('should create an INDIVIDUAL customer with valid props', () => {
      const customer = CustomerEntity.create(validIndividualProps, '1');
      expect(customer.id).toBe('1');
      expect(customer.name).toBe('Carlos Silva');
      expect(customer.type).toBe(CustomerType.INDIVIDUAL);
      expect(customer.document).toBe('52998224725');
      expect(customer.createdAt).toBeInstanceOf(Date);
    });

    it('should create a COMPANY customer with valid props', () => {
      const customer = CustomerEntity.create(validCompanyProps);
      expect(customer.type).toBe(CustomerType.COMPANY);
      expect(customer.document).toBe('11222333000181');
    });

    it('should throw DomainException for an empty name', () => {
      expect(() =>
        CustomerEntity.create({ ...validIndividualProps, name: '' }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for a name shorter than 2 characters', () => {
      expect(() =>
        CustomerEntity.create({ ...validIndividualProps, name: 'A' }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for an invalid email', () => {
      expect(() =>
        CustomerEntity.create({
          ...validIndividualProps,
          email: 'not-an-email',
        }),
      ).toThrow(DomainException);
    });

    it('should throw DomainException for an empty phone', () => {
      expect(() =>
        CustomerEntity.create({ ...validIndividualProps, phone: '' }),
      ).toThrow(DomainException);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a customer from persisted props', () => {
      const now = new Date();
      const customer = CustomerEntity.reconstitute(
        {
          ...validIndividualProps,
          createdAt: now,
          updatedAt: now,
        },
        '1',
      );
      expect(customer.id).toBe('1');
      expect(customer.createdAt).toBe(now);
    });
  });

  describe('update', () => {
    it('should update the name', () => {
      const customer = CustomerEntity.create(validIndividualProps);
      customer.update({ name: 'New Name' });
      expect(customer.name).toBe('New Name');
    });

    it('should update the email', () => {
      const customer = CustomerEntity.create(validIndividualProps);
      customer.update({ email: 'newemail@test.com' });
      expect(customer.email).toBe('newemail@test.com');
    });

    it('should throw DomainException when updating with invalid email', () => {
      const customer = CustomerEntity.create(validIndividualProps);
      expect(() => customer.update({ email: 'bad-email' })).toThrow(
        DomainException,
      );
    });

    it('should throw DomainException when updating with name too short', () => {
      const customer = CustomerEntity.create(validIndividualProps);
      expect(() => customer.update({ name: 'X' })).toThrow(DomainException);
    });
  });
});
