# Daily Dose of Food

SvelteKit + TypeScript, Neon (Postgres) via Drizzle, Cloudinary for images, Clerk for auth, Tailwind CSS.

## Setup

```sh
nvm use            # Node 22
pnpm install
cp .env.example .env   # fill in Neon, Cloudinary and Clerk keys
pnpm db:push
pnpm dev
```

## Scripts

| Script                                       | Purpose                    |
| -------------------------------------------- | -------------------------- |
| `pnpm dev` / `build` / `preview`             | Run, build, preview        |
| `pnpm check`                                 | svelte-check type checking |
| `pnpm lint` / `format`                       | Prettier + ESLint          |
| `pnpm spellcheck`                            | cspell                     |
| `pnpm test:unit` / `test:e2e`                | Vitest / Playwright        |
| `pnpm db:generate` `migrate` `push` `studio` | Drizzle Kit                |

CI (`.github/workflows/ci.yml`) runs lint, spellcheck, check, unit tests, build and e2e on every PR.
