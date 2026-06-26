# rb_shop — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the repo skeleton, tooling, database, tiered roles, and pure domain logic. End state: green CI, deployable Next.js app with no UI, Supabase schema with profiles + roles, role-grant scripts, and fully-tested domain logic (pricing, stock, discount, shipping, money).

**Architecture:** Single Next.js 15 app (App Router) with TypeScript strict. Pure `src/domain/` module isolated from I/O for unit testability. Supabase Postgres with Row-Level Security from day one. Three-tier role hierarchy (`dev` > `owner` > `customer`). Bun for package management, scripts, and tests. Biome for lint + format.

**Tech Stack:** Bun, Next.js 15 (App Router), TypeScript 5 strict, Tailwind CSS, Biome, Vitest, Supabase, Zod.

**Spec reference:** `docs/superpowers/specs/2026-06-26-rb-shop-design.md`. Plan 1 corresponds to Phase 1 steps 1–4 of §10 in the spec.

---

## File structure built by this plan

```
rb_shop/
├── .github/workflows/ci.yml
├── .env.example
├── .gitignore
├── biome.json
├── bun.lockb
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── public/                           (empty, ready for assets)
├── scripts/
│   ├── grant-owner.ts
│   ├── grant-dev.ts
│   └── pull-types.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                (root layout, fonts, globals)
│   │   ├── page.tsx                  (placeholder landing)
│   │   └── globals.css               (Tailwind directives)
│   ├── db/
│   │   ├── client.ts                 (Supabase client factories)
│   │   ├── auth.ts                   (role-check helpers)
│   │   └── types.gen.ts              (generated from Supabase)
│   ├── domain/
│   │   ├── money.ts
│   │   ├── pricing.ts
│   │   ├── stock.ts
│   │   ├── discount.ts
│   │   ├── shipping.ts
│   │   └── index.ts
│   └── lib/
│       ├── env.ts                    (Zod-validated env)
│       └── brand.ts                  (Soft Studio tokens)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20260626000000_init_roles.sql
│   ├── policies/
│   │   └── profiles.sql
│   └── seed.sql
└── tests/
    ├── unit/
    │   ├── domain/
    │   │   ├── money.test.ts
    │   │   ├── pricing.test.ts
    │   │   ├── stock.test.ts
    │   │   ├── discount.test.ts
    │   │   └── shipping.test.ts
    │   └── lib/
    │       └── env.test.ts
    └── setup.ts                      (Vitest setup file)
```

---

## Conventions used in this plan

- **Commands** are run from the repo root unless noted.
- **TDD strictly** for `src/domain/*` and `src/lib/env.ts` — test first, fail, implement, pass, commit.
- **Commit cadence:** at the end of each task (every task ends with a "Commit" step). Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- **Working on `develop` branch only.** Each commit lands directly on `develop`. (Per user feedback memory.)
- **Path style:** all paths in this plan are project-relative (e.g., `src/domain/money.ts`).

---

## Task 1: Initialize Bun + Next.js + TypeScript strict

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`

- [ ] **Step 1: Confirm Bun is installed**

Run: `bun --version`
Expected: prints version `>= 1.1.0`. If missing, install from https://bun.sh.

- [ ] **Step 2: Scaffold Next.js 15 app with Bun**

Run from repo root:
```bash
bun create next-app . --typescript --tailwind --eslint=false --app --src-dir --import-alias "@/*" --use-bun
```

When asked any interactive prompt, accept defaults that match: App Router yes, src/ yes, alias `@/*`, eslint NO (we use Biome). If the command refuses because the directory is non-empty, run:
```bash
bun create next-app rb-shop-tmp --typescript --tailwind --eslint=false --app --src-dir --import-alias "@/*" --use-bun
mv rb-shop-tmp/* rb-shop-tmp/.* . 2>/dev/null || true
rmdir rb-shop-tmp
```

- [ ] **Step 3: Verify dev server starts**

Run: `bun run dev`
Expected: server starts on http://localhost:3000 with the default Next.js welcome page. Kill with `Ctrl+C`.

- [ ] **Step 4: Make `tsconfig.json` strict**

Replace `tsconfig.json` with:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Verify type-check passes**

Run: `bun x tsc --noEmit`
Expected: no output, exit 0.

- [ ] **Step 6: Add `.gitignore` entries**

Append to `.gitignore` (Next.js scaffold already provides most):
```
# project additions
.env.local
.env.production.local
.env.development.local
.env*.local
.vercel
.claude/
supabase/.branches
supabase/.temp
*.log
.DS_Store
.vscode/
.idea/
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 15 + Bun + TypeScript strict"
```

---

## Task 2: Configure Biome (lint + format)

**Files:**
- Create: `biome.json`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Install Biome as dev dep**

Run: `bun add -d @biomejs/biome`
Expected: adds `@biomejs/biome` to `devDependencies`.

- [ ] **Step 2: Create `biome.json`**

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true, "ignore": [".next", "node_modules", "src/db/types.gen.ts"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "nursery": { "noFloatingPromises": "error" }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" }
  }
}
```

- [ ] **Step 3: Add scripts to `package.json`**

In `package.json`, replace the `"scripts"` block with:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:types": "bun run scripts/pull-types.ts",
  "db:migrate": "supabase db push",
  "db:reset": "supabase db reset",
  "grant:owner": "bun run scripts/grant-owner.ts",
  "grant:dev": "bun run scripts/grant-dev.ts"
}
```

- [ ] **Step 4: Run Biome on the scaffolded code and fix**

Run: `bun run lint:fix`
Expected: rewrites scaffold files to Biome style; exit 0 (or harmless info-level messages).

- [ ] **Step 5: Verify**

Run: `bun run lint`
Expected: exit 0, "Checked N files, no fixes needed."

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: add Biome lint + format with strict rules"
```

---

## Task 3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/unit/lib/smoke.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest + supporting deps**

Run: `bun add -d vitest @vitest/coverage-v8 happy-dom`
Expected: adds vitest, coverage adapter, and a fast DOM impl.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/db/types.gen.ts', 'src/app/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
// Vitest global setup. Add stubs/mocks here as the project grows.
import { beforeEach } from 'vitest';

beforeEach(() => {
  // Reset any module state if needed in the future.
});
```

- [ ] **Step 4: Write a smoke test**

Create `tests/unit/lib/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `bun run test`
Expected: 1 test passes, exit 0.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "test: configure Vitest with happy-dom + smoke test"
```

---

## Task 4: Configure Tailwind with Soft Studio tokens

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/lib/brand.ts`

- [ ] **Step 1: Replace `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: { center: true, padding: '1.5rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        // Soft Studio palette (LOCKED — see spec §7 Option A)
        ink: { DEFAULT: '#1F1A17', soft: '#3A3330' },
        paper: { DEFAULT: '#FAF7F2', warm: '#F2EDE5' },
        rose: { DEFAULT: '#C9A0A0', deep: '#A87E7E', soft: '#E6D0D0' },
        // Semantic
        muted: '#7A7370',
        line: '#E5DED3',
        success: '#5A8A6C',
        warn: '#C28A3D',
        error: '#B7484A',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xs: '2px', sm: '4px', md: '8px', lg: '12px' },
      transitionTimingFunction: { 'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)' },
      transitionDuration: { 150: '150ms', 220: '220ms', 260: '260ms' },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Update `src/app/globals.css`**

Replace contents:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: light;
  }
  html { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  body {
    @apply bg-paper text-ink font-sans;
  }
  ::selection { background: theme('colors.rose.soft'); color: theme('colors.ink.DEFAULT'); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
}
```

- [ ] **Step 3: Wire fonts in `src/app/layout.tsx`**

Replace contents:
```tsx
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'rainbykello',
  description: 'merchandise — made slowly, shipped warmly',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx` with a Soft Studio placeholder**

```tsx
export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">rb_shop</p>
        <h1 className="font-serif text-5xl md:text-6xl">made slowly,<br/>shipped warmly</h1>
        <p className="text-muted max-w-md mx-auto">A small shop, opening soon.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Create `src/lib/brand.ts`**

```ts
// Brand tokens reused by emails, receipts, social images.
// Tailwind reads colors from tailwind.config.ts; this is the SSOT for code.

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
```

- [ ] **Step 6: Verify build and visual smoke check**

Run: `bun run build`
Expected: build succeeds with no type errors.

Run: `bun run dev` → open http://localhost:3000 → confirm: warm off-white background, serif heading, dusty-rose-friendly palette. Kill with `Ctrl+C`.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(ui): Tailwind tokens + Fraunces/Inter fonts (Soft Studio)"
```

---

## Task 5: Zod-validated environment (`src/lib/env.ts`)

**Files:**
- Create: `src/lib/env.ts`, `tests/unit/lib/env.test.ts`, `.env.example`

- [ ] **Step 1: Install Zod**

Run: `bun add zod`
Expected: zod added to dependencies.

- [ ] **Step 2: Write failing test**

Create `tests/unit/lib/env.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('parses a valid env object', () => {
    const parsed = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      NODE_ENV: 'development',
    });
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('rejects when required vars are missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejects malformed Supabase URL', () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        NODE_ENV: 'development',
      }),
    ).toThrowError(/url/i);
  });
});
```

- [ ] **Step 3: Run test → fails**

Run: `bun run test`
Expected: FAIL with "Cannot find module @/lib/env" or similar.

- [ ] **Step 4: Implement `src/lib/env.ts`**

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}

// Exported lazy singleton for app code. Throws on import in misconfigured envs.
let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env as Record<string, string | undefined>);
  return cached;
}
```

- [ ] **Step 5: Run test → passes**

Run: `bun run test`
Expected: 4 tests pass (smoke + 3 env).

- [ ] **Step 6: Create `.env.example`**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only — never expose to client
SUPABASE_SERVICE_ROLE_KEY=

# Node
NODE_ENV=development
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(lib): Zod-validated env parser with tests"
```

---

## Task 6: CI on develop (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install
        run: bun install --frozen-lockfile
      - name: Lint
        run: bun run lint
      - name: Type check
        run: bun run typecheck
      - name: Test
        run: bun run test
      - name: Build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          SUPABASE_SERVICE_ROLE_KEY: placeholder
        run: bun run build
```

- [ ] **Step 2: Verify locally that all gates pass**

Run sequentially:
```bash
bun run lint
bun run typecheck
bun run test
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder bun run build
```
Expected: all four exit 0.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "ci: lint + typecheck + test + build on develop and main"
```

---

## Task 7: Domain — Money type (TDD)

**Files:**
- Create: `tests/unit/domain/money.test.ts`, `src/domain/money.ts`

The `Money` type is the foundation everything else builds on. We store amounts as **integer minor units (satang)** to avoid float drift.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/domain/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, money, subtractMoney, multiplyMoney } from '@/domain/money';

describe('money', () => {
  it('constructs from baht', () => {
    expect(money(100)).toEqual({ amount: 10000, currency: 'THB' });
  });

  it('rejects negative construction', () => {
    expect(() => money(-1)).toThrowError(/non-negative/);
  });

  it('rejects non-integer satang', () => {
    expect(() => money(10.005)).toThrowError(/two decimal/);
  });

  it('adds money of the same currency', () => {
    expect(addMoney(money(10), money(5))).toEqual(money(15));
  });

  it('refuses to add mismatched currencies', () => {
    const usd = { amount: 100, currency: 'USD' as const };
    expect(() => addMoney(money(10), usd as never)).toThrowError(/currency/);
  });

  it('subtracts and clamps at zero', () => {
    expect(subtractMoney(money(10), money(3))).toEqual(money(7));
    expect(subtractMoney(money(3), money(10))).toEqual(money(0));
  });

  it('multiplies by integer quantity', () => {
    expect(multiplyMoney(money(7.5), 3)).toEqual(money(22.5));
  });

  it('rejects negative or fractional quantity', () => {
    expect(() => multiplyMoney(money(10), -1)).toThrowError(/non-negative integer/);
    expect(() => multiplyMoney(money(10), 1.5)).toThrowError(/non-negative integer/);
  });

  it('formats THB for th locale', () => {
    expect(formatMoney(money(1290), 'th')).toBe('฿1,290.00');
  });

  it('formats THB for en locale', () => {
    expect(formatMoney(money(1290), 'en')).toBe('฿1,290.00');
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `bun run test`
Expected: tests fail with module-not-found.

- [ ] **Step 3: Implement `src/domain/money.ts`**

```ts
export type Currency = 'THB';

export interface Money {
  readonly amount: number; // integer minor units (satang)
  readonly currency: Currency;
}

export function money(baht: number, currency: Currency = 'THB'): Money {
  if (baht < 0) throw new Error('Money must be non-negative');
  const satang = Math.round(baht * 100);
  if (Math.abs(satang / 100 - baht) > 1e-9) {
    throw new Error('Money supports at most two decimal places');
  }
  return { amount: satang, currency };
}

export function fromSatang(amount: number, currency: Currency = 'THB'): Money {
  if (!Number.isInteger(amount)) throw new Error('satang must be an integer');
  if (amount < 0) throw new Error('Money must be non-negative');
  return { amount, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: Math.max(0, a.amount - b.amount), currency: a.currency };
}

export function multiplyMoney(a: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error('multiplyMoney qty must be a non-negative integer');
  }
  return { amount: a.amount * qty, currency: a.currency };
}

export function formatMoney(m: Money, locale: 'th' | 'en'): string {
  const fmt = new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: m.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return fmt.format(m.amount / 100);
}

export const ZERO_THB: Money = { amount: 0, currency: 'THB' };
```

- [ ] **Step 4: Run → pass**

Run: `bun run test`
Expected: all Money tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(domain): Money type with integer satang precision"
```

---

## Task 8: Domain — Pricing (TDD)

**Files:**
- Create: `tests/unit/domain/pricing.test.ts`, `src/domain/pricing.ts`

`computeTotals` takes line items + discount + shipping and returns a totals breakdown.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/domain/pricing.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { money, ZERO_THB } from '@/domain/money';
import { computeTotals, type LineItem } from '@/domain/pricing';

const lines: LineItem[] = [
  { variantId: 'v1', unitPrice: money(590), qty: 2 }, // 1180
  { variantId: 'v2', unitPrice: money(1290), qty: 1 }, // 1290
];

describe('computeTotals', () => {
  it('computes subtotal from line items', () => {
    const t = computeTotals({ lines, discount: ZERO_THB, shipping: ZERO_THB });
    expect(t.subtotal).toEqual(money(2470));
    expect(t.discount).toEqual(ZERO_THB);
    expect(t.shipping).toEqual(ZERO_THB);
    expect(t.total).toEqual(money(2470));
  });

  it('applies discount before shipping', () => {
    const t = computeTotals({ lines, discount: money(200), shipping: money(60) });
    expect(t.subtotal).toEqual(money(2470));
    expect(t.discount).toEqual(money(200));
    expect(t.shipping).toEqual(money(60));
    expect(t.total).toEqual(money(2330));
  });

  it('clamps discount to subtotal so total never negative', () => {
    const t = computeTotals({ lines, discount: money(99999), shipping: money(60) });
    expect(t.discount).toEqual(money(2470));
    expect(t.total).toEqual(money(60));
  });

  it('returns zero totals for empty cart', () => {
    const t = computeTotals({ lines: [], discount: ZERO_THB, shipping: ZERO_THB });
    expect(t.subtotal).toEqual(ZERO_THB);
    expect(t.total).toEqual(ZERO_THB);
  });

  it('rejects non-positive qty', () => {
    expect(() =>
      computeTotals({
        lines: [{ variantId: 'v1', unitPrice: money(10), qty: 0 }],
        discount: ZERO_THB,
        shipping: ZERO_THB,
      }),
    ).toThrowError(/positive/);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `bun run test`
Expected: pricing tests fail with module-not-found.

- [ ] **Step 3: Implement `src/domain/pricing.ts`**

```ts
import {
  addMoney,
  multiplyMoney,
  subtractMoney,
  type Money,
  ZERO_THB,
} from './money';

export interface LineItem {
  readonly variantId: string;
  readonly unitPrice: Money;
  readonly qty: number;
}

export interface Totals {
  readonly subtotal: Money;
  readonly discount: Money;
  readonly shipping: Money;
  readonly total: Money;
}

export interface ComputeTotalsInput {
  readonly lines: ReadonlyArray<LineItem>;
  readonly discount: Money;
  readonly shipping: Money;
}

export function computeTotals(input: ComputeTotalsInput): Totals {
  const subtotal = input.lines.reduce<Money>((acc, line) => {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new Error('LineItem qty must be a positive integer');
    }
    return addMoney(acc, multiplyMoney(line.unitPrice, line.qty));
  }, ZERO_THB);

  // Clamp discount to subtotal so total can never be negative.
  const effectiveDiscount =
    input.discount.amount > subtotal.amount ? subtotal : input.discount;

  const afterDiscount = subtractMoney(subtotal, effectiveDiscount);
  const total = addMoney(afterDiscount, input.shipping);

  return {
    subtotal,
    discount: effectiveDiscount,
    shipping: input.shipping,
    total,
  };
}
```

- [ ] **Step 4: Run → pass**

Run: `bun run test`
Expected: all pricing tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(domain): computeTotals with discount-clamping and qty validation"
```

---

## Task 9: Domain — Stock reservation logic (TDD)

**Files:**
- Create: `tests/unit/domain/stock.test.ts`, `src/domain/stock.ts`

Pure logic for stock state transitions. DB-level locking comes later — these functions enforce the math.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/domain/stock.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  commitReservation,
  releaseReservation,
  reserve,
  type StockLevel,
} from '@/domain/stock';

const level = (available: number, reserved: number): StockLevel => ({
  available,
  reserved,
});

describe('reserve', () => {
  it('moves qty from available to reserved', () => {
    expect(reserve(level(10, 0), 3)).toEqual(level(7, 3));
  });

  it('throws InsufficientStock if not enough available', () => {
    expect(() => reserve(level(2, 0), 3)).toThrowError(/insufficient/i);
  });

  it('rejects non-positive qty', () => {
    expect(() => reserve(level(10, 0), 0)).toThrowError(/positive/);
    expect(() => reserve(level(10, 0), -1)).toThrowError(/positive/);
  });
});

describe('commitReservation', () => {
  it('decrements reserved (stock becomes sold)', () => {
    expect(commitReservation(level(7, 3), 2)).toEqual(level(7, 1));
  });

  it('throws if commit exceeds reserved', () => {
    expect(() => commitReservation(level(7, 3), 4)).toThrowError(/exceeds reserved/i);
  });
});

describe('releaseReservation', () => {
  it('moves qty from reserved back to available', () => {
    expect(releaseReservation(level(7, 3), 2)).toEqual(level(9, 1));
  });

  it('throws if release exceeds reserved', () => {
    expect(() => releaseReservation(level(7, 3), 4)).toThrowError(/exceeds reserved/i);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `bun run test`
Expected: stock tests fail.

- [ ] **Step 3: Implement `src/domain/stock.ts`**

```ts
export interface StockLevel {
  readonly available: number;
  readonly reserved: number;
}

export class InsufficientStockError extends Error {
  constructor(requested: number, available: number) {
    super(`Insufficient stock: requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
  }
}

function assertPositive(qty: number, label: string): void {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function reserve(level: StockLevel, qty: number): StockLevel {
  assertPositive(qty, 'reserve qty');
  if (level.available < qty) {
    throw new InsufficientStockError(qty, level.available);
  }
  return {
    available: level.available - qty,
    reserved: level.reserved + qty,
  };
}

export function commitReservation(level: StockLevel, qty: number): StockLevel {
  assertPositive(qty, 'commit qty');
  if (level.reserved < qty) {
    throw new Error(`Commit ${qty} exceeds reserved ${level.reserved}`);
  }
  return {
    available: level.available,
    reserved: level.reserved - qty,
  };
}

export function releaseReservation(level: StockLevel, qty: number): StockLevel {
  assertPositive(qty, 'release qty');
  if (level.reserved < qty) {
    throw new Error(`Release ${qty} exceeds reserved ${level.reserved}`);
  }
  return {
    available: level.available + qty,
    reserved: level.reserved - qty,
  };
}
```

- [ ] **Step 4: Run → pass**

Run: `bun run test`
Expected: all stock tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(domain): stock reserve/commit/release with overflow guards"
```

---

## Task 10: Domain — Discount evaluator (TDD)

**Files:**
- Create: `tests/unit/domain/discount.test.ts`, `src/domain/discount.ts`

Evaluates whether a discount code applies, returns the amount in Money.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/domain/discount.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { money, ZERO_THB } from '@/domain/money';
import { applyDiscount, type DiscountCode } from '@/domain/discount';

const fixedCode: DiscountCode = {
  code: 'WELCOME50',
  kind: 'fixed',
  value: 50,
  minSubtotalBaht: 0,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2027-01-01T00:00:00Z'),
  maxUses: null,
  uses: 0,
  active: true,
};

const percentCode: DiscountCode = {
  ...fixedCode,
  code: 'TEN',
  kind: 'percent',
  value: 10, // 10%
};

const now = new Date('2026-06-26T12:00:00Z');

describe('applyDiscount', () => {
  it('returns fixed discount amount as Money', () => {
    const r = applyDiscount(fixedCode, money(500), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toEqual(money(50));
  });

  it('returns percent discount amount as Money', () => {
    const r = applyDiscount(percentCode, money(500), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toEqual(money(50));
  });

  it('rounds percent discount to satang', () => {
    const r = applyDiscount(percentCode, money(133.33), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount.amount).toBe(1333); // 10% of 13333 = 1333.3 → 1333
  });

  it('rejects inactive codes', () => {
    const r = applyDiscount({ ...fixedCode, active: false }, money(500), now);
    expect(r).toEqual({ ok: false, reason: 'inactive' });
  });

  it('rejects codes outside time window', () => {
    const r = applyDiscount(fixedCode, money(500), new Date('2025-12-31T00:00:00Z'));
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects when subtotal below minimum', () => {
    const r = applyDiscount({ ...fixedCode, minSubtotalBaht: 1000 }, money(500), now);
    expect(r).toEqual({ ok: false, reason: 'min_subtotal' });
  });

  it('rejects when max uses reached', () => {
    const r = applyDiscount({ ...fixedCode, maxUses: 5, uses: 5 }, money(500), now);
    expect(r).toEqual({ ok: false, reason: 'max_uses' });
  });

  it('returns zero amount for fixed > subtotal (caller clamps)', () => {
    const r = applyDiscount({ ...fixedCode, value: 1000 }, money(500), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toEqual(money(1000)); // clamping is computeTotals' job
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `bun run test`
Expected: discount tests fail.

- [ ] **Step 3: Implement `src/domain/discount.ts`**

```ts
import { fromSatang, money, type Money } from './money';

export interface DiscountCode {
  readonly code: string;
  readonly kind: 'fixed' | 'percent';
  readonly value: number; // baht (fixed) OR 0-100 (percent)
  readonly minSubtotalBaht: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly maxUses: number | null;
  readonly uses: number;
  readonly active: boolean;
}

export type DiscountResult =
  | { ok: true; amount: Money }
  | { ok: false; reason: 'inactive' | 'expired' | 'min_subtotal' | 'max_uses' };

export function applyDiscount(
  code: DiscountCode,
  subtotal: Money,
  now: Date,
): DiscountResult {
  if (!code.active) return { ok: false, reason: 'inactive' };
  if (now < code.startsAt || now > code.endsAt) return { ok: false, reason: 'expired' };

  const subtotalBaht = subtotal.amount / 100;
  if (subtotalBaht < code.minSubtotalBaht) return { ok: false, reason: 'min_subtotal' };

  if (code.maxUses !== null && code.uses >= code.maxUses) {
    return { ok: false, reason: 'max_uses' };
  }

  if (code.kind === 'fixed') {
    return { ok: true, amount: money(code.value) };
  }
  // percent: floor to satang
  const amount = Math.floor((subtotal.amount * code.value) / 100);
  return { ok: true, amount: fromSatang(amount) };
}
```

- [ ] **Step 4: Run → pass**

Run: `bun run test`
Expected: all discount tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(domain): discount evaluator (fixed + percent) with window guards"
```

---

## Task 11: Domain — Shipping cost (TDD)

**Files:**
- Create: `tests/unit/domain/shipping.test.ts`, `src/domain/shipping.ts`

Flat-per-zone cost based on shipping address country code. (D3 default — locked.)

- [ ] **Step 1: Write failing tests**

Create `tests/unit/domain/shipping.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { money } from '@/domain/money';
import { type ShippingZone, computeShippingCost } from '@/domain/shipping';

const zones: ShippingZone[] = [
  { code: 'TH', name: 'Thailand', countries: ['TH'], flatRateBaht: 60, isActive: true },
  { code: 'SEA', name: 'Southeast Asia', countries: ['MY', 'SG', 'ID', 'VN', 'PH'], flatRateBaht: 280, isActive: true },
  { code: 'WW', name: 'Worldwide', countries: ['*'], flatRateBaht: 650, isActive: true },
];

describe('computeShippingCost', () => {
  it('selects domestic zone by country code', () => {
    expect(computeShippingCost('TH', zones)).toEqual({
      zone: zones[0],
      cost: money(60),
    });
  });

  it('selects SEA zone for SEA country', () => {
    expect(computeShippingCost('SG', zones)).toEqual({
      zone: zones[1],
      cost: money(280),
    });
  });

  it('falls back to worldwide wildcard', () => {
    expect(computeShippingCost('US', zones)).toEqual({
      zone: zones[2],
      cost: money(650),
    });
  });

  it('throws when no zone matches and no wildcard exists', () => {
    const noWildcard = zones.slice(0, 2);
    expect(() => computeShippingCost('US', noWildcard)).toThrowError(/no shipping zone/i);
  });

  it('ignores inactive zones', () => {
    const inactiveTh = [{ ...zones[0]!, isActive: false }, zones[1]!, zones[2]!];
    expect(computeShippingCost('TH', inactiveTh)).toEqual({
      zone: zones[2],
      cost: money(650),
    });
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `bun run test`
Expected: shipping tests fail.

- [ ] **Step 3: Implement `src/domain/shipping.ts`**

```ts
import { money, type Money } from './money';

export interface ShippingZone {
  readonly code: string;
  readonly name: string;
  readonly countries: ReadonlyArray<string>; // ISO-3166 alpha-2, or ['*'] for worldwide
  readonly flatRateBaht: number;
  readonly isActive: boolean;
}

export interface ShippingQuote {
  readonly zone: ShippingZone;
  readonly cost: Money;
}

export function computeShippingCost(
  countryCode: string,
  zones: ReadonlyArray<ShippingZone>,
): ShippingQuote {
  const active = zones.filter((z) => z.isActive);
  const specific = active.find((z) => z.countries.includes(countryCode));
  const matched = specific ?? active.find((z) => z.countries.includes('*'));
  if (!matched) {
    throw new Error(`No shipping zone matches country ${countryCode}`);
  }
  return { zone: matched, cost: money(matched.flatRateBaht) };
}
```

- [ ] **Step 4: Run → pass**

Run: `bun run test`
Expected: all shipping tests pass.

- [ ] **Step 5: Domain barrel export**

Create `src/domain/index.ts`:
```ts
export * from './money';
export * from './pricing';
export * from './stock';
export * from './discount';
export * from './shipping';
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(domain): flat-per-zone shipping with wildcard fallback"
```

---

## Task 12: Supabase init + local config

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/` (dir), `supabase/policies/` (dir), `supabase/seed.sql`

- [ ] **Step 1: Verify Supabase CLI is installed**

Run: `supabase --version`
Expected: prints a version. If missing, install: `brew install supabase/tap/supabase` (mac) or `scoop install supabase` (windows) or follow https://supabase.com/docs/guides/local-development.

- [ ] **Step 2: Initialize Supabase project**

Run from repo root: `supabase init`
Expected: creates `supabase/` directory with `config.toml` and `seed.sql`. Accept defaults.

- [ ] **Step 3: Open `supabase/config.toml` and set project id**

Find the line `project_id = ...` and set to `project_id = "rb_shop"`.

- [ ] **Step 4: Start local Supabase**

Run: `supabase start`
Expected: docker-based local stack boots (Postgres, Auth, Storage, Studio). Outputs API URL, anon key, service role key.

Save these to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<API URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NODE_ENV=development
```

- [ ] **Step 5: Create policies dir + empty seed**

```bash
mkdir -p supabase/policies
```

Replace `supabase/seed.sql` with:
```sql
-- Local dev seed. Empty for now — Plan 2 (Catalog) will add product seed data.
```

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/policies supabase/seed.sql
git commit -m "chore(db): initialize Supabase local project"
```

---

## Task 13: Migration 0001 — profiles + tiered roles

**Files:**
- Create: `supabase/migrations/20260626000000_init_roles.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260626000000_init_roles.sql`:
```sql
-- Tiered roles: dev > owner > customer
-- A `dev` can do everything an `owner` can plus role management + diagnostics.
-- Profiles are auto-created via trigger on auth.users insert.

create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'owner', 'dev');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'customer',
  display_name text,
  locale text not null default 'en' check (locale in ('th', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Role-check helpers, SECURITY DEFINER so they bypass RLS for the lookup
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner_or_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) in ('owner', 'dev'),
    false
  );
$$;

create or replace function public.is_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'dev',
    false
  );
$$;

alter table public.profiles enable row level security;
```

- [ ] **Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: resets local DB and applies all migrations cleanly. No errors.

- [ ] **Step 3: Smoke-check schema via Studio**

Open the Studio URL printed by `supabase start` (typically http://localhost:54323). Confirm: `public.profiles` table exists with the role enum column. Confirm: trigger `on_auth_user_created` exists in `auth.users`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260626000000_init_roles.sql
git commit -m "feat(db): profiles + tiered role enum + auto-profile trigger"
```

---

## Task 14: Migration 0002 — RLS policies for profiles

**Files:**
- Create: `supabase/migrations/20260626000100_profiles_rls.sql`, `supabase/policies/profiles.sql` (mirror for review)

The policies file under `supabase/policies/` mirrors the migration content for code-review readability. The migration is what actually runs.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260626000100_profiles_rls.sql`:
```sql
-- profiles RLS
-- customer: select + update OWN row
-- owner:    select + update OWN row
-- dev:      ALL on all rows (role mgmt)
-- anon:     no access

-- Customer + owner: select own profile
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Customer + owner: update own profile (cannot change own role)
create policy "profiles_self_update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and (role = (select role from public.profiles where id = auth.uid()))
);

-- Dev: full read
create policy "profiles_dev_select"
on public.profiles for select
to authenticated
using (public.is_dev());

-- Dev: full insert
create policy "profiles_dev_insert"
on public.profiles for insert
to authenticated
with check (public.is_dev());

-- Dev: full update (including role changes)
create policy "profiles_dev_update"
on public.profiles for update
to authenticated
using (public.is_dev())
with check (public.is_dev());

-- Dev: delete (rare, but covered for role mgmt)
create policy "profiles_dev_delete"
on public.profiles for delete
to authenticated
using (public.is_dev());
```

- [ ] **Step 2: Mirror to policies/ dir for reviewability**

Create `supabase/policies/profiles.sql` with the same content (this file is documentation/review only; it is not auto-applied).

- [ ] **Step 3: Apply migration**

Run: `supabase db reset`
Expected: applies cleanly.

- [ ] **Step 4: Verify RLS works**

Open Studio's SQL editor and run as anon role:
```sql
set role anon;
select * from public.profiles;
reset role;
```
Expected: zero rows (anon has no policy = no access).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626000100_profiles_rls.sql supabase/policies/profiles.sql
git commit -m "feat(db): RLS policies for profiles (self + dev-managed)"
```

---

## Task 15: DB type generation script

**Files:**
- Create: `scripts/pull-types.ts`
- Modify: `src/db/types.gen.ts` (generated)

- [ ] **Step 1: Install Supabase JS**

Run: `bun add @supabase/supabase-js`
Expected: dep added.

- [ ] **Step 2: Write the type-gen script**

Create `scripts/pull-types.ts`:
```ts
#!/usr/bin/env bun
// Generate TypeScript types from the local Supabase project.
// Usage: bun run db:types

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const result = spawnSync(
  'supabase',
  ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
  { encoding: 'utf8' },
);

if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const header =
  '// AUTO-GENERATED by scripts/pull-types.ts. Do not edit.\n' +
  '// Run `bun run db:types` after schema changes.\n\n';

writeFileSync('src/db/types.gen.ts', header + result.stdout);
console.log('Wrote src/db/types.gen.ts');
```

- [ ] **Step 3: Run the script**

```bash
mkdir -p src/db
bun run db:types
```
Expected: writes `src/db/types.gen.ts` with the `Database` type covering the `profiles` table + `user_role` enum.

- [ ] **Step 4: Verify type-check still passes**

Run: `bun run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/pull-types.ts src/db/types.gen.ts
git commit -m "chore(db): type generation script + initial generated types"
```

---

## Task 16: Supabase client factories (`src/db/client.ts`)

**Files:**
- Create: `src/db/client.ts`

We need three different clients:
1. **Browser** — anon key, runs in the user's browser
2. **Server (RLS)** — anon key, runs server-side as the logged-in user via cookies (RLS enforced)
3. **Service role** — bypasses RLS, server-only, never exposed

- [ ] **Step 1: Install SSR helper**

Run: `bun add @supabase/ssr`
Expected: dep added.

- [ ] **Step 2: Implement `src/db/client.ts`**

```ts
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from './types.gen';

/** Browser-side Supabase client. Safe to use in 'use client' components. */
export function createBrowserSupabase() {
  const e = env();
  return createBrowserClient<Database>(
    e.NEXT_PUBLIC_SUPABASE_URL,
    e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Server-side Supabase client. Reads/writes the user session via cookies. RLS enforced. */
export async function createServerSupabase() {
  const e = env();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    e.NEXT_PUBLIC_SUPABASE_URL,
    e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component where setting cookies is disallowed.
            // Safe to ignore — middleware refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS.
 * ⚠️ NEVER call from any code path that reaches the browser.
 * Use only in: scripts/, app/api/, server actions explicitly gated by dev role.
 */
export function createServiceRoleSupabase() {
  const e = env();
  if (typeof window !== 'undefined') {
    throw new Error('Service role client must not be used in the browser');
  }
  return createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 3: Type-check**

Run: `bun run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(db): browser/server/service-role Supabase client factories"
```

---

## Task 17: Role-check helpers (`src/db/auth.ts`)

**Files:**
- Create: `src/db/auth.ts`, `tests/unit/db/auth.test.ts`

These run server-side and gate sensitive routes. We test them against a tiny mock of the Supabase client so we don't need a live DB for unit tests.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/db/auth.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, getCurrentRole, requireDev, requireOwnerOrDev } from '@/db/auth';

function mockClient(role: 'customer' | 'owner' | 'dev' | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: role === null ? null : { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: role === null ? null : { role },
            error: null,
          }),
        }),
      }),
    }),
  };
}

describe('getCurrentRole', () => {
  it('returns null when unauthenticated', async () => {
    const c = mockClient(null);
    expect(await getCurrentRole(c as never)).toBeNull();
  });

  it('returns the role for an authenticated user', async () => {
    const c = mockClient('owner');
    expect(await getCurrentRole(c as never)).toBe('owner');
  });
});

describe('requireOwnerOrDev', () => {
  it('passes for owner', async () => {
    const c = mockClient('owner');
    await expect(requireOwnerOrDev(c as never)).resolves.toBeUndefined();
  });

  it('passes for dev', async () => {
    const c = mockClient('dev');
    await expect(requireOwnerOrDev(c as never)).resolves.toBeUndefined();
  });

  it('throws ForbiddenError for customer', async () => {
    const c = mockClient('customer');
    await expect(requireOwnerOrDev(c as never)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws ForbiddenError for unauthenticated', async () => {
    const c = mockClient(null);
    await expect(requireOwnerOrDev(c as never)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('requireDev', () => {
  it('passes only for dev', async () => {
    await expect(requireDev(mockClient('dev') as never)).resolves.toBeUndefined();
    await expect(requireDev(mockClient('owner') as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(requireDev(mockClient('customer') as never)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `bun run test`
Expected: auth tests fail.

- [ ] **Step 3: Implement `src/db/auth.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.gen';

type Client = SupabaseClient<Database>;
export type Role = Database['public']['Enums']['user_role'];

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function getCurrentRole(client: Client): Promise<Role | null> {
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.role as Role;
}

export async function requireOwnerOrDev(client: Client): Promise<void> {
  const role = await getCurrentRole(client);
  if (role !== 'owner' && role !== 'dev') {
    throw new ForbiddenError('Requires owner or dev');
  }
}

export async function requireDev(client: Client): Promise<void> {
  const role = await getCurrentRole(client);
  if (role !== 'dev') {
    throw new ForbiddenError('Requires dev');
  }
}
```

- [ ] **Step 4: Run → pass**

Run: `bun run test`
Expected: all auth tests pass.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(db): role-check helpers (requireOwnerOrDev, requireDev)"
```

---

## Task 18: `scripts/grant-owner.ts`

**Files:**
- Create: `scripts/grant-owner.ts`

Used once (or rarely) to promote a user to owner role using the service-role key. Runs locally against either local Supabase or production (after `vercel env pull`).

- [ ] **Step 1: Implement**

```ts
#!/usr/bin/env bun
// Promote a user to 'owner' role.
// Usage: bun run grant:owner -- her@email.com
// Pulls SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env (.env.local or .env.production.local).

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/db/types.gen';

const email = process.argv[2];
if (!email) {
  console.error('Usage: bun run grant:owner -- <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('For production: `vercel env pull .env.production.local` first.');
  process.exit(1);
}

const supa = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supa.auth.admin.listUsers();
if (error) {
  console.error('listUsers failed:', error.message);
  process.exit(1);
}

const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No user found with email ${email}. Ask them to sign in first.`);
  process.exit(1);
}

const { error: updateErr } = await supa
  .from('profiles')
  .update({ role: 'owner' })
  .eq('id', user.id);

if (updateErr) {
  console.error('update failed:', updateErr.message);
  process.exit(1);
}

console.log(`Granted 'owner' to ${email} (id: ${user.id}).`);
```

- [ ] **Step 2: Type-check**

Run: `bun run typecheck`
Expected: exit 0.

- [ ] **Step 3: Smoke test against local DB**

```bash
# Sign up a dummy user via Supabase Studio first (Authentication → Add User),
# e.g. with email test-owner@local.dev. Then:
bun run grant:owner -- test-owner@local.dev
```
Expected: prints `Granted 'owner' to test-owner@local.dev (id: ...)`. Verify in Studio: profiles row shows role=owner.

- [ ] **Step 4: Commit**

```bash
git add scripts/grant-owner.ts
git commit -m "feat(scripts): grant-owner one-shot script"
```

---

## Task 19: `scripts/grant-dev.ts`

**Files:**
- Create: `scripts/grant-dev.ts`

Identical pattern, different role. The first dev is granted by running this script directly with DB credentials (no in-app surface — that's the design).

- [ ] **Step 1: Implement**

```ts
#!/usr/bin/env bun
// Promote a user to 'dev' role.
// Usage: bun run grant:dev -- you@email.com
// This is the ONLY way to create the first dev. Subsequent dev grants go through
// the in-app role management UI (built in a later plan).

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/db/types.gen';

const email = process.argv[2];
if (!email) {
  console.error('Usage: bun run grant:dev -- <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('For production: `vercel env pull .env.production.local` first.');
  process.exit(1);
}

const supa = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supa.auth.admin.listUsers();
if (error) {
  console.error('listUsers failed:', error.message);
  process.exit(1);
}

const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No user found with email ${email}. Ask them to sign in first.`);
  process.exit(1);
}

const { error: updateErr } = await supa
  .from('profiles')
  .update({ role: 'dev' })
  .eq('id', user.id);

if (updateErr) {
  console.error('update failed:', updateErr.message);
  process.exit(1);
}

console.log(`Granted 'dev' to ${email} (id: ${user.id}).`);
```

- [ ] **Step 2: Smoke test locally**

```bash
# Sign up dev-test@local.dev via Studio first.
bun run grant:dev -- dev-test@local.dev
```
Expected: prints success. Studio shows role=dev.

- [ ] **Step 3: Commit**

```bash
git add scripts/grant-dev.ts
git commit -m "feat(scripts): grant-dev one-shot script (first-dev bootstrap)"
```

---

## Task 20: README

**Files:**
- Create / replace: `README.md`

- [ ] **Step 1: Write the README**

```markdown
# rb_shop

Single-creator ecommerce store for [rainbykello](https://www.twitch.tv/rainbykello).

**Status:** Foundation (Plan 1). No public UI yet.
**Spec:** [docs/superpowers/specs/2026-06-26-rb-shop-design.md](docs/superpowers/specs/2026-06-26-rb-shop-design.md)
**Phase 1 plans:** [docs/superpowers/plans/](docs/superpowers/plans/)

## Stack

Next.js 15 · TypeScript strict · Tailwind · Supabase (Postgres + Auth + Storage + RLS) · Bun · Biome · Vitest · Zod.

## Setup

```bash
# 1. Install Bun (https://bun.sh) and Supabase CLI (https://supabase.com/docs/guides/local-development).
# 2. Install deps:
bun install

# 3. Start local Supabase (Docker required):
supabase start
# Copy the printed URL, anon key, and service role key into .env.local
# (template: .env.example).

# 4. Apply migrations + generate types:
supabase db reset
bun run db:types

# 5. Dev server:
bun run dev
```

## Common commands

| Command | What it does |
|---|---|
| `bun run dev` | Local Next.js dev server (http://localhost:3000) |
| `bun run build` | Production build |
| `bun run lint` | Biome lint + format check |
| `bun run lint:fix` | Biome auto-fix |
| `bun run typecheck` | TypeScript no-emit check |
| `bun run test` | Vitest unit tests |
| `bun run test:watch` | Vitest watch mode |
| `bun run db:types` | Regenerate `src/db/types.gen.ts` from local Supabase |
| `bun run db:reset` | Apply migrations from scratch + seed |
| `bun run grant:owner -- <email>` | Promote a user to owner (run after they sign in once) |
| `bun run grant:dev -- <email>` | Promote a user to dev — bootstrap your own access first |

## Layout

```
src/
  app/       Next.js routes
  domain/    Pure logic (no I/O) — Money, pricing, stock, discount, shipping
  db/        Supabase client factories + role-check helpers + generated types
  lib/       Cross-cutting: env validation, brand tokens
tests/unit/  Vitest unit tests mirroring src/
supabase/    Migrations + RLS policies + seed
scripts/     One-shot CLI scripts (run locally with `bun run scripts/*.ts`)
```

## Bootstrapping your dev account (first time)

1. `bun run dev`
2. Use Supabase Studio (URL printed by `supabase start`) → Authentication → Add User → enter your email.
3. `bun run grant:dev -- your@email.com`
4. You're now a dev. Magic-link sign-in surface is added in a later plan.

## Roles

| Role | Can do |
|---|---|
| `customer` | (default) Browse, buy, see own orders |
| `owner` | Manage products, orders, discounts, shipping, settings |
| `dev` | Everything `owner` does + role management, audit, diagnostics |

Only a `dev` can grant or revoke roles. The first `dev` is bootstrapped via `scripts/grant-dev.ts` (DB credentials required) — there is no in-app way to claim it.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup, commands, and role bootstrap"
```

---

## Task 21: Wire it together — smoke check + green CI

**Files:** none new; verifies the whole foundation works.

- [ ] **Step 1: Fresh clone simulation**

```bash
rm -rf node_modules
bun install
```
Expected: clean install succeeds.

- [ ] **Step 2: Full local gate**

```bash
bun run lint
bun run typecheck
bun run test
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder bun run build
```
Expected: all four exit 0. Vitest reports ≥ 30 tests passing (Money 10 + Pricing 5 + Stock 7 + Discount 8 + Shipping 5 + Env 3 + Auth 5 + smoke 1 ≈ 44).

- [ ] **Step 3: Push to GitHub and confirm CI is green**

```bash
git push -u origin develop
```
Open the Actions tab on GitHub → confirm the CI workflow runs and goes green.

- [ ] **Step 4: Final foundation commit (if no changes, skip)**

If lint:fix produced any tidy-ups, commit them:
```bash
git add .
git commit -m "chore: foundation green-CI checkpoint" || true
```

---

## Out of scope for Plan 1 (handled in later plans)

| Concern | Plan |
|---|---|
| shadcn/ui primitives, header/footer, layout chrome | Plan 2 (Catalog) |
| Product / variant / image schemas + admin UI | Plan 2 |
| Storefront product list (3-col grid) + PDP | Plan 2 |
| i18n routing (next-intl) | Plan 2 |
| Cart, fast guest checkout, payment provider interface, mock adapter | Plan 3 |
| Order schema, receipt page, shipping timeline | Plan 3 |
| Admin orders, waitlist, discount codes UI, email (Resend), cron jobs | Plan 4 |
| Dev-only screens (role mgmt, audit), Google Sheets sync | Plan 5 |
| Motion pass, security pass, E2E (Playwright), deploy | Plan 6 |

---

## Self-review notes

- All spec requirements addressed in Plan 1 are: TS strict, Bun, Biome, Vitest, Tailwind w/ Soft Studio tokens, Zod env, Supabase init + RLS + tiered roles, role-check helpers, grant scripts, domain logic (Money/Pricing/Stock/Discount/Shipping), CI on develop, README.
- No placeholders, no "TODO" steps.
- Type consistency: `Money`, `LineItem`, `Totals`, `StockLevel`, `DiscountCode`, `ShippingZone`, `Role` are referenced consistently across tasks.
- Each domain task follows test-fail → implement → test-pass → commit.
- Each commit happens on `develop` (per user feedback memory).
