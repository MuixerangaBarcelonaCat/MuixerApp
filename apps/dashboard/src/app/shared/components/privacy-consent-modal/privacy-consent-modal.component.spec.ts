import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { LegalDocumentType } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LegalDocumentService } from '../../../core/services/legal-document.service';
import { PrivacyConsentModalComponent } from './privacy-consent-modal.component';

describe('PrivacyConsentModalComponent', () => {
  async function setup() {
    const acceptPrivacyConsent = vi.fn().mockReturnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [PrivacyConsentModalComponent],
      providers: [
        { provide: AuthService, useValue: { currentUser: signal(null), acceptPrivacyConsent } },
        {
          provide: LegalDocumentService,
          useValue: {
            getActive: vi.fn().mockReturnValue(
              of({ type: LegalDocumentType.PRIVACY_POLICY, content: '## Dades que tractem\n\nNom i correu.' }),
            ),
          },
        },
        { provide: ToastService, useValue: { error: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PrivacyConsentModalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, acceptPrivacyConsent };
  }

  it('renders the privacy policy as Markdown', async () => {
    const { fixture } = await setup();

    expect(fixture.nativeElement.querySelector('.prose h2')?.textContent).toBe('Dades que tractem');
  });

  it('accepts the policy through the shared lib-button', async () => {
    const { fixture, acceptPrivacyConsent } = await setup();

    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('lib-button button');
    expect(button?.textContent?.trim()).toBe('Accepte');
    button?.click();

    expect(acceptPrivacyConsent).toHaveBeenCalledOnce();
  });
});
