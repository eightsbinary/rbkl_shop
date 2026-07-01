import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { CSSProperties, ReactNode } from 'react';

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

// Shared font stacks. The web uses Caslon (serif) + Inter (sans); neither loads
// reliably in mail clients, so we name them first and fall back to the closest
// email-safe faces — matching globals.css's own fallback chain.
const sansStack =
  "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const serifStack = "'Libre Caslon Text', Georgia, 'Times New Roman', serif";

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

const eyebrow: CSSProperties = {
  margin: '6px 0 0',
  fontSize: '11px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: c.muted,
};

const footer: CSSProperties = {
  margin: '8px 0 0',
  fontSize: '12px',
  color: c.muted,
};

/** Shared branded email frame: header, body slot, footer. */
export function EmailShell({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={brand}>rainbykello</Text>
            <Text style={eyebrow}>made slowly, shipped warmly</Text>
          </Section>
          {children}
          <Hr style={{ borderColor: c.line, margin: '32px 0 16px' }} />
          <Text style={footer}>
            You're receiving this because you placed an order or asked to be notified.
          </Text>
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
