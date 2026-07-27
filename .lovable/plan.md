## Goal

Make the draft defensible: every eligibility requirement the program states is visibly answered by something you wrote, every checklist item names the specific document that satisfies it, and HUD's own low-income and Opportunity Zone data is pulled in as citable evidence.

---

## 1. Evidence map (answers → eligibility criteria)

A new step between the questionnaire and the generated narrative.

- When the wizard loads a grant, the app reads the NOFO text and extracts a list of **requirements**: each one gets a short label, the verbatim snippet it came from, and a type (eligibility, threshold/mandatory, or scoring criterion).
- Each requirement is matched to the answers and profile fields that address it, with a status: **covered**, **partly covered** (something is there but thin or contains a bracketed blank), or **not addressed**.
- The step shows a coverage bar and a table: requirement → what the program says → your evidence → status. Anything not covered has a "answer this" link that jumps back to the exact question, or an inline box to add the missing evidence right there.
- A hard-blocker flag: if a requirement is one the city plainly can't meet (population cap, ineligible applicant type, required registration missing), it's called out at the top rather than buried.
- The evidence map is saved with the draft, feeds the drafting prompt (so the narrative explicitly answers each criterion), is re-checked after generation, and is exported as a "Requirement coverage" appendix in Word and PDF.

## 2. Checklist items tied to documents

Each checklist item gains structure instead of being a bare label:

- **Document name** (e.g. "Council resolution authorizing application"), **source** (who produces it — city secretary, engineer, auditor, SAM.gov), **format** expected, and whether it's required or conditional.
- **Status**: not started / in progress / have it / not applicable, plus a location note (where the file lives — shared drive path, URL, person) and a due date derived from the grant deadline.
- **Linked requirement**: where the NOFO ties a document to a criterion, the checklist item points at that requirement in the evidence map, and vice versa.
- **Export**: a "Document request packet" you can download — a per-item sheet listing what's needed, from whom, by when, and why the program requires it, suitable for emailing to staff. Also included as an appendix in the draft's Word/PDF export.

No file uploads; everything stays tracked locally in the browser as it is today.

## 3. HUD low-income and Opportunity Zone check

Two lookups, both live against HUD/Census open data — nothing hardcoded or guessed.

**Citywide (on the city profile page):** enter the city, and the app reports the HUD Low- and Moderate-Income Summary Data percentage for that place, whether it exceeds the 51% CDBG threshold, and how many Opportunity Zone tracts fall inside the city, with the tract numbers. Results are stored on the profile and feed fit scoring — grants that require LMI or OZ status get scored and explained using the real number instead of a checkbox.

**Project-specific (inside the draft wizard):** enter the project address or census tract; the app geocodes it, returns the tract's LMI percentage, low-income status and Opportunity Zone designation, and offers a ready-to-paste sentence with the tract ID and data vintage for the Statement of Need. That finding attaches to the draft as evidence and can satisfy an LMI or distressed-area requirement in the evidence map.

If HUD's service is unavailable, the app says so plainly and lets you enter the figure manually rather than silently omitting it.

---

## Technical notes

- New `src/lib/grants/evidence.ts` (types, coverage matching, status rules) and an AI-backed `extractRequirements` server function in `src/lib/grants.functions.ts`, alongside the existing `extractChecklist`. Requirement extraction is one AI call per grant, cached with the draft.
- `SavedChecklistItem` and `SavedDraft` in `src/lib/local-drafts.ts` gain the new fields with backward-compatible defaults in `normalize()`, so existing drafts keep working.
- HUD lookups run through a new server function hitting HUD's public ArcGIS layers (LMISD by place and by tract, Opportunity Zone tracts) plus the Census geocoder for addresses; responses cached in memory like the federal grant feed. No API key required.
- `CityProfile` gains a `hudFindings` block; `src/lib/grants/fit.ts` reads it so LMI/OZ-dependent grants score off real data.
- New wizard step in `src/routes/grants.$id.draft.tsx`; `src/lib/export.ts` gains the coverage and document-packet appendices.

## Sequencing

1. Requirement extraction + evidence map step and export appendix
2. Checklist item structure, requirement linking, document request packet
3. HUD citywide lookup on the profile + fit scoring integration
4. HUD project-address lookup in the wizard, wired into the evidence map
