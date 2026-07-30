import { Router } from '@angular/router';

/**
 * Where a workspace opened from the event page should come back to: the current path
 * keeping only `?tab=`, so the user lands on the section they left from instead of the
 * default one.
 *
 * Every other query param is dropped on purpose — notably a previous `returnUrl`, which
 * would otherwise nest.
 */
export function eventReturnUrl(router: Router): string {
  const [path, query] = router.url.split('?');
  const tab = new URLSearchParams(query ?? '').get('tab');
  return tab ? `${path}?tab=${tab}` : path;
}
