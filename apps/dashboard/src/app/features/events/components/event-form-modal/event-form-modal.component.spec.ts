import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { EventFormModalComponent } from './event-form-modal.component';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { signal } from '@angular/core';
import { CollaSettings, DEFAULT_COLLA_SETTINGS, EventType } from '@muixer/shared';
import { CollaSettingsService } from '../../../../core/services/colla-settings.service';
import { EventDetail } from '../../models/event.model';

const REHEARSAL_DEFAULTS = {
  title: 'Assaig de prova',
  startTime: '19:30',
  location: 'Local de prova',
  locationUrl: 'https://maps.example/local',
};
const collaSettings = signal<CollaSettings>({
  ...DEFAULT_COLLA_SETTINGS,
  rehearsalDefaults: REHEARSAL_DEFAULTS,
});
const collaSettingsProvider = { provide: CollaSettingsService, useValue: { settings: collaSettings } };

const mockSeason = { id: 'season-1', name: 'Temporada 2025-2026', startDate: '2025-09-01', endDate: '2026-08-31', description: null, eventCount: 5, rehearsalCount: 5, performanceCount: 0 };

function makeEventService() {
  return {
    create: vi.fn().mockReturnValue(of({})),
    updateFull: vi.fn().mockReturnValue(of({})),
  };
}

function makeSeasonService() {
  return {
    getAll: vi.fn().mockReturnValue(of({ data: [mockSeason], meta: { total: 1, page: 1, limit: 25 } })),
    getCurrent: vi.fn().mockReturnValue(of(mockSeason)),
  };
}

async function buildFixture(inputs: {
  presetEventType?: EventType | null;
  event?: EventDetail | null;
  eventService?: ReturnType<typeof makeEventService>;
  seasonService?: ReturnType<typeof makeSeasonService>;
} = {}): Promise<ComponentFixture<EventFormModalComponent>> {
  const eventService = inputs.eventService ?? makeEventService();
  const seasonService = inputs.seasonService ?? makeSeasonService();

  await TestBed.configureTestingModule({
    imports: [EventFormModalComponent],
    providers: [
      { provide: EventService, useValue: eventService },
      { provide: SeasonService, useValue: seasonService },
      collaSettingsProvider,
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(EventFormModalComponent);

  if (inputs.presetEventType !== undefined) {
    fixture.componentRef.setInput('presetEventType', inputs.presetEventType);
  }
  if (inputs.event !== undefined) {
    fixture.componentRef.setInput('event', inputs.event);
  }

  fixture.detectChanges();
  return fixture;
}

describe('EventFormModalComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('create mode — no presetEventType', () => {
    const prefilled = (fixture: ComponentFixture<EventFormModalComponent>) => {
      const { title, startTime, location, locationUrl } = fixture.componentInstance.form.getRawValue();
      return { title, startTime, location, locationUrl };
    };
    const EMPTY = { title: '', startTime: '', location: '', locationUrl: '' };

    it("starts as a rehearsal, with the colla's rehearsal title, time and place", async () => {
      const fixture = await buildFixture();
      expect(prefilled(fixture)).toEqual(REHEARSAL_DEFAULTS);
    });

    it('empties them on switching to a performance, and fills them again on switching back', async () => {
      const fixture = await buildFixture();
      const type = fixture.componentInstance.form.controls.eventType;

      type.setValue(EventType.ACTUACIO);
      expect(prefilled(fixture)).toEqual(EMPTY);

      type.setValue(EventType.ASSAIG);
      expect(prefilled(fixture)).toEqual(REHEARSAL_DEFAULTS);
    });

    it('keeps whatever someone typed when the type changes', async () => {
      const fixture = await buildFixture();
      const { title, location, eventType } = fixture.componentInstance.form.controls;
      title.setValue('Assaig de la Mercè');
      title.markAsDirty();
      location.setValue('Plaça Sant Jaume');
      location.markAsDirty();

      eventType.setValue(EventType.ACTUACIO);

      expect(prefilled(fixture)).toEqual({ ...EMPTY, title: 'Assaig de la Mercè', location: 'Plaça Sant Jaume' });
    });

    it('eventType control is enabled', async () => {
      const fixture = await buildFixture();
      expect(fixture.componentInstance.form.get('eventType')?.enabled).toBe(true);
    });

    it('modalTitle is Nou esdeveniment', async () => {
      const fixture = await buildFixture();
      expect(fixture.componentInstance.modalTitle()).toBe('Nou esdeveniment');
    });
  });

  describe('create mode — presetEventType = ASSAIG', () => {
    it("pre-fills the colla's rehearsal title, start time and place", async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ASSAIG });
      const { title, startTime, location, locationUrl } = fixture.componentInstance.form.getRawValue();
      expect({ title, startTime, location, locationUrl }).toEqual(REHEARSAL_DEFAULTS);
    });

    it('leaves the start time and place link empty when the colla has none', async () => {
      collaSettings.set({
        ...DEFAULT_COLLA_SETTINGS,
        rehearsalDefaults: { title: 'Assaig', startTime: null, location: '', locationUrl: null },
      });
      try {
        const fixture = await buildFixture({ presetEventType: EventType.ASSAIG });
        expect(fixture.componentInstance.form.get('startTime')?.value).toBe('');
        expect(fixture.componentInstance.form.get('locationUrl')?.value).toBe('');
      } finally {
        collaSettings.set({ ...DEFAULT_COLLA_SETTINGS, rehearsalDefaults: REHEARSAL_DEFAULTS });
      }
    });

    it('eventType control is disabled', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ASSAIG });
      expect(fixture.componentInstance.form.get('eventType')?.disabled).toBe(true);
    });

    it('eventType raw value is ASSAIG', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ASSAIG });
      expect(fixture.componentInstance.form.getRawValue().eventType).toBe(EventType.ASSAIG);
    });

    it('modalTitle is Assaig nou', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ASSAIG });
      expect(fixture.componentInstance.modalTitle()).toBe('Assaig nou');
    });
  });

  describe('create mode — presetEventType = ACTUACIO', () => {
    it('does not pre-fill title, start time or place', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ACTUACIO });
      const { title, startTime, location, locationUrl } = fixture.componentInstance.form.getRawValue();
      expect({ title, startTime, location, locationUrl }).toEqual({ title: '', startTime: '', location: '', locationUrl: '' });
    });

    it('eventType control is disabled', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ACTUACIO });
      expect(fixture.componentInstance.form.get('eventType')?.disabled).toBe(true);
    });

    it('eventType raw value is ACTUACIO', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ACTUACIO });
      expect(fixture.componentInstance.form.getRawValue().eventType).toBe(EventType.ACTUACIO);
    });

    it('modalTitle is Actuació nova', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ACTUACIO });
      expect(fixture.componentInstance.modalTitle()).toBe('Actuació nova');
    });
  });

  describe('edit mode — event provided', () => {
    const existingEvent = {
      id: 'ev-1',
      title: 'Assaig existent',
      eventType: EventType.ASSAIG,
      date: '2026-06-01',
      startTime: '10:00',
      location: 'Local',
      locationUrl: null,
      description: null,
      information: null,
      countsForStatistics: true,
      season: null,
    } as unknown as EventDetail;

    it('isEditMode is true', async () => {
      const fixture = await buildFixture({ event: existingEvent });
      expect(fixture.componentInstance.isEditMode()).toBe(true);
    });

    it('patches title from event', async () => {
      const fixture = await buildFixture({ event: existingEvent });
      expect(fixture.componentInstance.form.get('title')?.value).toBe('Assaig existent');
    });

    it('eventType control is enabled in edit mode', async () => {
      const fixture = await buildFixture({ event: existingEvent, presetEventType: EventType.ASSAIG });
      expect(fixture.componentInstance.form.get('eventType')?.enabled).toBe(true);
    });

    it('modalTitle is Editar esdeveniment', async () => {
      const fixture = await buildFixture({ event: existingEvent });
      expect(fixture.componentInstance.modalTitle()).toBe('Editar esdeveniment');
    });

    it('sends null for a field that is cleared', async () => {
      const eventService = makeEventService();
      const seasonService = makeSeasonService();
      await TestBed.configureTestingModule({
        imports: [EventFormModalComponent],
        providers: [
          { provide: EventService, useValue: eventService },
          { provide: SeasonService, useValue: seasonService },
          collaSettingsProvider,
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EventFormModalComponent);
      fixture.componentRef.setInput('event', {
        ...existingEvent,
        locationUrl: 'https://maps.example/x',
        description: 'Text previ',
      } as unknown as EventDetail);
      fixture.detectChanges();

      fixture.componentInstance.form.patchValue({ location: '', locationUrl: '', description: '' });
      fixture.componentInstance.onSubmit();

      expect(eventService.updateFull).toHaveBeenCalledWith('ev-1', expect.objectContaining({
        location: null,
        locationUrl: null,
        description: null,
      }));
    });

    it('keeps a field value that is still filled', async () => {
      const eventService = makeEventService();
      const seasonService = makeSeasonService();
      await TestBed.configureTestingModule({
        imports: [EventFormModalComponent],
        providers: [
          { provide: EventService, useValue: eventService },
          { provide: SeasonService, useValue: seasonService },
          collaSettingsProvider,
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(EventFormModalComponent);
      fixture.componentRef.setInput('event', existingEvent);
      fixture.detectChanges();

      fixture.componentInstance.onSubmit();

      expect(eventService.updateFull).toHaveBeenCalledWith('ev-1', expect.objectContaining({
        location: 'Local',
      }));
    });
  });

  describe('season derived from the date', () => {
    const fillValid = (fixture: ComponentFixture<EventFormModalComponent>, date: string) => {
      fixture.componentInstance.form.patchValue({ title: 'Assaig', eventType: EventType.ASSAIG, date });
      fixture.componentInstance.form.get('date')?.markAsDirty();
    };

    it('has no season selector: only the event type select remains', async () => {
      const fixture = await buildFixture();
      expect(fixture.nativeElement.querySelectorAll('lib-select')).toHaveLength(1);
      expect(fixture.componentInstance.form.contains('seasonId')).toBe(false);
    });

    it('shows the season the date falls in as a hint', async () => {
      const fixture = await buildFixture();
      fillValid(fixture, '2026-01-10');
      expect(fixture.componentInstance.dateHint()).toBe('Temporada: Temporada 2025-2026');
    });

    it('marks a date outside every season invalid, with an explanation', async () => {
      const fixture = await buildFixture();
      fillValid(fixture, '2026-09-10');
      expect(fixture.componentInstance.form.get('date')?.hasError('outsideSeason')).toBe(true);
      expect(fixture.componentInstance.fieldError('date')).toBe('Esta data no és dins de cap temporada.');
      expect(fixture.componentInstance.form.invalid).toBe(true);
    });

    it('creates the event without any seasonId', async () => {
      const eventService = makeEventService();
      const fixture = await buildFixture({ eventService });
      fillValid(fixture, '2026-01-10');
      fixture.componentInstance.onSubmit();
      expect(eventService.create).toHaveBeenCalledTimes(1);
      expect(eventService.create.mock.calls[0][0]).not.toHaveProperty('seasonId');
    });

    it('skips the client check when the seasons fail to load (the API still validates)', async () => {
      const seasonService = makeSeasonService();
      seasonService.getAll.mockReturnValue(throwError(() => new Error('offline')));
      const fixture = await buildFixture({ seasonService });
      fillValid(fixture, '2030-01-01');
      expect(fixture.componentInstance.form.get('date')?.valid).toBe(true);
      expect(fixture.componentInstance.dateHint()).toBeUndefined();
    });

    describe('editing an event whose date is in no season', () => {
      const uncoveredEvent = {
        id: 'ev-old',
        title: 'Assaig antic',
        eventType: EventType.ASSAIG,
        date: '2019-05-01',
        startTime: null,
        location: null,
        locationUrl: null,
        description: null,
        information: null,
        countsForStatistics: true,
        season: null,
      } as unknown as EventDetail;

      it('keeps the unchanged date valid and labels it «Sense temporada»', async () => {
        const fixture = await buildFixture({ event: uncoveredEvent });
        expect(fixture.componentInstance.form.get('date')?.valid).toBe(true);
        expect(fixture.componentInstance.dateHint()).toBe('Sense temporada');
      });

      it('saves other changes without sending any seasonId', async () => {
        const eventService = makeEventService();
        const fixture = await buildFixture({ event: uncoveredEvent, eventService });
        fixture.componentInstance.form.patchValue({ title: 'Assaig antic (revisat)' });
        fixture.componentInstance.onSubmit();
        expect(eventService.updateFull).toHaveBeenCalledTimes(1);
        expect(eventService.updateFull.mock.calls[0][1]).not.toHaveProperty('seasonId');
      });

      it('rejects moving it to another date that is in no season', async () => {
        const fixture = await buildFixture({ event: uncoveredEvent });
        fixture.componentInstance.form.patchValue({ date: '2019-06-01' });
        expect(fixture.componentInstance.form.get('date')?.hasError('outsideSeason')).toBe(true);
      });
    });
  });
});
