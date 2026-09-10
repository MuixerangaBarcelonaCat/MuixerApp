import { configRoutes } from './config.routes';

describe('configRoutes', () => {
  it('guards the users route as ADMIN-only', () => {
    const usersRoute = configRoutes.find((route) => route.path === 'users');

    expect(usersRoute?.canActivate).toHaveLength(1);
  });
});
