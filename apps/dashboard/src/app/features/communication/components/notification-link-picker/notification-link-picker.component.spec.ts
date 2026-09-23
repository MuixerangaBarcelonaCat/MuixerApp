import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationLinkType } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { NotificationLinkPickerComponent } from './notification-link-picker.component';
import { NotificationLinkValue } from '../../services/notification.service';

describe('NotificationLinkPickerComponent', () => {
  let component: NotificationLinkPickerComponent;
  let fixture: ComponentFixture<NotificationLinkPickerComponent>;

  const setup = async (link: NotificationLinkValue = { type: NotificationLinkType.HOME }, hasLinkedEvent = false) => {
    await TestBed.configureTestingModule({
      imports: [NotificationLinkPickerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationLinkPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('link', link);
    fixture.componentRef.setInput('hasLinkedEvent', hasLinkedEvent);
    fixture.detectChanges();
  };

  it('defaults to HOME', async () => {
    await setup();
    expect(component.link().type).toBe(NotificationLinkType.HOME);
  });

  it('sets the link type', async () => {
    await setup();
    component.setType(NotificationLinkType.CUSTOM);
    expect(component.link().type).toBe(NotificationLinkType.CUSTOM);
  });

  it('sets the custom url', async () => {
    await setup({ type: NotificationLinkType.CUSTOM });
    component.setUrl('/noticies/123');
    expect(component.link().url).toBe('/noticies/123');
  });

  it('clears the url when switching away from CUSTOM', async () => {
    await setup({ type: NotificationLinkType.CUSTOM, url: '/noticies/123' });
    component.setType(NotificationLinkType.HOME);
    expect(component.link().url).toBeUndefined();
  });

  it('disables the EVENT option when there is no linked event', async () => {
    await setup({ type: NotificationLinkType.HOME }, false);
    const button = fixture.nativeElement.querySelector('[data-testid="link-event-option"] button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables the EVENT option when there is a linked event', async () => {
    await setup({ type: NotificationLinkType.HOME }, true);
    const button = fixture.nativeElement.querySelector('[data-testid="link-event-option"] button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
