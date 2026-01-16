/**
 * Vercel Middleware - Force Single Domain
 * Redirects all traffic to chat.bestfitcoach.com
 * 
 * File: middleware.ts (project root)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  
  // Redirect Vercel default domain to custom domain
  if (host === 'bestfit-chatbot.vercel.app') {
    const url = request.nextUrl.clone();
    url.host = 'chat.bestfitcoach.com';
    url.protocol = 'https';
    
    console.log(`Redirecting from ${host} to chat.bestfitcoach.com`);
    return NextResponse.redirect(url, 301); // Permanent redirect
  }
  
  // Allow all other requests
  return NextResponse.next();
}

export const config = {
  // Match all paths
  matcher: '/:path*',
};
