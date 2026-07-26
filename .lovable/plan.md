## What we're building

A web app for Texas municipal staff to find grants their city can apply for, read a plain-English summary and timeline, then answer 8 questions to generate a downloadable first-draft application.

## Pages

1. **Home / Grant finder (`/`)** — searchable, filterable list of grants. Filters: source (Federal / Texas), category (water, transportation, public safety, parks, broadband, housing, emergency mgmt), deadline window, funding range. Each card shows title, agency, award range, match requirement, days until deadline.
2. **Grant detail (`/grants/$id`)** — plain-English summary ("What this funds", "Who can apply", "What it costs you", "What you'll need"), a visual timeline (open date → deadline → award → performance period), eligibility notes for municipalities, link to the official listing, and a "Start my draft" button.
3. **Application draft wizard (`/grants/$id/draft`)** — 8 questions, one per step, tailored to the grant type:
   1. City name, population, county
   2. The problem/need in your own words
   3. What you want to fund (project description)
   4. Who benefits and how many people
   5. Total project cost and how much you're requesting
   6. Local match / in-kind contribution available
   7. Timeline and who will manage the project
   8. How you'll measure success
4. **My drafts (`/drafts`)** — all drafts saved in the browser (localStorage), resume or re-export. No login.

## Draft generation and export

- On submit, a server function sends the answers plus the grant's structure to Lovable AI and returns a formatted draft: Executive Summary, Statement of Need, Project Description, Goals & Measurable Outcomes, Budget Narrative, Match/Leverage, Implementation Timeline, Capacity & Management, Evaluation Plan.
- The draft is shown in an editable review screen, then downloadable as **.docx** and **.pdf**.
- Everything (answers + generated draft) is stored in localStorage, so drafts survive refresh but never leave the device except for the AI generation call.

## Grant data

- **Federal:** Grants.gov public search API, filtered to eligibility code for city/township governments, refreshed on demand and cached.
- **Texas state:** a curated set of agency sources (TWDB, TxDOT, TDA/TCF, TDEM, Texas Historical Commission, Governor's Public Safety Office, TCEQ), fetched and parsed on the server. State pages are inconsistent HTML, so this uses a scrape-and-normalize step with an AI extraction pass; results always link back to the official page so users can verify.
- A "last checked" timestamp on each grant, plus a manual refresh action, so stale data is visible rather than silent.
- Each grant's plain-English summary is generated once from the official text and cached.

## Design

Civic-utility aesthetic, not generic SaaS: deep navy + Texas-clay accent, high-contrast typography, dense readable tables and card lists, deadline urgency shown with color. Light and dark themes via design tokens.

## Technical notes

- TanStack Start. Grant fetching, AI summarization, and draft generation run in server functions; the Grants.gov call and scraping never touch the browser.
- Lovable AI gateway for summaries, Texas-page extraction, and draft writing — no API keys for you to supply.
- Grant cache stored in Lovable Cloud (needed so every visitor isn't re-scraping agency sites); user answers and drafts stay in localStorage only.
- Exports built client-side with `docx` and `jspdf` so no document ever hits a server.
- Scraping caveat: state agency pages change format; expect to add/repair sources over time. First version ships with the curated list above and degrades gracefully when a source fails.
