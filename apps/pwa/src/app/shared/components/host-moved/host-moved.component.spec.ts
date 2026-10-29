import { TestBed } from '@angular/core/testing';
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

  it.each([undefined, null, '', 'not a url', 'http://app-beta.muixerangabarcelona.cat', '<!doctype html>', 42])(
    'ignores an unset or invalid public URL (%s)',
    (url) => {
      expect(movedHostUrl(url, at('app.beta.muixerangabarcelona.cat'))).toBeNull();
    },
  );
});

describe('HostMovedComponent', () => {
  it('links to the new address', () => {
    TestBed.configureTestingModule({ imports: [HostMovedComponent] });
    const fixture = TestBed.createComponent(HostMovedComponent);
    fixture.componentRef.setInput('url', 'https://app-beta.muixerangabarcelona.cat');
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://app-beta.muixerangabarcelona.cat');
  });
});
