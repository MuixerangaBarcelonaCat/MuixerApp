import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PushSubscriptionStatus } from '@muixer/shared';

const PUSH_DISMISSED_KEY = 'muixer_push_dismissed_at';
const PUSH_DISMISS_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly http = inject(HttpClient);

  private readonly _permission = signal<NotificationPermission>(this.readPermission());
  private readonly _isSubscribed = signal(false);
  private readonly _deviceCount = signal(0);
  private readonly _dismissedAt = signal<number | null>(this.readDismissedTimestamp());
  private cachedVapidKey: string | null = null;

  readonly pushSupported = computed(() => this.isPushSupported());
  readonly pushPermission = this._permission.asReadonly();
  readonly isSubscribed = this._isSubscribed.asReadonly();
  readonly deviceCount = this._deviceCount.asReadonly();

  /** Whether the user already dismissed the banner and the cooldown is still active. */
  readonly isDismissedRecently = computed(() => {
    const dismissedMs = this._dismissedAt();
    if (!dismissedMs) return false;
    const cooldownMs = PUSH_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedMs < cooldownMs;
  });

  async checkStatus(): Promise<void> {
    if (!this.isPushSupported()) return;
    this._permission.set(this.readPermission());
    try {
      const status = await firstValueFrom(
        this.http.get<PushSubscriptionStatus>('/api/me/push-subscriptions/status'),
      );
      this._isSubscribed.set(status.isSubscribed);
      this._deviceCount.set(status.deviceCount);
    } catch {
      // Non-critical: status check failure doesn't break the app.
    }
  }

  async requestPermissionAndSubscribe(): Promise<boolean> {
    if (!this.isPushSupported()) return false;

    const permission = await Notification.requestPermission();
    this._permission.set(permission);
    if (permission !== 'granted') return false;

    return this.subscribeAndRegister();
  }

  async unsubscribe(): Promise<void> {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (!existing) {
      this._isSubscribed.set(false);
      this._deviceCount.set(0);
      return;
    }

    const endpoint = existing.endpoint;
    await existing.unsubscribe();

    try {
      await firstValueFrom(
        this.http.delete('/api/me/push-subscriptions', { body: { endpoint } }),
      );
    } catch {
      // Already unsubscribed client-side; backend will deactivate eventually.
    }

    this._isSubscribed.set(false);
    this._deviceCount.set(0);
  }

  dismissBanner(): void {
    const now = Date.now();
    this.setItem(PUSH_DISMISSED_KEY, String(now));
    this._dismissedAt.set(now);
  }

  private async subscribeAndRegister(): Promise<boolean> {
    try {
      const vapidKey = await this.getVapidPublicKey();
      if (!vapidKey) return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await firstValueFrom(
        this.http.post('/api/me/push-subscriptions', {
          endpoint,
          keys,
          userAgent: navigator.userAgent.slice(0, 255),
        }),
      );

      this._isSubscribed.set(true);
      this._deviceCount.update((n) => n + 1);
      return true;
    } catch {
      return false;
    }
  }

  private async getVapidPublicKey(): Promise<string | null> {
    if (this.cachedVapidKey) return this.cachedVapidKey;
    try {
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>('/api/notifications/vapid-public-key'),
      );
      this.cachedVapidKey = publicKey;
      return publicKey;
    } catch {
      return null;
    }
  }

  private isPushSupported(): boolean {
    return typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator;
  }

  private readPermission(): NotificationPermission {
    try {
      return typeof Notification !== 'undefined' ? Notification.permission : 'default';
    } catch {
      return 'default';
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  private readDismissedTimestamp(): number | null {
    try {
      const raw = localStorage.getItem(PUSH_DISMISSED_KEY);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  }

  private getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage unavailable (private mode) — dismiss state just won't persist.
    }
  }
}
