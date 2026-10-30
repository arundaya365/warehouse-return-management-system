# UX Contract

## Scope and product context
Incremental contract for shared warehouse navigation and local-trial information, created from the existing app. Audience: Indonesian warehouse operators; secondary English locale. Target WCAG 2.2 AA for touched controls. Server authorization, data mutations and existing claim lifecycle are outside this visual change.

## Business-context sources
- README.md: warehouse inspection and reporting jobs.
- src/types/account.ts and AccountContext.tsx: existing UI permission visibility (not server authorization).
- server.ts, src/db/schema.ts and local-trial setup: storage facts.

## Visual contract
DESIGN.md mirrors canonical src/index.css variables. Changed consumers: Navbar.tsx and App.tsx. Keep existing report/form internals unchanged. Light theme only in this scope.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Navigation | src/components/Navbar.tsx | This contract | permission-filtered modules | browser narrow, desktop, keyboard |
| Scrollbar | src/index.css | DESIGN.md | table overflow geometry | browser computed style |
| Locale | src/context/LanguageContext.tsx | existing ID/EN state | ID / EN | browser toggle |
| Disclosure | native details/summary | this contract | storage note / claim breakdown | keyboard and pointer |
| Connection status | src/services/dataSyncService.ts | existing SyncState | idle / syncing / synced / error / offline | browser error + retry |

## Behavior
Navigation buttons expose aria-current=page. No nested interactive badge targets; counts are descriptive. Preserve permissions and tab destinations. User profile is a native button. Locale buttons expose aria-pressed. Connection text describes reachability, not transaction durability; failed reachability offers Retry. Storage details remain available with no overlay or disruptive banner. Menu changes never mutate records. Native disclosure is keyboard accessible and does not trap focus.

## Legacy migration boundary
Table selection, forms, destructive confirmations, search, toasts and async CRUD within existing screens have not been standardized by this shell change. Their implementation is not a newly approved behavior contract. Audit findings there must remain visible as backlog; do not rewrite this document to waive them. No table, date, select, form, or CRUD owner is introduced in this change.

## Verification
Run npm run lint and npm run build; strict skill audit; real-browser dashboard and database screens, narrow layout, ID/EN, keyboard focus, disclosure open/closed and connection error/retry. No destructive records or credentials are changed for visual verification.


## Marketplace -> logistics claim contract (29 October 2026)
Authority: user's explicit workflow: CS appeals to the marketplace; after failure, RMA appeals to logistics.
- Canonical business predicates and settlement deduplication: src/utils/claimWorkflow.ts.
- CS is marketplace-only. New records start in draft; damage alone does not prove submission or rejection.
- One outcome form per order and one handover action per order. Inline payout/status inference and duplicate export/transfer entry points are removed from the visible workflow.
- Handover is allowed only after all damaged goods have a recorded terminal marketplace decision and at least one rejected item. Only rejected items are sent; approved items retain their marketplace recovery. Partial/unknown decisions must be clarified first.
- Handover includes carrier, rejection reason, marketplace ticket, and manual claim estimate. No invented ticket numbers or default prices.
- CS saves the combined payload once before updating visible ownership. RMA saves wait for server success; failed saves preserve the form. Trial server returns failure when claim database persistence fails.
- RMA stages: waiting for RMA, logistics appeal, completed with explicit actual payout and resolution note. Zero is valid and means no payout; completion does not imply success. Legacy CS-stage records remain readable and explicitly labeled.
- Canonical and legacy aliases count once in dashboard money totals; only explicitly recorded payouts count as recovery.
- RMA correction-back-to-CS is not exposed in the normal workflow, preventing the two teams' queues from cycling.
- This is claim recordkeeping and evidence preparation; no automated external submission occurs.
- Ownership: native selects remain the established platform-owned popup for claim status/carrier filters. The shared ClaimFlowNotice owns the explanatory flow copy. Existing unrelated forms remain a separate migration scope.
Verification: tests/claimWorkflow.test.ts plus a generated QA order exercised in the live local browser through rejection, handover, zero-payout completion, and close/reopen persistence. Generated QA records removed afterward.

## Extended claim review and settlement contract
- Terminal marketplace decisions include partial approval. Forward only the uncovered amount; retain approved amounts and actual payments in marketplace records.
- RMA explicitly accepts, reviews evidence, requests missing evidence while keeping ownership, then records eligible or ineligible with reasons.
- Eligible claims proceed through logistics draft, submission, waiting, decision, and closure. Server enforces transitions and required evidence/ticket fields.
- Approval and actual cash are distinct. Partial payments remain visible; closure with an unpaid balance needs an explicit reason.
- RMA history is visible in the edit dialog. No automated external submission.
- Verification: 19 passing unit tests, HTTP integration and database reopen persistence; generated QA case removed. Browser verification limited by unavailable browser control. Existing UI audit backlog remains open.

## Consolidated operational actions
- Reports owns one download disclosure with filtered per-order, per-SKU and custom-filter variants. CS owns one filtered claim export.
- Navbar owns operator disclosure: read-only identity, switch operator and logout. Account administration remains a separate permission-controlled module.
- RMA transition choices derive from RMA_TRANSITIONS in claimWorkflow.ts, also consumed by server validation. Only current-stage edits and legal next actions appear. Grouped queues use rmaQueue; detailed status selection resets the group to avoid contradictory filters.
- Only the explicit disclosure control expands CS/RMA case details. Destructive CS deletion lives in the admin-only secondary disclosure and retains the existing confirmation.
- Google Drive email configuration never authenticates or unlocks scanning. Readiness requires a Google identity and a successful Drive token probe. Network/probe failures cannot report a verified session. User login still occurs in Google's own permission flow.
- Same primary/neutral/danger meaning across modules. Native selects retain accepted platform popup ownership. Legacy form validation and unrelated dialog migration remain open audit findings, not waived by this change.

## Report filter popup (30 October 2026)
ReportsView owns a native modal dialog opened by Filter laporan. Existing filters update results immediately; closing by Escape, X or Tampilkan hasil preserves the filter state. Native showModal owns focus containment, background inertness and focus restoration; body scrolling is locked while open. The dialog scrolls internally with a persistent footer. Download stays on the report toolbar. Active-filter count, matching rows, and reset remain visible outside the popup.

## Single report controls and values (30 October 2026)
ReportsView owns the only report filter popup and export menu. View mode is controlled by ReportsView and selected in the same popup. ResultViewer receives hideToolbar and reportViewMode in Reports; sibling consumers retain their existing controls. Reports no longer opens a second custom export filter. Local table search is hidden in this context so downloads, totals and visible rows share the same filtered dataset.
Value uses current master SKU HARGA, matched by SKU/barcode; each existing report row represents one unit, following established quantity calculations. Missing/invalid prices remain unknown and are counted explicitly. A known zero price remains zero. Value terdata is an estimate from current master data, not historical transaction value or claim cash received. Values appear in summaries, order cards, SKU tables, and order/SKU CSVs.
Verification: TypeScript and build passed; 23 unit tests passed, including value lookup, quantity totals, missing-price and zero-price handling. No database records changed. Interactive browser review of this change remains pending.

## Reporting-only dashboard (30 October 2026)
Explicit user decision: Dashboard is a reporting surface. Remove header export/unboxing/RMA actions, the duplicate recovery banner, and in-dashboard module navigation buttons. Preserve KPI values, charts, reporting period controls, summaries and read-only report detail. Main Navbar remains the owner of module navigation. No claim/return records or calculations changed.

## Indonesian interface wording (30 October 2026)
Use clear Indonesian labels: pengajuan banding, draf, nilai barang, dana diterima, pemeriksaan retur and barang dipindai. Keep SKU, AWB, CS, RMA and marketplace as operational terms. Approved amounts and cash received must never share an ambiguous label; closed cases must not imply full payment. Master-price estimates remain estimates. This wording pass changes display copy only; stored status/condition keys and calculation rules remain unchanged.

## Dashboard analytics redesign — 30 October 2026
Latest explicit specification supersedes the no-export dashboard rule. UI owners: Navbar, DashboardView, dashboard/MetricCard, PeriodFilter, ChartPanel and DashboardControls. CSS owners: src/index.css semantic tokens/shared shell and dashboard/dashboard.css page rules. Shared business helpers: dashboardReport.ts reuses reportValue and claimWorkflow. All new interface copy is Indonesian.
A preset covers7/30 inclusive calendar days in Asia/Jakarta; custom start/end validates before commit (max366 days for a bounded chart). Previous period has equal inclusive duration. All metrics, daily chart and CSV use the same applied range. Counts/value deltas neutral; higher damage adverse in percentage points; no infinite delta for zero baseline. Missing-price coverage suppresses estimated-value comparison. Actual recorded claim receipts are grouped by return-date cohort, never approval amount or payment-date throughput.
Production uses App's existing synced rows, master and claims. Separate opt-in dashboard-demo=1 fixture is labeled Data demo and never saved. dashboard-state=loading/updating/empty/error/offline are preview-only state selectors. Real retry calls syncService.syncPull. Cached data shown during failure is marked stale; unavailable values are dashes, not confirmed zeros. Zero-day bars are not colored. Daily chart can scroll horizontally inside its own holder, with44px interactive targets and a complete daily table. Native modal controls restore focus; native menus close on Escape/outside click.
Verification: 29 unit tests and build/typecheck pass before final copy fix; final commands recorded in outputs guide. Independent checker found5 issues and they were fixed, then remaining availability note fixed. Heading calibration used an isolated file copy outside checkout; it proved h1 detection only, not runtime/imports. Browser inspection was stopped by the user's physical Escape; desktop/tablet/phone, gestures, keyboard and reduced-motion runtime matrix remains unverified.

## Full-label navigation override — 30 October 2026
Latest user request replaces the four-primary/Lainnya arrangement. All existing permissioned modules render directly in the desktop navigation at widths >=1024px. Header uses two levels: compact brand/account, then wrapping complete labels. Labels14px minimum, ink foreground, active bold/indigo plus3px inset underline. No ellipsis, icon-only replacement, horizontal navigation scrolling, or desktop Lainnya. Tablet/mobile has a visible Menu label opening all complete labels in a vertically scrollable panel. Existing permission checks remain. Escape closes and restores summary focus; module selection closes the panel and restores focus. Hover/active transitions180ms; reduced motion remains supported.
