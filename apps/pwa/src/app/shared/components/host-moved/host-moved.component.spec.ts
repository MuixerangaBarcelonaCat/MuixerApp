import { TestBed } from '@angular/core/testing';
import { HostMovedComponent, movedHostUrl } from './host-moved.component';

describe('movedHostUrl', () => {
  const target = 'https://app-beta.muixerangabarcelona.cat';

  it('returns the normalised public URL when the app runs on another host', () => {
    expect(movedHostUrl(`  ${target.toUpperCase()}\n`, 'app.beta.muixerangabarcelona.cat')).toBe(`${target}/`);
  });

  it('treats a different port as another host', () => {
    expect(movedHostUrl(`${target}:8443`, 'app-beta.muixerangabarcelona.cat')).toBe(`${target}:8443/`);
  });

  it('returns null on the public host itself', () => {
    expect(movedHostUrl(target, 'app-beta.muixerangabarcelona.cat')).toBeNull();
  });

  it.each([undefined, null, '', 'not a url', 'http://app-beta.muixerangabarcelona.cat', '<!doctype html>', 42])(
    'ignores an unset or invalid public URL (%s)',
    (url) => {
      expect(movedHostUrl(url, 'app.beta.muixerangabarcelona.cat')).toBeNull();
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
