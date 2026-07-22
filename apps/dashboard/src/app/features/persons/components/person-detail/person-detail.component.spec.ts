import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PersonDetailComponent } from './person-detail.component';
import { PersonService } from '../../services/person.service';
import { TagService } from '../../../config/services/tag.service';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { SeasonService } from '../../../events/services/season.service';
import { PersonAssignmentEntry } from '../../../pinyes/models/assignment.model';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

const makeHistoryEntry = (overrides: Partial<PersonAssignmentEntry> = {}): PersonAssignmentEntry => ({
  eventId: 'event-1',
  eventTitle: 'Diada',
  eventDate: '2026-05-10',
  eventType: 'ACTUACIO',
  segmentName: 'Bloc 1',
  instanceId: 'instance-1',
  figureName: 'Muixeranga de 5',
  figureSlug: 'muixeranga-de-5',
  nodeLabel: 'Mans',
  positionType: 'mans',
  zone: 'PINYA',
  z: 0,
  renglaPosition: null,
  ...overrides,
});

describe('PersonDetailComponent', () => {
  let fixture: ComponentFixture<PersonDetailComponent>;
  let component: PersonDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonDetailComponent],
      providers: [
        allLucideIconsProvider,
        { provide: PersonService, useValue: { getOne: () => of({ id: 'p1', positions: [] }) } },
        { provide: TagService, useValue: { getAll: () => of([]) } },
        { provide: NodeAssignmentService, useValue: { getPersonHistory: () => of({ data: [], meta: { total: 0, page: 1, limit: 20 } }) } },
        { provide: SeasonService, useValue: { getAll: () => of({ data: [] }) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'p1' }) },
            paramMap: of(convertToParamMap({ id: 'p1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Historial de pinyes table', () => {
    it('does not render a Zona column', () => {
      component.historyEntries.set([makeHistoryEntry()]);
      fixture.detectChanges();

      const headers = Array.from(fixture.nativeElement.querySelectorAll('th')).map(
        (th) => (th as HTMLElement).textContent?.trim(),
      );
      expect(headers).not.toContain('Zona');
    });

    it('shows the cordon number next to the position label', () => {
      component.historyEntries.set([makeHistoryEntry({ nodeLabel: 'Mans', renglaPosition: 2 })]);
      fixture.detectChanges();

      const cell = fixture.nativeElement.querySelector('tbody tr td:nth-child(5)');
      expect(cell.textContent.trim()).toBe('Mans C2');
    });

    it('shows only the label when there is no cordon', () => {
      component.historyEntries.set([makeHistoryEntry({ nodeLabel: 'Mans', renglaPosition: null })]);
      fixture.detectChanges();

      const cell = fixture.nativeElement.querySelector('tbody tr td:nth-child(5)');
      expect(cell.textContent.trim()).toBe('Mans');
    });
  });

  describe('responsive button rows (WI-06, PE-M2)', () => {
    it('lets the header row wrap instead of cutting off the header buttons on narrow viewports', () => {
      const headerRow = fixture.nativeElement.querySelector('div.space-y-4 > div.flex.items-center.gap-3') as HTMLElement;
      expect(headerRow.className).toContain('flex-wrap');
    });

    it('lets the header button group itself wrap when several buttons/messages are shown at once', () => {
      const editButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (btn) => (btn as HTMLElement).textContent?.trim() === 'Edita',
      ) as HTMLElement;
      expect(editButton.parentElement?.className).toContain('flex-wrap');
    });

    it('lets the "Informació de la colla" button row wrap instead of cutting off "Enllaça amb usuari existent"', () => {
      const linkButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (btn) => (btn as HTMLElement).textContent?.trim() === 'Enllaça amb usuari existent',
      ) as HTMLElement;
      expect(linkButton.parentElement?.className).toContain('flex-wrap');
    });
  });
});
