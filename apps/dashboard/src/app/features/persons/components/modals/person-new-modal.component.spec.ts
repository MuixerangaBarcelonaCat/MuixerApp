import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PersonNewModalComponent } from './person-new-modal.component';
import { PersonService } from '../../services/person.service';
import { Person } from '../../models/person.model';

describe('PersonNewModalComponent', () => {
  let fixture: ComponentFixture<PersonNewModalComponent>;
  let component: PersonNewModalComponent;
  let personService: { createProvisional: ReturnType<typeof vi.fn> };

  const mockPerson = { id: 'new-1', alias: '~test' } as Person;

  beforeEach(async () => {
    personService = {
      createProvisional: vi.fn().mockReturnValue(of(mockPerson)),
    };

    await TestBed.configureTestingModule({
      imports: [PersonNewModalComponent],
      providers: [{ provide: PersonService, useValue: personService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonNewModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('renders an alias input, a Crea button and a Cancel·la button', () => {
    const input = fixture.nativeElement.querySelector('input');
    expect(input).toBeTruthy();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    expect(buttons.some((b) => b.textContent?.trim() === 'Crea')).toBe(true);
    expect(buttons.some((b) => b.textContent?.trim() === 'Cancel·la')).toBe(true);
  });

  it('disables the Crea button while the alias is empty', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const createBtn = buttons.find((b) => b.textContent?.trim() === 'Crea') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it('emits closed when Cancel·la is clicked', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    (buttons.find((b) => b.textContent?.trim() === 'Cancel·la') as HTMLElement).click();

    expect(closedSpy).toHaveBeenCalled();
    expect(personService.createProvisional).not.toHaveBeenCalled();
  });

  it('creates a provisional person with only the alias and emits it on success', () => {
    const createdSpy = vi.fn();
    component.created.subscribe(createdSpy);

    component.alias.set('Nou Membre');
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    (buttons.find((b) => b.textContent?.trim() === 'Crea') as HTMLElement).click();

    expect(personService.createProvisional).toHaveBeenCalledWith('Nou Membre');
    expect(createdSpy).toHaveBeenCalledWith(mockPerson);
  });

  it('shows an error message and does not emit created when creation fails', () => {
    personService.createProvisional.mockReturnValue(
      throwError(() => ({ error: { message: 'Àlies duplicat' } })),
    );
    const createdSpy = vi.fn();
    component.created.subscribe(createdSpy);

    component.alias.set('Duplicat');
    fixture.detectChanges();
    component.create();
    fixture.detectChanges();

    expect(createdSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Àlies duplicat');
  });
});
