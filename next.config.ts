import type { NextConfig } from "next";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://qkydnrjmzekvuhrejbzv.supabase.co",
  "connect-src 'self' https://qkydnrjmzekvuhrejbzv.supabase.co wss://qkydnrjmzekvuhrejbzv.supabase.co https://accounts.google.com https://oauth2.googleapis.com",
  "frame-src 'self' https://qkydnrjmzekvuhrejbzv.supabase.co https://accounts.google.com",
  "form-action 'self' https://accounts.google.com https://qkydnrjmzekvuhrejbzv.supabase.co",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
