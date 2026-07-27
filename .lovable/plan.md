## Goal

Two problems: (1) a city shouldn't miss a grant it qualifies for, and (2) the generated draft should be good enough that a reviewer takes it seriously.

---

## Part 1 — Don't miss anything

**Deeper federal pull.** Today the Grants.gov call is a single 200-row request that only returns titles and agencies, so searching never touches the actual program text. Change it to:
- Paginate through all municipal-eligible results (eligibility `02`), plus special-district/county eligibilities that Texas cities routinely qualify under, deduped.
- Also pull results for `oppStatuses: forecasted` so upcoming cycles show up months early.
- Fetch and cache full descriptions in the background so keyword search, category rules, and fit scoring work on the real synopsis rather than the title alone.
- Show a "last synced" timestamp and a clear banner when the federal feed fails, instead of silently returning fewer grants.

**City profile (one-time, stored in the browser).** A short setup screen capturing:
- City name, county, population, whether it's a general-law or home-rule city
- Utilities/services operated (water, wastewater, stormwater, airport, transit, library, museum, parks, PD, FD, EMS)
- Designations that unlock funding: colonias, disadvantaged/LMI, Main Street city, Certified Local Government, rural, border, MPO membership
- Current priorities and any pending capital projects
- Grant capacity: staff time available, cash match available, ability to front costs for reimbursement

**Fit scoring.** Every grant gets scored against the profile using deterministic rules (eligibility text, category vs. services operated, population thresholds, match capacity vs. cost-share, deadline feasibility) — no AI call, so the whole list ranks instantly. Each grant shows a fit badge plus one line of *why* ("You operate a wastewater system and cost share is waived for cities under 10,000"), and an explicit "likely not eligible" flag with the reason, so nothing is hidden — only reordered.

**Coverage views** on the finder: Closing in 30 days, Newly posted since your last visit, Forecasted/opening soon, and Strong fits for your city. A saved-keyword watchlist highlights matches ("splash pad", "lift station") across all sources.

---

## Part 2 — A submission-quality draft

**Profile auto-fill.** The city profile pre-answers the applicant, population, and capacity questions, so the wizard starts partly complete and stays consistent across every application.

**Grant-specific questions.** After the eight core questions, the app reads the actual NOFO text and generates 3–6 additional questions tied to *that* program's stated review criteria and required elements (e.g. a benefit-cost ratio for hazard mitigation, an LMI percentage for CDBG, a service-population count for library funds). This is where most weak applications lose points.

**Two-pass writing.** Pass one drafts the nine sections. Pass two acts as a program officer: it re-reads the draft against the funder's own evaluation criteria and rewrites for specificity, tightening vague claims and making every assertion traceable to an answer. Nothing is invented — unknowns stay as clearly bracketed placeholders.

**Reviewer scorecard.** After generation, a panel scores the draft on the criteria that funder actually publishes (need, capacity, outcomes, budget justification, match) with a short list of concrete gaps: "No baseline number for overflow frequency", "Match source not identified", "No evaluation method for outcome 2". Each gap links to the section and question that fixes it.

**Section-level control.** Regenerate, expand, or shorten any single section with an instruction ("make the need statement more urgent", "add detail on the maintenance plan") without touching the rest, plus word-count targets per section.

**Attachment checklist.** A per-grant checklist of what has to accompany the narrative — SAM.gov/UEI registration, resolution of the governing body, audited financials, engineering report, environmental review, letters of support, budget forms — extracted from the NOFO where possible with a standard municipal baseline otherwise, each with a done/not-done state saved with the draft.

**Better exports.** Word and PDF get proper heading structure, a cover page with grant number and applicant details, a placeholder audit page listing every unfilled bracket, and the attachment checklist as an appendix.

---

## Technical notes

- All new state lives in `localStorage` alongside existing drafts (`src/lib/city-profile.ts`, extended `src/lib/local-drafts.ts`) — still no accounts, no server storage.
- Fit scoring is pure TypeScript in `src/lib/grants/fit.ts`, called client-side; no per-grant AI cost.
- New server functions in `src/lib/grants.functions.ts`: `generateGrantQuestions`, `reviewDraft` (scorecard), `reviseSection`, `extractChecklist`. All go through the existing `callAi` helper.
- Federal fetch changes are confined to `src/lib/grants/grants-gov.server.ts`; description hydration uses the existing in-memory cache with a longer TTL.
- New routes: `/profile` (city setup) and a checklist tab within the existing draft route. Finder and detail pages gain fit badges.

## Sequencing

1. City profile + fit scoring + finder coverage views
2. Deeper federal pull with full-text hydration
3. Grant-specific questions + two-pass drafting
4. Reviewer scorecard + section regeneration
5. Attachment checklist + upgraded exports
