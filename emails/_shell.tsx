import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { CSSProperties, ReactNode } from 'react';

// Soft Studio palette (mirrors globals.css). Emails use inline styles because
// most mail clients strip <style> and external CSS.
export const c = {
  paper: '#faf7f2',
  paperWarm: '#f2ede5',
  ink: '#1f1a17',
  inkSoft: '#3a3330',
  rose: '#c9a0a0',
  roseDeep: '#a87e7e',
  muted: '#7a7370',
  line: '#e5ded3',
} as const;

const main: CSSProperties = {
  backgroundColor: c.paperWarm,
  margin: 0,
  padding: '32px 0',
  fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container: CSSProperties = {
  backgroundColor: c.paper,
  border: `1px solid ${c.line}`,
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '480px',
  padding: '40px',
};

const brand: CSSProperties = {
  margin: 0,
  fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
  fontSize: '20px',
  fontWeight: 600,
  color: c.ink,
};

const eyebrow: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '11px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: c.roseDeep,
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
    fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
    fontSize: '24px',
    fontWeight: 600,
    color: c.ink,
  } satisfies CSSProperties,
  paragraph: {
    margin: '12px 0 0',
    fontSize: '15px',
    lineHeight: 1.6,
    color: c.inkSoft,
  } satisfies CSSProperties,
  button: {
    display: 'inline-block',
    marginTop: '24px',
    backgroundColor: c.ink,
    color: c.paper,
    borderRadius: '8px',
    padding: '12px 28px',
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'none',
  } satisfies CSSProperties,
  meta: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: c.muted,
  } satisfies CSSProperties,
};
