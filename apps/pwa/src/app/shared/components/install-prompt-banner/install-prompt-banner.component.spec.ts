import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InstallPromptBannerComponent } from './install-prompt-banner.component';
import { InstallPromptService } from '../../services/install-prompt.service';

describe('InstallPromptBannerComponent', () => {
  function render(platform: { isIos: boolean; canPrompt: boolean }): HTMLElement {
    TestBed.configureTestingModule({
      imports: [InstallPromptBannerComponent],
      providers: [
        {
          provide: InstallPromptService,
          useValue: {
            isIos: platform.isIos,
            canPromptInstall: signal(platform.canPrompt),
            promptInstall: () => undefined,
            dismiss: () => undefined,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InstallPromptBannerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const installButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Instal·la');

  it('offers the install button when the browser can prompt', () => {
    expect(installButton(render({ isIos: false, canPrompt: true }))).toBeTruthy();
  });

  it('shows manual menu instructions when the browser cannot prompt', () => {
    const el = render({ isIos: false, canPrompt: false });
    expect(el.textContent).toContain("«Instal·la l'app»");
    expect(installButton(el)).toBeUndefined();
  });

  it('keeps the Share instructions on iPhone', () => {
    const el = render({ isIos: true, canPrompt: false });
    expect(el.textContent).toContain('Compartir');
    expect(installButton(el)).toBeUndefined();
  });
});
