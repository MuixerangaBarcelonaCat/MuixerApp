import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccessStatus } from '@muixer/shared';
import { AccessStatusBadgeComponent, accessStatusBadgeClass } from './access-status-badge.component';

describe('AccessStatusBadgeComponent', () => {
  let fixture: ComponentFixture<AccessStatusBadgeComponent>;

  const render = (status: AccessStatus) => {
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.badge') as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccessStatusBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccessStatusBadgeComponent);
  });

  it.each([
    [AccessStatus.ACTIVE, 'Compte actiu', 'badge-success'],
    [AccessStatus.INVITED, 'Invitació enviada', 'badge-warning'],
    [AccessStatus.INVITE_EXPIRED, 'Invitació vençuda', 'badge-error'],
    [AccessStatus.MANAGED, 'Amb responsable', 'badge-info'],
  ])('%s reads «%s» in the semantic color', (status, label, cls) => {
    const badge = render(status);
    expect(badge.textContent?.trim()).toBe(label);
    expect(badge.classList).toContain(cls);
  });

  it('draws «Sense accés» as a quiet outline', () => {
    const badge = render(AccessStatus.NONE);
    expect(badge.textContent?.trim()).toBe('Sense accés');
    expect(badge.classList).toContain('badge-outline');
  });

  // Tables draw raw badge markup (no <lib-badge> per cell): the same classes, from the same map.
  it.each(Object.values(AccessStatus))('accessStatusBadgeClass(%s) matches the badge', (status) => {
    const badge = render(status);
    const classes = accessStatusBadgeClass(status).split(' ');
    expect(classes.every((cls) => badge.classList.contains(cls))).toBe(true);
    expect(badge.classList.contains('badge-outline')).toBe(classes.includes('badge-outline'));
  });
});
