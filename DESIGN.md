---
version: alpha
name: Unboxin warehouse trial
description: A quiet operational console for warehouse return inspection.
colors:
  primary: '#4F46E5'
  foreground: '#0F172A'
  muted: '#64748B'
  background: '#F8FAFC'
  surface: '#ffffff'
  border: '#E2E8F0'
  danger: '#DC2626'
typography:
  sans:
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
  mono:
    fontFamily: "'Cascadia Mono', Consolas, monospace"
rounded:
  DEFAULT: '10px'
omitted:
  - section: spacing
    reason: Existing Tailwind spacing remains canonical; shell geometry is documented below.
components:
  navigation:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.muted}'
  action:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.foreground}'
---

# Unboxin design context

## Overview
Product/admin console for Indonesian warehouse operators inspecting returns on a laptop and reviewing reports on smaller screens. The 30 October redesign uses an indigo analytics workspace. All permissioned modules are directly visible on a dedicated desktop navigation row; tablet and phone expose the same full labels through Menu. Avoid floating decorative objects and marketing hero treatments in authenticated workspaces. The redesigned dashboard and shared navigation use Indonesian; LanguageContext remains for legacy screens. No Japan-market scope.

Business evidence: README.md describes return inspection, SKU master data and claims; src/types/account.ts defines existing UI permissions; server.ts and src/db/schema.ts define storage behavior. This change does not establish new security policy or alter domain transitions.

## Colors
Runtime CSS in src/index.css remains canonical (model B). Colors above map respectively to --warehouse-brand, --warehouse-ink, --warehouse-muted, --warehouse-bg, --warehouse-surface, --warehouse-border and --warehouse-danger. Navbar and App shell consume those variables through warehouse-* classes; unchanged content continues using established Tailwind utilities. Error status includes text, never color alone.

## Typography
Sans maps to --warehouse-body-font, mono to --warehouse-data-font. Use sans for controls and headings, mono only for counts. Preserve readable wrapping for long company names. Existing report and dashboard typography remains unchanged.

## Layout
Document owns vertical scrolling. Header uses a logo/account topbar and a dedicated wrapping full-label navigation row from 1024px. Below 1024px, Menu opens the vertically scrollable complete navigation panel. Below 520px actions occupy their own row and header is not sticky. Never clip or hide primary navigation. Main content stays at the existing 1280px maximum. Tables retain their own horizontal overflow. No viewport-height restrictions on forms.

## Elevation & Depth
Opaque white header and quiet gray workspace. One subtle header shadow; preserve existing content cards. No decorative motion in authenticated shell.

## Shapes
Shared shell controls map rounded.DEFAULT to --warehouse-control-radius. Selected navigation uses background, border, and underline. Existing cards keep their established shapes.

## Components
Navbar owns module navigation, operator actions, locale controls and connection status. Status subscribes to dataSyncService and does not claim every write has persisted. App owns the compact native disclosure explaining local-trial storage. Disclosure is not a modal. Global stylesheet owns visible scrollbars, keyboard focus, forced-colors and reduced-motion support. Both ID and EN shell strings follow LanguageContext.

## Do's and Don'ts
Keep every available module visible at narrow widths. Preserve permission visibility, counts and click destinations. Never call a cloud connection active without evidence. Preserve data and filters during shell-only visual changes. Video is separate; synchronized CS/RMA claims are included in the local database backup. ClaimFlowNotice shares the same restrained teal surface across both claim screens.

## Operational button consolidation (29 October 2026)
Shared operational control geometry and menu surfaces are owned by src/index.css (.warehouse-button, .warehouse-action-menu, .warehouse-menu-panel). Use existing runtime palette and radius tokens. Keep dangerous operations inside a labelled secondary disclosure; one primary action per case. Native details/summary owns disclosure keyboard semantics. Navbar installs one shared Escape/outside-click dismissal with summary focus restoration.


## Analytics redesign — 30 October 2026
Explicit latest user request overrides the earlier teal dashboard and reporting-only/no-export decisions. The dashboard owns one compact header, one period selector, five metric cards, and one daily chart panel. No operation shortcuts or decorative hero. Navbar keeps existing permissioned modules with Dashboard/Unboxing/Laporan/Klaim RMA primary, others in Lainnya; mobile uses a keyboard-operable disclosure.

Runtime theme remains canonical in src/index.css: --dashboard-bg #F8FAFC, --dashboard-surface #FFFFFF, --dashboard-ink #0F172A, --dashboard-muted #64748B, --dashboard-brand #4F46E5, --dashboard-success #15803D, --dashboard-warning #B45309, --dashboard-danger #DC2626, --dashboard-border #E2E8F0. Warehouse shell tokens alias dashboard tokens. Legacy content interiors remain their own migration scope. Dashboard radius16px, controls12px; system sans with optional locally available Inter; no new font network dependency. Spacing tokens use a4px base. Metric values32px, responsive30/32 and wrapping; body13px, captions11–12px.

First-mount opacity/<=8px entrance300ms, metric stagger50ms, chart500ms. Controls180ms specific properties, active .98, fine-pointer hover metric-2px. Menu150ms offset4px. Reduced motion disables motion and shimmer. No replay on filter/sync updates. Native date dialog is accepted platform-owned calendar; focus containment and background inertness use showModal.

## Navigation readability — latest override
At desktop widths >=1024px, all permissioned modules appear on a dedicated second row under brand/account; flex-wrap is allowed instead of hidden links. Labels use14px, full text, and no truncation. Tablet/phone use a clearly labelled Menu disclosure with vertical scrolling and the same full item labels. This explicit user decision supersedes earlier four-primary navigation and Lainnya notes. Other dashboard tokens and structure remain unchanged.

