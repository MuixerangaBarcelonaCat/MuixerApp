import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventType } from '@muixer/shared';
import { CreateEventDto } from './create-event.dto';

describe('CreateEventDto', () => {
  const base = { title: 'Assaig', eventType: EventType.ASSAIG, date: '2026-05-10' };

  it('accepts an event with no season field', async () => {
    expect(await validate(plainToInstance(CreateEventDto, base))).toHaveLength(0);
  });

  it('no longer has a seasonId field: the season is derived from the date', async () => {
    const errors = await validate(plainToInstance(CreateEventDto, { ...base, seasonId: 'e4b6a3c1-6f1e-4b52-9a0f-2d3c4b5a6e7f' }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(['seasonId']);
  });
});
