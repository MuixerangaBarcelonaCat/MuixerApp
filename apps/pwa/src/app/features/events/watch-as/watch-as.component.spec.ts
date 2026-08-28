import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, type Mocked } from 'vitest';
import { FigureMode } from '@muixer/shared';
import { WatchAsComponent } from './watch-as.component';
import { PersonLookupService } from '../services/person-lookup.service';
import { EventService } from '../services/event.service';

describe('WatchAsComponent', () => {
  let fixture: ComponentFixture<WatchAsComponent>;
  let personLookupService: Mocked<PersonLookupService>;
  let eventService: Mocked<EventService>;

  beforeEach(async () => {
    personLookupService = { search: vi.fn() } as unknown as Mocked<PersonLookupService>;
    eventService = { findSegments: vi.fn() } as unknown as Mocked<EventService>;

    await TestBed.configureTestingModule({
      imports: [WatchAsComponent],
      providers: [
        { provide: PersonLookupService, useValue: personLookupService },
        { provide: EventService, useValue: eventService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WatchAsComponent);
    fixture.componentRef.setInput('id', 'event-1');
    fixture.detectChanges();
  });

  it('searches persons as the user types', () => {
    personLookupService.search.mockReturnValue(
      of([{ id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' }]),
    );
    fixture.componentInstance['onSearchInput']('ann');
    expect(personLookupService.search).toHaveBeenCalledWith('ann');
  });

  it('loads segments scoped to the selected person', () => {
    eventService.findSegments.mockReturnValue(
      of([
        {
          id: 'segment-1',
          name: 'Roscana',
          sortOrder: 0,
          instances: [],
          myPlacements: [{ nodeLabel: 'C1', cordon: 1, figureName: null, figureMode: FigureMode.COMPLETA }],
        },
      ]),
    );
    fixture.componentInstance['selectPerson']({
      id: 'person-1',
      alias: 'Anna',
      name: 'Anna',
      firstSurname: 'Puig',
    });
    expect(eventService.findSegments).toHaveBeenCalledWith('event-1', 'person-1');
    expect(fixture.componentInstance['selectedPerson']()?.alias).toBe('Anna');
  });
});
