import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { LegalDocument, LegalDocumentType } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { LegalDocumentService } from '../../../../core/services/legal-document.service';
import { LegalDocumentsComponent } from './legal-documents.component';

const VERSION: LegalDocument = {
  id: 'd-1',
  type: LegalDocumentType.PRIVACY_POLICY,
  version: 1,
  content: '## Dades que tractem\n\nNom i correu.',
  isActive: true,
  requiresConsent: true,
  publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('LegalDocumentsComponent', () => {
  it('renders a version from the history as Markdown', async () => {
    await TestBed.configureTestingModule({
      imports: [LegalDocumentsComponent],
      providers: [
        { provide: LegalDocumentService, useValue: { getAll: vi.fn().mockReturnValue(of([VERSION])) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LegalDocumentsComponent);
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { viewVersion(v: LegalDocument): void }).viewVersion(VERSION);
    fixture.detectChanges();

    expect(document.querySelector('.prose h2')?.textContent).toBe('Dades que tractem');
  });
});
