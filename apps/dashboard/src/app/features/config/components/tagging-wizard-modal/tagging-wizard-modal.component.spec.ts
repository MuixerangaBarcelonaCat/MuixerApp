import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { TagCategory } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TaggingWizardModalComponent } from './tagging-wizard-modal.component';
import { PersonService } from '../../../persons/services/person.service';
import { TagService } from '../../services/tag.service';
import { TagWithCount } from '../../models/tag.model';
import { Person, Position } from '../../../persons/models/person.model';

const tag = (id: string, category: TagCategory): TagWithCount => ({
  id,
  name: id,
  slug: id,
  shortDescription: null,
  longDescription: null,
  color: '#6366f1',
  category,
  positionTypes: [],
  personCount: 0,
});
const position = (t: TagWithCount): Position => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  zone: null,
  color: t.color ?? '',
  category: t.category,
});
const person = (id: string, positions: Position[] = []): Person =>
  ({ id, name: id, firstSurname: 'X', secondSurname: null, alias: id, isXicalla: false, shoulderHeight: null, notes: null, notesEmoji: null, positions }) as Person;
const page = (data: Person[], total = data.length) => ({ data, meta: { total, page: 1, limit: 100 } });

const PINYA = tag('pinya', TagCategory.PINYA);
const TRONC = tag('tronc', TagCategory.TRONC);

describe('TaggingWizardModalComponent', () => {
  let fixture: ComponentFixture<TaggingWizardModalComponent>;
  let component: TaggingWizardModalComponent;
  let personService: { getAll: ReturnType<typeof vi.fn> };
  let tagService: { getAll: ReturnType<typeof vi.fn>; assignPersons: ReturnType<typeof vi.fn>; unassignPerson: ReturnType<typeof vi.fn> };
  let toast: { error: ReturnType<typeof vi.fn> };

  async function setup(people: Person[] = [person('a'), person('b')]) {
    personService = { getAll: vi.fn().mockReturnValue(of(page(people))) };
    tagService = {
      getAll: vi.fn().mockReturnValue(of([PINYA, TRONC])),
      assignPersons: vi.fn().mockReturnValue(of(undefined)),
      unassignPerson: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaggingWizardModalComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: toast },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaggingWizardModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads active non-compliant people in pending mode', async () => {
    await setup();
    expect(personService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, tagRuleOk: false, page: 1, limit: 100 }),
    );
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b']);
    expect(component.current()?.id).toBe('a');
  });

  it('loads everyone in all mode (no tagRuleOk filter)', async () => {
    await setup();
    component.setMode('all');
    const last = personService.getAll.mock.calls.at(-1)![0];
    expect(last.tagRuleOk).toBeUndefined();
    expect(last.isActive).toBe(true);
  });

  it('fetches the remaining pages when total exceeds one page', async () => {
    personService = { getAll: vi.fn() };
    personService.getAll
      .mockReturnValueOnce(of(page([person('a')], 150)))
      .mockReturnValueOnce(of(page([person('b')], 150)));
    tagService = { getAll: vi.fn().mockReturnValue(of([])), assignPersons: vi.fn(), unassignPerson: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaggingWizardModalComponent],
      providers: [
        { provide: PersonService, useValue: personService },
        { provide: TagService, useValue: tagService },
        { provide: ToastService, useValue: { error: vi.fn() } },
        allLucideIconsProvider,
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaggingWizardModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(personService.getAll).toHaveBeenCalledTimes(2);
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('assigns a tag immediately and updates the current person', async () => {
    await setup();
    component.toggleTag(PINYA);
    expect(tagService.assignPersons).toHaveBeenCalledWith('pinya', ['a']);
    expect(component.current()?.positions.map((p) => p.id)).toEqual(['pinya']);
  });

  it('removes a tag that is already assigned', async () => {
    await setup([person('a', [position(PINYA)])]);
    component.toggleTag(PINYA);
    expect(tagService.unassignPerson).toHaveBeenCalledWith('pinya', 'a');
    expect(component.current()?.positions).toEqual([]);
  });

  it('reverts only the failed tag and shows a toast', async () => {
    await setup([person('a', [position(PINYA)])]);
    tagService.assignPersons.mockReturnValue(throwError(() => new Error('boom')));
    component.toggleTag(TRONC);
    expect(component.current()?.positions.map((p) => p.id)).toEqual(['pinya']);
    expect(toast.error).toHaveBeenCalledWith("No s'ha pogut alçar l'etiqueta.");
  });

  it('ignores a second click on the same tag while its request is in flight', async () => {
    await setup();
    const pending = new Subject<void>();
    tagService.assignPersons.mockReturnValue(pending);
    component.toggleTag(PINYA);
    component.toggleTag(PINYA);
    expect(tagService.assignPersons).toHaveBeenCalledTimes(1);
  });

  it('drops a now-compliant person on next in pending mode but keeps them until then', async () => {
    await setup([person('a'), person('b')]);
    component.toggleTag(PINYA);
    component.toggleTag(TRONC);
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b']);
    component.next();
    expect(component.people().map((p) => p.id)).toEqual(['b']);
    expect(component.current()?.id).toBe('b');
  });

  it('empties the queue when the last person becomes compliant and Next is pressed', async () => {
    await setup([person('a')]);
    component.toggleTag(PINYA);
    component.toggleTag(TRONC);
    expect(component.canNext()).toBe(true);
    component.next();
    expect(component.current()).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hi ha persones pendents');
  });

  it('does not allow Next on the last person while still pending', async () => {
    await setup([person('a')]);
    expect(component.canNext()).toBe(false);
  });

  it('shows an empty state when there is nobody to tag', async () => {
    await setup([]);
    expect(component.current()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No hi ha persones pendents');
  });

  it('shows a retry state when loading fails', async () => {
    await setup();
    personService.getAll.mockReturnValue(throwError(() => new Error('boom')));
    component.reload();
    expect(component.loadError()).toBe(true);
  });

  it('ignores a stale response when mode changes mid-load', async () => {
    await setup();
    const slow = new Subject<ReturnType<typeof page>>();
    personService.getAll.mockReturnValueOnce(slow).mockReturnValueOnce(of(page([person('z')])));
    component.setMode('all');
    component.setMode('pending');
    slow.next(page([person('stale')]));
    slow.complete();
    expect(component.people().map((p) => p.id)).toEqual(['z']);
  });

  it('does not send a search term to the API (search is a jump, not a filter)', async () => {
    await setup();
    expect(personService.getAll.mock.calls[0][0]).not.toHaveProperty('search');
  });

  it('jumps to a searched person already in the queue', async () => {
    await setup([person('a'), person('b'), person('c')]);
    component.jumpTo(person('c'));
    expect(component.current()?.id).toBe('c');
    expect(component.people().map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('inserts a searched person missing from the queue right after the current one', async () => {
    await setup([person('a'), person('b')]);
    component.jumpTo(person('z'));
    expect(component.people().map((p) => p.id)).toEqual(['a', 'z', 'b']);
    expect(component.current()?.id).toBe('z');
  });

  it('shows the shoulder height relative to the 140 cm baseline', async () => {
    await setup([{ ...person('a'), shoulderHeight: 145 }]);
    expect(fixture.nativeElement.textContent).toContain("Alçada d'espatlles: +5");
  });

  it('shows 0 for the baseline height', async () => {
    await setup([{ ...person('a'), shoulderHeight: 140 }]);
    expect(fixture.nativeElement.textContent).toContain("Alçada d'espatlles: 0");
  });

  it('renders one distinct section per tag category with its tags', async () => {
    await setup();
    const sections = fixture.nativeElement.querySelectorAll('[data-testid^="tag-group-"]');
    expect(sections.length).toBe(2);
    expect(sections[0].getAttribute('data-testid')).toBe('tag-group-PINYA');
  });

  it('opens the person detail in a new tab', async () => {
    await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    component.openDetail(person('a'));
    expect(open).toHaveBeenCalledWith('/persons/a', '_blank', 'noopener');
  });

  it('emits closed when the modal closes', async () => {
    await setup();
    const spy = vi.fn();
    component.closed.subscribe(spy);
    component.closed.emit();
    expect(spy).toHaveBeenCalled();
  });
});
