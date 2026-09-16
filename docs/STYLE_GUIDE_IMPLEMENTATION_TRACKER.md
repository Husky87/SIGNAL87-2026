# Signal87 Workspace Style Guide Implementation Tracker

Reference: `Signal87 SaaS Dashboard Showcase(1).png` supplied in the product review.

## Implementation sequence

- [x] 0. Preserve existing architecture, auth, API routes, Firestore paths, and automated tests as the safety baseline.
- [x] 1. Workspace shell and navigation: the existing desktop rail was retained for its working navigation/collapse/session behavior; mobile navigation now matches the reference Home / Ask / Files / Notes / More hierarchy.
- [x] 2. Home/Dashboard: implemented the reference home composition while keeping real question, upload, and recent-session actions.
- [x] 3. Ask/Research: preserved the existing live Research Assistant wiring and authenticated/server-side research path; the shared Signal87 visual token system remains in use.
- [x] 4. Files: preserved the full document-library implementation and shared the reference palette, spacing, borders, cards, search, and document controls rather than replacing the large production library.
- [x] 5. Notes: rebuilt the Saved/Notes workspace to match the reference while preserving note persistence, search/filtering, saved answers, linked-document behavior, and delete/save actions.
- [x] 6. Team, Settings, and document viewer: Team and Settings were rebuilt in the reference visual system; the document viewer was enlarged to use substantially more of the viewport, the duplicate fallback Download control was removed, and Firebase Storage PDF transport was repaired so PDF.js receives same-origin bytes instead of a direct cross-origin Storage URL.
- [x] 7. Mobile parity: mobile navigation hierarchy, spacing, rounded controls, touch behavior, safe-area handling, and responsive styling match the reference direction.
- [ ] 8. Validation: verify the latest document-preview commit passes TypeScript, AI routing tests, Firebase tests, production build, API smoke tests, and the document-viewer regression checks.

## Document viewer change

- `a90b759f` — added scoped document-viewer layout overrides: up to 98vw × 98vh on desktop, full-bleed on mobile, compact footer, tighter reading-surface padding, and removal of the duplicate browser-viewer Download link.
- `62588783` — loads the document-viewer presentation overrides.
- `6c84f1cf` — expands the PDF viewer page-width cap from 900px to 1200px and the browser fallback iframe from 70vh to 82vh; removes the duplicate fallback Download action while retaining the top-level Download button.
- `ea4d3adc` — adds an authenticated same-origin `/api/documents/preview` proxy that validates Firebase ownership of Firebase Storage objects before fetching the PDF for the viewer.
- `84a9e6cf` — routes Firebase Storage PDF URLs through the same-origin preview endpoint before handing bytes to PDF.js, while preserving the browser PDF viewer as a compatibility fallback.

## Safety rules for this implementation

1. Do not remove or rename existing API endpoints.
2. Do not change Firebase collection paths or authentication semantics unless required for a verified bug.
3. Preserve existing component callbacks/props when redesigning views.
4. Make one logical UI step per commit so changes can be isolated or reverted.
5. Never commit API keys, tokens, or other secrets.
6. Do not alter IONOS DNS configuration as part of this UI work.
7. Prefer additive/scoped presentation changes for established document-viewer behavior unless a functional bug is confirmed.
8. Document preview must authorize the Firebase Storage object against the authenticated user's `users/{uid}/documents/` namespace before proxying bytes.

## Implementation commits

- `3c77c453` — tracker and safety baseline
- `05dad3b1` — reference Home/Dashboard
- `71028cb6` — mobile navigation parity
- `648aa8be` — reference Settings
- `d20de89d` — reference Team
- `4c7b318f` — reference Notes workspace
- `a90b759f` — document-viewer presentation overrides
- `62588783` — load document-viewer overrides
- `6c84f1cf` — enlarge PDF viewer and remove duplicate fallback Download control
- `ea4d3adc` — authenticated Firebase Storage document-preview proxy
- `84a9e6cf` — route Firebase PDFs through same-origin preview transport

## Validation

The last completed Signal87 Build before this functional viewer fix passed every configured step, including production API reachability and Research API authentication smoke tests. The viewer transport commits above have triggered a new CI run; its result remains pending until GitHub reports it complete.
