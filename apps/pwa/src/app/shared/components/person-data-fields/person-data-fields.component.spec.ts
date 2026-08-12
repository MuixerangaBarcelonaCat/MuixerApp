import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Gender } from '@muixer/shared';
import { PersonDataFieldsComponent } from './person-data-fields.component';
import { buildPersonDataFormGroup } from '../../utils/person-data-form.util';

describe('PersonDataFieldsComponent', () => {
  let fixture: ComponentFixture<PersonDataFieldsComponent>;

  const createGroup = () => buildPersonDataFormGroup(new FormBuilder().nonNullable);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonDataFieldsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonDataFieldsComponent);
  });

  it('renders an input bound to each mandatory field', () => {
    fixture.componentRef.setInput('formGroup', createGroup());
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input[formControlName="name"]')).toBeTruthy();
    expect(el.querySelector('input[formControlName="firstSurname"]')).toBeTruthy();
    expect(el.querySelector('input[formControlName="secondSurname"]')).toBeTruthy();
    expect(el.querySelector('select[formControlName="gender"]')).toBeTruthy();
    expect(el.querySelector('select[formControlName="country"]')).toBeTruthy();
    expect(el.querySelector('input[formControlName="phoneNumber"]')).toBeTruthy();
    expect(el.querySelector('input[formControlName="birthDate"]')).toBeTruthy();
  });

  it('renders the optional heading when provided', () => {
    fixture.componentRef.setInput('formGroup', createGroup());
    fixture.componentRef.setInput('heading', 'Dades de la xicalla');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dades de la xicalla');
  });

  it('does not render a heading when omitted', () => {
    fixture.componentRef.setInput('formGroup', createGroup());
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h2, h3');
    expect(heading).toBeFalsy();
  });

  it('populates the country select with every ISO country and its dial code', () => {
    fixture.componentRef.setInput('formGroup', createGroup());
    fixture.detectChanges();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('select[formControlName="country"] option'),
    ) as HTMLOptionElement[];
    expect(options.length).toBeGreaterThan(100);
    const spain = options.find((o) => o.value === 'ES');
    expect(spain?.textContent).toContain('+34');
  });

  it('defaults gender to an empty (unselected) option so the user must actively choose', () => {
    const group = createGroup();
    fixture.componentRef.setInput('formGroup', group);
    fixture.detectChanges();

    expect(group.controls.gender.value).toBe('');
  });

  it('reflects values typed into the bound form group', () => {
    const group = createGroup();
    fixture.componentRef.setInput('formGroup', group);
    fixture.detectChanges();

    group.patchValue({ name: 'Joan', gender: Gender.MALE });
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector(
      'input[formControlName="name"]',
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Joan');
  });
});
