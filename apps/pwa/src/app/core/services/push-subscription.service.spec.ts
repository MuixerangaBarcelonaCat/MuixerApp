import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { PushSubscriptionService } from './push-subscription.service';

const mockSubscription = {
  endpoint: 'https://fcm.googleapis.com/push/test',
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/push/test',
    keys: { p256dh: 'abc123', auth: 'secret' },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

const mockPushManager = {
  subscribe: vi.fn().mockResolvedValue(mockSubscription),
  getSubscription: vi.fn().mockResolvedValue(null),
};

const mockRegistration = { pushManager: mockPushManager };

Object.defineProperty(globalThis, 'navigator', {
  value: {
    serviceWorker: {
      ready: Promise.resolve(mockRegistration),
    },
    userAgent: 'Vitest/1.0',
  },
  configurable: true,
});

const defaultNotification = { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') };

Object.defineProperty(globalThis, 'Notification', {
  value: defaultNotification,
  configurable: true,
});

Object.defineProperty(globalThis, 'PushManager', { value: {}, configurable: true });

describe('PushSubscriptionService', () => {
  let service: PushSubscriptionService;
  let http: HttpTestingController;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'Notification', {
      value: defaultNotification,
      configurable: true,
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PushSubscriptionService);
    http = TestBed.inject(HttpTestingController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    http.verify();
    Object.defineProperty(globalThis, 'Notification', {
      value: defaultNotification,
      configurable: true,
    });
  });

  it('pushSupported returns true when PushManager is in window', () => {
    expect(service.pushSupported()).toBe(true);
  });

  describe('checkStatus', () => {
    it('updates isSubscribed and deviceCount from API response', async () => {
      const promise = service.checkStatus();
      http.expectOne('/api/me/push-subscriptions/status').flush({ isSubscribed: true, deviceCount: 2 });
      await promise;
      expect(service.isSubscribed()).toBe(true);
      expect(service.deviceCount()).toBe(2);
    });

    it('does not throw on API error', async () => {
      const promise = service.checkStatus();
      http.expectOne('/api/me/push-subscriptions/status').error(new ProgressEvent('error'));
      await expect(promise).resolves.not.toThrow();
    });
  });

  describe('requestPermissionAndSubscribe', () => {
    it('subscribes and registers when permission granted', async () => {
      const promise = service.requestPermissionAndSubscribe();
      await Promise.resolve();
      http.expectOne('/api/notifications/vapid-public-key').flush({ publicKey: 'test-key' });
      await new Promise((r) => setTimeout(r, 0));
      http.expectOne('/api/me/push-subscriptions').flush({ id: 'sub-1' });
      const result = await promise;
      expect(result).toBe(true);
      expect(service.isSubscribed()).toBe(true);
    });

    it('returns false when permission denied', async () => {
      Object.defineProperty(globalThis, 'Notification', {
        value: { permission: 'denied', requestPermission: vi.fn().mockResolvedValue('denied') },
        configurable: true,
      });
      const result = await service.requestPermissionAndSubscribe();
      expect(result).toBe(false);
      http.expectNone('/api/me/push-subscriptions');
    });
  });

  describe('dismissBanner', () => {
    it('sets isDismissedRecently to true after dismissal', () => {
      expect(service.isDismissedRecently()).toBe(false);
      service.dismissBanner();
      expect(service.isDismissedRecently()).toBe(true);
    });
  });
});
