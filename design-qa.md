# ChainScope UI design QA

Final result: **passed** for the requested UI-only redesign.

## Contract and reference

The final source of product content is repository commit `cf0c1bb894a7b1cf97f9d54a6995faf6bfbe979a`. The selected visual direction is option 1, a silver/white and cobalt investigation workspace. The redesign started from `a2b3eba`; the subsequent upstream address-context verification feature has been integrated without changing its business logic.

Reference image (local):
`C:/Users/CHENZHELONG/.codex/generated_images/01a114f6-6558-7be0-a59e-398ea65bc944/exec-cdea7905-5c10-494d-8abc-54dc7fef9c9a.png` (1487 × 1058).

The concept's illustrative amounts, example graph data, and overview evidence table are not product requirements. The implementation preserves the original overview panels, four metric calculations, trace tab, report, evidence, bilingual copy, and render conditions. Layout and typography therefore follow the selected style while contents follow the repository.

## Visual evidence

Screenshots are local QA artifacts in `qa/screenshots/` and excluded from Git:

- `overview-desktop.jpg`, `trace-desktop.jpg`
- `overview-mobile.jpg`, `trace-mobile.jpg`
- `report-desktop.jpg`, `evidence-desktop.jpg`
- `report-mobile-en.jpg`, `evidence-mobile-en.jpg`
- `home-production.jpg`
- `overview-verification-desktop.jpg`, `overview-verification-mobile-en.jpg` (latest upstream content)
- `overview-desktop-comparison.jpg`, `trace-desktop-comparison.jpg`, `trace-detail-comparison.jpg`

Desktop viewport: 1488 × 1056 CSS pixels. Mobile viewport: 390 × 844 CSS pixels. Device pixel ratio: 1. Desktop full-page images can have a 16px scrollbar width difference. Comparisons use a centered 1472px-wide crop of reference and implementation, the first 1056px of the page, with no stretching. The trace detail comparison uses natural-size focused crops.

Result screens use the isolated synthetic fixture in `qa/review-fixture.ts`, processed through the original analysis functions. This fixture is never imported by production code. A temporary review route used for visual checks has been removed. The production homepage is the actual final build.

## Findings and fixes

| Finding | Change | Post-fix evidence |
| --- | --- | --- |
| English hero words ran together across styled spans | Added a typographic space without changing words | English mobile report screenshot; bilingual content check |
| Some secondary labels were too pale | Darkened muted and metadata text colors; cobalt button white contrast approximately 5.8:1 | Final desktop and mobile captures |
| Desktop type hierarchy was undersized relative to the selected direction | Increased navigation, metric labels, section headings, body text, and results hero; widened sidebar | Final overview and trace comparisons |
| Trace needed clear direction while retaining original content | Horizontal arrow connectors on desktop and vertical connectors on mobile | Desktop trace and mobile trace screenshots |

Inspected spacing, typography, surface color, icon consistency, trace connectors, original text/data, focus styles, and responsive behavior. No remaining actionable visual issue within the requested scope was found in the inspected views. This is not an exhaustive accessibility certification.

## Interaction and content checks

- All four tabs, Chinese/English switching, report markdown, and evidence disclosure controls checked in the browser.
- Desktop and mobile overview/trace; English mobile report/evidence checked without horizontal overflow.
- Original first-30 evidence row behavior and six-counterparty trace limit retained.
- Final production server homepage returned HTTP 200, rendered successfully, preserved both original invalid-address messages, and showed no console errors.
- Final production homepage document scroll width and viewport width both 1488px.
- Viewport override reset after testing.
- `node qa/verify-content.mjs`: passed 32 combinations of language × tab × populated/empty/loading/initial state. This compares business text against the pinned original Dashboard and checks that controller, API, and library files are unchanged.
- Final verification against the latest upstream Dashboard passes **38** cases: the above 32 plus all three cause-verification statuses in Chinese and English. Browser checks additionally confirm the new validation evidence in the desktop overview and English mobile overview, with no horizontal overflow or console errors.

## Build and scope checks

Passed:

- `npm run build`
- `npx tsc --noEmit`
- `npx eslint components/chain/Dashboard.tsx qa/review-fixture.ts qa/verify-content.mjs`
- `node qa/verify-content.mjs`

Full `npm run lint` reports 13 existing backend `any` errors: one in `app/api/address-context/route.ts:163` and twelve in `app/api/investigate/route.ts`, plus the existing unused `balance` warning at `app/page.tsx:39`. These files exactly match the latest upstream commit; the UI patch does not modify them. The original Dashboard's nine `any` lint errors were eliminated by typing the presentation helpers.

Live chain fetching and the DeepSeek report flow were not revalidated because local API credentials were not configured. Their original code is unchanged. Production Vercel was not deployed as part of this review.

Runtime changes are limited to `components/chain/Dashboard.tsx`, `app/globals.css`, and the Phosphor icon dependency/lockfile. QA artifacts are separate from runtime.
