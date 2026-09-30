import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { EmojiPickerComponent } from './emoji-picker.component';

describe('EmojiPickerComponent', () => {
  let fixture: ComponentFixture<EmojiPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmojiPickerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(EmojiPickerComponent);
    fixture.detectChanges();
  });

  const openPanel = () => {
    (fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLElement).click();
    fixture.detectChanges();
  };

  it('renders a compact trigger with the current emoji and a dropdown chevron', () => {
    fixture.componentRef.setInput('value', '🚨');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLElement;
    expect(trigger.textContent?.trim()).toBe('🚨');
    expect(trigger.querySelector('lucide-icon[name="ChevronDown"]')).toBeTruthy();
    expect(trigger.className).toContain('h-8');
    // .select is inline-flex with no align-items, so without this the emoji sits at the top edge.
    expect(trigger.className).toContain('items-center');
    expect(trigger.className).toContain('justify-center');
  });

  it('opens the library picker directly, without a "Freqüents" section', () => {
    openPanel();

    const panel = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.querySelector('emoji-picker')).toBeTruthy();
    expect(panel.textContent).not.toContain('Freqüents');
    expect(panel.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not offer a way to clear the emoji, even when one is set', () => {
    fixture.componentRef.setInput('value', '🚨');
    fixture.detectChanges();
    openPanel();

    const panel = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.textContent).not.toContain('Cap');
    expect(panel.querySelectorAll('button')).toHaveLength(0);
  });
});
