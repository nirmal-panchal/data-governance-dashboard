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

## Assumptions & design decisions / trade-offs

- **No auth / multi-user** — out of scope per the brief; the app is single-tenant.
- **Raw rows aren't persisted** — only column *profiles* and a ~10-row preview
  are stored. Consequence: a manual tag override recomputes trust via
  classification coverage but does **not** re-derive per-column invalid counts
  (that would need the original values). This keeps storage light and uploads fast.
- **Classification is intentionally simple** (name hints + value patterns, Luhn
  for cards), as the brief asks. Name signals take precedence over value shape
  since headers are less ambiguous (e.g. a `signup_date` column of `2023-01-15`
  values would otherwise look phone-like).
- **Type inference is dominant-type with a threshold**, so a mostly-numeric
  column with a few bad cells is typed numeric and the bad cells count as invalid
  — which is what "obviously invalid values" should mean.
- **Value scoring is view-driven.** With no real analytics to hook into, opening
  a dataset logs a `UsageEvent`; the score blends view volume and recency.
- **Prisma 7** requires a driver adapter (the connection URL is no longer read
  from the schema), so the client is constructed with the `pg` adapter in
  `PrismaService`.

---

## Deployment

- **Database:** Neon (free Postgres).
- **Backend:** Render web service. Build `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`; start `npm run start:prod`. Env: `DATABASE_URL`, `FRONTEND_ORIGIN`.
- **Frontend:** Vercel. Env: `VITE_API_URL` → the deployed backend `/api` URL.

> **Free-tier note:** the backend may **sleep after inactivity** and take
> ~20–30s to wake on the first request — this is expected; just retry.
