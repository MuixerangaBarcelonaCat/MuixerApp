import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CollaSettings, DEFAULT_COLLA_SETTINGS, TagCategory } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { CollaSettingsService } from '../../../../core/services/colla-settings.service';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { CollaSettingsComponent } from './colla-settings.component';

const tag = (id: string, name: string, category: TagCategory): TagWithCount => ({
  id,
  name,
  slug: id,
  shortDescription: null,
  longDescription: null,
  color: null,
  category,
  positionTypes: [],
  personCount: 0,
});

describe('CollaSettingsComponent', () => {
  let fixture: ComponentFixture<CollaSettingsComponent>;
  let component: CollaSettingsComponent;
  const stored: CollaSettings = { ...DEFAULT_COLLA_SETTINGS, defaultTagId: 'tag-nova' };
  const settings = signal<CollaSettings>(stored);
  const loaded = signal(true);
  const loadFailed = signal(false);
  let update: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const el = () => fixture.nativeElement as HTMLElement;
  const saveButton = () => el().querySelector('[data-testid="colla-settings-save"] button') as HTMLButtonElement;
  const edit = (patch: Record<string, unknown>) => {
    component.form.patchValue(patch);
    component.form.markAsDirty();
    fixture.detectChanges();
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [CollaSettingsComponent],
      providers: [
        allLucideIconsProvider,
        provideRouter([]),
        { provide: CollaSettingsService, useValue: { settings, loaded, loadFailed, update } },
        {
          provide: TagService,
          useValue: {
            getAll: () =>
              of([
                tag('tag-nova', 'Persona nova', TagCategory.ALTRES),
                tag('tag-baix', 'Baix', TagCategory.TRONC),
                tag('tag-vent', 'Vent', TagCategory.PINYA),
              ]),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CollaSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    settings.set(stored);
    loaded.set(true);
    loadFailed.set(false);
    update = vi.fn((patch: CollaSettings) => of({ ...stored, ...patch }));
    toast = { success: vi.fn(), error: vi.fn() };
  });

  it('fills the form with the stored settings', async () => {
    await setup();

    // A missing place link shows as an empty field.
    expect(component.form.getRawValue()).toEqual({
      ...stored,
      rehearsalDefaults: { ...stored.rehearsalDefaults, locationUrl: '' },
    });
  });

  it('waits for the stored settings before showing the form', async () => {
    loaded.set(false);
    await setup();
    expect(el().querySelector('form')).toBeNull();

    settings.set({ ...stored, collaName: 'Muixeranga Carregada' });
    loaded.set(true);
    fixture.detectChanges();

    expect(component.form.getRawValue().collaName).toBe('Muixeranga Carregada');
    expect(el().querySelector('form')).not.toBeNull();
  });

  it('says so when the settings cannot be read', async () => {
    loaded.set(false);
    loadFailed.set(true);
    await setup();

    expect(el().textContent).toContain("No s'ha pogut carregar la configuració de la colla.");
    expect(el().querySelector('form')).toBeNull();
  });

  it('offers no tag and every tag, grouped by category', async () => {
    await setup();
    const select = el().querySelector('[data-testid="colla-default-tag"]') as HTMLElement;

    expect(Array.from(select.querySelectorAll('optgroup')).map((g) => g.label)).toEqual(['Pinya', 'Tronc', 'Altres']);
    expect(select.querySelector('option[value=""]')?.textContent?.trim()).toBe('Cap');
  });

  it('cannot be saved while nothing has changed', async () => {
    await setup();

    expect(saveButton().disabled).toBe(true);
  });

  it('saves the whole settings, and starts again from what was saved', async () => {
    await setup();
    edit({ collaName: 'Muixeranga Nova', shirtRequirements: { performances: 3, rehearsals: 6 } });

    saveButton().click();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith({
      ...stored,
      collaName: 'Muixeranga Nova',
      shirtRequirements: { performances: 3, rehearsals: 6 },
    });
    expect(toast.success).toHaveBeenCalledWith("S'ha alçat la configuració de la colla.");
    expect(component.form.dirty).toBe(false);
  });

  it('sends an empty default start time and place link as null, and keeps an empty title and place', async () => {
    await setup();
    edit({ rehearsalDefaults: { title: '', startTime: '', location: '', locationUrl: '' } });

    saveButton().click();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ rehearsalDefaults: { title: '', startTime: null, location: '', locationUrl: null } }),
    );
  });

  it('refuses a place link that is not a link', async () => {
    await setup();
    edit({ rehearsalDefaults: { title: 'Assaig', startTime: '18:45', location: 'Local', locationUrl: 'local de la colla' } });

    expect(component.form.invalid).toBe(true);
  });

  it('sends no default tag as null', async () => {
    await setup();
    edit({ defaultTagId: '' });

    saveButton().click();

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ defaultTagId: null }));
  });

  it('refuses a warning threshold that is not below its error threshold', async () => {
    await setup();
    edit({ troncHeightThresholds: { floor: { warning: 10, error: 10 }, support: { warning: 3, error: 5 } } });
    component.form.markAllAsTouched();
    fixture.detectChanges();

    expect(component.form.invalid).toBe(true);
    expect(saveButton().disabled).toBe(true);
    expect(el().textContent).toContain("Ha de ser més gran que l'avís");
  });

  it('refuses an empty colla name', async () => {
    await setup();
    edit({ collaName: '   ' });

    expect(component.form.invalid).toBe(true);
  });

  describe('age of majority', () => {
    it('asks before changing it, and saves once confirmed', async () => {
      await setup();
      edit({ majorityAge: 18 });

      saveButton().click();
      fixture.detectChanges();
      expect(update).not.toHaveBeenCalled();
      expect(component.confirmingMajorityAge()).toBe(true);

      component.confirmMajorityAge();

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ majorityAge: 18 }));
      expect(component.confirmingMajorityAge()).toBe(false);
    });

    it('saves nothing when the change is cancelled', async () => {
      await setup();
      edit({ majorityAge: 18 });
      saveButton().click();

      component.cancelMajorityAge();

      expect(update).not.toHaveBeenCalled();
      expect(component.form.getRawValue().majorityAge).toBe(18);
    });
  });

  it('shows the reason the server gives when saving fails', async () => {
    update.mockReturnValue(throwError(() => ({ error: { message: "No s'ha trobat l'etiqueta." } })));
    await setup();
    edit({ collaName: 'Muixeranga Nova' });

    saveButton().click();

    expect(toast.error).toHaveBeenCalledWith("No s'ha trobat l'etiqueta.");
    expect(component.form.dirty).toBe(true);
  });
});
