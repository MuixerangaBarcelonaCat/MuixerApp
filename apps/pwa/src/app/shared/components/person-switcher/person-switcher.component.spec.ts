import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DelegateType, ManagedPerson } from '@muixer/shared';
import { PersonSwitcherComponent } from './person-switcher.component';

describe('PersonSwitcherComponent', () => {
  let fixture: ComponentFixture<PersonSwitcherComponent>;

  const items: ManagedPerson[] = [
    { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null },
    { personId: 'p-2', displayName: 'JoanP', isSelf: false, delegateType: DelegateType.PARENT },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonSwitcherComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonSwitcherComponent);
  });

  it('renders every item as an option', () => {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('selectedId', 'p-1');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('MartaP');
    expect(text).toContain('JoanP');
  });

  it('shows the selected item as the trigger label', () => {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('selectedId', 'p-2');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('[role="button"]') as HTMLElement;
    expect(trigger.textContent).toContain('JoanP');
  });

  it('highlights the selected option in primary color, not the default DaisyUI neutral', () => {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('selectedId', 'p-2');
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('li button');
    expect((options[0] as HTMLElement).classList.contains('bg-primary')).toBe(false);
    expect((options[1] as HTMLElement).classList.contains('bg-primary')).toBe(true);
    expect((options[1] as HTMLElement).classList.contains('text-primary-content')).toBe(true);
  });

  it('emits selectionChange with the personId when an option is clicked', () => {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('selectedId', 'p-1');
    fixture.detectChanges();

    let emitted: string | undefined;
    fixture.componentInstance.selectionChange.subscribe((id: string) => (emitted = id));

    const options = fixture.nativeElement.querySelectorAll('li button');
    (options[1] as HTMLButtonElement).click();

    expect(emitted).toBe('p-2');
  });
});
