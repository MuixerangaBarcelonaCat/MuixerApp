import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Component, input } from '@angular/core';
import { PrevisualitzaTabComponent } from './previsualitza-tab.component';
import { ProjectionViewComponent } from '../../../projection-view/projection-view.component';

@Component({ selector: 'app-projection-view', standalone: true, template: '' })
class ProjectionViewStub {
  readonly embedded = input(false);
}

describe('PrevisualitzaTabComponent', () => {
  let fixture: ComponentFixture<PrevisualitzaTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrevisualitzaTabComponent],
    })
      .overrideComponent(PrevisualitzaTabComponent, {
        remove: { imports: [ProjectionViewComponent] },
        add: { imports: [ProjectionViewStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PrevisualitzaTabComponent);
    fixture.detectChanges();
  });

  it('renders the projection view in embedded mode', () => {
    const el: HTMLElement = fixture.nativeElement;
    const projectionView = el.querySelector('app-projection-view');
    expect(projectionView).toBeTruthy();

    const debugEl = fixture.debugElement.query((de) => de.name === 'app-projection-view');
    const stub = debugEl.componentInstance as ProjectionViewStub;
    expect(stub.embedded()).toBe(true);
  });
});
