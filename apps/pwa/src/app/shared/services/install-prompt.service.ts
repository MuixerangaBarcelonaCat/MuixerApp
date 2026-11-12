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

  private readonly _canPromptInstall = signal(false);
  private readonly _installed = signal(this.isInstalled());

  /** The browser handed us `beforeinstallprompt`: the banner can show a real «Instal·la» button. */
  readonly canPromptInstall = this._canPromptInstall.asReadonly();
  // iPadOS Safari reports a Mac UA; the touch screen tells it apart from a real Mac.
  readonly isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  readonly isMobile = this.isIos || /Android/.test(navigator.userAgent);

  readonly shouldShow = signal(false);

  constructor() {
    // The event fires once per page load and can beat Angular's boot: index.html keeps it for us.
    const early = (window as { __muixerInstallPrompt?: Event }).__muixerInstallPrompt;
    if (early) this.adoptPrompt(early);
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.adoptPrompt(event);
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
    // Rejects when the user gesture was lost: nothing to do, the banner hides either way.
    this.deferredPrompt?.prompt().catch(() => undefined);
    // A prompt event can only be used once. Accepting fires `appinstalled`; cancelling counts as a
    // dismissal, so the banner comes back after REMIND_AFTER_LOGINS like the close button.
    this.deferredPrompt = null;
    this._canPromptInstall.set(false);
    this.dismiss();
  }

  private adoptPrompt(event: Event): void {
    this.deferredPrompt = event as BeforeInstallPromptEvent;
    this._canPromptInstall.set(true);
    this.recomputeShouldShow();
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
    // Phones always get the banner (with menu instructions when there is no prompt event: Chrome
    // custom tabs, Firefox, Samsung Internet); desktop only when the browser can actually prompt.
    if (!this.isMobile && !this._canPromptInstall()) {
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

  isStandalone(): boolean {
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
