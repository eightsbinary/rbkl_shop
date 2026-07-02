# Sign-in (magic link) email — Editorial Mono redesign

**Date:** 2026-07-02 · **Approved:** yes (approach B, Thai-first bilingual)

## Problem

The admin sign-in email is Supabase Auth's stock template and clashes with the
storefront/dashboard design. The five transactional emails already share a
branded frame (`emails/_shell.tsx`); the sign-in email should be pixel-identical
to them.

## Design

React-email is the single source of truth; a script renders it to the static
HTML file Supabase Auth reads.

- `emails/SignIn.tsx` — uses `EmailShell`. Bilingual, Thai first, English below.
  Serif heading, square ink CTA ("เข้าสู่ระบบ · Sign in"), muted expiry meta
  line. CTA href is Supabase's `{{ .ConfirmationURL }}` Go-template placeholder.
- `emails/_shell.tsx` — add optional `footerText` prop; the default footer
  ("you placed an order…") is wrong for auth email. Other emails unchanged.
- `scripts/render-auth-emails.ts` (`bun run emails:auth`) — renders `SignIn` to
  `supabase/templates/magic_link.html` (committed; config reads it from disk).
- `supabase/config.toml` — `[auth.email.template.magic_link]` with bilingual
  subject and `content_path = "./supabase/templates/magic_link.html"`. Local
  stack needs `supabase stop && supabase start` to pick it up.

## Risks / notes

- Rendering may URL-encode the `{{ .ConfirmationURL }}` placeholder inside
  `href` — the unit test asserts the *exact* placeholder survives in the output;
  if encoding occurs, the render script post-processes it back.
- Hosted Supabase ignores `config.toml` templates: at deploy time, paste the
  generated HTML + subject into Dashboard → Auth → Emails → Magic Link.

## Testing

- Unit (TDD): rendered `SignIn` contains the exact placeholder, Thai + English
  copy, and the auth-specific footer (not the order footer).
- E2E (local): request an OTP, fetch the message from Mailpit, confirm branded
  HTML.
