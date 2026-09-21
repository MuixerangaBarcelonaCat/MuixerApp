import { describe, expect, it } from 'vitest';
import { desktopOnlyGuard } from '../../core/guards/desktop-only.guard';
import { pinyesRoutes } from './pinyes.routes';

const routeFor = (path: string) => pinyesRoutes.find((r) => r.path === path);

describe('pinyesRoutes access on narrow screens', () => {
  it.each([
    'events/:eventId/segments/:segmentId/assign',
    'events/:eventId/segments/:segmentId/assign/:instanceId',
  ])('the segment workspace (%s) is reachable from a phone', (path) => {
    const route = routeFor(path);

    expect(route).toBeDefined();
    expect(route?.canActivate ?? []).not.toContain(desktopOnlyGuard);
  });

  it.each(['templates/new', 'templates/:id/edit', 'compositions/new', 'compositions/:id/edit'])(
    'the editor (%s) stays desktop / tablet only',
    (path) => {
      expect(routeFor(path)?.canActivate).toContain(desktopOnlyGuard);
    },
  );
});
