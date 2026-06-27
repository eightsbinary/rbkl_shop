'use client';

/**
 * Root global-error boundary.
 *
 * Renders its own <html>/<body> because it replaces the root layout when that
 * layout (or anything above the locale segment) throws. Styling is inline on
 * purpose: globals.css is imported by the root layout, which may itself have
 * failed, so we can't rely on the stylesheet or Tailwind theme classes here.
 */

const css = `
  @keyframes rb-rise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rb-retry:hover {
    background-color: #3a3330;
    transform: translateY(-2px);
    box-shadow: 0 10px 24px -12px rgba(31, 26, 23, 0.55);
  }
  .rb-retry:active {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 4px 10px -8px rgba(31, 26, 23, 0.55);
  }
  .rb-retry:focus-visible {
    outline: 2px solid #c9a0a0;
    outline-offset: 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    .rb-shell { animation: none !important; }
    .rb-retry { transition: none !important; }
    .rb-retry:hover, .rb-retry:active { transform: none !important; }
  }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#faf7f2',
          color: '#1f1a17',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {/* Micro-interactions: gentle entrance + tactile button hover/press.
            A <style> string child is used because there is no external
            stylesheet to rely on when the root layout has failed. */}
        <style>{css}</style>

        <main
          className="rb-shell"
          style={{
            maxWidth: '28rem',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            animation: 'rb-rise 480ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#a87e7e',
            }}
          >
            something broke
          </p>
          <h1
            style={{
              margin: '0.75rem 0 0',
              fontSize: '1.75rem',
              fontWeight: 600,
              fontFamily: 'ui-serif, Georgia, serif',
              color: '#1f1a17',
            }}
          >
            We hit an unexpected snag
          </h1>
          <p
            style={{
              margin: '0.75rem 0 1.75rem',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              color: '#7a7370',
            }}
          >
            Sorry about that. Try again — if it keeps happening, the shop will be back to normal
            shortly.
            {error.digest ? (
              <span
                style={{
                  display: 'block',
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#a89f99',
                }}
              >
                ref: {error.digest}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rb-retry"
            style={{
              appearance: 'none',
              border: '1px solid #1f1a17',
              borderRadius: '8px',
              backgroundColor: '#1f1a17',
              color: '#faf7f2',
              padding: '0.7rem 1.6rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition:
                'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 180ms ease',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
