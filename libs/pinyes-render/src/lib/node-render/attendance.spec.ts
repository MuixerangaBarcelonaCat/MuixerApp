import { attendanceLegend, attendanceVisual } from './attendance';

describe('attendanceVisual', () => {
  it.each(['before', 'day'] as const)(
    'until the start time (%s): coming is confirmed, no answer is pending, not coming is absent',
    (phase) => {
      expect(attendanceVisual('ANIRE', phase)).toBe('confirmed');
      expect(attendanceVisual('PENDENT', phase)).toBe('pending');
      expect(attendanceVisual('NO_VAIG', phase)).toBe('absent');
    },
  );

  it.each(['started', 'after'] as const)(
    'from the start time (%s): said yes but not here yet is pending, no answer and not coming are absent',
    (phase) => {
      expect(attendanceVisual('ANIRE', phase)).toBe('pending');
      expect(attendanceVisual('PENDENT', phase)).toBe('absent');
      expect(attendanceVisual('NO_VAIG', phase)).toBe('absent');
    },
  );

  it.each(['before', 'day', 'started', 'after'] as const)('someone who is here is confirmed (%s)', (phase) => {
    expect(attendanceVisual('ASSISTIT', phase)).toBe('confirmed');
  });

  it('draws a person with no known status as confirmed: no information adds no mark', () => {
    expect(attendanceVisual(undefined, 'started')).toBe('confirmed');
    expect(attendanceVisual(null, 'before')).toBe('confirmed');
  });
});

describe('attendanceLegend', () => {
  it('before the event day: coming, no answer, not coming', () => {
    expect(attendanceLegend('before')).toEqual([
      { fill: 'confirmed', label: 'Ve' },
      { fill: 'pending', label: 'Pendent' },
      { fill: 'absent', label: 'No ve' },
    ]);
  });

  it('on the day, before the start time: here or coming, no answer, not coming', () => {
    expect(attendanceLegend('day')).toEqual([
      { fill: 'confirmed', label: 'Ha arribat o ve' },
      { fill: 'pending', label: 'Pendent' },
      { fill: 'absent', label: 'No vindrà' },
    ]);
  });

  it('from the start time: here, not here yet, no answer or not coming', () => {
    expect(attendanceLegend('started')).toEqual([
      { fill: 'confirmed', label: 'Ha arribat' },
      { fill: 'pending', label: 'No ha arribat' },
      { fill: 'absent', label: 'Pendent o no vindrà' },
    ]);
  });
});
