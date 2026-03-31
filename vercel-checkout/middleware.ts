import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const parts = hostname.split('.');

  // Ignore localhost and main platform domain (2 parts = bare domain)
  if (parts.length <= 2 || hostname.includes('localhost')) {
    return NextResponse.next();
  }

  // Extract subdomain: e.g., "pay" from "pay.payshein.site"
  const subdomain = parts[0];

  // Don't inject tenant for the platform's own subdomains
  const platformSubdomains = ['www', 'api', 'app', 'admin'];
  if (platformSubdomains.includes(subdomain)) {
    return NextResponse.next();
  }

  // Inject tenant as query param for checkout to consume
  const url = req.nextUrl.clone();
  url.searchParams.set('tenant', subdomain);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api).*)'],
};
