import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { CustomerType } from '@domain/enums/customer-type.enum';
import { Cpf } from './value-objects/cpf.value-object';
import { Cnpj } from './value-objects/cnpj.value-object';

export function IsValidDocument(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDocument',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      options: {
        message: ({ object: obj }: ValidationArguments) => {
          const type = (obj as { type?: CustomerType }).type;
          if (type === CustomerType.INDIVIDUAL)
            return 'document must be a valid CPF';
          if (type === CustomerType.COMPANY)
            return 'document must be a valid CNPJ';
          return 'document must be a valid CPF or CNPJ depending on type';
        },
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const obj = args.object as { type?: CustomerType };
          if (obj.type === CustomerType.INDIVIDUAL) return Cpf.isValid(value);
          if (obj.type === CustomerType.COMPANY) return Cnpj.isValid(value);
          return false;
        },
      },
    });
  };
}
