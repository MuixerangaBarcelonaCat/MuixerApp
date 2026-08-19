import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ButtonGroupComponent } from './button-group.component';

@Component({
  imports: [ButtonGroupComponent],
  template: `<lib-button-group><button data-testid="projected">A</button></lib-button-group>`,
})
class HostComponent {}

describe('ButtonGroupComponent', () => {
  let fixture: ComponentFixture<ButtonGroupComponent>;

  const joinEl = () => fixture.debugElement.query(By.css('.join'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonGroupComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ButtonGroupComponent);
    fixture.detectChanges();
  });

  it('renders a .join wrapper with role="group"', () => {
    const el = joinEl();
    expect(el).toBeTruthy();
    expect(el.nativeElement.getAttribute('role')).toBe('group');
  });

  it('is horizontal by default', () => {
    expect(joinEl().nativeElement.className).not.toContain('join-vertical');
  });

  it('adds join-vertical when vertical is set', () => {
    fixture.componentRef.setInput('vertical', true);
    fixture.detectChanges();
    expect(joinEl().nativeElement.className).toContain('join-vertical');
  });

  it('projects content inside the .join wrapper', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();

    const projected = hostFixture.debugElement.query(By.css('[data-testid="projected"]'));
    expect(projected).toBeTruthy();
    expect(projected.nativeElement.closest('.join')).toBeTruthy();
  });
});
