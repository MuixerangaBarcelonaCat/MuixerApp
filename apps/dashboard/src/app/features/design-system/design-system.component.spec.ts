import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { DesignSystemComponent } from './design-system.component';

describe('DesignSystemComponent', () => {
  let fixture: ComponentFixture<DesignSystemComponent>;
  let originalTheme: string;

  beforeEach(async () => {
    originalTheme = document.documentElement.dataset['theme'] ?? '';
    document.documentElement.dataset['theme'] = 'colla-barcelona-light';

    await TestBed.configureTestingModule({
      imports: [DesignSystemComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(DesignSystemComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.dataset['theme'] = originalTheme;
  });

  it('starts reflecting the page theme already applied to the document', () => {
    expect(fixture.componentInstance.mode()).toBe('light');
  });

  it('toggling switches the document data-theme to the dark colla theme', () => {
    fixture.componentInstance.toggleMode();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('colla-barcelona-dark');
    expect(fixture.componentInstance.mode()).toBe('dark');
  });

  it('toggling twice returns to the light colla theme', () => {
    fixture.componentInstance.toggleMode();
    fixture.componentInstance.toggleMode();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('colla-barcelona-light');
    expect(fixture.componentInstance.mode()).toBe('light');
  });

  it('restores the document theme that was active before this page mounted, on destroy', () => {
    fixture.componentInstance.toggleMode();
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).toBe('colla-barcelona-dark');

    fixture.destroy();

    expect(document.documentElement.dataset['theme']).toBe('colla-barcelona-light');
  });
});
