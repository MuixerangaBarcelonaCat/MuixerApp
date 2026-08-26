import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TagCategory } from '@muixer/shared';
import { TagFormModalComponent } from './tag-form-modal.component';
import { TagService } from '../../services/tag.service';
import { ToastService } from '@muixer/ui';
import { TagWithCount } from '../../models/tag.model';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

const mockTag: TagWithCount = {
  id: 't1',
  name: 'Vents',
  slug: 'vents',
  shortDescription: null,
  longDescription: null,
  color: '#6366f1',
  category: TagCategory.TRONC,
  positionTypes: ['base', 'vent'],
  personCount: 3,
};

describe('TagFormModalComponent', () => {
  let component: TagFormModalComponent;
  let fixture: ComponentFixture<TagFormModalComponent>;
  let tagService: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    tagService = {
      create: vi.fn().mockReturnValue(of(mockTag)),
      update: vi.fn().mockReturnValue(of(mockTag)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TagFormModalComponent],
      providers: [
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('category filtering of position type groups', () => {
    it('shows Tronc + Direcció + Base groups for TRONC category', () => {
      component.form.get('category')!.setValue(TagCategory.TRONC);
      const labels = component.visiblePositionTypeGroups().map((g) => g.label);
      expect(labels).toEqual(['Tronc', 'Direcció', 'Base']);
    });

    it('shows only the Pinya group for PINYA category', () => {
      component.form.get('category')!.setValue(TagCategory.PINYA);
      const labels = component.visiblePositionTypeGroups().map((g) => g.label);
      expect(labels).toEqual(['Pinya']);
    });

    it('shows no groups for ALTRES category', () => {
      component.form.get('category')!.setValue(TagCategory.ALTRES);
      expect(component.visiblePositionTypeGroups()).toEqual([]);
    });

    it('no ofereix cap grup de positionTypes per a xicalla', () => {
      component.form.get('category')!.setValue(TagCategory.XICALLA);
      expect(component.visiblePositionTypeGroups()).toEqual([]);
    });

    it('drops selected position types that belong to now-hidden groups when category changes', () => {
      component.form.get('category')!.setValue(TagCategory.TRONC);
      component.selectedPositionTypes.set(['base']);
      fixture.detectChanges();

      component.form.get('category')!.setValue(TagCategory.PINYA);
      fixture.detectChanges();

      expect(component.selectedPositionTypes()).toEqual([]);
    });
  });

  describe('onSave', () => {
    it('sends category in the create payload', () => {
      component.form.patchValue({
        name: 'Vents',
        slug: 'vents',
        category: TagCategory.PINYA,
      });
      component.onSave();

      expect(tagService.create).toHaveBeenCalledWith(
        expect.objectContaining({ category: TagCategory.PINYA }),
      );
    });

    it('sends category in the update payload', () => {
      fixture.componentRef.setInput('position', mockTag);
      fixture.detectChanges();

      component.form.patchValue({ category: TagCategory.ALTRES });
      component.onSave();

      expect(tagService.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ category: TagCategory.ALTRES }),
      );
    });
  });
});
