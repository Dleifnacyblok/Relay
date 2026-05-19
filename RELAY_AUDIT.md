# Relay — Codebase Audit

**Audit date:** 2026-05-18
**Auditor:** Claude (Opus 4.7)
**Repo:** `C:\Users\kolby\Documents\Relay`
**Branch reviewed:** `main` @ `21a5bcc`
**Scope:** Full codebase — frontend (`src/`), backend functions (`base44/functions/`), data model (`base44/entities/`), auth, config.

---

## 1. Executive Summary

Relay is a working single-user app built on Base44, a hosted low-code platform. The frontend is a real React/Vite codebase (~18,400 lines, 85 components, 18 pages). The backend is 18 serverless Deno functions running inside Base44's infrastructure, plus a JSON-defined data model with 14 entities.

**The honest bottom line:** the app works for one rep doing one territory because it doesn't actually have to keep data separate yet. The instant a second rep logs in, the architecture starts leaking. Almost everything that should be a backend security rule is implemented as a client-side filter — meaning the rules exist only in the UI, and any rep with a browser dev console can see, edit, or delete data belonging to every other rep across every territory. There are no per-row access rules in the data model.

What's working:
- The frontend code is decent shadcn/React, organized by feature, using react-query and Tailwind. Not great, but not embarrassing.
- The data model is coherent — loaners, missing parts, send-backs, marketplace, IEP analytics are all modeled.
- The Gmail auto-import and IEP import pipelines exist and parse the right spreadsheets.

What's not working, ranked by how much it will hurt:
1. **No backend access control.** Server-side, anyone authenticated can read or modify any row. Territory and role exist only in the UI.
2. **The auth token is stored in `localStorage` and passed via URL query string.** Any XSS, any browser-history scrape, or any shared device exposes it.
3. **Every list page loads the entire table into the browser, then filters in JS.** Fine at 200 loaners. Painful at 5,000. Broken at 50,000.
4. **Several import jobs nuke and replace data**, with hardcoded hospital→rep mappings sitting in code (including hospital names that imply this isn't hypothetical).
5. **An admin's email is hardcoded into a backend function** (`kolby5canfield@gmail.com` in `autoImportFromGmail`).

**Stay on Base44 or migrate?** Stay on Base44 for now, with a hardening sprint. The data volume is small, the user count is small, and migration costs 6–10 engineer-weeks of work that would land you in roughly the same place feature-wise. Migrate when you (a) hit Base44's RLS/permission limits and discover they truly can't be solved, or (b) cross ~50 active users / 5 territories. Detailed reasoning in §7.

**For the developer you're hiring:** the top-5 priority list is in §9. The first item — getting any real form of server-side access control in place — is non-negotiable before you put a second rep on the system.

---

## 2. Architecture Overview

### Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18.2 + Vite 6 |
| Routing | react-router-dom 6 |
| Data layer | @tanstack/react-query 5 |
| UI library | shadcn/ui (Radix primitives + Tailwind) |
| Forms | react-hook-form + zod |
| Charts | recharts |
| Maps | react-leaflet |
| Drag/drop | @hello-pangea/dnd |
| QR / scanning | html5-qrcode |
| Excel import | xlsx 0.18.5 |
| PDF | jspdf, html2canvas |
| Backend (Base44) | Deno serverless functions, hosted DB, hosted auth |
| Backend AI | Anthropic Claude (gregChat), Base44 `Core.InvokeLLM` (identifyPartNumber) |
| Integrations | Gmail (read), Google Calendar (write), Stripe (loaded but unused in code I can see) |
| Deployment | Base44-hosted; `base44.app` subdomain |

### Key files

| File | Role |
|---|---|
| `src/App.jsx` | Root component, sets up router and auth |
| `src/Layout.jsx` | Sidebar + mobile bottom-nav, role-based menu items |
| `src/pages.config.js` | Page registry consumed by router |
| `src/api/base44Client.js` | Base44 SDK client init (note: `requiresAuth: false`) |
| `src/lib/AuthContext.jsx` | Auth state + login redirect |
| `src/lib/app-params.js` | **Reads token from `?access_token=…` URL param, persists to localStorage** |
| `src/lib/query-client.js` | react-query config (no `staleTime`, retry=1) |
| `src/pages/*.jsx` | 18 page components (5,028 LOC total) |
| `base44/entities/*.jsonc` | 14 entity schemas (Loaners, MissingPart, Notification, SendBackLog, IEP*, *ImportSnapshot, AnalyticsSnapshot) |
| `base44/functions/*/entry.ts` | 18 Deno functions (alerts, imports, AI chat, PDF export, calendar sync) |

### Data flow

```
Excel report (email) ──► Gmail API ──► autoImportFromGmail() ──► Loaners table
                                                                      │
Manager upload (UI) ──► importMichiganLoanerReport() ─────────────────┤
                                                                      │
IEP report upload ────► importIEPFiles() ──► IEPSystemData/LoanerData │
                                                                      ▼
                                                            ┌────────────────┐
                                  Rep browser ◄── REST ────┤  Base44 DB     │
                                  (loads full tables)      └────────────────┘
                                                                      ▲
Rep marks part missing ──► MissingPart.create() ──────────────────────┤
                                  │                                   │
                                  ▼                                   │
                          alertOnMissingPart() ──► emails admins + Notification table
```

**Critical observation:** the data flow is "browser pulls everything, filters locally." That's the root of both the performance ceiling and the security model. The backend doesn't constrain what a given user sees; the frontend does.

---

## 3. Code Quality Assessment

### What's solid

- **Consistent UI library usage.** The shadcn pattern is applied throughout; 49 reusable UI primitives in `src/components/ui/`. New screens won't have to reinvent buttons, dialogs, tables.
- **Feature-folder organization.** `src/components/loaners/`, `marketplace/`, `analytics/`, etc. are reasonable seams.
- **react-query is used.** Not perfectly, but it's there. Caching exists. Mutations invalidate queries.
- **Forms use react-hook-form + zod.** Where it's used, validation is sane.
- **No `eval`, no `dangerouslySetInnerHTML` misuse**, no `console.log` left in. Linter has been run.
- **Pagination *is* implemented in a handful of places** (`MyLoaners.jsx:59-69`, `ImportData.jsx:51-62`, `Analytics.jsx:49-60`) — the pattern exists, it's just inconsistently applied.

### Technical debt

- **Three pages are too large to maintain** (`SendBackLog.jsx` 651, `Analytics.jsx` 582, `IEPDashboard.jsx` 540, `MyMissingParts.jsx` 530). Mixed concerns: data fetching, mutations, dialogs, sorting, filtering all in one file.
- **Hardcoded business rules in source:**
  - `src/pages/MyLoaners.jsx:87` — email→display-name alias map (`grantsellis14@gmail.com` → `Grant Ellis`). This belongs in the User entity.
  - `src/pages/AdminSettings.jsx:9-17` — `SUFFIX_MAP` for hospital name normalization.
  - `base44/functions/autoImportFromGmail/entry.ts:168-180` and `importMichiganLoanerReport/.../entry.ts` (same block) — **hospital-name-to-rep-name fallback mappings hardcoded in Deno functions**. Includes "John DeLeon", "Reid Butcher", "Graham Brown", "Joshua Raptis", "Kristine Binge". If a rep is reassigned, you ship code to fix it.
- **Hardcoded admin email** in `autoImportFromGmail/entry.ts:281` and `:299` — `kolby5canfield@gmail.com`. Success and failure emails go there. Not a config value.
- **`requiresAuth: false`** on the Base44 client (`src/api/base44Client.js:12`). The SDK does not enforce client-side that a token is present; everything depends on the server enforcing it (and as §5 shows, the server isn't enforcing as much as you'd think).
- **Duplicate routing for IEP pages.** `App.jsx:63-72` hardcodes routes for `IEPDashboard` and `IEPImport` *in addition* to the auto-registration via `pages.config.js`. Dead-feeling — likely a leftover from manual fix-ups in the Base44 builder.
- **Two date libraries.** Both `date-fns` and `moment` are dependencies. Pick one (`date-fns`), drop the other; saves ~70 KB gzipped.
- **`three` is a dependency** (line 79 of package.json) but I see no 3D code in `src/`. Pure bloat unless I'm missing a hidden import.
- **`functionsVersion` consumed from URL params** (`app-params.js:46`) — clients can pin themselves to any backend function version they like by setting a query string. Useful for Base44 dev, problematic in production.
- **No tests.** None. Zero `*.test.*`, no `__tests__/`, no `vitest`/`jest` config.
- **`react-query` defaults are too aggressive on refetch.** `staleTime: 0` means every component remount refetches. With ~26 full-table calls in the app, this thrashes the backend on every navigation.
- **No error boundaries.** A single bad render in one widget crashes the page.
- **Inconsistent pagination.** ~26 raw `.list()` calls vs. ~3 paginated loops. Same data, different patterns, depending on which dev was on the keyboard that day.

### Fragile areas

| File | Why it's fragile |
|---|---|
| `src/pages/SendBackLog.jsx` (651 LOC) | Photo uploads, undo logic, transfers, no auth checks on undo (`:159-182`). |
| `src/pages/MyMissingParts.jsx` (530 LOC) | `deletePartMutation` calls `MissingPart.delete(id)` with arbitrary IDs and no server-side role enforcement. |
| `src/pages/AdminSettings.jsx` (467 LOC) | Manages rep-to-account assignments; no role check guarding the page, only by virtue of being absent from the rep nav. |
| `base44/functions/importMichiganLoanerReport/.../entry.ts` | **Deletes loaners whose `importKey` isn't in the new upload.** If someone uploads a partial file, you lose data. |
| `base44/functions/cleanupZeroFeeParts/entry.ts` | Bulk-deletes any MissingPart with `fineAmount <= 0`. One-button data loss if invoked at the wrong time. |
| `base44/functions/gregChat/entry.ts:16` | `loanerContext` from the client is interpolated raw into the system prompt. Prompt injection vector if loaner names contain crafted text. |

---

## 4. Performance Analysis

The dominant performance pattern in this codebase is **"fetch the whole table, filter in the browser."**

### The numbers

- **26 `.list()` calls in `src/` with no `limit` argument.** Confirmed via grep. Pages doing this on mount include Dashboard, Search, MyMissingParts, TerritoryInventory, Marketplace, AllLoanersUnfiltered, IEPDashboard, Calendar, AdminSettings, LoanerDetail (parent).
- **`Dashboard.jsx:57-73`** loads all loaners, missing parts, marketplace items, IEP systems — four full tables — every time the dashboard mounts.
- **`IEPDashboard.jsx:69-92`** loads five full tables (IEPSystemData, IEPConsignmentData, IEPLoanerData, Loaners, ConsignedSets), then runs nested `useMemo` reductions over them (lines 94-195) on every render.
- **`Analytics.jsx`** is the one screen that paginates correctly (`:49-60`), then does ~6 sequential passes over the merged dataset for different aggregations (`:124-220`) when one pass would do.

### What breaks, and when

| Loaner count | What happens |
|---|---|
| < 500 | Imperceptible. Page loads feel instant. |
| 500 – 2,500 | Dashboard takes 1–3 seconds to render. Tolerable. |
| 2,500 – 10,000 | Search and Analytics take 5–10 seconds, mobile devices noticeably warm. JSON payload starts to exceed 5 MB. |
| 10,000+ | Pages stop responding. Mobile browsers may crash on TerritoryInventory or IEPDashboard. |

A single territory at steady state runs ~150–400 active loaners. Five territories would hit ~1,000–2,000. Twenty territories starts to enter the "noticeably slow" zone. You don't have a fire today, but you will inside 12 months at the scale you described.

### Other perf concerns

- **No `staleTime` on react-query.** Navigating Dashboard → Search → Dashboard re-fetches the whole loaner table each leg.
- **No code splitting beyond Vite's default.** First-load bundle includes leaflet maps, recharts, jspdf, html2canvas, three.js, xlsx — all eagerly loaded.
- **Embedded image URLs from Supabase** (e.g., `Layout.jsx:95` logo) — fine, but no `<link rel="preload">` and no `loading="lazy"` discipline anywhere.
- **Auto-import runs sequentially with `sleep(100)`** between each loaner upsert and `sleep(1000)` between batches of 10 (`autoImportFromGmail/entry.ts:233-262`). At 2,000 loaners, this is ~3.5 minutes per run. Fine for now, slow at territory scale.
- **`alertOnMissingPart` and `alertOnOverdueLoaner` list ALL users** to find admins (`base44/functions/alertOnMissingPart/entry.ts:15`, `alertOnOverdueLoaner/entry.ts:17`). At 50 users this is nothing; at 5,000 it's a non-trivial scan per event.

---

## 5. Security & Auth Review

This is the section where I'd push back hard if I were the dev you're about to hire. **Treat this app as zero-trust today — assume any logged-in user can see everything until proven otherwise.**

### Auth flow

1. User clicks "Login" → redirected to Base44's hosted login page.
2. Base44 redirects back to your app with `?access_token=<jwt>` in the URL.
3. `src/lib/app-params.js:22-23` reads the token, **writes it to `localStorage` under key `base44_access_token`**, then strips it from the URL via `history.replaceState`.
4. The SDK uses that token for all subsequent calls.
5. `AuthContext.jsx` calls `base44.auth.me()` once to fetch the user profile.

**Problems with the auth flow:**

| # | Issue | File:line | Severity |
|---|---|---|---|
| A1 | Token stored in `localStorage` (XSS-readable). No `HttpOnly` cookie option. | `app-params.js:23` | **High** |
| A2 | Token arrives in URL query string — exposed in browser history, referrer headers, server access logs, and any browser extension that reads the URL bar. | `app-params.js:22, 44` | **High** |
| A3 | `clear_access_token=true` is a recognized URL param. An attacker who can get a logged-in rep to click a crafted link can force-logout them, possibly redirecting them to a phishing login. | `app-params.js:38-41` | Medium |
| A4 | `requiresAuth: false` on the SDK client — the client doesn't refuse to make requests without a token. | `base44Client.js:12` | Low (server should enforce, but it's a weaker default) |
| A5 | No refresh token handling visible. When the access token expires, users hit an opaque error. | n/a | Medium |

### Role separation

- Three roles inferred from the code: `admin`, `manager`, `rep`. Roles are stored on the User entity but **not defined in `base44/entities/`** — they live in Base44's User schema.
- Frontend role gates: `Layout.jsx:38` (`isAdmin = user?.role === "admin" || user?.role === "manager"`) controls which menu items render.
- Backend role checks exist in **only 4 of 18 functions**:
  - `importIEPFiles` — checks admin or manager (`entry.ts:42`).
  - `cleanupZeroFeeParts` — checks admin only (`entry.ts:8`).
  - `deduplicateMissingParts` — checks admin only (`entry.ts:8`).
  - `archiveImportSnapshot` — checks admin or manager (`entry.ts:11`).
- The other 14 functions check that *someone* is logged in, then operate.

### Territory-based data isolation

**There isn't any, at the data layer.** Here's the model:

- The `Loaners` entity has fields `repName`, `fieldSalesRep`, `associateSalesRep`, `accountName`. These are **plain strings**, not foreign keys.
- The `RepAccountAssignment` entity maps account → rep names. There's no enforcement that a write to Loaners respects this mapping.
- "My loaners" filtering is done in `src/pages/MyLoaners.jsx:115-124` — a `.filter()` over the full Loaners list, matching `user.full_name` against the rep-name strings.

**What this means in practice:** if I'm Rep A in Michigan and I open the browser console, I can call `base44.entities.Loaners.list()` and see every loaner for every rep in every territory. I can call `base44.entities.Loaners.update(someId, { repName: "Me" })` and reassign anyone's loaner to myself. I can call `base44.entities.MissingPart.delete(id)` for any missing part anywhere.

This is the single most important finding in the audit.

### Concrete holes (in priority order)

| # | Hole | File:line | Severity |
|---|---|---|---|
| S1 | No RLS / row-level access rules on any entity. Any authenticated user can read/write/delete any record across all territories. | All entities | **Critical** |
| S2 | `exportLoanersPDF` uses `asServiceRole` to list **all** loaners and emits a PDF containing every rep's data. The user invoking it doesn't have to be admin. | `base44/functions/exportLoanersPDF/index/entry.ts:10` | **Critical** |
| S3 | `MyMissingParts.jsx` mutations (`:131-145`) and `LoanerDetail.jsx` updates (`:63, 72`) and `SendBackLog.jsx` undo (`:159-182`) all call `Entity.update()/delete()` directly with no server-side authorization check. | various | **Critical** |
| S4 | `AdminSettings.jsx` is reachable only by hiding the link in the nav. There's no route guard. A non-admin who learns the URL can edit rep-account assignments. | `AdminSettings.jsx` (no role check at top) | **High** |
| S5 | Auth token in localStorage + URL. | `app-params.js:22-23` | **High** |
| S6 | `gregChat` interpolates client-supplied `loanerContext` into a system prompt. Prompt-injection vector — a loaner with a crafted note could make the AI behave unexpectedly. | `gregChat/entry.ts:16` | Medium |
| S7 | `autoImportFromGmail` ingests **whichever attachment landed in the inbox in the last 24 hours**, with no sender verification. Anyone who can email the mailbox can inject loaner records. | `autoImportFromGmail/entry.ts:40` | **High** (depends on who can email the inbox) |
| S8 | Hardcoded hospital→rep mapping in two import functions. Reassigning a rep requires a code deploy. Also, misspellings of hospital names silently route loaners to the wrong rep. | `autoImportFromGmail/entry.ts:168-180`; `importMichiganLoanerReport/index/entry.ts` (same block) | Medium |
| S9 | `importMichiganLoanerReport` deletes loaners whose `importKey` isn't in the new upload. A partial upload is destructive. | `importMichiganLoanerReport/index/entry.ts` (~line 267) | Medium |
| S10 | `cleanupZeroFeeParts` bulk-deletes parts with `fineAmount <= 0`. No "soft delete," no confirmation in the API. | `cleanupZeroFeeParts/entry.ts:14` | Medium |
| S11 | Hardcoded admin email `kolby5canfield@gmail.com` in import notifications. Can't change without redeploying. | `autoImportFromGmail/entry.ts:281, 299` | Low |
| S12 | `alertOnMissingPart`/`alertOnOverdueLoaner` notify **all** admins/managers regardless of territory. As you add territories, every manager gets every alert. | `alertOnMissingPart/entry.ts:15`; `alertOnOverdueLoaner/entry.ts:17` | Medium |
| S13 | `Notification.repName` is a plain string, not a user ID. Notifications could be created on behalf of any rep. | `base44/entities/Notification.jsonc` | Medium |
| S14 | No CSRF/origin checks visible (Base44 SDK may handle this; verify). No CSP headers in `index.html`. | `index.html` | Low |
| S15 | No audit log. There is no trail of "who deleted what when," which matters once you have multiple reps fighting over inventory. | n/a | Medium |

The first three are the ones that should stop a multi-rep rollout.

---

## 6. Scalability Assessment

### At 5 concurrent users / 2 territories

App works. Performance is fine. **The problem isn't performance, it's data isolation** — at 5 users you've already proven the security model leaks, you've just gotten lucky that nobody noticed yet. The first time two reps argue over who's responsible for a missing $400 part, somebody will open the dev console.

### At 20 concurrent users / 5 territories

- Loaner table likely 1,500–2,500 rows. Dashboard load times 1–3 sec, still acceptable.
- Every dashboard refresh by every user pulls the full loaner table. Bandwidth and Base44 read costs scale linearly with users × refresh rate.
- Alert email noise becomes a real problem. Every manager gets pinged for every missing part across all 5 territories (S12). Expect managers to mute notifications, missing real ones.
- The hardcoded hospital→rep mappings (S8) become unmaintainable. Reps rotate. You will have a stretch where loaners get auto-imported under the wrong rep until someone redeploys.
- AdminSettings starts seeing real concurrent edits. There's no optimistic-concurrency / version field on RepAccountAssignment. Last write wins.

### At 50 concurrent users / 20 territories

- Loaner table likely 8,000–12,000 rows. **Dashboard load times approach 8–15 seconds.** Mobile reps complain.
- Search.jsx and IEPDashboard.jsx become unusable on mid-range Android.
- `autoImportFromGmail` takes ~12 minutes per run. If it's daily, fine; if you want hourly, it will overlap with itself.
- `alertOnMissingPart` listing all Users on every event becomes ~2-second function execution per event. Function timeout risk.
- Without backend RLS, you now have 50 reps with the ability to nuke each other's data through dev console or a malicious browser extension. **You're one disgruntled rep away from a data-loss incident.**

### Where the cliffs are

1. **5 users.** Security/territory leakage becomes a tangible business risk.
2. **20 users.** Notification noise + hardcoded routing becomes an operational headache.
3. **50 users / 10k+ loaners.** Performance becomes user-visible. Page bundling and pagination become required, not optional.

---

## 7. Stay on Base44 vs. Migrate

### Recommendation: **stay on Base44 for now**, with a hardening sprint.

### Reasoning

**Reasons to stay:**
- The app works. You have one paying use case (your own territory) and the code is shippable for more.
- Base44 gives you auth, hosting, a database, file storage, scheduled functions, an email integration, and a Gmail/Calendar OAuth plumbing for free. Replicating that takes weeks.
- The frontend is portable. You're not locked into Base44 UI; it's a normal React app calling an SDK. If you migrate later, the React tree comes with you.
- The data model is simple (14 entities). It's a 1–2 day export job whenever you do decide to move.
- The most critical issue (no row-level security) is a Base44 configuration problem, not an architecture problem. **Base44 supports access rules per entity** — they just haven't been configured for this app. That's a setup task, not a rebuild.

**Reasons to migrate:**
- If Base44's access rules turn out to be too coarse to express "rep sees own territory + accounts they're assigned to" — possible but not confirmed.
- If costs at 50+ users become prohibitive on the Base44 plan tiers.
- If you need features Base44 doesn't offer (mobile native app, complex offline sync, custom infrastructure).

### Trigger conditions for migration

Migrate when **two or more** of these happen:
1. You confirm Base44's access rules can't model your territory/account isolation requirements.
2. You hit 30+ active reps and the Base44 bill becomes a real line item.
3. You need to integrate something Base44 doesn't support cleanly (ERP, EHR-adjacent system, on-prem hospital data).
4. Performance ceilings make UX unacceptable and Base44 won't expose pagination/index controls you need.

### If/when you migrate, target stack

| Layer | Recommendation | Why |
|---|---|---|
| Backend | **Supabase** | Already the storage backend Base44 uses (visible in their CDN URLs). Postgres + RLS that you actually control. Closest 1:1 migration. |
| Alt backend | Convex or Firebase | If you want even less ops; weaker for relational queries. |
| Frontend | Keep as-is (React/Vite/Tailwind/shadcn) | Already there. |
| Auth | Supabase Auth or Clerk | Both have OAuth providers and decent React SDKs. |
| Functions | Supabase Edge Functions (Deno) | Same runtime your Base44 functions already use — port is mechanical. |
| Email | Resend or Postmark | Cleaner than Base44's bundled email. |
| File storage | Supabase Storage | Already in the stack. |
| Deployment | Vercel for frontend | Cheap, automatic, no surprises. |

### Rough effort estimate to migrate

| Phase | Effort |
|---|---|
| Schema port (Postgres tables + RLS) | 1 week |
| Auth migration + user backfill | 0.5 week |
| Function rewrites (18 → ~12, after consolidation) | 2–3 weeks |
| SDK abstraction in frontend (`base44Client.js` → `supabaseClient.js`) | 1 week |
| Gmail + Calendar OAuth re-implementation | 1 week |
| Data migration scripts + dry runs | 0.5 week |
| Testing + parallel-run period | 1–2 weeks |
| **Total** | **7–10 engineer-weeks** |

That's $30–50k of senior dev time. Don't spend it until you have to.

---

## 8. Prioritized Issue List

Effort estimates assume a senior React/full-stack dev who's seen Base44 once before.

### P1 — Block multi-user rollout until fixed

| ID | Issue | File(s) | Effort |
|---|---|---|---|
| P1-1 | Configure Base44 entity-level access rules so reps can only read/write their own rows. Loaners, MissingPart, SendBackLog, Notification, MarketplaceItem, LookForItem, LoanerRequest. | Base44 console + entity JSONC | 12–16 h |
| P1-2 | Add server-side role guards to every backend function that mutates data. Specifically: `MyMissingParts` delete/update flows, `LoanerDetail.update`, `SendBackLog` undo, `AdminSettings` mutations. | `base44/functions/*/entry.ts` + new helpers | 10–14 h |
| P1-3 | Route guard `AdminSettings` (and `ImportData`, `Analytics` if manager-only). | `src/pages/AdminSettings.jsx`, `src/App.jsx` route table | 3 h |
| P1-4 | Fix `exportLoanersPDF` to scope to caller's territory/role. | `base44/functions/exportLoanersPDF/index/entry.ts` | 4 h |
| P1-5 | Verify Base44 access rules with a "logged in as Rep B, try to read Rep A's data" test in the dev console. Document the result. | manual | 3 h |
| P1-6 | Sender verification on `autoImportFromGmail` (only ingest attachments from a whitelisted set of `From:` addresses). | `base44/functions/autoImportFromGmail/entry.ts` | 4 h |

**P1 total: ~36–44 hours.** This is the hardening sprint that has to happen before you put a second rep on the system.

### P2 — Fix before scaling past 10 users

| ID | Issue | File(s) | Effort |
|---|---|---|---|
| P2-1 | Move auth token off `localStorage` and out of URL params. Use Base44's session/cookie option if available; otherwise hash fragment + sessionStorage. | `src/lib/app-params.js`, `src/api/base44Client.js` | 6–10 h |
| P2-2 | Replace hardcoded hospital→rep mapping with an entity (`HospitalRepMapping` or similar) editable in `AdminSettings`. | `base44/functions/autoImportFromGmail/entry.ts`, `importMichiganLoanerReport/.../entry.ts`, new entity | 8 h |
| P2-3 | Remove hardcoded admin email; replace with `AppSetting` lookup. | `base44/functions/autoImportFromGmail/entry.ts:281, 299` | 1 h |
| P2-4 | Filter `alertOnMissingPart`/`alertOnOverdueLoaner` notifications to the territory's manager(s) only. | `base44/functions/alertOnMissingPart/entry.ts`, `alertOnOverdueLoaner/entry.ts` | 4 h |
| P2-5 | Replace 26 unbounded `.list()` calls with paginated queries or server-side filters. Highest-impact pages first: Dashboard, Search, MyMissingParts, IEPDashboard, Calendar. | various pages | 16–24 h |
| P2-6 | Set sensible `staleTime` on react-query defaults (5 min for stable lists, 30 sec for active state). | `src/lib/query-client.js` | 1 h |
| P2-7 | Add error boundaries at the route level so one broken widget doesn't blank the page. | `src/App.jsx`, new `ErrorBoundary.jsx` | 3 h |
| P2-8 | Add a soft-delete or confirmation gate to `cleanupZeroFeeParts` and the "delete missing on import" path of `importMichiganLoanerReport`. | both functions | 4 h |
| P2-9 | Audit log entity — minimum: `User`, `action`, `entity`, `entityId`, `at`, `diff`. Wire into mutation paths. | new `AuditLog` entity + function wrappers | 12 h |
| P2-10 | Sanitize `loanerContext` before injecting into `gregChat` prompt. | `base44/functions/gregChat/entry.ts:16` | 2 h |

**P2 total: ~57–69 hours.**

### P3 — Cleanup and quality of life

| ID | Issue | File(s) | Effort |
|---|---|---|---|
| P3-1 | Split the four 500+ LOC pages (`SendBackLog.jsx`, `Analytics.jsx`, `IEPDashboard.jsx`, `MyMissingParts.jsx`) into feature subcomponents. | those four files | 16 h |
| P3-2 | Drop `moment` (keep `date-fns`); drop `three` if unused. Audit `package.json` for dead deps. | `package.json`, replace `moment(...)` calls | 4 h |
| P3-3 | Add Vitest + 5–10 smoke tests around critical flows (auth redirect, my-loaners filter, missing-part create, send-back undo). | `vitest.config.ts`, `src/__tests__/` | 8 h |
| P3-4 | Add CSP headers (`Content-Security-Policy` meta tag) restricting script sources. | `index.html` | 2 h |
| P3-5 | Remove duplicate IEP route registration in `App.jsx:63-72`. | `src/App.jsx`, `src/pages.config.js` | 1 h |
| P3-6 | Consolidate duplicate aggregation passes in `Analytics.jsx:124-220` into a single reducer. | `src/pages/Analytics.jsx` | 3 h |
| P3-7 | Code-split heavy routes (Analytics, IEPDashboard, Calendar) via `React.lazy`. | router setup | 3 h |
| P3-8 | Eliminate hardcoded email→alias map in `MyLoaners.jsx:87`; put display names on the User entity. | `src/pages/MyLoaners.jsx` + User schema | 4 h |
| P3-9 | README rewrite — explain Relay (not "Welcome to your Base44 project"). Document env vars, run instructions, deployment. | `README.md` | 2 h |
| P3-10 | Lazy-load `xlsx`, `jspdf`, `html2canvas` on the pages that need them only. | various | 3 h |
| P3-11 | Refresh-token handling / graceful "session expired" UX. | `AuthContext.jsx`, `base44Client.js` | 4 h |

**P3 total: ~50 hours.**

---

## 9. Recommended Scope for Hired Developer

This is what to put in front of the candidate. Two-sentence framing, then five concrete deliverables.

> Relay is a working single-rep loaner-tracking app on Base44, and we're hardening it for multi-rep rollout. The job is to lock down the data model, kill the most painful technical debt, and document the path forward — not to rewrite the app.

### Deliverables

**1. Backend access control sprint** *(P1-1, P1-2, P1-3, P1-4, P1-5 — ~36 hours)*
Configure Base44 entity-level access rules so a rep can read and write only their own loaners, missing parts, send-back logs, and notifications. Add manager/admin scope where appropriate. Add server-side role guards inside every mutation function. Manually verify by logging in as "Rep B" in an incognito window and confirming Rep A's data is inaccessible from the dev console. Deliverable: a short doc enumerating each entity's access rules and the test you ran against each.

**2. Auth hardening** *(P2-1 — ~10 hours)*
Move the access token out of `localStorage` and out of the URL query string. Use whatever session/cookie option Base44 supports; if none, use `sessionStorage` + `history.replaceState`, and document the limitations. Add a "session expired" UX rather than the current opaque error.

**3. Remove hardcoded business rules** *(P2-2, P2-3 — ~9 hours)*
The hospital→rep mappings in `autoImportFromGmail/entry.ts:168-180` and the duplicate block in `importMichiganLoanerReport`, plus the hardcoded admin email at `autoImportFromGmail/entry.ts:281, 299`, plus the email→display-name alias in `MyLoaners.jsx:87`. All become data, not code, editable in AdminSettings.

**4. Fix the unbounded queries on the five highest-traffic pages** *(P2-5 subset — ~16 hours)*
Dashboard, Search, MyMissingParts, IEPDashboard, Calendar. Today each loads the entire relevant table on mount. Add server-side pagination or scoped filters (now possible because deliverable #1 made the data model territory-aware). Acceptable result: each page loads in <1 sec at 10,000 loaners.

**5. Audit log + alert routing** *(P2-4, P2-9 — ~16 hours)*
Add an `AuditLog` entity that records every mutation (who, what, when, before/after). Route `alertOnMissingPart` and `alertOnOverdueLoaner` notifications to the territory's manager only, not all managers globally. This unblocks adding territories without flooding inboxes.

**Total scope: ~87 hours of senior dev work, or roughly two and a half weeks at typical pace.** Add a 25% contingency for Base44 quirks and discovery: **call it three to four weeks.**

### Out of scope for this engagement

- Splitting the large page files (P3-1).
- Adding a test suite (P3-3).
- Removing dead deps (P3-2).
- Code-splitting (P3-7).
- README rewrite (P3-9).

These are quality-of-life items. They matter, but they should come *after* the hardening sprint above. Doing them first is rearranging deck chairs.

### What I'd push back on if I were the hire

1. **"Just migrate to Supabase first."** No. The blocking issue is access control, and Base44 supports access rules; you don't need to migrate to fix the actual problem. Migration is a 7–10 week project that doesn't make the data safer until week 5.
2. **"Let's add multi-tenancy / org tables now."** Premature. You have one organization. Add the territory dimension to the entities you already have; introduce orgs when you have a second customer.
3. **"Rewrite in TypeScript."** The codebase is JS-with-jsconfig. Converting to TS is a useful exercise but it doesn't fix any of the P1 issues. Defer.
4. **"Replace react-query with X."** It's fine. Configure `staleTime` and move on.
5. **"Build a native mobile app."** Not yet. The mobile web app works. Native is a meaningful expense that should follow a pricing/retention signal, not an aesthetic preference.

### What I'd want from you before starting

- A read-only login to a production-like Base44 environment with realistic data volume (a few thousand loaners).
- Confirmation of which roles are intended to exist (`admin`, `manager`, `rep` — anything else?).
- The actual definition of a "territory." Today it's implicit — strings on rows. Is a territory equal to a manager? A geographic region? An account list? This decision drives the access-rule model.
- Names of the reps who are guinea pigs for the first multi-rep rollout, so the dev can test against their accounts specifically.

---

## Appendix A — Quick stats

- **Total LOC (src/):** ~18,400
- **Page files:** 18 (5,028 LOC)
- **Component files:** 85 (49 shadcn primitives + 36 feature components)
- **Backend functions:** 18
- **Data entities (defined):** 14
- **Data entities (referenced but undefined):** ~6 (MarketplaceItem, LookForItem, LoanerRequest, ConsignedSet, User, RepAccountAssignment, AppSetting — these live in Base44's hosted schema, not in this repo)
- **Unbounded `.list()` calls in `src/`:** 26
- **Backend functions with role checks:** 4 of 18
- **`TODO`/`FIXME`/`HACK` comments:** 0
- **Tests:** 0
- **Console.log statements:** 0
- **Hardcoded admin emails in source:** 1 (`kolby5canfield@gmail.com`)
- **Hardcoded hospital→rep mappings in source:** 2 functions, ~6 mappings each

## Appendix B — Files referenced

```
src/App.jsx
src/Layout.jsx
src/api/base44Client.js
src/lib/AuthContext.jsx
src/lib/app-params.js
src/lib/query-client.js
src/pages.config.js
src/pages/Dashboard.jsx
src/pages/Search.jsx
src/pages/MyLoaners.jsx
src/pages/MyMissingParts.jsx
src/pages/LoanerDetail.jsx
src/pages/Analytics.jsx
src/pages/IEPDashboard.jsx
src/pages/SendBackLog.jsx
src/pages/AdminSettings.jsx
src/pages/TerritoryInventory.jsx
src/pages/Marketplace.jsx
src/pages/Calendar.jsx
src/pages/AllLoanersUnfiltered.jsx
src/pages/ImportData.jsx
base44/entities/Notification.jsonc
base44/entities/IEPLoanerData.jsonc
base44/functions/alertOnMissingPart/entry.ts
base44/functions/alertOnOverdueLoaner/entry.ts
base44/functions/autoImportFromGmail/entry.ts
base44/functions/bulkImportLoaners/entry.ts
base44/functions/cleanupZeroFeeParts/entry.ts
base44/functions/exportLoanersPDF/index/entry.ts
base44/functions/gregChat/entry.ts
base44/functions/identifyPartNumber/entry.ts
base44/functions/importIEPFiles/index/entry.ts
base44/functions/importMichiganLoanerReport/index/entry.ts
base44/functions/notifyOnMarketplaceMatch/entry.ts
```
