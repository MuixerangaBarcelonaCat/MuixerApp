import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TabNavComponent } from './tab-nav.component';

describe('TabNavComponent', () => {
  let fixture: ComponentFixture<TabNavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabNavComponent],
      providers: [provideRouter([]), allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(TabNavComponent);
    fixture.detectChanges();
  });

  describe('tablet labels (WI-09, UX-M4)', () => {
    it('shows every tab label starting at `md` instead of only at `lg`', () => {
      const labels = Array.from(
        fixture.nativeElement.querySelectorAll('div.hidden.sm\\:flex a span:not(.sr-only)'),
      ) as HTMLElement[];
      expect(labels.length).toBe(7);
      for (const label of labels) {
        expect(label.className).toContain('hidden');
        expect(label.className).toContain('md:inline');
        expect(label.className).not.toContain('lg:inline');
      }
    });

    it('keeps an accessible (sr-only) label only for the icon-only range below `md`', () => {
      const srOnlyLabels = Array.from(
        fixture.nativeElement.querySelectorAll('div.hidden.sm\\:flex a span.sr-only'),
      ) as HTMLElement[];
      expect(srOnlyLabels.length).toBe(7);
      for (const label of srOnlyLabels) {
        expect(label.className).toContain('md:hidden');
      }
    });
  });
});
