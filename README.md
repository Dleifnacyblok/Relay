# Relay

Loaner tray tracking and missing parts alerts for medical device sales reps.

Built on [Base44](https://base44.com) (React + hosted backend). Original use case: spine sales reps managing consigned loaner sets across hospital accounts, tracking overdue returns and missing parts, calculating fines, and surfacing marketplace matches across reps.

## Key features

- **Loaner tracking** — overdue detection, days-until-due, per-rep and per-account views
- **Missing parts** — log, track, and resolve missing components from returned sets
- **Send-back log** — record shipments with tracking numbers and photos
- **Territory inventory** — see consigned sets at each account
- **Marketplace** — request and offer parts across reps
- **Analytics** — overdue rates, fine exposure, IEP efficiency metrics
- **IEP dashboard** — Globus Grid 5 / Grid 6 efficiency reporting
- **Gmail auto-import** — pulls daily loaner reports from a Gmail inbox
- **Calendar sync** — pushes return dates to Google Calendar
- **AI assistant ("Greg")** — Claude-powered chat over the user's loaner data

## Stack

- **Frontend:** React 18 + Vite 6, Tailwind CSS, shadcn/ui, react-query, react-router
- **Backend:** Base44 hosted platform — Deno serverless functions + hosted Postgres-like datastore
- **AI:** Anthropic Claude (gregChat), Base44 `Core.InvokeLLM` (identifyPartNumber)
- **Integrations:** Gmail (read), Google Calendar (write)

## Repository layout

```
src/
  pages/          18 page components (Dashboard, Search, MyLoaners, etc.)
  components/     85 shared components (49 are shadcn/ui primitives)
  api/            Base44 SDK client wiring
  lib/            Auth context, query client, app params, utilities
base44/
  entities/       Data model — 14 entity JSON schemas
  functions/      18 Deno serverless functions (alerts, imports, AI, exports)
RELAY_AUDIT.md    Full codebase audit (read this first if you're new to the repo)
```

## Local development

### Prerequisites

- Node 18+
- A Base44 app ID and base URL (get from the Base44 console)

### Setup

```bash
git clone <repo-url>
cd Relay
npm install
```

Create `.env.local`:

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
VITE_BASE44_FUNCTIONS_VERSION=prod
```

### Run

```bash
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build → ./dist
npm run lint       # eslint
npm run typecheck  # tsc against jsconfig.json
```

## Deployment

Production is hosted by Base44. Pushing to the repo's main branch syncs back to the Base44 builder. To publish a new version, open the app in [Base44.com](https://base44.com) and click **Publish**.

Backend functions in `base44/functions/` deploy through Base44's pipeline, not through this repo's build step.

## For new contributors

Before changing anything in this codebase, **read `RELAY_AUDIT.md`**. It documents the current security model (territory isolation is client-side only, do not assume server-side row-level access control), the known performance ceilings (most pages load full tables and filter in JS), and the prioritized issue list with effort estimates.

The audit also describes which changes are safe vs. risky and which P1/P2 issues block multi-rep rollout.

## Links

- Base44 docs: https://docs.base44.com
- Base44 support: https://app.base44.com/support
