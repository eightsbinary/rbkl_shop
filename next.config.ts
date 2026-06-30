import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Product images are pre-resized webps (400/800/1600) generated on upload and
  // served straight from Supabase Storage, so next/image's optimizer adds no
  // value here. Skipping it makes <Image> emit the source URL directly — which
  // also sidesteps the optimizer's 400 on loopback hosts in local dev and keeps
  // us off Vercel's image-optimization limits in production.
  images: { unoptimized: true },
};

export default withNextIntl(nextConfig);
