import { Routes } from '@angular/router';
import { TemplateListComponent } from './components/template-list/template-list.component';

export const pinyesRoutes: Routes = [
  { path: '', component: TemplateListComponent },
  {
    path: 'templates/new',
    loadComponent: () =>
      import('./components/template-editor/template-editor.component').then(
        (m) => m.TemplateEditorComponent,
      ),
  },
  {
    path: 'templates/:id/edit',
    loadComponent: () =>
      import('./components/template-editor/template-editor.component').then(
        (m) => m.TemplateEditorComponent,
      ),
  },
  {
    path: 'compositions/new',
    loadComponent: () =>
      import('./components/composition-editor/composition-editor.component').then(
        (m) => m.CompositionEditorComponent,
      ),
  },
  {
    path: 'compositions/:id/edit',
    loadComponent: () =>
      import('./components/composition-editor/composition-editor.component').then(
        (m) => m.CompositionEditorComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/distribute',
    loadComponent: () =>
      import('./components/distribution-editor/distribution-editor.component').then(
        (m) => m.DistributionEditorComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/assign',
    loadComponent: () =>
      import('./components/segment-workspace/segment-workspace.component').then(
        (m) => m.SegmentWorkspaceComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/assign/:instanceId',
    loadComponent: () =>
      import('./components/segment-workspace/segment-workspace.component').then(
        (m) => m.SegmentWorkspaceComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/project',
    loadComponent: () =>
      import('./components/projection-view/projection-view.component').then(
        (m) => m.ProjectionViewComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/project/:instanceId',
    loadComponent: () =>
      import('./components/projection-view/projection-view.component').then(
        (m) => m.ProjectionViewComponent,
      ),
  },
];
