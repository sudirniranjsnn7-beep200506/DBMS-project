## Description
<!-- Provide a clear, concise description of the motivation and objective of this pull request. -->

## Changes Proposed
<!-- List high-level architectural and technical modifications made in this PR. -->
- 

## How to Test
<!-- Detail step-by-step reproduction instructions or testing commands. -->
1. Run linting: `npm run lint`
2. Run unit & integration test suites: `npm run test`
3. Run Playwright E2E journeys: `npm run test:e2e`
4. Run secret scanner: `npm run check:secrets`

## Verification Checklist
- [ ] **No Secrets Committed:** Verified that `.env`, private keys, API tokens, or credentials are not included.
- [ ] **Database Architecture:** If schema or models changed, the ER diagram and documentation have been updated accordingly.
- [ ] **Automated Testing:** All unit, integration, and E2E tests pass with 100% success rate.
- [ ] **Static Analysis:** `npm run lint` completes with zero TypeScript and linting errors.
- [ ] **Commit Convention:** Follows Conventional Commits standard (`feat:`, `fix:`, `docs:`, `chore:`, etc.).
- [ ] **Documentation:** Relevant markdown specs in `/docs` and Swagger annotations updated.
