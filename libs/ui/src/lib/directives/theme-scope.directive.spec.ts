import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeScopeDirective } from './theme-scope.directive';
import { THEME_NAMES } from '../tokens/theme-names';
import { ThemeMode } from '../tokens/color';

@Component({
  standalone: true,
  imports: [ThemeScopeDirective],
  template: `<div [libThemeScope]="mode()">HUD</div>`,
})
class HostComponent {
  readonly mode = signal<ThemeMode>('dark');
}

describe('ThemeScopeDirective', () => {
  it('pins its element to the named theme of the given mode, whatever the page theme is', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(el.dataset['theme']).toBe(THEME_NAMES.dark);

    fixture.componentInstance.mode.set('light');
    fixture.detectChanges();
    expect(el.dataset['theme']).toBe(THEME_NAMES.light);
  });
});
