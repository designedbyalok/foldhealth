// The component's path is typed by an admin and the result loads in an
// iframe, so it must stay on the chosen domain: a path such as
// "@evil.com/x" or "//evil.com" would otherwise send the frame elsewhere.
export function embedUrl(domain, path) {
  if (!domain || typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return '';
  try {
    const url = new URL(`https://${domain}${path}`);
    return url.host === String(domain).toLowerCase() ? url.href : '';
  } catch {
    return '';
  }
}
