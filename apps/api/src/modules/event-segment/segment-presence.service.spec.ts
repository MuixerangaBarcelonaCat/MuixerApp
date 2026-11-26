import { Repository } from 'typeorm';
import { PRESENCE_EDITING_WINDOW_MS } from '@muixer/shared';
import { User } from '../user/user.entity';
import { SegmentPresenceService } from './segment-presence.service';

describe('SegmentPresenceService', () => {
  let userRepo: { findOne: jest.Mock };
  let service: SegmentPresenceService;

  beforeEach(() => {
    jest.useFakeTimers();
    userRepo = {
      findOne: jest.fn(({ where: { id } }) =>
        Promise.resolve({ id, person: id === 'no-person' ? null : { alias: `alias-${id}` } }),
      ),
    };
    service = new SegmentPresenceService(userRepo as unknown as Repository<User>);
  });

  afterEach(() => jest.useRealTimers());

  it('a request without editing=1 records nothing', () => {
    // Only markEditing writes: a plain poll (editorsIn) leaves no trace of the caller.
    expect(service.editorsIn('s1', 'u1')).toEqual([]);
    expect(service.editorsIn('s1', 'u2')).toEqual([]);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('editorsIn returns users who edited within PRESENCE_EDITING_WINDOW_MS, excluding the caller', async () => {
    await service.markEditing('s1', 'u1');
    await service.markEditing('s1', 'u2');
    await service.markEditing('s2', 'u3');

    expect(service.editorsIn('s1', 'u1')).toEqual([{ userId: 'u2', alias: 'alias-u2' }]);
    expect(service.editorsIn('s1', 'u9')).toEqual([
      { userId: 'u1', alias: 'alias-u1' },
      { userId: 'u2', alias: 'alias-u2' },
    ]);
  });

  it('an editor disappears PRESENCE_EDITING_WINDOW_MS after their last edit', async () => {
    await service.markEditing('s1', 'u2');
    jest.advanceTimersByTime(PRESENCE_EDITING_WINDOW_MS - 1_000);
    await service.markEditing('s1', 'u2');
    jest.advanceTimersByTime(PRESENCE_EDITING_WINDOW_MS - 1);
    expect(service.editorsIn('s1', 'u1')).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(service.editorsIn('s1', 'u1')).toEqual([]);
  });

  it('two devices of the same user collapse into one editor', async () => {
    await service.markEditing('s1', 'u2');
    await service.markEditing('s1', 'u2');
    expect(service.editorsIn('s1', 'u1')).toEqual([{ userId: 'u2', alias: 'alias-u2' }]);
  });

  it('resolves the alias once per user', async () => {
    await service.markEditing('s1', 'u2');
    await service.markEditing('s1', 'u2');
    await service.markEditing('s1', 'u2');
    expect(userRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('falls back to «Un altre tècnic» for a user with no linked person', async () => {
    await service.markEditing('s1', 'no-person');
    expect(service.editorsIn('s1', 'u1')).toEqual([{ userId: 'no-person', alias: 'Un altre tècnic' }]);
  });
});
