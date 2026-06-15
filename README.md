# GameChanger Screenshot Scout

AI-powered opponent scouting for youth baseball coaches. Upload GameChanger screenshots, extract structured data with AI, and generate coach-friendly scouting reports.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Supabase (Auth, Postgres, Storage)
- OpenAI GPT-4o (vision + report generation)
- Tailwind CSS + shadcn/ui

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

### 3. Set up Supabase

1. Create a new Supabase project
2. Run the SQL in `supabase/schema.sql` in the SQL Editor
3. Create a storage bucket named `gamechanger-screenshots` (public)
4. Add storage policies from the comments at the bottom of `schema.sql`
5. Enable email auth in Authentication settings

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## User Flow

1. **Login** — Sign up or sign in
2. **Create opponent** — Add team name, age level, location
3. **Upload screenshots** — Drag & drop GameChanger screenshots
4. **AI extraction** — Run extraction on uploaded images
5. **Review data** — Edit extracted players, batting, pitching stats
6. **Generate report** — AI writes a scouting report
7. **Export** — Copy or print the report

## Routes

| Route | Description |
|-------|-------------|
| `/login` | Authentication |
| `/dashboard` | Overview and recent opponents |
| `/opponents` | List all opponents |
| `/opponents/new` | Create opponent |
| `/opponents/[id]` | Opponent detail |
| `/opponents/[id]/upload` | Upload screenshots |
| `/opponents/[id]/extracted-data` | Review/edit extracted data |
| `/opponents/[id]/report` | View/generate scouting report |

## API Routes

- `POST /api/opponents` — Create opponent
- `GET /api/opponents` — List opponents
- `GET /api/opponents/[id]` — Opponent detail with related data
- `POST /api/opponents/[id]/upload` — Upload screenshots
- `POST /api/opponents/[id]/extract` — Run AI extraction
- `POST /api/opponents/[id]/generate-report` — Generate scouting report
- `PUT /api/extracted-data` — Update extracted records
