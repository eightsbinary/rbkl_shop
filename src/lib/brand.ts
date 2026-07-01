// Brand tokens reused by emails, receipts, social images.
// Tailwind reads colors from globals.css @theme; this is the SSOT for code.
// Kept in sync with globals.css @theme (Editorial Mono).

export const BRAND = {
  name: 'rainbykello',
  tagline: { en: 'made slowly, shipped warmly', th: 'ทำอย่างใส่ใจ ส่งอย่างอบอุ่น' },
  colors: {
    ink: '#111111',
    inkSoft: '#3a3a3a',
    paper: '#fbfbfa',
    surface: '#ffffff',
    field: '#f3f3f4',
    muted: '#5e5e5e',
    line: '#e2e2e2',
  },
  fonts: { serif: 'Libre Caslon Text', sans: 'Inter' },
  socials: {
    twitch: 'https://www.twitch.tv/rainbykello',
    instagram: 'https://www.instagram.com/rainbykello/',
    facebook: 'https://www.facebook.com/rainbykello/',
  },
} as const;

export type Brand = typeof BRAND;
