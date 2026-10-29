import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { InstallPromptService } from '../../services/install-prompt.service';
import { HostMovedComponent, movedHostUrl } from './host-moved.component';

describe('movedHostUrl', () => {
  const target = 'https://app-beta.muixerangabarcelona.cat';
  const at = (host: string, pathname = '/', search = '') => ({ host, pathname, search });

  it('returns the normalised public URL when the app runs on another host', () => {
    expect(movedHostUrl(`  ${target.toUpperCase()}\n`, at('app.beta.muixerangabarcelona.cat'))).toBe(`${target}/`);
  });

  it('treats a different port as another host', () => {
    expect(movedHostUrl(`${target}:8443`, at('app-beta.muixerangabarcelona.cat'))).toBe(`${target}:8443/`);
  });

  it('returns null on the public host itself', () => {
    expect(movedHostUrl(target, at('app-beta.muixerangabarcelona.cat'))).toBeNull();
  });

  it('keeps the path and query (old invite link)', () => {
    expect(movedHostUrl(target, at('app.beta.muixerangabarcelona.cat', '/activate', '?token=abc'))).toBe(
      `${target}/activate?token=abc`,
    );
  });

  it('does not double the slash when the public URL ends with one', () => {
    expect(movedHostUrl(`${target}/`, at('app.beta.muixerangabarcelona.cat', '/events/1'))).toBe(`${target}/events/1`);
  });

  it('never leaves the public origin, even for a protocol-relative path', () => {
    expect(movedHostUrl(target, at('app.beta.muixerangabarcelona.cat', '//evil.com/login', '?a=1'))).toBe(
      `${target}//evil.com/login?a=1`,
    );
  });

  it.each([undefined, null, '', 'not a url', 'http://app-beta.muixerangabarcelona.cat', '<!doctype html>', 42])(
    'ignores an unset or invalid public URL (%s)',
    (url) => {
      expect(movedHostUrl(url, at('app.beta.muixerangabarcelona.cat'))).toBeNull();
    },
  );
});

describe('HostMovedComponent', () => {
  const url = 'https://app-beta.muixerangabarcelona.cat/';

  afterEach(() => vi.unstubAllGlobals());

  function render(platform: { isIos: boolean; standalone: boolean } = { isIos: false, standalone: false }) {
    TestBed.configureTestingModule({
      imports: [HostMovedComponent],
      providers: [
        { provide: InstallPromptService, useValue: { isIos: platform.isIos, isStandalone: () => platform.standalone } },
      ],
    });
    const fixture = TestBed.createComponent(HostMovedComponent);
    fixture.componentRef.setInput('url', url);
    fixture.detectChanges();
    return fixture;
  }

  const copyButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes("Copia l'adreça"));

  it('links to the new address', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.querySelector('a')?.getAttribute('href')).toBe(url);
  });

  it('copies the new address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    copyButton(el)?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith(url);
    expect(el.textContent).toContain("S'ha copiat l'adreça");
  });

  it('does not throw without a clipboard', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    copyButton(el)?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).not.toContain("S'ha copiat l'adreça");
    expect(el.textContent).toContain(url);
  });

  it('explains how to leave the in-app browser when installed on iPhone', () => {
    const el = render({ isIos: true, standalone: true }).nativeElement as HTMLElement;
    expect(el.textContent).toContain('«Obre a Safari»');
  });

  it('explains how to leave the in-app browser when installed on Android', () => {
    const el = render({ isIos: false, standalone: true }).nativeElement as HTMLElement;
    expect(el.textContent).toContain('«Obre a Chrome»');
  });

  it('hides the in-app browser step in a normal tab', () => {
    const el = render().nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('«Obre a');
  });
});
