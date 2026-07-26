import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { SyncController } from './sync.controller';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';
import { EventSyncStrategy } from './strategies/event-sync.strategy';
import { AttendanceSyncStrategy } from './strategies/attendance-sync.strategy';
import { SyncLockService } from './sync-lock.service';
import { SyncEvent } from './interfaces/sync-event.interface';

const mockPersonSyncStrategy = { execute: jest.fn() };
const mockEventSyncStrategy = { execute: jest.fn() };
const mockAttendanceSyncStrategy = { executeSingleEvent: jest.fn() };

async function collect(observable: { subscribe: (o: { next: (v: unknown) => void; complete: () => void }) => void }): Promise<unknown[]> {
  return new Promise((resolve) => {
    const events: unknown[] = [];
    observable.subscribe({
      next: (v) => events.push(v),
      complete: () => resolve(events),
    });
  });
}

describe('SyncController — concurrency guard', () => {
  let controller: SyncController;
  let syncLock: SyncLockService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        { provide: PersonSyncStrategy, useValue: mockPersonSyncStrategy },
        { provide: EventSyncStrategy, useValue: mockEventSyncStrategy },
        { provide: AttendanceSyncStrategy, useValue: mockAttendanceSyncStrategy },
        SyncLockService,
      ],
    }).compile();

    controller = module.get<SyncController>(SyncController);
    syncLock = module.get<SyncLockService>(SyncLockService);
  });

  it('rejects a second concurrent /sync/persons call without invoking the strategy again', async () => {
    const subject = new Subject<SyncEvent>();
    mockPersonSyncStrategy.execute.mockReturnValue(subject.asObservable());

    const first$ = controller.syncPersons();
    const firstEvents: unknown[] = [];
    first$.subscribe({ next: (v) => firstEvents.push(v) });

    const second$ = controller.syncPersons();
    const secondEvents = await collect(second$);

    expect(mockPersonSyncStrategy.execute).toHaveBeenCalledTimes(1);
    expect(secondEvents).toHaveLength(1);
    expect((secondEvents[0] as { data: string }).data).toContain('en curs');

    subject.complete();
  });

  it('releases the lock once the first sync completes, allowing a new one', async () => {
    const subject = new Subject<SyncEvent>();
    mockPersonSyncStrategy.execute.mockReturnValueOnce(subject.asObservable());

    const first$ = controller.syncPersons();
    first$.subscribe({ next: () => undefined });
    subject.next({ type: 'complete', entity: 'person', message: 'done' });
    subject.complete();

    expect(syncLock.tryAcquire()).toBe(true);
    syncLock.release();

    mockPersonSyncStrategy.execute.mockReturnValueOnce(new Subject<SyncEvent>().asObservable());
    controller.syncPersons();
    expect(mockPersonSyncStrategy.execute).toHaveBeenCalledTimes(2);
  });

  it('rejects /sync/all while /sync/persons is running (shared lock across endpoints)', async () => {
    const subject = new Subject<SyncEvent>();
    mockPersonSyncStrategy.execute.mockReturnValue(subject.asObservable());

    controller.syncPersons().subscribe({ next: () => undefined });

    const all$ = controller.syncAll();
    const allEvents = await collect(all$);

    expect(allEvents).toHaveLength(1);
    expect((allEvents[0] as { data: string }).data).toContain('en curs');

    subject.complete();
  });
});
