# Design system

The visual and interaction contract for Daily Dose of Food's UI. Written for whoever (human or
agent) builds the next screen — Journal, Explore, Favorites, a place page — so it comes out
consistent with the review wizard rather than reinventing the look.

This is the source of truth. Tokens live in code at
[`src/routes/layout.css`](src/routes/layout.css); this file explains what they mean and how to use
them. If the two disagree, fix whichever is wrong — don't let a third definition appear elsewhere.

## 1. Principles

- **Warm cream paper, espresso ink, one orange accent.** No second accent color. Status needs
  (good/bad/favorite) get their own tokens instead of overloading the accent.
- **Serif for display, sans for everything else.** Literata (`font-display`) is reserved for
  headings and the odd emphatic number (e.g. the overall rating word). Figtree (`font-sans`, the
  `body` default) is for all UI text, labels, and body copy. Don't mix a heading weight into body
  text or vice versa.
- **Generous vertical rhythm.** Sections breathe (`gap-6`/`gap-7` between major blocks, `gap-2.5`
  within a tight label+control pair). Don't compress toward a dense, admin-panel density.
- **Color carries meaning, not decoration.**
  - Green (`good`/`good-soft`) = a positive tag or highlight.
  - Red (`bad`/`bad-soft`) = a negative tag or complaint.
  - Orange (`accent`/`accent-soft`) = selected / active / primary action / "you are here".
  - `fav` (a distinct red-pink) = favorited, never reused for "negative" or "error" — those are
    `bad`.

## 2. Tokens

All tokens are plain CSS custom properties in `:root` (see
[`layout.css`](src/routes/layout.css)), re-exported as `--color-*` under `@theme` so Tailwind v4
generates utilities (`bg-accent`, `text-ink-3`, `border-line`, …) automatically. **Never write a
literal color or a Tailwind stock color (`text-stone-500`, `#f08a2c`, …) in a component.** The one
existing violation — `src/routes/review/[id]/+page.svelte`, which still uses `text-stone-*` — is
tech debt, not a pattern to copy; fix it if you touch that file.

| Token                | Light                 | Meaning / when to use                                                                                                                                                                        |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg`                 | `#fcf9f3`             | Page background field.                                                                                                                                                                       |
| `surface`            | `#ffffff`             | Raised cards, inputs, the header bar — anything sitting a level above `bg`.                                                                                                                  |
| `sunken`             | `#f4eee4`             | Recessed wells: the `SegmentedControl` track, an expanded tag panel, a disabled-looking block. One level _below_ `surface`.                                                                  |
| `line`               | `#e7ded0`             | Hairline borders and dividers. Never use it as a text or fill color.                                                                                                                         |
| `ink`                | `#2a2019`             | Primary text, headings.                                                                                                                                                                      |
| `ink-2`              | `#6a5b4e`             | Secondary text — sub-labels, descriptions, body copy that isn't the headline.                                                                                                                |
| `ink-3`              | `#9b8c7d`             | Tertiary text — placeholders, meta (dates, counts), disabled-ish labels, icons that shouldn't compete with content.                                                                          |
| `accent`             | `#f08a2c`             | Fills: primary buttons, selected-star fill, progress bars, focus ring base.                                                                                                                  |
| `accent-strong`      | `#b9560c`             | Text/icon color _on_ a light background that needs to read as "accent" (links, the active nav underline's label, "Edit" buttons) — `accent` itself is too light for body-size text contrast. |
| `accent-soft`        | `#fdeedf`             | Tinted selection background (selected tile, active step pill, overall-rating card).                                                                                                          |
| `on-accent`          | `#ffffff`             | Text/icon color placed on top of an `accent` fill.                                                                                                                                           |
| `good` / `good-soft` | `#3c7a4b` / `#e4f1e6` | Positive tag text/fill and its soft background.                                                                                                                                              |
| `bad` / `bad-soft`   | `#b0463a` / `#f9e4e0` | Negative tag / error text/fill and soft background.                                                                                                                                          |
| `fav`                | `#d64f4a`             | Favorite heart, favorite badge.                                                                                                                                                              |
| `star-empty`         | `#e2d6c6`             | Unfilled star.                                                                                                                                                                               |

Radius scale: `rounded-input` (12px, form controls), `rounded-tile` (14px, photo/option tiles),
`rounded-card` (16px, cards/sections). Pick by _what kind of element it is_, not by eyeballing a
size.

Shadows: `shadow-card` (resting card elevation), `shadow-card-lg` (modal/popover-level
elevation). There is no third shadow — don't invent one.

## 3. Dark mode

Every token above is redefined for dark twice in `layout.css`: once under
`:root[data-theme='dark']` (explicit user choice) and once under
`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }` (OS default,
unless the user explicitly picked light). **A new token needs a value in all three places** — the
light `:root` block and both dark blocks — or dark mode silently falls back to the light value.
Component code should never branch on theme directly; it only ever references the token, which is
what makes this work for free.

## 4. Component inventory

All in `src/lib/components/` (no shadcn/Radix/CVA in this project — these are it). Reach for one
of these before writing new markup for the same job.

| Component          | For                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`           | Any clickable action. `variant="primary"` (accent fill) or `"ghost"` (text-only, e.g. "Back").                                                                                                     |
| `Chip`             | A small toggleable or static pill — rating tags (`pos`/`neg`), a dashed "add" affordance (`add`), or a neutral display pill (`neutral`).                                                           |
| `Field`            | Label + optional hint/error wrapper around any form control. Always wrap a labeled input in this rather than hand-rolling a `<label>`.                                                             |
| `Icon`             | Renders an entry from `icons.ts`. Never inline raw `<svg>` in a component.                                                                                                                         |
| `InfoTooltip`      | A small info-circle icon that reveals a short explanatory tooltip on hover/focus — for a one-off hint that doesn't deserve permanent on-page real estate.                                          |
| `SegmentedControl` | Mutually-exclusive choice among 2–4 short options shown together, pill-switch style (e.g. meal type).                                                                                              |
| `StarRating`       | _Interactive_ 1–5 star input (click to set, click-again to clear).                                                                                                                                 |
| `Stars`            | _Read-only_ star display (previews, summaries). Don't reuse `StarRating` just to show a value — it drags in click handlers and ARIA radio semantics it doesn't need.                               |
| `TextInput`        | Any single-line text/number/date input, with optional leading icon or prefix/suffix (`$`, `%`).                                                                                                    |
| `TileGroup`        | Mutually-exclusive choice shown as a grid of bigger tappable tiles with icon + label (+ optional sub-label) — used when options need more visual weight than `SegmentedControl` (e.g. visit type). |
| `Toggle`           | An on/off switch (e.g. "Add to favorites"). Don't use a bare `<input type="checkbox">` for a prominent yes/no setting.                                                                             |

## 5. Authoring conventions (Svelte 5)

- Props: `let { foo, bar = default, class: extraClass = '', ...rest } = $props()` with an inline
  type literal (no separate `Props` interface unless it's genuinely reused).
- Two-way bound props use `$bindable()` (see `StarRating`, `TextInput`, `SegmentedControl`,
  `TileGroup`).
- Variant classes are computed as `$derived(...)` returning a class _string_, picked by ternary —
  not a lookup object, not a separate CSS class per variant file.
- Class composition is **template-literal concatenation**, not a merge utility — there is no
  `cn()`/`clsx`/`tailwind-merge` in this repo. Because later classes don't override earlier
  conflicting ones automatically, only pass _additive_ classes in via `class` props (spacing,
  layout) — never try to override a component's own color/variant classes that way.
- Generic components (`SegmentedControl`, `TileGroup`) use
  `<script lang="ts" generics="T extends string">` so callers get typed `value`/`options`.
  Rest props spread through `{...rest}` typed as `Omit<HTMLXAttributes, 'class'>` (or `'value'`
  for bindables).
- Children render via `Snippet` + `{@render children()}`.
- Icons are plain SVG path-data strings in `icons.ts`, rendered through `Icon.svelte`'s
  `{@html ...}` (safe only because every entry is a fixed, developer-authored constant — never
  put user input through that path). Add new icons there, keyed by a short camelCase name.
- **Runes mutation trap:** a function that _mutates_ reactive state (pushes to a `$state` array,
  assigns a field) must only be called from an `$effect` or an event handler — never from a
  `$derived(...)` or directly in template markup. Svelte 5 throws `state_unsafe_mutation`
  otherwise. `ensureRating` in `src/lib/review/draft.svelte.ts` is the worked example: it mutates
  and is only ever called inside `$effect`; its read-only twin `findRating` is what templates call
  directly. When adding a similar "find-or-create" helper, follow that same split.
- Accessibility is not optional polish — see §7.

## 6. Layout patterns

- **Three-column page shell** (desktop): a fixed-width left rail (navigation / steps), a flexible
  center column (the actual content, independently scrollable), and a fixed-width right rail
  (context / live preview), separated by `border-line` column rules. Collapses to a single column
  on mobile — see the breakpoint rule below.
- **Sticky action footer**: for multi-step flows, the primary/secondary actions live in a bar
  pinned to the bottom of the center column (`sticky bottom-0`, `border-t`, `bg-surface`), not
  inline at the end of the form content.
- **Cards vs. flush content**: use a `rounded-card border border-line bg-surface p-5` wrapper for
  a logically distinct, scannable block (a rating group, a summary section). Primary-path form
  fields that are the main point of the step (e.g. the dish name/price fields) can sit flush on
  `bg` without a card wrapper — don't nest a card inside a card for things that are "the step
  itself" rather than "a section of the step."
- **Mobile-first breakpoint rule**: base (unprefixed) classes target mobile; `lg:` classes build
  the desktop frame on top. Never write a desktop-only layout that has no mobile fallback — at
  minimum it should stack into a single readable column.

## 7. Accessibility floor

- Minimum 44×44px touch target on anything tappable.
- `aria-pressed` on toggle-style buttons (tiles, chips, segmented options).
- `role="radiogroup"` / `role="radio"` + `aria-checked` for single-choice sets rendered as custom
  buttons (star rating, visibility picker).
- `role="alert"` on inline validation/error text so it's announced.
- Don't suppress the global `:focus-visible` ring (`layout.css`) by adding `outline-none` without
  an equivalent replacement.
- Respect `prefers-reduced-motion` (already handled globally in `layout.css` — don't add a
  component-level animation that ignores it).

## 8. Content voice

- Sentence case everywhere except small uppercase eyebrows reserved for section labels
  (`WHAT WAS GOOD`, `CARD PREVIEW`) — don't upper-case regular copy or button labels.
- Second person, specific, and warm. Prefer "Add a name so you can find this in your journal
  later" over "Name is required." Error text explains the _consequence_, not just that something
  is invalid.
- Never a bare "Invalid input" / "Error" with no context.
