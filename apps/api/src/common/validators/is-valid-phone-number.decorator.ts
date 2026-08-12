import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValidPhoneNumber } from 'libphonenumber-js';

/** Valid E.164 phone number (with explicit country prefix), backed by libphonenumber-js. */
export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidPhoneNumber',
      target: object.constructor,
      propertyName,
      options: {
        message: 'El telèfon ha de ser un número vàlid en format internacional, per exemple +34612345678',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidPhoneNumber(value);
        },
      },
    });
  };
}
