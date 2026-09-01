import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Component, input } from '@angular/core';
import { FigureZone, ImportScope } from '@muixer/shared';
import { PinyaProjectionComponent, TroncViewComponent } from '@muixer/pinyes-render';
import { ImportPreviewModalComponent } from './import-preview-modal.component';
import { ProjectionService } from '../../services/projection.service';

// Stubs: the real components pull in Konva/ResizeObserver rendering concerns this suite
// doesn't need to exercise — same pattern as projection-view.component.spec.ts.
@Component({ selector: 'lib-pinya-projection', standalone: true, template: '' })
class PinyaProjectionStub {
  readonly data = input.required<unknown>();
  readonly instanceId = input<string | null>(null);
  readonly scope = input<ImportScope | null>(null);
  readonly showZoomControls = input<boolean>(true);
}

@Component({ selector: 'app-tronc-view', standalone: true, template: '' })
class TroncViewStub {
  readonly troncNodes = input<unknown[]>([]);
  readonly baseNodes = input<unknown[]>([]);
  readonly directionNodes = input<unknown[]>([]);
  readonly mode = input<string>('assignment');
}

describe('ImportPreviewModalComponent', () => {
  let fixture: ComponentFixture<ImportPreviewModalComponent>;
  let component: ImportPreviewModalComponent;
  let projectionServiceMock: { getProjection: ReturnType<typeof vi.fn> };

  const projectionData = () => ({
    segment: { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, prevSegmentId: null, nextSegmentId: null },
    instances: [{
      id: 'inst-1', label: null, sortOrder: 0, numberOfCordons: null,
      projectionX: 0, projectionY: 0, projectionScale: 1, projectionAngle: 0,
      troncPanelX: null, troncPanelY: null, troncPanelWidth: null, troncPanelHeight: null,
      figureMode: 'COMPLETA', figureTemplate: { id: 't1', name: 'Pilar', hasPinya: true },
      nodes: [], assignments: [],
    }],
    personAttendance: {}, hasDistribution: true, conflicts: [],
  });

  beforeEach(async () => {
    projectionServiceMock = { getProjection: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ImportPreviewModalComponent],
      providers: [{ provide: ProjectionService, useValue: projectionServiceMock }],
    })
      .overrideComponent(ImportPreviewModalComponent, {
        remove: { imports: [PinyaProjectionComponent, TroncViewComponent] },
        add: { imports: [PinyaProjectionStub, TroncViewStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportPreviewModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentRef.setInput('segmentId', 'seg-1');
    fixture.componentRef.setInput('instanceId', 'inst-1');
    fixture.componentRef.setInput('scope', ImportScope.PINYA);
    fixture.componentRef.setInput('eventTitle', 'Assaig 1');
  });

  it('fetches projection data when opened', () => {
    projectionServiceMock.getProjection.mockReturnValue(of(projectionData()));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(projectionServiceMock.getProjection).toHaveBeenCalledWith('event-1', 'seg-1');
    expect(component.loading()).toBe(false);
    expect(component.projectionData()).not.toBeNull();
  });

  it('sets an error message when the fetch fails', () => {
    projectionServiceMock.getProjection.mockReturnValue(throwError(() => new Error('boom')));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('renders lib-pinya-projection (not app-tronc-view) for PINYA scope', () => {
    projectionServiceMock.getProjection.mockReturnValue(of(projectionData()));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(PinyaProjectionStub))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TroncViewStub))).toBeFalsy();
  });

  it('renders app-tronc-view (not lib-pinya-projection) for TRONC scope', () => {
    fixture.componentRef.setInput('scope', ImportScope.TRONC);
    projectionServiceMock.getProjection.mockReturnValue(of(projectionData()));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(TroncViewStub))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(PinyaProjectionStub))).toBeFalsy();
  });

  it('passes only correctly-zoned nodes of the matched instance to app-tronc-view', () => {
    fixture.componentRef.setInput('scope', ImportScope.TRONC);
    const troncNode = { id: 'n-tronc', zone: FigureZone.TRONC };
    const baseNode = { id: 'n-base', zone: FigureZone.BASE };
    const pinyaNode = { id: 'n-pinya', zone: FigureZone.PINYA };
    const figureDirNode = { id: 'n-figdir', zone: FigureZone.FIGURE_DIRECTION };
    const xicallaDirNode = { id: 'n-xicdir', zone: FigureZone.XICALLA_DIRECTION };
    const decorationNode = { id: 'n-deco', zone: FigureZone.DECORATION };

    const data = projectionData();
    data.instances[0].nodes = [
      troncNode, baseNode, pinyaNode, figureDirNode, xicallaDirNode, decorationNode,
    ] as never;
    // A second, non-matched instance whose nodes must never leak through.
    data.instances.push({
      ...data.instances[0],
      id: 'inst-2',
      nodes: [{ id: 'n-other-tronc', zone: FigureZone.TRONC }] as never,
    });
    projectionServiceMock.getProjection.mockReturnValue(of(data));

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const stub = fixture.debugElement.query(By.directive(TroncViewStub))
      .componentInstance as TroncViewStub;
    expect(stub.troncNodes()).toEqual([troncNode]);
    expect(stub.baseNodes()).toEqual([baseNode]);
    expect(stub.directionNodes()).toEqual([figureDirNode, xicallaDirNode]);
  });

  it('emits closed when close() is called', () => {
    const spy = vi.fn();
    component.closed.subscribe(spy);

    component.close();

    expect(spy).toHaveBeenCalled();
  });
});
