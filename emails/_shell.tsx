import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { CSSProperties, ReactNode } from 'react';
import { BRAND } from '@/lib/brand';

/** Buyer language. Every order/waitlist row carries this, so each email is sent
 *  wholly in the buyer's language rather than bilingually. */
export type Locale = 'th' | 'en';

// Footer line, localized per buyer. The tagline is sourced from BRAND so email,
// receipt, and social images share one canonical wording.
const footerCopy = {
  en: "You're receiving this because you placed an order or asked to be notified.",
  th: 'คุณได้รับอีเมลฉบับนี้เพราะสั่งซื้อสินค้าหรือขอรับการแจ้งเตือนจากเรา',
} as const satisfies Record<Locale, string>;

// Editorial Mono palette (mirrors globals.css @theme). Emails use inline styles
// because most mail clients strip <style> and external CSS. The rose* keys are
// kept for back-compat and revalued to neutrals — the rose accent is retired,
// exactly as on the web — so the per-email templates render mono without edits.
export const c = {
  paper: '#ffffff', // card surface (globals: --color-surface)
  paperWarm: '#f3f3f4', // outer body field (globals: --color-field)
  ink: '#111111',
  inkSoft: '#3a3a3a',
  rose: '#111111', // accent retired → mono
  roseDeep: '#111111',
  muted: '#5e5e5e',
  line: '#e2e2e2',
} as const;

// Shared font stacks, mirroring globals.css: Caslon (serif) / Inter (sans),
// with Thai glyphs falling through to IBM Plex Sans Thai — the exact face the
// storefront loads via next/font. Clients that honor @font-face (Apple Mail,
// Mailpit preview, …) download it via the <Font> tags below; Gmail strips
// webfonts and falls back to Sarabun/Thai system faces later in the stack.
const sansStack =
  "'Inter', 'IBM Plex Sans Thai', 'Sarabun', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const serifStack =
  "'Libre Caslon Text', 'IBM Plex Sans Thai', Georgia, 'Noto Serif Thai', 'Times New Roman', serif";

// Thai-subset woff2 files for IBM Plex Sans Thai (Google Fonts v11), regular +
// semibold — the two weights the emails use (body copy / headings).
const plexThai = {
  400: 'https://fonts.gstatic.com/s/ibmplexsansthai/v11/m8JPje1VVIzcq1HzJq2AEdo2Tj_qvLqMHdYgVcM.woff2',
  600: 'https://fonts.gstatic.com/s/ibmplexsansthai/v11/m8JMje1VVIzcq1HzJq2AEdo2Tj_qvLqE1vI1fuJHa74.woff2',
} as const;

const main: CSSProperties = {
  backgroundColor: c.paperWarm,
  margin: 0,
  padding: '32px 0',
  fontFamily: sansStack,
};

const container: CSSProperties = {
  backgroundColor: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: 0,
  margin: '0 auto',
  maxWidth: '480px',
  padding: '40px',
};

const brand: CSSProperties = {
  margin: 0,
  fontFamily: serifStack,
  fontSize: '20px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: c.ink,
};

// Wide tracking + uppercase suit the Latin eyebrow but pull Thai vowel/tone marks
// apart, so Thai uses a gentler treatment.
const eyebrow = (locale: Locale): CSSProperties => ({
  margin: '6px 0 0',
  fontSize: '11px',
  letterSpacing: locale === 'th' ? '0.04em' : '0.16em',
  textTransform: locale === 'th' ? 'none' : 'uppercase',
  color: c.muted,
});

const footer: CSSProperties = {
  margin: '8px 0 0',
  fontSize: '12px',
  color: c.muted,
};

/** Shared branded email frame: header, body slot, footer — all in `locale`. */
export function EmailShell({
  preview,
  locale,
  children,
  footerText,
}: {
  preview: string;
  locale: Locale;
  children: ReactNode;
  /** Override the default order/waitlist footer (e.g. for auth emails). */
  footerText?: string;
}) {
  return (
    <Html lang={locale}>
      <Head>
        {([400, 600] as const).map((weight) => (
          <Font
            key={weight}
            fontFamily="IBM Plex Sans Thai"
            fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
            webFont={{ url: plexThai[weight], format: 'woff2' }}
            fontWeight={weight}
            fontStyle="normal"
          />
        ))}
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={brand}>
              {/* Text glyph, not an image: Gmail strips SVG and blocks remote
                  images by default, but a serif dagger renders everywhere and
                  echoes the storefront's gold Latin cross. */}
              <span style={{ color: '#b6a681' }}>†</span> {BRAND.name}
            </Text>
            <Text style={eyebrow(locale)}>{BRAND.tagline[locale]}</Text>
          </Section>
          {children}
          <Hr style={{ borderColor: c.line, margin: '32px 0 16px' }} />
          <Text style={footer}>{footerText ?? footerCopy[locale]}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = {
  heading: {
    margin: '28px 0 0',
    fontFamily: serifStack,
    fontSize: '24px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: c.ink,
  } satisfies CSSProperties,
  paragraph: {
    margin: '12px 0 0',
    fontSize: '15px',
    lineHeight: 1.6,
    color: c.inkSoft,
  } satisfies CSSProperties,
  // Editorial CTA — square, uppercase, tracked, ink on paper (mirrors the web's
  // <Button variant="solid">).
  button: {
    display: 'inline-block',
    marginTop: '24px',
    backgroundColor: c.ink,
    color: c.paper,
    borderRadius: 0,
    padding: '13px 28px',
    fontSize: '13px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    textDecoration: 'none',
  } satisfies CSSProperties,
  meta: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: c.muted,
  } satisfies CSSProperties,
};
