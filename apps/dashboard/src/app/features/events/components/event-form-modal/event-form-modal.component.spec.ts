import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { EventFormModalComponent } from './event-form-modal.component';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { EventType } from '@muixer/shared';
import { EventDetail } from '../../models/event.model';

const mockSeason = { id: 'season-1', name: 'Temporada 2025-2026', startDate: '2025-09-01', endDate: '2026-08-31', description: null, eventCount: 5 };

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
} = {}): Promise<ComponentFixture<EventFormModalComponent>> {
  const eventService = makeEventService();
  const seasonService = makeSeasonService();

  await TestBed.configureTestingModule({
    imports: [EventFormModalComponent],
    providers: [
      { provide: EventService, useValue: eventService },
      { provide: SeasonService, useValue: seasonService },
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
    it('title starts empty', async () => {
      const fixture = await buildFixture();
      expect(fixture.componentInstance.form.get('title')?.value).toBe('');
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
    it('pre-fills title with Assaig general', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ASSAIG });
      expect(fixture.componentInstance.form.get('title')?.value).toBe('Assaig general');
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
    it('does not pre-fill title', async () => {
      const fixture = await buildFixture({ presetEventType: EventType.ACTUACIO });
      expect(fixture.componentInstance.form.get('title')?.value).toBe('');
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
  });
});
