import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai, Inter, Libre_Caslon_Text } from 'next/font/google';
import './globals.css';

const caslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-caslon',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Thai glyph coverage — Inter/Fraunces are Latin-only, so Thai text falls through
// to this in the font stacks (see globals.css). Pairs with Inter (shared Plex/
// neo-grotesque language).
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'rainbykello',
  description: 'merchandise — made slowly, shipped warmly',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${caslon.variable} ${inter.variable} ${plexThai.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Deliberately synchronous: sets data-theme before first paint (see
            public/theme-init.js). Inline is not an option — the admin CSP
            drops 'unsafe-inline' for scripts. */}
        <script src="/theme-init.js" />
        {children}
      </body>
    </html>
  );
}
