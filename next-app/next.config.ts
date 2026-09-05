import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV !== 'production';
const scriptPolicy = `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://cdn.jsdelivr.net https://vercel.live https://challenges.cloudflare.com`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images:{remotePatterns:[{protocol:'https',hostname:'**.supabase.co'}]},
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: `default-src 'self'; ${scriptPolicy}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live https://*.vercel.com wss://*.vercel.com https://challenges.cloudflare.com; frame-src 'self' https://vercel.live https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'` }
    ] }];
  }
};

export default nextConfig;
