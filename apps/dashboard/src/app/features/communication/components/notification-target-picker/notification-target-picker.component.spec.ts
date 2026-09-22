import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationTargetType } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationTargetPickerComponent } from './notification-target-picker.component';
import { NotificationTargetValue } from '../../services/notification.service';

describe('NotificationTargetPickerComponent', () => {
  let component: NotificationTargetPickerComponent;
  let fixture: ComponentFixture<NotificationTargetPickerComponent>;

  const setup = async (target: NotificationTargetValue = { type: NotificationTargetType.ALL }, hasLinkedEvent = false) => {
    await TestBed.configureTestingModule({
      imports: [NotificationTargetPickerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationTargetPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('target', target);
    fixture.componentRef.setInput('hasLinkedEvent', hasLinkedEvent);
    fixture.detectChanges();
  };

  it('changes the target type', async () => {
    await setup();
    component.setType(NotificationTargetType.PERSON);
    expect(component.target().type).toBe(NotificationTargetType.PERSON);
  });

  it('sets the attendance filter, or clears it', async () => {
    await setup({ type: NotificationTargetType.EVENT_ATTENDANCE }, true);
    component.setAttendanceFilter('ANIRE' as never);
    expect(component.target().attendanceFilter).toBe('ANIRE');
    component.setAttendanceFilter('');
    expect(component.target().attendanceFilter).toBeUndefined();
  });

  it('adds and removes persons, keeping target.personIds in sync', async () => {
    await setup({ type: NotificationTargetType.PERSON });
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as never);
    component.addPerson({ id: 'p2', name: 'Joan', firstSurname: 'Puig' } as never);
    expect(component.target().personIds).toEqual(['p1', 'p2']);

    component.removePerson('p1');
    expect(component.target().personIds).toEqual(['p2']);
  });

  it('does not add the same person twice', async () => {
    await setup({ type: NotificationTargetType.PERSON });
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as never);
    component.addPerson({ id: 'p1', name: 'Anna', firstSurname: 'Ferrer' } as never);
    expect(component.selectedPersons().length).toBe(1);
  });

  it('does not offer "Segons assistència" when there is no linked event', async () => {
    await setup({ type: NotificationTargetType.ALL }, false);
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('Segons assistència');
  });

  it('offers "Segons assistència" when there is a linked event', async () => {
    await setup({ type: NotificationTargetType.ALL }, true);
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).toContain('Segons assistència');
  });

  it('does not offer a no-filter "all responses" option — it is redundant with the ALL target', async () => {
    await setup({ type: NotificationTargetType.EVENT_ATTENDANCE }, true);
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('Totes les respostes');
  });
});
