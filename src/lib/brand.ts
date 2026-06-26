// Brand tokens reused by emails, receipts, social images.
// Tailwind reads colors from globals.css @theme; this is the SSOT for code.

export const BRAND = {
  name: 'rainbykello',
  tagline: { en: 'made slowly, shipped warmly', th: 'ทำอย่างใส่ใจ ส่งอย่างอบอุ่น' },
  colors: {
    ink: '#1F1A17',
    paper: '#FAF7F2',
    paperWarm: '#F2EDE5',
    rose: '#C9A0A0',
    roseDeep: '#A87E7E',
    roseSoft: '#E6D0D0',
    muted: '#7A7370',
    line: '#E5DED3',
  },
  fonts: { serif: 'Fraunces', sans: 'Inter' },
  socials: {
    twitch: 'https://www.twitch.tv/rainbykello',
    instagram: 'https://www.instagram.com/rainbykello/',
    facebook: 'https://www.facebook.com/rainbykello/',
  },
} as const;

export type Brand = typeof BRAND;
