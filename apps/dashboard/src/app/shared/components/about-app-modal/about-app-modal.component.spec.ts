import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { LegalDocument, LegalDocumentType } from '@muixer/shared';
import { LegalDocumentService } from '../../../core/services/legal-document.service';
import { AboutAppModalComponent } from './about-app-modal.component';

const PRIVACY_POLICY: LegalDocument = {
  id: 'd-1',
  type: LegalDocumentType.PRIVACY_POLICY,
  version: 1,
  content: 'Contingut de la política de privacitat.',
  isActive: true,
  requiresConsent: true,
  publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AboutAppModalComponent', () => {
  let fixture: ComponentFixture<AboutAppModalComponent>;
  let legalService: { getActive: ReturnType<typeof vi.fn> };

  const create = async (opts: { open?: boolean; policyFails?: boolean; policyContent?: string } = {}) => {
    const policy = { ...PRIVACY_POLICY, content: opts.policyContent ?? PRIVACY_POLICY.content };
    legalService = {
      getActive: vi.fn().mockReturnValue(opts.policyFails ? throwError(() => new Error('boom')) : of(policy)),
    };
    await TestBed.configureTestingModule({
      imports: [AboutAppModalComponent],
      providers: [{ provide: LegalDocumentService, useValue: legalService }],
    }).compileComponents();
    fixture = TestBed.createComponent(AboutAppModalComponent);
    fixture.componentRef.setInput('open', opts.open ?? true);
    fixture.detectChanges();
    // The policy renders inside a @defer block (marked stays out of the initial bundle).
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement => el().querySelector(`[data-testid="${id}"]`) as HTMLElement;

  afterEach(() => vi.useRealTimers());

  it('is titled «Sobre l\'app»', async () => {
    await create();

    expect(el().querySelector('h2')?.textContent?.trim()).toBe("Sobre l'app");
  });

  it('does not fetch the privacy policy while closed', async () => {
    await create({ open: false });

    expect(legalService.getActive).not.toHaveBeenCalled();
  });

  it('fetches the privacy policy once when opened, and not again on re-open', async () => {
    await create();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(legalService.getActive).toHaveBeenCalledTimes(1);
    expect(legalService.getActive).toHaveBeenCalledWith(LegalDocumentType.PRIVACY_POLICY);
    expect(byTestId('privacy-policy-viewer').textContent).toContain(PRIVACY_POLICY.content);
  });

  it('renders the privacy policy as Markdown', async () => {
    await create({ policyContent: '## Dades que tractem\n\nNom i correu.' });

    expect(byTestId('privacy-policy-viewer').querySelector('.prose h2')?.textContent).toBe('Dades que tractem');
  });

  it('shows an error when the privacy policy cannot be loaded', async () => {
    await create({ policyFails: true });

    expect(byTestId('privacy-policy-viewer').textContent).toContain(
      "No s'ha pogut carregar la política de privacitat.",
    );
  });

  it('shows a Contacte section pointing to the Comissió Tecnològica above the privacy policy', async () => {
    await create();
    const contact = byTestId('about-contact');

    expect(contact.querySelector('h3')?.textContent?.trim()).toBe('Contacte');
    expect(contact.textContent).toContain('Comissió Tecnològica');
    expect(contact.compareDocumentPosition(byTestId('privacy-policy-viewer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links to the source code on GitHub in a new tab', async () => {
    await create();
    const link = byTestId('about-info').querySelector('a') as HTMLAnchorElement;

    expect(link.textContent?.trim()).toBe('GitHub');
    expect(link.href).toBe('https://github.com/MuixerangaBarcelonaCat/MuixerApp');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('shows the copyright notice with the current year range', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2028-03-01T12:00:00Z'));
    await create();

    expect(byTestId('about-info').textContent).toContain('© 2026–2028 Associació Muixeranga de Barcelona');
  });

  it('emits closed when the modal is dismissed', async () => {
    await create();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    (el().querySelector('[data-testid="lib-modal-close"] button') as HTMLButtonElement).click();

    expect(closed).toHaveBeenCalled();
  });
});
