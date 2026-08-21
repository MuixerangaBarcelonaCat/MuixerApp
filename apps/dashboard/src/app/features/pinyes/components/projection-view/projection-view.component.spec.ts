import { PinyaProjectionComponent } from '@muixer/pinyes-render';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ProjectionViewComponent } from './projection-view.component';
import { ProjectionService } from '../../services/projection.service';
import { ToastService } from '@muixer/ui';
import { LayoutService } from '../../../../core/services/layout.service';

@Component({ selector: 'lib-pinya-projection', standalone: true, template: '' })
class PinyaProjectionStub {
  readonly data = input.required<unknown>();
  readonly instanceId = input<string | null>(null);
}

const emptySegment = () => ({
  segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
  instances: [],
  personAttendance: {},
  hasDistribution: false,
  conflicts: [],
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ProjectionViewComponent', () => {
  let fixture: ComponentFixture<ProjectionViewComponent>;
  let component: ProjectionViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectionViewComponent],
      providers: [
        { provide: ProjectionService, useValue: { getProjection: vi.fn().mockReturnValue(of(emptySegment())) } },
        { provide: ToastService, useValue: { error: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { eventId: 'e1', segmentId: 's1' } } } },
        allLucideIconsProvider,
      ],
    })
    .overrideComponent(ProjectionViewComponent, {
      remove: { imports: [PinyaProjectionComponent] },
      add: { imports: [PinyaProjectionStub] },
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectionViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── help dialog (touch gestures) ─────────────────────────────────────────────

  describe('help dialog', () => {
    it('mentions pinch-to-zoom and one-finger pan (projection has no touch guard)', () => {
      component.helpModalOpen.set(true);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Pinça');
      expect(text.toLowerCase()).toContain('desplaç');
    });
  });

  // ── browser back button ─────────────────────────────────────────────────────

  describe('browser back button', () => {
    it('navigates back to the event (like the HUD arrow) when the browser back button is pressed', () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.eventId = 'e1';

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(navigateSpy).toHaveBeenCalledWith(['/events', 'e1']);
    });
  });

  // ── navigateSegment resets instanceId (design decision 6 bug fix) ───────────

  describe('navigateSegment', () => {
    it('clears instanceId when moving to the next segment (URL carries no instance id)', () => {
      component.eventId = 'e1';
      component.instanceIdSignal.set('inst-x');
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: 's2' },
        instances: [],
        personAttendance: {},
        hasDistribution: false,
        conflicts: [],
      });

      component.navigateSegment('next');

      expect(component.instanceIdSignal()).toBeNull();
    });

    it('clears instanceId when moving to the previous segment too', () => {
      component.eventId = 'e1';
      component.instanceIdSignal.set('inst-x');
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: 's0', nextSegmentId: null },
        instances: [],
        personAttendance: {},
        hasDistribution: false,
        conflicts: [],
      });

      component.navigateSegment('prev');

      expect(component.instanceIdSignal()).toBeNull();
    });

    it('does not touch instanceId when there is no target segment to navigate to', () => {
      component.eventId = 'e1';
      component.instanceIdSignal.set('inst-x');
      component.segmentData.set({
        segment: { id: 's1', name: null, sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
        instances: [],
        personAttendance: {},
        hasDistribution: false,
        conflicts: [],
      });

      component.navigateSegment('next');

      expect(component.instanceIdSignal()).toBe('inst-x');
    });
  });

  // ── embedded mode ─────────────────────────────────────────────────────────────

  describe('embedded mode', () => {
    async function createEmbedded(embedded: boolean, instanceIdParam = 'inst-x') {
      const layoutService = { requestFullscreen: vi.fn(), exitFullscreen: vi.fn() };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ProjectionViewComponent],
        providers: [
          { provide: ProjectionService, useValue: { getProjection: vi.fn().mockReturnValue(of(emptySegment())) } },
          { provide: ToastService, useValue: { error: vi.fn() } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: ActivatedRoute, useValue: { snapshot: { params: { eventId: 'e1', segmentId: 's1', instanceId: instanceIdParam } } } },
          { provide: LayoutService, useValue: layoutService },
          allLucideIconsProvider,
        ],
      })
        .overrideComponent(ProjectionViewComponent, {
          remove: { imports: [PinyaProjectionComponent] },
          add: { imports: [PinyaProjectionStub] },
        })
        .compileComponents();

      const embeddedFixture = TestBed.createComponent(ProjectionViewComponent);
      embeddedFixture.componentRef.setInput('embedded', embedded);
      embeddedFixture.detectChanges();
      return { fixture: embeddedFixture, layoutService };
    }

    it('does not manage fullscreen when embedded', async () => {
      const { fixture: f, layoutService } = await createEmbedded(true);
      expect(layoutService.requestFullscreen).not.toHaveBeenCalled();
      f.destroy();
      expect(layoutService.exitFullscreen).not.toHaveBeenCalled();
    });

    it('manages fullscreen when not embedded (default)', async () => {
      const { fixture: f, layoutService } = await createEmbedded(false);
      expect(layoutService.requestFullscreen).toHaveBeenCalled();
      f.destroy();
      expect(layoutService.exitFullscreen).toHaveBeenCalled();
    });

    it('ignores the route instanceId param when embedded, always showing the full segment', async () => {
      const { fixture: f } = await createEmbedded(true, 'inst-x');
      expect(f.componentInstance.instanceIdSignal()).toBeNull();
    });

    it('reads the route instanceId param when not embedded', async () => {
      const { fixture: f } = await createEmbedded(false, 'inst-x');
      expect(f.componentInstance.instanceIdSignal()).toBe('inst-x');
    });

    it('hides the floating HUD nav when embedded', async () => {
      const { fixture: f } = await createEmbedded(true);
      expect(f.nativeElement.querySelector('nav')).toBeNull();
    });

    it('shows the floating HUD nav when not embedded', async () => {
      const { fixture: f } = await createEmbedded(false);
      expect(f.nativeElement.querySelector('nav')).not.toBeNull();
    });

    it('ignores segment-navigation arrow keys when embedded', async () => {
      const { fixture: f } = await createEmbedded(true);
      const navigateSpy = vi.spyOn(f.componentInstance, 'navigateSegment');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('handles segment-navigation arrow keys when not embedded', async () => {
      const { fixture: f } = await createEmbedded(false);
      const navigateSpy = vi.spyOn(f.componentInstance, 'navigateSegment');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(navigateSpy).toHaveBeenCalledWith('prev');
    });

    it('ignores the browser back button when embedded — the host shell owns it', async () => {
      const { fixture: f } = await createEmbedded(true);
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
