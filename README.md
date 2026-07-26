# Data Governance Dashboard

A small full-stack app that ingests raw datasets (CSV / Excel) and turns them
into a **governed, browsable catalog**. On upload it automatically discovers the
dataset's structure, classifies sensitive fields, runs quality checks, and
computes **Quality**, **Trust**, and **Value** scores — all viewable on a
dashboard with click-through to column-level detail.

> Built for the Proteccio Full Stack Developer assignment.

**Live demo:** _<add frontend URL after deploy>_ · **API:** _<add backend URL after deploy>_

---

## What it does (the 7 areas)

| Area | Implementation |
|------|----------------|
| **Data Ingestion** | Upload a CSV/Excel file; captures filename, upload time, row & column counts. |
| **Data Discovery** | Infers each column's type (integer/float/boolean/date/string) and stores a browsable catalog. |
| **Data Classification** | Auto-tags sensitive columns (email, phone, name, ID, credit card, address, date) via name + value pattern matching. Tags can be manually overridden. |
| **Data Quality** | Per-column % missing, invalid values, distinct counts; duplicate-row detection; a 0–100 **Quality Score**. |
| **Data Trust** | 0–100 **Trust Score** blending quality, completeness, accuracy, consistency, and classification coverage. |
| **Data Value** | 0–100 **Value Score** from view/access frequency + recency; low-activity datasets are flagged for archival/retirement. |
| **Dashboard** | Lists all datasets with counts, sensitivity tags, and all three scores; each dataset opens a column-level detail view. |

**Trust vs. Value** — Trust answers *"how reliable is this data?"* (derived from
quality + classification). Value answers *"how much is it actually used?"*
(derived from access frequency + recency).

---

## Tech stack

- **Backend:** NestJS (TypeScript) + Prisma 7 ORM
- **Database:** PostgreSQL (Neon free tier)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Parsing:** `csv-parse` (CSV), `xlsx` (Excel)
- **Tests:** Jest

### Why NestJS (deviation from the suggested plain Express)
NestJS gives first-class **dependency injection and module boundaries**, which
map cleanly onto this problem: the ingestion pipeline is a set of focused,
independently testable services — `ParsingService`, `ProfilingService`,
`ClassificationService`, `ScoringService` — orchestrated by `DatasetsService`.
That separation of concerns is exactly what the pipeline needs and keeps the
scoring/classification logic pure and unit-testable.

---

## Architecture

```
data-governance-dashboard/
├── backend/                 # NestJS API
│   ├── prisma/              # schema + migrations
│   └── src/
│       ├── parsing/         # CSV/Excel → { headers, rows }
│       ├── profiling/       # type inference + quality checks
│       ├── classification/  # sensitive-field tagging + validators
│       ├── scoring/         # quality / trust / value formulas (pure)
│       ├── datasets/        # controller + service (HTTP + orchestration)
│       └── prisma/          # PrismaService (pg driver adapter)
├── frontend/                # React dashboard
│   └── src/{pages,components,api,lib}
└── sample-data/             # example datasets (clean, messy, Excel)
```

**Ingestion pipeline (on upload):**
`parse → profile (types + quality) → classify columns → score (quality, trust) → persist dataset + columns atomically`.

### Data model
- **Dataset** — metadata + computed scores + view tracking + a small sample-rows preview.
- **Column** — per-column profile (type, missing/invalid/distinct) + auto tag + optional manual override.
- **UsageEvent** — a view log that drives the Value score over time.

### How the scores are computed
- **Quality** = `0.4·completeness + 0.3·validity + 0.3·uniqueness` (×100).
- **Trust** = `0.35·quality + 0.25·completeness + 0.20·accuracy + 0.10·consistency + 0.10·classificationCoverage` (×100). Coverage counts columns that are a known sensitive type **or** have been human-reviewed — so manually overriding a tag *raises* trust.
- **Value** = `0.7·usage + 0.3·recency` (×100), where usage is a saturating `log` of view count and recency decays over ~30 days. A never-viewed dataset scores 0 and is flagged **low activity**.

---

## Running locally

### Prerequisites
- Node.js 20+ (developed on Node 24)
- A PostgreSQL connection string (Neon free tier works great)

### 1. Backend
```bash
cd backend
cp .env.example .env          # then set DATABASE_URL to your Postgres URL
npm install
npx prisma migrate deploy     # apply the schema
npm run start:dev             # http://localhost:3000/api
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env          # defaults to http://localhost:3000/api
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 and upload a file from [`sample-data/`](./sample-data).

### Tests
```bash
cd backend && npm test
```
Covers the highest-value logic: classification (incl. a regression test that
dates aren't misread as phone numbers), the scoring formulas (with empty-dataset
and coverage edge cases), and parsing edge cases (duplicate/blank headers, empty
and unsupported files).

---

## API

Base path: `/api`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/datasets/upload` | Multipart upload (`file`); runs the full pipeline and returns the dataset. |
| `GET` | `/datasets` | List all datasets (dashboard summary). |
| `GET` | `/datasets/:id` | Dataset detail incl. columns + sample rows; **records a view**. |
| `PATCH` | `/datasets/:id/columns/:columnId` | Override a column's tag (`{ "manualTag": "EMAIL" }`, or `null` to reset to auto); recomputes trust. |
| `DELETE` | `/datasets/:id` | Delete a dataset. |
| `GET` | `/health` | Health check. |

---

## Sample datasets

Included in [`sample-data/`](./sample-data):
- **`customers_clean.csv`** — well-formed PII (Quality 100).
- **`customers_messy.csv`** — missing values, duplicate rows, invalid emails, a
  non-numeric value in a numeric column, a **duplicate header**, and a **blank
  header** — exercises the edge-case handling.
- **`products_inventory.xlsx`** — proves the Excel ingestion path.

---

## Design decisions & why

Each choice below is framed as **decision → why → trade-off**.

### Architecture & stack

- **NestJS instead of plain Express.** The ingestion pipeline is naturally a set
  of focused steps (parse → profile → classify → score), so NestJS's dependency
  injection and modules let each step be its own injectable, single-responsibility
  service that's unit-testable in isolation. *Trade-off:* more boilerplate/framework
  overhead than Express — justified here because the separation of concerns is the
  point of the exercise.
- **The scoring & classification logic are pure functions/services** (no DB, no
  HTTP). *Why:* they hold the "real" business logic, so keeping them side-effect-free
  makes them trivial to test and reason about. *Trade-off:* the orchestrating
  `DatasetsService` has to wire inputs/outputs between them, which is deliberate.
- **Process the whole pipeline synchronously on upload** rather than using a job
  queue. *Why:* datasets are small (10 MB cap) and the user wants scores
  *immediately* on the dashboard — a queue would add infrastructure and a
  "pending" state for no real benefit at this scale. *Trade-off:* a very large
  file would block the request; the size limit bounds that, and a queue is the
  obvious next step if inputs grew.
- **Store column *profiles*, not raw rows** (plus a ~10-row preview for the UI).
  *Why:* the catalog only needs aggregates (types, missing/invalid/distinct,
  scores), so persisting every cell would bloat the DB for no product value.
  *Trade-off:* a manual tag override recomputes trust via classification coverage
  but can't re-derive per-column *invalid* counts (those need the original values)
  — an accepted limitation, called out because it's a real consequence.
- **Prisma 7 with the `pg` driver adapter.** Prisma 7 no longer reads the
  connection URL from the schema, so `PrismaService` constructs the client with an
  explicit `@prisma/adapter-pg` adapter. *Why note it:* it's the least obvious part
  of the setup and would trip up anyone on an older Prisma mental model.

### Domain logic (the interesting part)

- **Classification = column-name hints first, value patterns second, with a
  match threshold.** *Why:* a human-authored header (`email`, `phone`) is a
  stronger, less ambiguous signal than value shape. Concretely, `signup_date`
  values like `2023-01-15` satisfy a loose phone-number pattern, so a value-first
  approach mislabels dates as phones (there's a regression test locking this
  behavior in). Credit cards additionally require a **Luhn** check so random
  16-digit IDs aren't flagged. *Trade-off:* simple substring/regex matching will
  miss exotic formats — acceptable, and exactly the "simple pattern matching" the
  brief asks for.
- **Type inference is dominant-type with a 60% threshold**, not all-or-nothing.
  *Why:* real columns are messy — a mostly-integer column with a couple of bad
  cells should still be typed `INTEGER`, with the bad cells counted as *invalid*.
  That's precisely what "obviously invalid values" should mean, and it makes the
  quality score reflect reality instead of collapsing to `STRING`.
- **Trust ≠ Value, kept deliberately separate** (the brief stresses these get
  confused). **Trust** blends the five reliability factors — quality,
  completeness, accuracy, consistency, and *classification coverage* — so a
  well-understood, well-classified dataset scores higher. Crucially, a **manual
  override counts toward coverage**, so human review *raises* trust, which models
  governance correctly. **Value** is purely usage: a saturating `log` of view
  count plus access recency, so a dataset nobody opens trends to 0 and is flagged
  for archival. *Trade-off:* the specific weightings are a judgment call — they're
  centralized as named constants in `scoring.service.ts` so they're easy to tune.
- **A view is recorded when a dataset detail is opened.** *Why:* with no external
  analytics to hook into, opening the detail page is the most honest proxy for
  "this data is being used," and it's what makes the Value score move over time.

### Data handling & edge cases

- **Never crash on messy input; degrade gracefully.** Blank headers become
  `column_N`, duplicate headers get suffixed (`email`, `email_2`), ragged rows are
  padded/truncated to the header width, fully-empty rows are dropped, and empty or
  unsupported files return a clear `400`. *Why:* "data handling & edge cases" is an
  explicit grading criterion, and a governance tool that chokes on a bad CSV is
  useless. Each of these is covered by a test.

### Frontend

- **Tailwind + a small set of presentational components.** *Why:* the dashboard's
  job is to *communicate* governance at a glance, so scores are color-coded
  (green/amber/red), sensitivity tags are distinct colored chips, and bad
  missing/invalid percentages turn red. Tailwind makes that fast without a design
  system. *Trade-off:* utility classes are verbose in JSX — fine for an app this size.

## Assumptions

- **No authentication / multi-user** — explicitly out of scope; single-tenant.
- **Uploads are ≤ 10 MB** and processed in-memory (no file persistence).
- **"Usage" means dashboard views** in the absence of a real consumption signal.
- **First matching signal wins** in classification (a column gets one tag).

---

## Deployment

- **Database:** Neon (free Postgres).
- **Backend:** Render web service. Build `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`; start `npm run start:prod`. Env: `DATABASE_URL`, `FRONTEND_ORIGIN`.
- **Frontend:** Vercel. Env: `VITE_API_URL` → the deployed backend `/api` URL.

> **Free-tier note:** the backend may **sleep after inactivity** and take
> ~20–30s to wake on the first request — this is expected; just retry.
