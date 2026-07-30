import { Router } from '@angular/router';
import { eventReturnUrl } from './event-return-url.util';

const routerWithUrl = (url: string) => ({ url }) as Router;

describe('eventReturnUrl', () => {
  it('keeps the tab param so the user returns to the section they left', () => {
    expect(eventReturnUrl(routerWithUrl('/events/ev-1?tab=participacio'))).toBe(
      '/events/ev-1?tab=participacio',
    );
  });

  it('returns the bare path when there is no query string', () => {
    expect(eventReturnUrl(routerWithUrl('/events/ev-1'))).toBe('/events/ev-1');
  });

  it('returns the bare path when the query string has no tab', () => {
    expect(eventReturnUrl(routerWithUrl('/events/ev-1?foo=bar'))).toBe('/events/ev-1');
  });

  it('drops every other param, including a previous returnUrl that would otherwise nest', () => {
    expect(
      eventReturnUrl(routerWithUrl('/events/ev-1?tab=pinyes&returnUrl=%2Fold&foo=bar')),
    ).toBe('/events/ev-1?tab=pinyes');
  });

  it('ignores an empty tab value', () => {
    expect(eventReturnUrl(routerWithUrl('/events/ev-1?tab='))).toBe('/events/ev-1');
  });
});
