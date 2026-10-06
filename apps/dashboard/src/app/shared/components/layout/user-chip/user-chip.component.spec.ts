import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRole } from '@muixer/shared';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { UserChipComponent } from './user-chip.component';

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
});
