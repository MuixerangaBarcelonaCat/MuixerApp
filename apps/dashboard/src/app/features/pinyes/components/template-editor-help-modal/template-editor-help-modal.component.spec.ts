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

  describe('assignment canvas: moving a person', () => {
    const assignmentShortcuts = () =>
      component.shortcutGroups.find((g) => g.title === "Canvas d'assignació")?.shortcuts ?? [];

    it('documents the right-click that starts moving a person', () => {
      const entry = assignmentShortcuts().find((s) => s.keys.toLowerCase().includes('clic dret'));

      expect(entry).toBeDefined();
      expect(entry?.action.toLowerCase()).toContain('intercanvia');
    });

    it('says that Escape also cancels a move', () => {
      const entry = assignmentShortcuts().find((s) => s.keys === 'Escape');

      expect(entry?.action.toLowerCase()).toContain('moviment');
    });
  });

  describe('touch gestures: a long press moves people, drag is for editor nodes', () => {
    const touchShortcuts = () =>
      component.shortcutGroups.find((g) => g.title.toLowerCase().includes('tàctils'))?.shortcuts ?? [];
    const touchAnswers = () =>
      (component.sections.find((s) => s.id === 'tactil')?.items ?? []).map((i) => i.answer);

    it('documents that a long press on a person starts moving them, then the destination is tapped', () => {
      const entry = touchShortcuts().find((s) => s.keys.toLowerCase().includes('mantingut'));

      expect(entry?.action.toLowerCase()).toContain('moure');
      expect(entry?.action.toLowerCase()).toContain('destí');
    });

    it('no longer says a long press shows the person card', () => {
      expect(touchShortcuts().some((s) => s.action.toLowerCase().includes('fitxa'))).toBe(false);
    });

    it('no longer says a person can be dragged on touch', () => {
      expect(touchShortcuts().some((s) => s.action === 'Moure un node o una persona')).toBe(false);
    });

    it('the gestures answer explains the long press to move', () => {
      expect(touchAnswers().some((a) => a.toLowerCase().includes('començar a moure-la'))).toBe(true);
    });

    it('the person-card answer no longer tells the user to hold a finger on the node', () => {
      expect(touchAnswers().some((a) => a.toLowerCase().includes('manteniu el dit'))).toBe(false);
    });
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
