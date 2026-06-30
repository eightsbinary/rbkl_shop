import type { MetadataRoute } from 'next';

/** Keep bots out of the dashboard and API; the public storefront stays open. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
  };
}
