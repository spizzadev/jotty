# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start dev server (Next.js)
yarn build            # Build for production (+ runs postbuild.js)
yarn start            # Start production server
yarn lint             # Run ESLint
npx tsc --noEmit      # Type-check without emitting files
yarn test             # Run tests in watch mode (Vitest)
yarn test:run         # Run tests once (CI mode)
yarn test:coverage    # Run tests with coverage report
```

To run a single test file:
```bash
yarn test:run tests/server-actions/note.test.ts
```

Mock data generators (useful for local testing):
```bash
yarn mock:data:lists <username>   # Generate checklist mock data for a user
yarn mock:data:notes <username>   # Generate note mock data for a user
```

Docker (production uses `node:20-alpine`):
```bash
docker compose build --no-cache   # Rebuild image (required after source changes)
docker compose up -d              # Start container
docker compose down               # Stop container
docker logs jotty                 # View logs
```

---

## Architecture

### Overview

Jotty is a **file-based** self-hosted Next.js 16 app (React 19, TypeScript). There is **no database** — all content is stored as Markdown files with YAML frontmatter, and JSON files, under `data/`.

### Data Storage Layout

```
data/
├── notes/[username]/[category]/[id].md       # Notes (Markdown + YAML frontmatter)
├── checklists/[username]/[category]/[id].md  # Checklists + Tasks (Markdown + YAML)
├── time-entries/[username]/
│   ├── [taskId].json                         # Task-level time entries
│   ├── _cat_[slug].json                      # Category-level time entries
│   └── _billing.json                         # Hourly rates keyed by taskId
├── users/
│   ├── users.json                            # User accounts + hashed passwords
│   ├── sessions.json                         # Session → username mapping
│   └── session-data.json                     # Session metadata
├── sharing/shared-items.json                 # Sharing permissions
└── logs/[username]/                          # Audit logs
```

Files use `.order.json` in each directory to preserve user-defined ordering (not alphabetical).

### Page/Route Structure

The app uses Next.js App Router with a route group `(loggedInRoutes)/` for authenticated pages.

**Every authenticated section follows this 3-layer pattern:**
1. `[section]/layout.tsx` — Server Component: fetches `categories` + `user`, passes to Client wrapper
2. `[section]/[SectionClient].tsx` — Client Component: wraps in `<Layout>` (provides sidebar + navbar), sets up any filter context
3. `[section]/page.tsx` — Server Component: fetches page-specific data, renders the main view client component

The `<Layout>` component (`app/_components/GlobalComponents/Layout/Layout.tsx`) is the dashboard chrome — **always use it** via the section's Client wrapper. Rendering a page component directly without a `layout.tsx` will produce a blank screen.

### Providers (app/layout.tsx)

The root layout wraps all pages with (inner to outer): `ShortcutProvider` → `ToastProvider` → `NavigationGuardProvider` → `EmojiProvider` → `ThemeProvider` → `KonamiProvider` → `WebSocketProvider` → `AppModeProvider` → `NextIntlClientProvider`.

**`AppModeProvider`** is the primary global context: holds current `user`, `notes`, `checklists`, `mode` (notes/checklists/time-tracking), shared items, link index, and app settings.

### Server Actions vs. API Routes

- **Server Actions** (`app/_server/actions/`) — used by the UI directly via React Server Actions (`"use server"`). Handles auth via `getCurrentUser()` (session cookie).
- **API Routes** (`app/api/`) — external REST API, authenticated via `x-api-key` header using `withApiAuth()`. Follow the same structure but for programmatic access.

**File I/O utilities** (always use these, not `fs` directly):
- `readJsonFile(relativePath)` / `writeJsonFile(data, relativePath)` — JSON read/write relative to `process.cwd()`
- `serverReadFile(absolutePath)` / `serverWriteFile(absolutePath, content)` — string read/write with absolute paths
- `ensureDir(absolutePath)` — create directory if missing
- All in `app/_server/actions/file/index.ts`

### Sidebar Modes

The sidebar has three modes (`app/_types/enums.ts` → `Modes`):
- `NOTES` = "notes"
- `CHECKLISTS` = "checklists"
- `TIME_TRACKING` = "time-tracking"

All modes navigate to `/?mode=[mode]`. In `TIME_TRACKING` mode the sidebar renders `TimeTrackingSidebar` (a flat list of categories + task boards for filtering) instead of the standard category tree. The main view changes based on URL params:
- `/?mode=time-tracking` — global view, all entries
- `/?mode=time-tracking&category=X` — entries for all tasks in category X + category-level entries
- `/?mode=time-tracking&task=[uuid]` — entries for a specific task board

### Authentication

Session-based. `getCurrentUser()` reads the session cookie, looks up `data/users/sessions.json`, returns the user or `null`. Passwords hashed with SHA-256. MFA via TOTP (speakeasy). OIDC/SSO support via `app/api/oidc/`.

### Checklist Types

A `Checklist` has a `type` field:
- `"simple"` — plain checklist
- `"task"` — Kanban board (has `statuses: KanbanStatus[]` and per-item `timeEntries: TimeEntry[]` for the built-in per-card timer)

Project-level time tracking (the Tracking tab) is separate from the per-card `TimeEntry` — it uses `ProjectTimeEntry` stored in `data/time-entries/`. Entries can be linked to a task (`taskId`) or a category directly (`category`). Category-level entries are stored in `_cat_[slug].json`.

### Time Tracking API

All endpoints require `x-api-key: <key>` header (same key used by all other API routes).

#### Time Entries — `app/api/time-entries/`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/time-entries` | All entries for the authenticated user (global view) |
| `GET` | `/api/time-entries?taskId=X` | Entries for a specific task |
| `POST` | `/api/time-entries` | Start a timer or add a manual entry |
| `PATCH` | `/api/time-entries/[entryId]` | Stop a timer or update description |
| `DELETE` | `/api/time-entries/[entryId]?taskId=X` | Delete an entry |
| `GET` | `/api/time-entries/billing?taskId=X` | Get billing settings for a task |
| `PATCH` | `/api/time-entries/billing` | Save billing settings for a task |

**POST `/api/time-entries` — body fields:**
```jsonc
{
  "taskId": "uuid",          // required unless category is set
  "category": "Frontend",    // required unless taskId is set; creates category-level entry
  "description": "",         // optional
  "durationMin": 60,         // if present → manual entry (completed immediately)
  "dateStr": "2026-02-23"    // optional with durationMin; defaults to today
}
```
Without `durationMin` → starts a live timer. With `durationMin` → creates a completed manual entry.

**PATCH `/api/time-entries/[entryId]` — body fields:**
```jsonc
{
  "taskId": "uuid",      // or "category": "Frontend"
  "action": "stop",      // stops the running timer
  "description": "..."   // alternatively, updates description (taskId only)
}
```

**PATCH `/api/time-entries/billing` — body fields:**
```jsonc
{
  "taskId": "uuid",
  "hourlyRate": 85,
  "currency": "EUR"      // EUR | CHF | USD | GBP
}
```

**Server actions** (used by UI, not API): `getTimeEntries`, `getAllTimeEntries`, `getEntriesForTasks`, `startTimeEntry`, `startCategoryEntry`, `stopTimeEntry`, `stopCategoryEntry`, `addManualEntry`, `addManualCategoryEntry`, `deleteTimeEntry`, `deleteCategoryEntry`, `getBillingSettings`, `saveBillingSettings` — all in `app/_server/actions/time-entries/index.ts`.

**Time Tracking UI components** (`app/_components/FeatureComponents/TimeTracking/`):

| File | Purpose |
|------|---------|
| `TimeTrackingView.tsx` | Main view — reads `?task` and `?category` URL params, 3 views (global/category/task) |
| `TimeTrackingSidebar.tsx` | Sidebar list: "All Entries" + categories + task boards, navigates via URL params |
| `TimerControl.tsx` | Start/stop timer, supports `taskId` or `category` |
| `ManualEntryForm.tsx` | Collapsible form to backdate entries, supports `taskId` or `category` |
| `EntryTable.tsx` | Entry list with week/month/all filter, CSV export, delete; shows Project column in global/category view |
| `SummaryRow.tsx` | Total hours + billing amount for the current filter |
| `BillingSettingsPanel.tsx` | Collapsible hourly rate + currency form (task view only) |
| `exportCsv.ts` | CSV export utility |

### Key Utility Files

| File | Purpose |
|------|---------|
| `app/_utils/yaml-metadata-utils.ts` | Parse/write YAML frontmatter, `generateUuid()`, `updateYamlMetadata()` |
| `app/_utils/grep-utils.ts` | File lookup via shell commands (`grepFindFileByUuid`, `grepSearchContent`, etc.) |
| `app/_utils/global-utils.ts` | `cn()` (clsx), `sanitizeFilename()`, misc |
| `app/_utils/user-sanitize-utils.ts` | `sanitizeUserForClient()` — strips sensitive fields before passing user to client |
| `app/_utils/sidebar-store.ts` | Zustand store for sidebar state |
| `app/_server/lib/metadata-cache.ts` | In-process FS-watcher cache for note/checklist metadata; invalidated on `.md`/`order.json` changes |
| `app/_consts/files.ts` | All data directory path constants |

**Alpine grep compatibility**: The Docker image uses `node:20-alpine` (BusyBox grep). BusyBox grep does **not** support `--include=`. All shell commands in `grep-utils.ts` must use `find ... -name "*.md" -type f -print0 | xargs -0 grep` instead of `grep ... --include="*.md"`. Filenames can contain spaces, so `-print0`/`-0` are required.

**`checkUserPermission` gotcha**: This function does an `fs.access()` check using the `id` argument as a filename. Always pass the note/checklist filename ID (e.g. `"my-note"`), never a UUID — otherwise permission checks will always fail.

### Testing

Tests live in `tests/`, mirroring `app/_server/actions/` structure. Uses Vitest with node environment. Tests write to a `data/` dir relative to the test runner — `tests/setup.ts` handles cleanup.

### Note Editor

Notes use **TipTap** as the rich-text editor. Custom extensions live in `app/_components/FeatureComponents/Notes/Parts/TipTap/CustomExtensions/` (slash commands, `@mention` links, internal links, callouts, Mermaid/Drawio/Excalidraw embeds, etc.). The toolbar is in `Parts/TipTap/Toolbar/` and floating menus in `Parts/TipTap/FloatingMenu/`.

### Server Action Internal Structure

Complex server action modules (e.g. `note/`, `checklist/`) are split into:
- `readers.ts` — low-level file reads
- `parsers.ts` — parse raw file content into typed objects
- `queries.ts` — higher-level data access (combines readers + parsers)
- `crud.ts` — create/update/delete operations
- `index.ts` — public exports

### Component Placement

- `app/_components/GlobalComponents/` — reusable UI primitives (buttons, modals, form elements, cards, layout)
- `app/_components/FeatureComponents/` — feature-specific components (Notes, Checklists, TimeTracking, Admin, etc.)

Don't add feature logic to GlobalComponents; don't use inline styles or hardcode Tailwind classes when a GlobalComponent already exists.

### i18n

Translations in `app/_translations/[locale].json`. Uses `next-intl`. Access in components via `useTranslations()` hook. **All UI strings must use translation keys** — no hardcoded strings in components. Add keys to all locale files when adding new UI text.

### Branch Workflow

New branches must be created off `develop` (not `main`). Pull requests must target `develop`. `main` is the release branch.
