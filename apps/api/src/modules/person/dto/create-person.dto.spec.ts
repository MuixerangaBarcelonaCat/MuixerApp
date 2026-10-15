import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePersonDto } from './create-person.dto';
import { UpdatePersonDto } from './update-person.dto';

async function shoulderHeightErrors(
  dtoClass: new () => Pick<CreatePersonDto, 'shoulderHeight'>,
  shoulderHeight: unknown,
) {
  const dto = plainToInstance(dtoClass, { name: 'Anna', alias: 'Anna', shoulderHeight } as object);
  const errors = await validate(dto);
  return { dto, messages: Object.values(errors.find((e) => e.property === 'shoulderHeight')?.constraints ?? {}) };
}

describe.each([
  ['CreatePersonDto', CreatePersonDto],
  ['UpdatePersonDto', UpdatePersonDto],
])('%s.shoulderHeight', (_name, dtoClass) => {
  it('accepts a numeric string and converts it to a number', async () => {
    const { dto, messages } = await shoulderHeightErrors(dtoClass, '166');
    expect(messages).toEqual([]);
    expect(dto.shoulderHeight).toBe(166);
  });

  it('accepts null, which clears the height', async () => {
    const { dto, messages } = await shoulderHeightErrors(dtoClass, null);
    expect(messages).toEqual([]);
    expect(dto.shoulderHeight).toBeNull();
  });

  it('rejects a height below the minimum with a Catalan message', async () => {
    const { messages } = await shoulderHeightErrors(dtoClass, 30);
    expect(messages).toEqual(["L'alçada ha de ser de 50 cm com a mínim."]);
  });

  it('rejects a height above the maximum with a Catalan message', async () => {
    const { messages } = await shoulderHeightErrors(dtoClass, 300);
    expect(messages).toEqual(["L'alçada ha de ser de 250 cm com a màxim."]);
  });

  it('rejects a non-integer height with a Catalan message', async () => {
    const { messages } = await shoulderHeightErrors(dtoClass, 166.5);
    expect(messages).toEqual(["L'alçada ha de ser un nombre enter."]);
  });
});
