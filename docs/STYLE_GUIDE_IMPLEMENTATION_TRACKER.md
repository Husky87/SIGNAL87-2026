# Signal87 Workspace Style Guide Implementation Tracker

Reference: `Signal87 SaaS Dashboard Showcase(1).png` supplied in the product review.

## Implementation sequence

- [x] 0. Preserve existing architecture, auth, API routes, Firestore paths, and automated tests as the safety baseline.
- [x] 1. Workspace shell and navigation: the existing desktop rail was retained for its working navigation/collapse/session behavior; mobile navigation now matches the reference Home / Ask / Files / Notes / More hierarchy.
- [x] 2. Home/Dashboard: implemented the reference home composition while keeping real question, upload, and recent-session actions.
- [x] 3. Ask/Research: preserved the existing live Research Assistant wiring and authenticated/server-side research path; the shared Signal87 visual token system remains in use.
- [x] 4. Files: preserved the full document-library implementation and shared the reference palette, spacing, borders, cards, search, and document controls rather than replacing the large production library.
- [x] 5. Notes: rebuilt the Saved/Notes workspace to match the reference while preserving note persistence, search/filtering, saved answers, linked-document behavior, and delete/save actions.
- [x] 6. Team, Settings, and document viewer: Team and Settings were rebuilt in the reference visual system; the established document viewer/PDF infrastructure was retained because it already uses the shared workspace tokens and preserves viewer/export behavior.
- [x] 7. Mobile parity: mobile navigation hierarchy, spacing, rounded controls, touch behavior, safe-area handling, and responsive styling match the reference direction.
- [x] 8. Validation: latest completed GitHub Actions build (#132) passed TypeScript, AI routing tests, Firebase AI fallback tests, production build, production API reachability, and Research API authentication smoke test.

## Safety rules for this implementation

1. Do not remove or rename existing API endpoints.
2. Do not change Firebase collection paths or authentication semantics unless required for a verified bug.
3. Preserve existing component callbacks/props when redesigning views.
4. Make one logical UI step per commit so changes can be isolated or reverted.
5. Never commit API keys, tokens, or other secrets.
6. Do not alter IONOS DNS configuration as part of this UI work.

## Implementation commits

- `3c77c453` — tracker and safety baseline
- `05dad3b1` — reference Home/Dashboard
- `71028cb6` — mobile navigation parity
- `648aa8be` — reference Settings
- `d20de89d` — reference Team
- `4c7b318f` — reference Notes workspace

## Validation

The latest completed Signal87 Build workflow (#132) passed every configured step, including the production API reachability and unauthenticated Research API authentication smoke tests.
