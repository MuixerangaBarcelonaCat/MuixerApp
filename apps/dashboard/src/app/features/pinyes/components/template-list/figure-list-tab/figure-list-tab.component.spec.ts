import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../../testing/lucide-test-provider';
import { FigureListTabComponent } from './figure-list-tab.component';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';

describe('FigureListTabComponent', () => {
  let fixture: ComponentFixture<FigureListTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FigureListTabComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        {
          provide: FigureTemplateService,
          useValue: { getAll: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 200 } })) },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FigureListTabComponent);
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('tap targets >=24px (WI-22)', () => {
    it('gives the search input a >=24px tap target', () => {
      const search = fixture.nativeElement.querySelector('input') as HTMLElement;
      expect(search).toBeTruthy();
      expect(search.className).toContain('h-6');
    });
  });
});
