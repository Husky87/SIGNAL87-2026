# Signal87 Workspace Style Guide Implementation Tracker

Reference: `Signal87 SaaS Dashboard Showcase(1).png` supplied in the product review.

## Implementation sequence

- [x] 0. Preserve existing architecture, auth, API routes, Firestore paths, and automated tests as the safety baseline.
- [ ] 1. Workspace shell and navigation: align desktop/mobile shell, navigation hierarchy, spacing, typography, and active states.
- [ ] 2. Home/Dashboard: implement the reference home composition while keeping real question, upload, and recent-session actions.
- [ ] 3. Ask/Research: align the Ask workspace UI and keep the existing authenticated `/api/research` and `/api/chat` pathways intact.
- [ ] 4. Files: align the document library with the reference Files view without changing Firestore/document operations.
- [ ] 5. Notes: present Saved/Notes as the reference Notes workspace while preserving existing note persistence and answer-saving behavior.
- [ ] 6. Team, Settings, and document viewer: align these screens with the reference visual system while preserving their existing functionality.
- [ ] 7. Mobile parity: ensure the mobile dock, responsive spacing, and touch behavior use the same visual system.
- [ ] 8. Validation: GitHub Actions, build, existing E2E/static tests, production route checks, and manual end-to-end Research Assistant test.

## Safety rules for this implementation

1. Do not remove or rename existing API endpoints.
2. Do not change Firebase collection paths or authentication semantics unless required for a verified bug.
3. Preserve existing component callbacks/props when redesigning views.
4. Make one logical UI step per commit so changes can be isolated or reverted.
5. Never commit API keys, tokens, or other secrets.
6. Do not alter IONOS DNS configuration as part of this UI work.

## Current baseline

Last known green GitHub Actions workflow before the style implementation: Signal87 Build #125.
