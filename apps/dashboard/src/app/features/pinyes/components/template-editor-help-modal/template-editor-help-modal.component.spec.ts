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

  const tactilAnswers = (): string[] =>
    (component.sections.find((s) => s.id === 'tactil')?.items ?? []).map((i) => i.answer);

  it('the touch/tablet section explains the 768px guard on the editors', () => {
    expect(tactilAnswers().some((a) => a.includes('768px'))).toBe(true);
  });

  it('the touch/tablet section explains that assignment works on touch by tapping a node', () => {
    const answer = tactilAnswers().find((a) => a.includes('768px')) ?? '';
    expect(answer).toContain('assignació');
    expect(answer.toLowerCase()).toContain('toqueu un node');
  });

  it('the touch/tablet section no longer mentions the old 1024px limit', () => {
    expect(tactilAnswers().some((a) => a.includes('1024px'))).toBe(false);
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

  it('searching without the accent still finds the same section', () => {
    component.searchQuery.set('pinca');
    fixture.detectChanges();

    expect(component.filteredSections().some((s) => s.id === 'tactil')).toBe(true);
  });
});
