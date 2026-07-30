import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ParticipationService } from './participation.service';
import { EventParticipation } from '../models/participation.model';

describe('ParticipationService', () => {
  let service: ParticipationService;
  let httpMock: HttpTestingController;

  const EVENT_ID = 'ev-uuid';

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ParticipationService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ParticipationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByEvent requests /events/:id/participation with no query params', () => {
    service.getByEvent(EVENT_ID).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/events/${EVENT_ID}/participation`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ event: { id: EVENT_ID, title: '', date: '' }, segments: [], persons: [], meta: {} });
  });

  it('passes the overview through unmodified, including plural placements', () => {
    const response: EventParticipation = {
      event: { id: EVENT_ID, title: 'Assaig', date: '2026-05-01' },
      segments: [
        {
          id: 'seg-1',
          name: 'Primera',
          sortOrder: 0,
          figureNames: ['4d7'],
          isVisible: true,
          figureCount: 1,
          snapshottedFigureCount: 1,
        },
      ],
      persons: [
        {
          id: 'person-1',
          alias: 'PERSIANA',
          name: 'Joana',
          firstSurname: 'Vila',
          shoulderHeight: 140,
          isXicalla: false,
          isActive: true,
          notes: null,
          notesEmoji: null,
          attendanceStatus: 'ANIRE',
          positions: [],
          placements: {
            'seg-1': [
              {
                assignmentId: 'a-1',
                instanceId: 'inst-1',
                figureName: '4d7',
                nodeId: 'n-1',
                nodeLabel: 'Mans',
                zone: 'PINYA',
                positionType: null,
                z: 0,
                renglaPosition: 2,
              },
              {
                assignmentId: 'a-2',
                instanceId: 'inst-1',
                figureName: '4d7',
                nodeId: 'n-2',
                nodeLabel: 'Vent',
                zone: 'PINYA',
                positionType: null,
                z: 0,
                renglaPosition: 1,
              },
            ],
          },
          assignedSegmentCount: 1,
          placementCount: 2,
          conflictSegmentIds: ['seg-1'],
        },
      ],
      meta: {
        distinctPersons: 1,
        personsWithPlacement: 1,
        totalPlacements: 2,
        conflictedPersons: 1,
      },
    };

    let received: EventParticipation | undefined;
    service.getByEvent(EVENT_ID).subscribe((r) => (received = r));

    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/events/${EVENT_ID}/participation`)
      .flush(response);

    expect(received).toEqual(response);
    expect(received!.persons[0].placements['seg-1']).toHaveLength(2);
  });
});
