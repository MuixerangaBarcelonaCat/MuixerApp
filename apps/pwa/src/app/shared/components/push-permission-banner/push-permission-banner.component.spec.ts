import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PushPermissionBannerComponent } from './push-permission-banner.component';
import { PushSubscriptionService } from '../../../core/services/push-subscription.service';
import { signal } from '@angular/core';

const makeService = (overrides: Partial<{
  pushSupported: boolean;
  pushPermission: NotificationPermission;
  isSubscribed: boolean;
  isDismissedRecently: boolean;
}> = {}): Partial<PushSubscriptionService> => {
  const opts = {
    pushSupported: true,
    pushPermission: 'default' as NotificationPermission,
    isSubscribed: false,
    isDismissedRecently: false,
    ...overrides,
  };
  return {
    pushSupported: signal(opts.pushSupported) as ReturnType<typeof signal<boolean>>,
    pushPermission: signal(opts.pushPermission) as ReturnType<typeof signal<NotificationPermission>>,
    isSubscribed: signal(opts.isSubscribed) as ReturnType<typeof signal<boolean>>,
    isDismissedRecently: signal(opts.isDismissedRecently) as ReturnType<typeof signal<boolean>>,
    requestPermissionAndSubscribe: vi.fn().mockResolvedValue(true),
    dismissBanner: vi.fn(),
  } as unknown as Partial<PushSubscriptionService>;
};

describe('PushPermissionBannerComponent', () => {
  it('shows banner when push supported, permission default, not subscribed, not dismissed', async () => {
    TestBed.configureTestingModule({
      imports: [PushPermissionBannerComponent],
      providers: [{ provide: PushSubscriptionService, useValue: makeService() }],
    });
    const fixture = TestBed.createComponent(PushPermissionBannerComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('hides banner when push not supported', async () => {
    TestBed.configureTestingModule({
      imports: [PushPermissionBannerComponent],
      providers: [{ provide: PushSubscriptionService, useValue: makeService({ pushSupported: false }) }],
    });
    const fixture = TestBed.createComponent(PushPermissionBannerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('hides banner when permission already granted', async () => {
    TestBed.configureTestingModule({
      imports: [PushPermissionBannerComponent],
      providers: [{ provide: PushSubscriptionService, useValue: makeService({ pushPermission: 'granted', isSubscribed: true }) }],
    });
    const fixture = TestBed.createComponent(PushPermissionBannerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('hides banner when recently dismissed', async () => {
    TestBed.configureTestingModule({
      imports: [PushPermissionBannerComponent],
      providers: [{ provide: PushSubscriptionService, useValue: makeService({ isDismissedRecently: true }) }],
    });
    const fixture = TestBed.createComponent(PushPermissionBannerComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('calls dismissBanner when "Ara no" clicked', async () => {
    const svc = makeService();
    TestBed.configureTestingModule({
      imports: [PushPermissionBannerComponent],
      providers: [{ provide: PushSubscriptionService, useValue: svc }],
    });
    const fixture = TestBed.createComponent(PushPermissionBannerComponent);
    fixture.detectChanges();
    const dismissBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="No activar ara"]');
    dismissBtn.click();
    expect(svc.dismissBanner).toHaveBeenCalled();
  });
});
