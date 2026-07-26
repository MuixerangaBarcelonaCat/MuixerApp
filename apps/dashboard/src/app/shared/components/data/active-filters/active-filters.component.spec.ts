import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { ActiveFiltersComponent } from './active-filters.component';

describe('ActiveFiltersComponent', () => {
  let fixture: ComponentFixture<ActiveFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveFiltersComponent);
    fixture.componentRef.setInput('filters', [{ key: 'active', label: 'Actiu' }]);
    fixture.detectChanges();
  });

  describe('remove button tap target (WI-03, PE-L1/CF-L1)', () => {
    it('gives the "x" remove button a >=24px tap target instead of shrinking to the glyph size', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLElement;
      expect(button.className).toContain('min-h-6');
      expect(button.className).toContain('min-w-6');
    });
  });
});
