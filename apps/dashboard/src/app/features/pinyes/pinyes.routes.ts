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
    path: 'events/:eventId/segments/:segmentId/distribute',
    loadComponent: () =>
      import('./components/distribution-editor/distribution-editor.component').then(
        (m) => m.DistributionEditorComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/assign',
    loadComponent: () =>
      import('./components/assignment-canvas/assignment-canvas.component').then(
        (m) => m.AssignmentCanvasComponent,
      ),
  },
  {
    path: 'events/:eventId/segments/:segmentId/assign/:instanceId',
    loadComponent: () =>
      import('./components/assignment-canvas/assignment-canvas.component').then(
        (m) => m.AssignmentCanvasComponent,
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
