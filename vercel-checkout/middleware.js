export default function middleware(request) {
  const url = new URL(request.url);

  // If tenant is already set, do nothing (avoid redirect loop)
  if (url.searchParams.has('tenant')) {
    return;
  }

  const hostname = request.headers.get('host') || '';
  const parts = hostname.split('.');

  // Skip for localhost or bare domains (2 parts)
  if (parts.length <= 2 || hostname.includes('localhost')) {
    return;
  }

  // Extract subdomain
  const subdomain = parts[0];
  const skip = ['www', 'api', 'app', 'admin', 'pay', 'checkout'];
  if (skip.includes(subdomain)) return;

  // Inject tenant as query param
  url.searchParams.set('tenant', subdomain);
  return Response.redirect(url, 307);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api).*)'],
};
