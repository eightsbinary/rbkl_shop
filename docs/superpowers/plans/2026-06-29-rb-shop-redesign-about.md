# Redesign Phase 4 — Editorial Mono About page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/about` page in Editorial Mono — hero (story + portrait), "Intentional Craftsmanship" (captioned image + two cards), and inspiration (image + label + heading + paragraphs) — with editable placeholder copy + `field` image placeholders, and add the `ABOUT` nav link.

**Architecture:** A server-rendered `about/page.tsx` resolves all `about.*` strings via `getTranslations` and passes them to three plain presentational section components. No client state. Header gains one nav link.

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind v4 (Editorial Mono tokens). Bun except `next build` (Node). Local Supabase up for the visual gate (the page itself needs no DB).

**Reference:** Spec [docs/superpowers/specs/2026-06-29-rb-shop-redesign-about-design.md](../specs/2026-06-29-rb-shop-redesign-about-design.md). Figma About screenshot `scratchpad/about.png` (re-fetch node `0:113` if expired).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Helper `/tmp/p6a2-check.sh <files>` = tsc + biome; `next build` = `~/.local/bin/node ./node_modules/next/dist/bin/next build`. git in Git Bash via `cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"`. Commit bodies end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Presentational — no new unit tests; existing suite stays green (135). Route path `src/app/[locale]/about/page.tsx` has brackets — quote in shell.

## File structure

```
messages/en.json, messages/th.json            (modify — new "about" namespace)
src/components/shop/Header.tsx                 (modify — add ABOUT link)
src/components/shop/AboutHero.tsx              (new)
src/components/shop/CraftSection.tsx           (new)
src/components/shop/InspirationSection.tsx     (new)
src/app/[locale]/about/page.tsx                (new — compose)
```

---

## Task 1: About i18n namespace

**Files:** Modify `messages/en.json`, `messages/th.json`.

- [ ] **Step 1: en.json** — add a new top-level `"about"` object (place it after the existing `"landing"` or any object; keep all other namespaces):

```json
"about": {
  "heroTitle": "Made with care.",
  "heroBody1": "rainbykello is a small studio for the things I make and share with my community — designed slowly, in limited runs, and shipped warmly from Thailand.",
  "heroBody2": "Everything here starts on stream and ends in your hands. No mass production, no noise — just objects I'd want to keep myself.",
  "craftTitle": "How it's made",
  "craftSubtitle": "Every drop is considered — from the first sketch to the package on your doorstep.",
  "craftCaption": "Material — chosen by hand",
  "card1Title": "Made to last",
  "card1Body": "Heavyweight fabrics and durable prints, chosen so each piece holds up to everyday wear.",
  "card2Title": "Small batches",
  "card2Body": "Limited runs mean tighter quality control and less waste — once a drop sells out, it's gone.",
  "inspirationLabel": "Inspiration",
  "inspirationTitle": "Stream & community",
  "inspirationBody1": "The work is shaped by the people who show up — the chat, the regulars, the late-night streams.",
  "inspirationBody2": "Every design is a little artifact of that community: something to carry the feeling of being part of it, offline."
}
```

- [ ] **Step 2: th.json** — add the matching `"about"` object:

```json
"about": {
  "heroTitle": "ทำด้วยใจ",
  "heroBody1": "rainbykello คือสตูดิโอเล็ก ๆ สำหรับสิ่งที่ฉันตั้งใจทำและแบ่งปันกับคอมมูนิตี้ — ออกแบบอย่างค่อยเป็นค่อยไป ผลิตจำนวนจำกัด และจัดส่งด้วยความอบอุ่นจากประเทศไทย",
  "heroBody2": "ทุกอย่างเริ่มต้นบนสตรีมและจบลงในมือของคุณ ไม่มีการผลิตจำนวนมาก ไม่มีเสียงรบกวน — มีแค่ของที่ฉันเองก็อยากเก็บไว้",
  "craftTitle": "ทำอย่างไร",
  "craftSubtitle": "ทุกคอลเลกชันผ่านการคิดมาอย่างดี — ตั้งแต่ภาพร่างแรกจนถึงพัสดุที่หน้าบ้านคุณ",
  "craftCaption": "วัสดุ — คัดด้วยมือ",
  "card1Title": "ทำมาให้ใช้ได้นาน",
  "card1Body": "เลือกใช้เนื้อผ้าหนาและงานพิมพ์ที่ทนทาน เพื่อให้ทุกชิ้นอยู่กับคุณได้ในทุกวัน",
  "card2Title": "ผลิตจำนวนจำกัด",
  "card2Body": "ล็อตเล็กหมายถึงการควบคุมคุณภาพที่ดีกว่าและของเหลือทิ้งที่น้อยลง — เมื่อขายหมดแล้วก็คือหมดเลย",
  "inspirationLabel": "แรงบันดาลใจ",
  "inspirationTitle": "สตรีมและคอมมูนิตี้",
  "inspirationBody1": "งานทุกชิ้นถูกหล่อหลอมจากผู้คนที่แวะมา — แชท ขาประจำ และสตรีมดึก ๆ",
  "inspirationBody2": "ทุกดีไซน์คือชิ้นส่วนเล็ก ๆ ของคอมมูนิตี้นั้น สิ่งที่พาความรู้สึกของการได้เป็นส่วนหนึ่งออกมาสู่โลกจริง"
}
```

- [ ] **Step 3: Validate + commit.**

```bash
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && for f in messages/en.json messages/th.json; do ~/.local/bin/node -e \"JSON.parse(require('node:fs').readFileSync('\$f'))\" && echo \"\$f OK\"; done"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add messages/en.json messages/th.json
git commit -m "$(printf 'feat(i18n): About page copy (placeholder, editable)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: About section components

**Files:** Create `src/components/shop/AboutHero.tsx`, `src/components/shop/CraftSection.tsx`, `src/components/shop/InspirationSection.tsx`.

All three are plain presentational (props in, no hooks) so the page can stay a server component.

- [ ] **Step 1: AboutHero.tsx**

```tsx
export function AboutHero({
  title,
  body1,
  body2,
}: {
  title: string;
  body1: string;
  body2: string;
}) {
  return (
    <section className="container mx-auto grid gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-16">
      <div className="max-w-xl space-y-6">
        <h1 className="font-serif text-5xl leading-tight text-ink md:text-6xl">{title}</h1>
        <p className="text-base leading-relaxed text-ink-soft">{body1}</p>
        <p className="text-base leading-relaxed text-ink-soft">{body2}</p>
      </div>
      <div className="aspect-[4/5] w-full bg-field lg:aspect-[3/4]" />
    </section>
  );
}
```

- [ ] **Step 2: CraftSection.tsx**

```tsx
export function CraftSection({
  title,
  subtitle,
  caption,
  card1Title,
  card1Body,
  card2Title,
  card2Body,
}: {
  title: string;
  subtitle: string;
  caption: string;
  card1Title: string;
  card1Body: string;
  card2Title: string;
  card2Body: string;
}) {
  return (
    <section className="container mx-auto space-y-12 px-6 py-20 lg:px-16">
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        <h2 className="font-serif text-3xl text-ink md:text-4xl">{title}</h2>
        <p className="text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-field">
          <span className="absolute bottom-4 left-4 bg-ink-deep px-3 py-1 text-xs uppercase tracking-[0.12em] text-paper">
            {caption}
          </span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {[
            { t: card1Title, b: card1Body },
            { t: card2Title, b: card2Body },
          ].map((c) => (
            <div key={c.t} className="space-y-3 border border-line bg-surface p-6">
              <div className="h-6 w-6 border border-ink" aria-hidden />
              <h3 className="font-serif text-xl text-ink">{c.t}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{c.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: InspirationSection.tsx**

```tsx
export function InspirationSection({
  label,
  title,
  body1,
  body2,
}: {
  label: string;
  title: string;
  body1: string;
  body2: string;
}) {
  return (
    <section className="container mx-auto grid gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:px-16">
      <div className="aspect-square w-full bg-ink-deep" />
      <div className="max-w-xl space-y-5">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
        <h2 className="font-serif text-3xl text-ink md:text-4xl">{title}</h2>
        <p className="text-base leading-relaxed text-ink-soft">{body1}</p>
        <p className="text-base leading-relaxed text-ink-soft">{body2}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck + lint + commit.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/components/shop/AboutHero.tsx src/components/shop/CraftSection.tsx src/components/shop/InspirationSection.tsx"
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add src/components/shop/AboutHero.tsx src/components/shop/CraftSection.tsx src/components/shop/InspirationSection.tsx
git commit -m "$(printf 'feat(design): About section components (hero, craft, inspiration)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: About page + ABOUT nav link

**Files:** Create `src/app/[locale]/about/page.tsx`; modify `src/components/shop/Header.tsx`.

- [ ] **Step 1: Create `src/app/[locale]/about/page.tsx`**

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AboutHero } from '@/components/shop/AboutHero';
import { CraftSection } from '@/components/shop/CraftSection';
import { InspirationSection } from '@/components/shop/InspirationSection';
import type { Locale } from '@/i18n/routing';

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');

  return (
    <>
      <AboutHero title={t('heroTitle')} body1={t('heroBody1')} body2={t('heroBody2')} />
      <CraftSection
        title={t('craftTitle')}
        subtitle={t('craftSubtitle')}
        caption={t('craftCaption')}
        card1Title={t('card1Title')}
        card1Body={t('card1Body')}
        card2Title={t('card2Title')}
        card2Body={t('card2Body')}
      />
      <InspirationSection
        label={t('inspirationLabel')}
        title={t('inspirationTitle')}
        body1={t('inspirationBody1')}
        body2={t('inspirationBody2')}
      />
    </>
  );
}
```

- [ ] **Step 2: Add the ABOUT nav link in `src/components/shop/Header.tsx`.** The left `<nav>` currently contains only the SHOP link. Add an ABOUT link after it:

```tsx
        <nav className="flex items-center gap-6 text-xs uppercase tracking-[0.14em] text-ink-soft">
          <Link href={`/${locale}/shop`} className="transition-colors hover:text-ink">
            {t('shop')}
          </Link>
          <Link href={`/${locale}/about`} className="transition-colors hover:text-ink">
            {t('about')}
          </Link>
        </nav>
```

(`nav.about` exists in both locales. `t` is `useTranslations('nav')`, already in the file.)

- [ ] **Step 3: Typecheck + lint + build.**

```bash
wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-check.sh src/app/[locale]/about/page.tsx src/components/shop/Header.tsx"
wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && ~/.local/bin/node ./node_modules/next/dist/bin/next build 2>&1 | grep -E 'Compiled|Error|Failed' | tail -3"
wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh 2>&1 | tail -3"
```
Expected: TSC_OK, biome clean, `Compiled successfully`, 135 tests pass.

- [ ] **Step 4: Commit.**

```bash
cd "//wsl.localhost/Ubuntu/home/ton/workspace/rb_shop"
git add "src/app/[locale]/about/page.tsx" src/components/shop/Header.tsx
git commit -m "$(printf 'feat(design): About page route + ABOUT nav link\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Visual gate

**Files:** none.

- [ ] **Step 1: Full gate.** `wsl -d Ubuntu -- bash -lc "bash /tmp/p6a2-gate.sh"` → typecheck clean, biome clean, 135 tests pass, `Compiled successfully`.

- [ ] **Step 2: Visual compare.** Load `http://localhost:3000/en/about` at 1280px, compare to `scratchpad/about.png`:
  - Header shows **SHOP / ABOUT** (centered wordmark).
  - Hero: serif H1 + two paragraphs (left) | portrait `field` block (right).
  - "How it's made" centered H2 + subtitle; below, a large `field` image with a caption chip + two bordered cards (mark + H3 + body).
  - Inspiration: dark `field` block (left) | "INSPIRATION" label + serif H2 + two paragraphs (right).
  - `/th/about` → Thai + Plex Thai. ABOUT link navigates from any page.
  Image blocks are intentionally empty `field`/`ink-deep` placeholders (no creator photos yet). Fix obvious drift; otherwise report.

- [ ] **Step 3 (if fixes):** commit `fix(design): …`.

---

## Out of scope (later)

| Item | Phase |
|---|---|
| Real creator photos / image system | later |
| Checkout page restyle | later |
| Admin Thai i18n | separate plan |
