export type AppRoute = 'today' | 'check-in' | 'history' | 'insights' | 'more';

const routes = new Set<AppRoute>(['today', 'check-in', 'history', 'insights', 'more']);

export function routeFromHash(hash = window.location.hash): AppRoute {
  const candidate = hash.replace(/^#\/?/, '') as AppRoute;
  return routes.has(candidate) ? candidate : 'today';
}

export function navigateTo(route: AppRoute) {
  const nextHash = `#/${route}`;
  if (window.location.hash === nextHash) {
    window.dispatchEvent(new Event('hashchange'));
    return;
  }
  window.location.hash = nextHash;
}
