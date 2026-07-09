/**
 * Normalizes a URL the same way for both registration and lookup, so trivial
 * variations (trailing slash, etc.) don't cause a registered URL to fail to
 * match against itself later. MUST be used everywhere a URL is checked
 * against the registry — registration, agent citation checks, etc.
 */
export function normalizeCanonicalUrl(rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}${path}`;
}
