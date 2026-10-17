// Several small endpoints share one Vercel function: the Hobby plan allows at
// most 12 per deployment. vercel.json rewrites each public path to its
// group's function with a `route` query param; the function hands the
// request to that route's handler in api/_handlers/. The original path is the
// fallback, so a request that arrives un-rewritten still lands.
export function dispatch(routes, routeForPath) {
  return function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const route = url.searchParams.get('route') || routeForPath[url.pathname.replace(/\/+$/, '')];
    const target = routes[route];
    if (!target) return res.status(404).json({ error: { message: 'Not found' } });
    return target(req, res);
  };
}
