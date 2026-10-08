import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserChipComponent } from './user-chip.component';
import { AboutAppModalComponent } from '../../about-app-modal/about-app-modal.component';
import { LegalDocumentService } from '../../../../core/services/legal-document.service';
import { of } from 'rxjs';

describe('UserChipComponent', () => {
  let fixture: ComponentFixture<UserChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserChipComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ email: 'anna@colla.cat', person: { name: 'Anna', alias: 'Anna' } }),
            userRole: signal(UserRole.TECHNICAL),
            logout: vi.fn(),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: LegalDocumentService, useValue: { getActive: vi.fn().mockReturnValue(of({ content: '' })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserChipComponent);
    fixture.detectChanges();
  });

  it('offers the theme picker in the user menu, under an «Aparença» label', () => {
    const item: HTMLElement = fixture.nativeElement.querySelector('[data-testid="appearance-item"]');
    expect(item.textContent).toContain('Aparença');
    expect(item.querySelector('lib-theme-picker')).toBeTruthy();
  });

  it('opens the «Sobre l\'app» modal from the user menu', () => {
    const modal = () =>
      fixture.debugElement.query((n) => n.componentInstance instanceof AboutAppModalComponent)
        .componentInstance as AboutAppModalComponent;
    expect(modal().open()).toBe(false);

    const item: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="about-item"]');
    expect(item.textContent).toContain("Sobre l'app");
    item.click();
    fixture.detectChanges();

    expect(modal().open()).toBe(true);
  });

  it('closes the «Sobre l\'app» modal when it emits closed', () => {
    (fixture.nativeElement.querySelector('[data-testid="about-item"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const modal = fixture.debugElement.query((n) => n.componentInstance instanceof AboutAppModalComponent)
      .componentInstance as AboutAppModalComponent;

    modal.closed.emit();
    fixture.detectChanges();

    expect(modal.open()).toBe(false);
  });
});
