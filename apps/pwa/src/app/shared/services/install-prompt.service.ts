import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const REMIND_AFTER_LOGINS = 10;
const LOGIN_COUNT_KEY = 'muixer_login_count';
const DISMISSED_AT_KEY = 'muixer_install_dismissed_at';
const INSTALL_DONE_KEY = 'muixer_install_done';

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  private readonly _canInstallAndroid = signal(false);
  private readonly _installed = signal(this.isInstalled());

  readonly canInstallAndroid = this._canInstallAndroid.asReadonly();
  readonly isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  readonly shouldShow = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this._canInstallAndroid.set(true);
      this.recomputeShouldShow();
    });

    window.addEventListener('appinstalled', () => {
      this.setItem(INSTALL_DONE_KEY, '1');
      this._installed.set(true);
      this.shouldShow.set(false);
    });

    this.recomputeShouldShow();
  }

  registerLogin(): void {
    const count = this.getLoginCount() + 1;
    this.setItem(LOGIN_COUNT_KEY, String(count));
    this.recomputeShouldShow();
  }

  promptInstall(): void {
    this.deferredPrompt?.prompt();
  }

  dismiss(): void {
    this.setItem(DISMISSED_AT_KEY, String(this.getLoginCount()));
    this.shouldShow.set(false);
  }

  private recomputeShouldShow(): void {
    if (this._installed() || this.isStandalone()) {
      this.shouldShow.set(false);
      return;
    }
    if (!this.isIos && !this._canInstallAndroid()) {
      this.shouldShow.set(false);
      return;
    }

    const loginCount = this.getLoginCount();
    const dismissedAt = this.getDismissedAt();
    const eligible =
      dismissedAt === null
        ? loginCount >= 1
        : loginCount >= dismissedAt + REMIND_AFTER_LOGINS;
    this.shouldShow.set(eligible);
  }

  private isInstalled(): boolean {
    return this.getItem(INSTALL_DONE_KEY) === '1';
  }

  private isStandalone(): boolean {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }

  private getLoginCount(): number {
    return Number(this.getItem(LOGIN_COUNT_KEY) ?? '0');
  }

  private getDismissedAt(): number | null {
    const raw = this.getItem(DISMISSED_AT_KEY);
    return raw === null ? null : Number(raw);
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
      // localStorage unavailable (private mode) — banner logic just won't persist.
    }
  }
}
