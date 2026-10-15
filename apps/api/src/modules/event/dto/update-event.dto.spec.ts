import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateEventDto } from './update-event.dto';

describe('UpdateEventDto', () => {
  const errorsFor = async (input: Record<string, unknown>) =>
    validate(plainToInstance(UpdateEventDto, input), { whitelist: true, forbidNonWhitelisted: true });

  it('accepts expectedNotes alongside notes', async () => {
    expect(await errorsFor({ notes: 'Nou', expectedNotes: 'Antic' })).toHaveLength(0);
  });

  it('accepts an empty expectedNotes, the editor baseline for notes never written', async () => {
    expect(await errorsFor({ notes: 'Nou', expectedNotes: '' })).toHaveLength(0);
  });

  it('rejects a non-string expectedNotes', async () => {
    const errors = await errorsFor({ notes: 'Nou', expectedNotes: 42 });
    expect(errors.some((e) => e.property === 'expectedNotes')).toBe(true);
  });
});
