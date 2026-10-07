import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { LegalDocumentType } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { AuthService } from '../../../core/auth/services/auth.service';
import { LegalDocumentService } from '../../../core/services/legal-document.service';
import { ConsentModalComponent } from './consent-modal.component';

describe('ConsentModalComponent', () => {
  it('renders the privacy policy as Markdown', async () => {
    await TestBed.configureTestingModule({
      imports: [ConsentModalComponent],
      providers: [
        { provide: AuthService, useValue: { currentUser: signal(null), acceptPrivacyConsent: vi.fn() } },
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
    const fixture = TestBed.createComponent(ConsentModalComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.prose h2')?.textContent).toBe('Dades que tractem');
  });
});
