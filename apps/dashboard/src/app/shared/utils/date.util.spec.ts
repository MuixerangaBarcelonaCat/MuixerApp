import { formatValenciaDateAndTime } from './date.util';

describe('formatValenciaDateAndTime', () => {
  it('splits an instant into Valencia date (dd/mm/yyyy) and time (HH:mm)', () => {
    // 16:42 UTC is 18:42 in Valencia during summer time (CEST, UTC+2).
    expect(formatValenciaDateAndTime('2026-10-20T16:42:00.000Z')).toEqual({ date: '20/10/2026', time: '18:42' });
  });

  it('follows the winter offset (CET, UTC+1)', () => {
    expect(formatValenciaDateAndTime('2026-10-27T17:42:00.000Z')).toEqual({ date: '27/10/2026', time: '18:42' });
  });

  it('rolls over to the next Valencia day near midnight UTC', () => {
    expect(formatValenciaDateAndTime('2026-10-27T23:30:00.000Z')).toEqual({ date: '28/10/2026', time: '00:30' });
  });
});
