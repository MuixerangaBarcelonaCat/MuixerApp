import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ManualComponent } from './manual.component';

describe('ManualComponent', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'config/manual', component: ManualComponent },
          { path: 'config/manual/:slug', component: ManualComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        allLucideIconsProvider,
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => httpMock.verify());

  const open = async (url: string, body?: string) => {
    await harness.navigateByUrl(url);
    if (body !== undefined) {
      const slug = url.split('/').pop() === 'manual' ? '00-benvinguda' : url.split('/').pop();
      httpMock.expectOne(`/manual/${slug}.md`).flush(body);
    }
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  };

  it('loads the welcome page when there is no slug', async () => {
    const el = await open('/config/manual', '# Benvinguda');
    expect(el.querySelector('h1')?.textContent).toBe('Benvinguda');
  });

  it('renders markdown and rewrites images', async () => {
    const el = await open('/config/manual/03-persones', '# Hola\n\n![](img/a.png)');
    expect(el.querySelector('h1')?.textContent).toBe('Hola');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/manual/img/a.png');
  });

  it('shows "No s\'ha trobat la pàgina." for an unknown slug', async () => {
    const el = await open('/config/manual/no-existeix');
    httpMock.expectNone(() => true);
    expect(el.textContent).toContain("No s'ha trobat la pàgina.");
  });

  it('shows "Esta pàgina encara s\'està escrivint." on 404', async () => {
    await harness.navigateByUrl('/config/manual/20-preguntes-frequents');
    httpMock
      .expectOne('/manual/20-preguntes-frequents.md')
      .flush('', { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      "Esta pàgina encara s'està escrivint.",
    );
  });

  it('navigates internally on a .md link click', async () => {
    const el = await open('/config/manual/03-persones', '[x](04-etiquetes.md)');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLAnchorElement>('.prose a')!.click();
    expect(navigate).toHaveBeenCalledWith(['/config/manual', '04-etiquetes']);
  });

  it('lets external links through', async () => {
    const el = await open('/config/manual/03-persones', '[x](https://example.com)');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const anchor = el.querySelector<HTMLAnchorElement>('.prose a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    expect(navigate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
