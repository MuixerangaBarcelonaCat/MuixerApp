import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { TemplateEditorHelpModalComponent } from './template-editor-help-modal.component';

describe('TemplateEditorHelpModalComponent', () => {
  let component: TemplateEditorHelpModalComponent;
  let fixture: ComponentFixture<TemplateEditorHelpModalComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TemplateEditorHelpModalComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateEditorHelpModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Touch/tablet guidance ("what can and can't be done on a tablet") ──────

  it('includes a touch/tablet help section', () => {
    expect(component.sections.some((s) => s.id === 'tactil')).toBe(true);
  });

  it('the touch/tablet section explains the ≥1024px guard on editor/assignment', () => {
    const section = component.sections.find((s) => s.id === 'tactil')!;
    expect(section.items.some((i) => i.answer.includes('1024px'))).toBe(true);
  });

  it('the touch/tablet section explains projection has no device restriction', () => {
    const section = component.sections.find((s) => s.id === 'tactil')!;
    expect(section.items.some((i) => i.answer.toLowerCase().includes('projecció'))).toBe(true);
  });

  it('selecting the touch/tablet tab shows its content', () => {
    component.open();
    component.selectTab('tactil');
    fixture.detectChanges();

    expect(component.activeSection()?.id).toBe('tactil');
  });

  it('includes a touch gestures shortcut group', () => {
    expect(component.shortcutGroups.some((g) => g.title.toLowerCase().includes('tàctils'))).toBe(true);
  });

  it('searching "pinça" finds the touch/tablet section', () => {
    component.searchQuery.set('pinça');
    fixture.detectChanges();

    expect(component.filteredSections().some((s) => s.id === 'tactil')).toBe(true);
  });
});
