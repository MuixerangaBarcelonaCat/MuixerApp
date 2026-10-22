import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent, UnrecoverableStateEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let swUpdate: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<UnrecoverableStateEvent>;
    checkForUpdate: ReturnType<typeof vi.fn>;
    activateUpdate: ReturnType<typeof vi.fn>;
  };

  function create(isEnabled = true): AppUpdateService {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    swUpdate = {
      isEnabled,
      versionUpdates,
      unrecoverable,
      checkForUpdate: vi.fn().mockResolvedValue(false),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: swUpdate }] });
    const service = TestBed.inject(AppUpdateService);
    vi.spyOn(service, 'reload').mockImplementation(() => undefined);
    return service;
  }

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => setVisibility('visible'));

  it('flags an update once a new version is ready', () => {
    const service = create();
    expect(service.updateReady()).toBe(false);

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(service.updateReady()).toBe(false);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    expect(service.updateReady()).toBe(true);
  });

  it('checks for a new version when the app comes back to the foreground', () => {
    create();
    setVisibility('hidden');
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('activates the new version and reloads', async () => {
    const service = create();
    await service.update();
    expect(swUpdate.activateUpdate).toHaveBeenCalled();
    expect(service.reload).toHaveBeenCalled();
  });

  it('still reloads when activation fails', async () => {
    const service = create();
    swUpdate.activateUpdate.mockRejectedValue(new Error('gone'));
    await service.update();
    expect(service.reload).toHaveBeenCalled();
  });

  it('reloads when the cached version can no longer be served', () => {
    const service = create();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'missing chunk' });
    expect(service.reload).toHaveBeenCalled();
  });

  it('does nothing when the service worker is disabled', () => {
    const service = create(false);
    setVisibility('visible');
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
    expect(service.updateReady()).toBe(false);
  });
});
